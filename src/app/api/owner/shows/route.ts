import { NextRequest } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ok, fail, handler, parseBody, audit, HttpError } from "@/lib/api";
import { requireOwner, assertAuditoriumAccess } from "@/lib/owner";

const createSchema = z.object({
  auditoriumId: z.string().min(5),
  movieId: z.string().min(5),
  startsAt: z.string().datetime({ offset: true }).or(z.string().min(10)),
  language: z.string().min(2).max(40),
  format: z.string().min(1).max(20).default("2D"),
  priceOverrides: z.record(z.string(), z.number().min(0)).optional(), // categoryCode -> price
});

// GET /api/owner/shows — upcoming + recent shows across owner's auditoriums
export const GET = handler(async () => {
  const user = await requireOwner();
  const shows = await db.show.findMany({
    where: user.role === "ADMIN" ? {} : { auditorium: { theatre: { ownerId: user.id } } },
    include: {
      movie: { select: { title: true, posterUrl: true } },
      auditorium: { select: { name: true, theatre: { select: { name: true, city: true } } } },
      showSeats: { select: { status: true, price: true } },
    },
    orderBy: { startsAt: "asc" },
    take: 100,
  });
  return ok({
    shows: shows.map((s) => ({
      id: s.id, startsAt: s.startsAt, format: s.format, language: s.language,
      movie: s.movie, auditorium: s.auditorium,
      total: s.showSeats.length,
      available: s.showSeats.filter((x) => x.status === "AVAILABLE").length,
      held: s.showSeats.filter((x) => x.status === "HELD").length,
      booked: s.showSeats.filter((x) => x.status === "BOOKED").length,
    })),
  });
});

// POST /api/owner/shows — schedule a show (creates per-show seat inventory)
export const POST = handler(async (req: NextRequest) => {
  const user = await requireOwner();
  const body = await parseBody(req, createSchema);
  const { auditorium } = await assertAuditoriumAccess(user, body.auditoriumId);
  if (auditorium.status !== "PUBLISHED") return fail("Auditorium is not published", 409);

  const movie = await db.movie.findUnique({ where: { id: body.movieId } });
  if (!movie || movie.status === "ARCHIVED") return fail("Movie not found in the catalogue", 404);

  const startsAt = new Date(body.startsAt);
  if (isNaN(startsAt.getTime())) return fail("Invalid show datetime", 422);
  if (startsAt.getTime() < Date.now() - 60000) return fail("Show must start in the future", 422);
  const endsAt = new Date(startsAt.getTime() + (movie.durationMins + 30) * 60000);

  // Overlap guard within the same auditorium (no two shows can share the screen)
  const existing = await db.show.findMany({
    where: { auditoriumId: auditorium.id, status: { in: ["SCHEDULED", "COMPLETED"] }, startsAt: { gte: new Date(startsAt.getTime() - 8 * 3600000), lte: new Date(startsAt.getTime() + 8 * 3600000) } },
    include: { movie: { select: { durationMins: true } } },
  });
  for (const s of existing) {
    const sEnd = new Date(s.startsAt.getTime() + (s.movie.durationMins + 30) * 60000);
    if (startsAt < sEnd && endsAt > s.startsAt) {
      return fail(`Time slot overlaps with another show at ${s.startsAt.toLocaleString("en-IN")}`, 409);
    }
  }

  let show;
  try {
    show = await db.show.create({
      data: { movieId: movie.id, auditoriumId: auditorium.id, startsAt, language: body.language, format: body.format },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return fail("This auditorium already has a show starting at that exact time", 409);
    }
    throw e;
  }

  const seats = await db.seat.findMany({ where: { auditoriumId: auditorium.id }, include: { category: true } });
  const overrides = body.priceOverrides || {};
  const rows = seats.map((s) => ({
    showId: show.id,
    seatId: s.id,
    status: "AVAILABLE",
    price: overrides[s.category.code] ?? s.category.basePrice,
  }));
  for (let c = 0; c < rows.length; c += 60) {
    await db.showSeat.createMany({ data: rows.slice(c, c + 60) });
  }

  await audit({ actorId: user.id, actorEmail: user.email, action: "SHOW_SCHEDULED", entity: "Show", entityId: show.id, meta: { movie: movie.title, startsAt: startsAt.toISOString() } });
  return ok({ show: { id: show.id, seats: rows.length } }, { status: 201 });
});
