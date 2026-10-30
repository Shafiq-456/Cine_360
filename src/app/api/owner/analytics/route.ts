import { db } from "@/lib/db";
import { ok, handler } from "@/lib/api";
import { requireOwner } from "@/lib/owner";
import { sweepStalePendingBookings } from "@/lib/booking";

// GET /api/owner/analytics — revenue by day (last 7 days), occupancy by show, category mix
export const GET = handler(async () => {
  const user = await requireOwner();
  await sweepStalePendingBookings();

  const theatres = await db.theatre.findMany({
    where: user.role === "ADMIN" ? {} : { ownerId: user.id },
    select: { id: true, name: true },
  });
  const auditoriums = await db.auditorium.findMany({
    where: { theatreId: { in: theatres.map((t) => t.id) } },
    select: { id: true, name: true },
  });
  const audIds = auditoriums.map((a) => a.id);

  const since = new Date();
  since.setDate(since.getDate() - 6);
  since.setHours(0, 0, 0, 0);

  const paidPayments = await db.payment.findMany({
    where: { status: "PAID", booking: { show: { auditoriumId: { in: audIds } } }, createdAt: { gte: since } },
    select: { amount: true, createdAt: true },
  });

  const byDay: { date: string; label: string; revenue: number; bookings: number }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(since.getTime() + i * 86400000);
    const next = new Date(d.getTime() + 86400000);
    const dayPayments = paidPayments.filter((p) => p.createdAt >= d && p.createdAt < next);
    byDay.push({
      date: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" }),
      revenue: dayPayments.reduce((s, p) => s + p.amount, 0),
      bookings: dayPayments.length,
    });
  }

  const shows = await db.show.findMany({
    where: { auditoriumId: { in: audIds }, startsAt: { gte: new Date(Date.now() - 3 * 86400000) } },
    include: {
      movie: { select: { title: true } },
      auditorium: { select: { name: true, theatre: { select: { name: true } } } },
      showSeats: { select: { status: true, price: true, seat: { include: { category: { select: { code: true } } } } } },
    },
    orderBy: { startsAt: "asc" },
    take: 40,
  });

  const occupancyByShow = shows.map((s) => {
    const total = s.showSeats.length;
    const booked = s.showSeats.filter((x) => x.status === "BOOKED").length;
    const revenue = s.showSeats.filter((x) => x.status === "BOOKED").reduce((sum, x) => sum + x.price, 0);
    return {
      id: s.id,
      startsAt: s.startsAt,
      movie: s.movie.title,
      auditorium: `${s.auditorium.theatre.name} · ${s.auditorium.name}`,
      occupancy: total ? Math.round((booked / total) * 1000) / 10 : 0,
      revenue,
      booked,
      total,
    };
  });

  // category mix across all shows listed
  const catMix: Record<string, { sold: number; revenue: number }> = {};
  for (const s of shows) {
    for (const ss of s.showSeats) {
      if (ss.status !== "BOOKED") continue;
      const code = ss.seat.category.code;
      catMix[code] = catMix[code] || { sold: 0, revenue: 0 };
      catMix[code].sold += 1;
      catMix[code].revenue += ss.price;
    }
  }

  const commissionSetting = await db.setting.findUnique({ where: { key: "platform.commissionPercent" } });

  return ok({ byDay, occupancyByShow, categoryMix: catMix, commissionPercent: commissionSetting ? Number(commissionSetting.value) : 0 });
});
