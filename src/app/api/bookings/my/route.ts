import { db } from "@/lib/db";
import { ok, handler } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { sweepStalePendingBookings } from "@/lib/booking";

// GET /api/bookings/my — current user's bookings (newest first)
export const GET = handler(async () => {
  const user = await requireAuth();
  await sweepStalePendingBookings();

  const bookings = await db.booking.findMany({
    where: { userId: user.id },
    include: {
      seats: true,
      payment: { select: { status: true, provider: true, amount: true } },
      tickets: { select: { id: true, code: true, status: true, rowLabel: true, seatNumber: true } },
      show: {
        include: {
          movie: { select: { title: true, posterUrl: true, durationMins: true, certification: true } },
          auditorium: { include: { theatre: { select: { name: true, city: true } } } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return ok({ bookings });
});
