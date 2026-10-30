// Booking transactions: booking creation from a hold, confirmation on payment,
// cancellation + seat release, pending-booking sweeping.
import { db } from "./db";
import { SEAT_STATUS, generateBookingReference } from "./constants";
import { HttpError } from "./api";
import { expireStaleHolds } from "./inventory";
import { emitShowInventoryChanged } from "./events";
import { randomUUID } from "crypto";

/** Creates a PENDING_PAYMENT booking from an ACTIVE hold (seats stay HELD → immune to hold expiry). */
export async function createBookingFromHold(params: { holdId: string; userId: string }) {
  await expireStaleHolds();
  const hold = await db.seatHold.findUnique({ where: { id: params.holdId } });
  if (!hold) throw new HttpError("Seat hold not found", 404);
  if (hold.userId !== params.userId) throw new HttpError("This hold belongs to another user", 403);
  if (hold.status === "CONVERTED") throw new HttpError("This hold was already used for a booking", 409);
  if (hold.status === "EXPIRED" || hold.expiresAt.getTime() < Date.now()) {
    throw new HttpError("Your seat hold has expired. Please select seats again.", 410);
  }

  const booking = await db.$transaction(async (tx) => {
    const held = await tx.showSeat.findMany({
      where: { holdId: hold.id, status: SEAT_STATUS.HELD },
      include: { seat: { include: { category: true } } },
    });
    if (held.length === 0) throw new HttpError("No held seats found for this hold", 409);

    const total = held.reduce((sum, s) => sum + s.price, 0);
    let created: { id: string; reference: string } | null = null;
    for (let attempt = 0; attempt < 5 && !created; attempt++) {
      try {
        created = await tx.booking.create({
          data: {
            reference: generateBookingReference(),
            userId: params.userId,
            showId: hold.showId,
            holdId: hold.id,
            totalAmount: total,
            status: "PENDING_PAYMENT",
          },
          select: { id: true, reference: true },
        });
      } catch (e) {
        if (attempt === 4) throw e; // reference collision after retries (practically impossible)
      }
    }
    if (!created) throw new HttpError("Could not create booking", 500);

    await tx.bookingSeat.createMany({
      data: held.map((s) => ({
        bookingId: created!.id,
        showSeatId: s.id,
        rowLabel: s.seat.rowLabel,
        seatNumber: s.seat.seatNumber,
        categoryName: s.seat.category.name,
        price: s.price,
      })),
    });
    await tx.seatHold.update({ where: { id: hold.id }, data: { status: "CONVERTED" } });
    return created;
  });

  return booking;
}

/** Confirms a booking after verified payment: seats → BOOKED, tickets generated. Idempotent. */
export async function confirmBookingPaid(bookingId: string, paymentId: string) {
  return db.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      include: {
        seats: { include: { showSeat: { include: { seat: true } } } },
        payment: true,
        show: true,
      },
    });
    if (!booking) throw new HttpError("Booking not found", 404);
    if (booking.status === "CONFIRMED") return booking; // idempotent replay
    if (booking.status !== "PENDING_PAYMENT") {
      throw new HttpError(`Booking is ${booking.status.toLowerCase()} and cannot be confirmed`, 409);
    }

    // Seats must still be held for this booking's hold; otherwise the hold expired mid-payment.
    const showSeatIds = booking.seats.map((bs) => bs.showSeatId);
    const claimed = await tx.showSeat.updateMany({
      where: { id: { in: showSeatIds }, status: SEAT_STATUS.HELD },
      data: { status: SEAT_STATUS.BOOKED, updatedAt: new Date() },
    });
    if (claimed.count !== showSeatIds.length) {
      throw new HttpError(
        "Seat inventory changed during payment — booking cannot be confirmed. A refund will be issued.",
        409
      );
    }

    const updated = await tx.booking.update({
      where: { id: bookingId },
      data: { status: "CONFIRMED" },
      include: { seats: true },
    });

    // One ticket per seat; QR encodes only the opaque ticket code (no PII/payment data)
    await tx.ticket.createMany({
      data: booking.seats.map((bs) => ({
        code: `C360T-${randomUUID()}`,
        bookingId: booking.id,
        showId: booking.showId,
        seatId: bs.showSeat.seatId,
        rowLabel: bs.rowLabel,
        seatNumber: bs.seatNumber,
        status: "VALID",
      })),
    });

    await tx.seatHold.updateMany({
      where: { id: booking.holdId || "" },
      data: { status: "CONVERTED" },
    });

    return updated;
  });
}

/** Cancels a pending (unpaid) booking and releases its seats. */
export async function cancelPendingBooking(bookingId: string, reason: string) {
  const booking = await db.booking.findUnique({ where: { id: bookingId } });
  if (!booking || booking.status !== "PENDING_PAYMENT") return;
  await db.$transaction([
    db.showSeat.updateMany({
      where: { id: { in: (await db.bookingSeat.findMany({ where: { bookingId }, select: { showSeatId: true } })).map((b) => b.showSeatId) }, status: SEAT_STATUS.HELD },
      data: { status: SEAT_STATUS.AVAILABLE, holdId: null },
    }),
    db.booking.update({ where: { id: bookingId }, data: { status: "CANCELLED" } }),
  ]);
  emitShowInventoryChanged(booking.showId);
  console.log(`[booking] cancelled pending booking ${booking.reference}: ${reason}`);
}

/** Releases seats for a CONFIRMED booking (admin refund path) and voids tickets. */
export async function refundBooking(bookingId: string, actorId: string) {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: { seats: { include: { showSeat: true } }, payment: true, tickets: true },
  });
  if (!booking) throw new HttpError("Booking not found", 404);
  if (booking.status !== "CONFIRMED") throw new HttpError("Only confirmed bookings can be refunded", 409);

  await db.$transaction([
    db.showSeat.updateMany({
      where: { id: { in: booking.seats.map((bs) => bs.showSeatId) }, status: SEAT_STATUS.BOOKED },
      data: { status: SEAT_STATUS.AVAILABLE, holdId: null },
    }),
    db.ticket.updateMany({ where: { bookingId }, data: { status: "VOID" } }),
    db.payment.updateMany({ where: { bookingId }, data: { status: "REFUNDED" } }),
    db.booking.update({ where: { id: bookingId }, data: { status: "REFUNDED" } }),
  ]);
  emitShowInventoryChanged(booking.showId);
  await db.auditLog.create({
    data: {
      actorId,
      action: "REFUND_BOOKING",
      entity: "Booking",
      entityId: bookingId,
      meta: JSON.stringify({ reference: booking.reference, amount: booking.totalAmount }),
    },
  });
}

/** Sweeps pending bookings older than 45 minutes (abandoned checkouts). */
export async function sweepStalePendingBookings(showId?: string) {
  const cutoff = new Date(Date.now() - 45 * 60 * 1000);
  const stale = await db.booking.findMany({
    where: { status: "PENDING_PAYMENT", createdAt: { lte: cutoff }, ...(showId ? { show: { id: showId } } : {}) },
    select: { id: true },
  });
  for (const b of stale) await cancelPendingBooking(b.id, "payment not completed within 45 minutes");
}
