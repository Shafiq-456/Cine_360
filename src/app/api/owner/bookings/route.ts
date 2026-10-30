import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, handler } from "@/lib/api";
import { requireOwner } from "@/lib/owner";

// GET /api/owner/bookings?showId=&status=&q=
export const GET = handler(async (req: NextRequest) => {
  const user = await requireOwner();
  const sp = req.nextUrl.searchParams;
  const status = sp.get("status");
  const showId = sp.get("showId");

  const where: Record<string, unknown> = {
    status: status || undefined,
    showId: showId || undefined,
    show: user.role === "ADMIN" ? undefined : { auditorium: { theatre: { ownerId: user.id } } },
  };

  const bookings = await db.booking.findMany({
    where,
    include: {
      user: { select: { name: true, email: true } },
      seats: true,
      payment: { select: { status: true, provider: true, method: true, orderId: true } },
      show: {
        select: {
          startsAt: true, format: true,
          movie: { select: { title: true } },
          auditorium: { select: { name: true, theatre: { select: { name: true } } } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 80,
  });
  return ok({ bookings });
});
