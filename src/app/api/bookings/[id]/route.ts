import { db } from "@/lib/db";
import { ok, handler, HttpError } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { ticketQRDataUrl } from "@/lib/tickets";

// GET /api/bookings/[id] — booking detail (owner or platform admin only)
export const GET = handler(async (_req, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireAuth();
  const { id } = await ctx.params;
  const booking = await db.booking.findUnique({
    where: { id },
    include: {
      seats: true,
      payment: true,
      hold: { select: { expiresAt: true } },
      tickets: true,
      user: { select: { name: true, email: true } },
      show: {
        include: {
          movie: { select: { title: true, posterUrl: true, durationMins: true, certification: true } },
          auditorium: { include: { theatre: { select: { name: true, city: true, address: true } } } },
        },
      },
    },
  });
  if (!booking) throw new HttpError("Booking not found", 404);
  if (booking.userId !== user.id && user.role !== "ADMIN") {
    throw new HttpError("You can only view your own bookings", 403);
  }

  // QR codes are generated server-side and encode only the opaque ticket code
  const ticketsWithQr = await Promise.all(
    booking.tickets.map(async (t) => ({ ...t, qrDataUrl: await ticketQRDataUrl(t.code) }))
  );

  return ok({ booking: { ...booking, tickets: ticketsWithQr } });
});
