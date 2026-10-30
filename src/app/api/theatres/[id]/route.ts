import { db } from "@/lib/db";
import { ok, handler, HttpError } from "@/lib/api";

// GET /api/theatres/[id] — theatre detail, auditoriums and upcoming shows
export const GET = handler(async (_req, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const theatre = await db.theatre.findUnique({
    where: { id },
    include: {
      auditoriums: { include: { _count: { select: { seats: true } } } },
      owner: { select: { name: true } },
    },
  });
  if (!theatre || theatre.status !== "APPROVED") throw new HttpError("Theatre not found", 404);

  const now = new Date();
  const shows = await db.show.findMany({
    where: { auditorium: { theatreId: theatre.id }, startsAt: { gte: now }, status: "SCHEDULED" },
    include: {
      movie: { select: { id: true, title: true, slug: true, posterUrl: true, durationMins: true, certification: true } },
      auditorium: { select: { name: true } },
      showSeats: { select: { status: true } },
    },
    orderBy: { startsAt: "asc" },
  });

  return ok({
    theatre: {
      id: theatre.id, name: theatre.name, city: theatre.city, address: theatre.address,
      amenities: JSON.parse(theatre.amenities), ownerName: theatre.owner.name,
      auditoriums: theatre.auditoriums.map((a) => ({ id: a.id, name: a.name, seatCount: a._count.seats, geometrySource: a.geometrySource })),
    },
    shows: shows.map((s) => ({
      id: s.id, startsAt: s.startsAt, format: s.format, language: s.language,
      auditorium: s.auditorium.name,
      available: s.showSeats.filter((x) => x.status === "AVAILABLE").length,
      total: s.showSeats.length,
      movie: s.movie,
    })),
  });
});
