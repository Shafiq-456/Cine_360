import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, handler } from "@/lib/api";
import { ensureRollingSchedule } from "@/lib/schedule";

// GET /api/shows?movieId=&date=YYYY-MM-DD&theatreId=
export const GET = handler(async (req: NextRequest) => {
  await ensureRollingSchedule();
  const sp = req.nextUrl.searchParams;
  const movieId = sp.get("movieId");
  const theatreId = sp.get("theatreId");
  const date = sp.get("date");

  const where: Record<string, unknown> = { status: "SCHEDULED", startsAt: { gte: new Date() } };
  if (movieId) where.movieId = movieId;
  if (theatreId) where.auditorium = { theatreId };
  if (date) {
    const from = new Date(`${date}T00:00:00`);
    const to = new Date(from.getTime() + 86400000);
    where.startsAt = { gte: from, lt: to };
  }

  const shows = await db.show.findMany({
    where,
    include: {
      movie: { select: { id: true, title: true, posterUrl: true, durationMins: true } },
      auditorium: {
        select: { id: true, name: true, theatre: { select: { id: true, name: true, city: true, status: true } } },
      },
      showSeats: { select: { status: true, price: true } },
    },
    orderBy: { startsAt: "asc" },
    take: 120,
  });

  const approved = shows.filter((s) => s.auditorium.theatre.status === "APPROVED");
  return ok({
    shows: approved.map((s) => ({
      id: s.id,
      startsAt: s.startsAt,
      language: s.language,
      format: s.format,
      movie: s.movie,
      auditorium: s.auditorium,
      available: s.showSeats.filter((x) => x.status === "AVAILABLE").length,
      total: s.showSeats.length,
      minPrice: s.showSeats.length ? Math.min(...s.showSeats.map((x) => x.price)) : 0,
    })),
  });
});
