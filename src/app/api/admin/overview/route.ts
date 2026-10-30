import { db } from "@/lib/db";
import { ok, handler } from "@/lib/api";
import { requireAuth } from "@/lib/auth";

// GET /api/admin/overview — platform-wide metrics from real data
export const GET = handler(async () => {
  await requireAuth(["ADMIN"]);

  const [users, customers, owners, staff, theatres, pendingTheatres, approvedTheatres, movies, shows, bookings, confirmedBookings, revenueAgg] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { role: "CUSTOMER" } }),
    db.user.count({ where: { role: "OWNER" } }),
    db.user.count({ where: { role: "STAFF" } }),
    db.theatre.count(),
    db.theatre.count({ where: { status: "PENDING" } }),
    db.theatre.count({ where: { status: "APPROVED" } }),
    db.movie.count(),
    db.show.count({ where: { status: "SCHEDULED" } }),
    db.booking.count(),
    db.booking.count({ where: { status: "CONFIRMED" } }),
    db.payment.aggregate({ where: { status: "PAID" }, _sum: { amount: true } }),
  ]);

  const commissionSetting = await db.setting.findUnique({ where: { key: "platform.commissionPercent" } });
  const commissionPercent = commissionSetting ? Number(commissionSetting.value) : 8;
  const gross = revenueAgg._sum.amount || 0;

  return ok({
    users, customers, owners, staff,
    theatres, pendingTheatres, approvedTheatres,
    movies, shows, bookings, confirmedBookings,
    grossRevenue: gross,
    platformCommission: Math.round(gross * (commissionPercent / 100) * 100) / 100,
    commissionPercent,
  });
});
