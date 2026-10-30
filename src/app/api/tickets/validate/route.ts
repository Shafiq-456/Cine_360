import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, handler, parseBody, HttpError, audit } from "@/lib/api";
import { requireAuth } from "@/lib/auth";

const schema = z.object({
  code: z.string().trim().min(8).max(64),
  action: z.enum(["check", "redeem"]).default("check"),
});

// POST /api/tickets/validate — staff scanner: verify authenticity, check status, redeem once.
export const POST = handler(async (req: NextRequest) => {
  const staff = await requireAuth(["STAFF", "OWNER", "ADMIN"]);
  const body = await parseBody(req, schema);

  const ticket = await db.ticket.findFirst({
    where: { OR: [{ code: body.code }, { id: body.code }] },
    include: {
      booking: {
        include: {
          user: { select: { name: true, email: true } },
          show: {
            include: {
              movie: { select: { title: true } },
              auditorium: { include: { theatre: { select: { id: true, name: true } } } },
            },
          },
        },
      },
      validations: { orderBy: { createdAt: "desc" }, take: 3 },
    },
  });
  if (!ticket) {
    await audit({ actorId: staff.id, actorEmail: staff.email, action: "TICKET_SCAN_INVALID", entity: "Ticket", entityId: body.code, meta: { result: "INVALID" } });
    throw new HttpError("Ticket not found — this QR code is not a valid CINE 360 ticket", 404);
  }

  const show = ticket.booking.show;

  // Ticket must belong to a show at the staff member's theatre (staff scope)
  if (staff.role === "STAFF") {
    const isStaffHere = await db.theatreStaff.findFirst({
      where: { userId: staff.id, theatreId: show.auditorium.theatre.id },
    });
    if (!isStaffHere) {
      await audit({ actorId: staff.id, actorEmail: staff.email, action: "TICKET_SCAN_WRONG_THEATRE", entity: "Ticket", entityId: ticket.id });
      throw new HttpError("This ticket belongs to a different theatre", 403);
    }
  }

  if (ticket.status === "VOID") {
    return ok({ result: "VOID", detail: "Ticket was voided (booking refunded/cancelled). Do not admit.", ticket });
  }

  if (ticket.status === "REDEEMED") {
    await db.ticketValidation.create({
      data: { ticketId: ticket.id, validatedById: staff.id, result: "ALREADY_REDEEMED", detail: `First redeemed ${ticket.redeemedAt?.toLocaleString("en-IN")}` },
    });
    await audit({ actorId: staff.id, actorEmail: staff.email, action: "TICKET_SCAN_DUPLICATE", entity: "Ticket", entityId: ticket.id, meta: { result: "ALREADY_REDEEMED" } });
    return ok({ result: "ALREADY_REDEEMED", detail: "This ticket was already redeemed. Refuse duplicate entry.", firstRedeemedAt: ticket.redeemedAt, ticket });
  }

  if (body.action !== "redeem") {
    // check-only: report validity without redeeming
    return ok({ result: "VALID", detail: "Ticket is genuine and ready for redemption.", ticket });
  }

  const redeemed = await db.ticket.updateMany({
    where: { id: ticket.id, status: "VALID" },
    data: { status: "REDEEMED", redeemedAt: new Date(), redeemedById: staff.id },
  });
  if (redeemed.count === 0) {
    return ok({ result: "ALREADY_REDEEMED", detail: "Redeemed by another scanner moments ago.", ticket });
  }

  await db.ticketValidation.create({
    data: { ticketId: ticket.id, validatedById: staff.id, result: "SUCCESS", detail: `Row ${ticket.rowLabel} · Seat ${ticket.seatNumber}` },
  });
  await audit({
    actorId: staff.id, actorEmail: staff.email,
    action: "TICKET_REDEEMED", entity: "Ticket", entityId: ticket.id,
    meta: { bookingRef: ticket.booking.reference, row: ticket.rowLabel, seat: ticket.seatNumber },
  });

  return ok({ result: "SUCCESS", detail: "Ticket redeemed. Admit the guest.", ticket });
});
