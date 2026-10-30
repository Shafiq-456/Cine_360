import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, handler } from "@/lib/api";
import { requireAuth } from "@/lib/auth";

// GET /api/admin/bookings?status=&q=
export const GET = handler(async (req: NextRequest) => {
  await requireAuth(["ADMIN"]);
  const status = req.nextUrl.searchParams.get("status") || undefined;
  const bookings = await db.booking.findMany({
    where: { status },
    include: {
      user: { select: { name: true, email: true } },
      seats: true,
      payment: { select: { status: true, provider: true, orderId: true, method: true } },
      show: {
        select: {
          startsAt: true,
          movie: { select: { title: true } },
          auditorium: { select: { name: true, theatre: { select: { name: true, city: true } } } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return ok({ bookings });
});
