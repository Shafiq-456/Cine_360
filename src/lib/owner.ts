// Owner scope helpers: ensure an OWNER can only touch their own theatres.
import { db } from "./db";
import { requireAuth } from "./auth";
import { HttpError } from "./api";
import type { SessionUser } from "./auth";
import type { Theatre, Auditorium } from "@prisma/client";

export async function requireOwner(): Promise<SessionUser> {
  return requireAuth(["OWNER", "ADMIN"]);
}

/** Verifies the owner may manage this theatre. Admins may manage any. */
export async function assertTheatreAccess(user: SessionUser, theatreId: string): Promise<Theatre> {
  const theatre = await db.theatre.findUnique({ where: { id: theatreId } });
  if (!theatre) throw new HttpError("Theatre not found", 404);
  if (user.role !== "ADMIN" && theatre.ownerId !== user.id) {
    throw new HttpError("You can only manage your own theatres", 403);
  }
  return theatre;
}

export async function assertAuditoriumAccess(
  user: SessionUser,
  auditoriumId: string
): Promise<{ theatre: Theatre; auditorium: Auditorium }> {
  const auditorium = await db.auditorium.findUnique({ where: { id: auditoriumId } });
  if (!auditorium) throw new HttpError("Auditorium not found", 404);
  const theatre = await assertTheatreAccess(user, auditorium.theatreId);
  return { theatre, auditorium };
}

/** Computes owner metrics from real application data only. */
export async function ownerMetrics(ownerId: string, adminAll = false) {
  const theatres = await db.theatre.findMany({
    where: adminAll ? {} : { ownerId },
    select: { id: true },
  });
  const theatreIds = theatres.map((t) => t.id);

  const auditoriums = await db.auditorium.findMany({
    where: { theatreId: { in: theatreIds } },
    select: { id: true, theatreId: true, name: true },
  });
  const audIds = auditoriums.map((a) => a.id);

  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart.getTime() + 86400000);

  const [todayShows, upcomingShows, totalBookings, todayBookings, cancelledBookings] = await Promise.all([
    db.show.count({ where: { auditoriumId: { in: audIds }, startsAt: { gte: dayStart, lt: dayEnd } } }),
    db.show.count({ where: { auditoriumId: { in: audIds }, startsAt: { gte: new Date() }, status: "SCHEDULED" } }),
    db.booking.count({ where: { show: { auditoriumId: { in: audIds } }, status: { in: ["CONFIRMED", "REFUNDED"] } } }),
    db.booking.count({
      where: { show: { auditoriumId: { in: audIds } }, status: "CONFIRMED", createdAt: { gte: dayStart, lt: dayEnd } },
    }),
    db.booking.count({ where: { show: { auditoriumId: { in: audIds } }, status: { in: ["CANCELLED", "REFUNDED"] } } }),
  ]);

  const revenueAgg = await db.payment.aggregate({
    where: { status: "PAID", booking: { show: { auditoriumId: { in: audIds } } } },
    _sum: { amount: true },
  });

  // Occupancy: booked vs total seats across today's shows
  const todayShowRows = await db.show.findMany({
    where: { auditoriumId: { in: audIds }, startsAt: { gte: dayStart, lt: dayEnd } },
    select: { id: true },
  });
  const booked = await db.showSeat.count({
    where: { showId: { in: todayShowRows.map((s) => s.id) }, status: "BOOKED" },
  });
  const totalSeats = await db.showSeat.count({
    where: { showId: { in: todayShowRows.map((s) => s.id) } },
  });

  const commissionSetting = await db.setting.findUnique({ where: { key: "platform.commissionPercent" } });
  const commissionPercent = commissionSetting ? Number(commissionSetting.value) : 0;
  const gross = revenueAgg._sum.amount || 0;

  return {
    theatres: theatres.length,
    auditoriums: auditoriums.length,
    totalBookings,
    todayBookings,
    cancelledBookings,
    revenue: gross,
    netRevenue: Math.round(gross * (1 - commissionPercent / 100) * 100) / 100,
    commissionPercent,
    occupancyRate: totalSeats > 0 ? Math.round((booked / totalSeats) * 1000) / 10 : 0,
    todayShows,
    upcomingShows,
    seatsAvailable: totalSeats - booked,
  };
}
