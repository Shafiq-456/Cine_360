import { db } from "@/lib/db";
import { ok, handler, HttpError } from "@/lib/api";

// GET /api/movies/[id] — detail + showtime availability grouped by theatre
export const GET = handler(async (_req, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const movie = await db.movie.findFirst({
    where: { OR: [{ id }, { slug: id }] },
  });
  if (!movie) throw new HttpError("Movie not found", 404);

  const now = new Date();
  const shows = await db.show.findMany({
    where: { movieId: movie.id, startsAt: { gte: now }, status: "SCHEDULED" },
    include: {
      auditorium: { include: { theatre: true, _count: { select: { seats: true } } } },
      showSeats: { select: { status: true } },
    },
    orderBy: { startsAt: "asc" },
  });

  const theatreMap = new Map<string, {
    theatre: { id: string; name: string; city: string; address: string };
    shows: unknown[];
  }>();
  for (const s of shows) {
    const t = s.auditorium.theatre;
    if (t.status !== "APPROVED") continue;
    if (!theatreMap.has(t.id)) theatreMap.set(t.id, { theatre: { id: t.id, name: t.name, city: t.city, address: t.address }, shows: [] });
    theatreMap.get(t.id)!.shows.push({
      id: s.id,
      startsAt: s.startsAt,
      language: s.language,
      format: s.format,
      auditorium: { id: s.auditorium.id, name: s.auditorium.name },
      totalSeats: s.showSeats.length,
      available: s.showSeats.filter((x) => x.status === "AVAILABLE").length,
    });
  }

  return ok({
    movie: { ...movie, genres: JSON.parse(movie.genres), languages: JSON.parse(movie.languages) },
    theatres: [...theatreMap.values()],
  });
});
