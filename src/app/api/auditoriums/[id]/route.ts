import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, handler, HttpError } from "@/lib/api";

// GET /api/auditoriums/[id] — public auditorium descriptor (layout + categories).
export const GET = handler(async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const auditorium = await db.auditorium.findUnique({
    where: { id },
    include: {
      theatre: { select: { id: true, name: true, city: true, address: true, status: true } },
      categories: { orderBy: { basePrice: "asc" } },
      _count: { select: { seats: true, shows: true } },
    },
  });
  if (!auditorium) throw new HttpError("Auditorium not found", 404);

  return ok({
    auditorium: {
      id: auditorium.id,
      name: auditorium.name,
      status: auditorium.status,
      geometrySource: auditorium.geometrySource,
      layoutConfig: JSON.parse(auditorium.layoutConfig),
      categories: auditorium.categories,
      seatCount: auditorium._count.seats,
      showCount: auditorium._count.shows,
      theatre: auditorium.theatre,
    },
  });
});
