import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, handler } from "@/lib/api";

// GET /api/theatres?city=&q= — approved theatres with their auditoriums
export const GET = handler(async (req: NextRequest) => {
  const sp = req.nextUrl.searchParams;
  const city = sp.get("city")?.trim();
  const q = sp.get("q")?.trim();

  const theatres = await db.theatre.findMany({
    where: { status: "APPROVED", ...(city ? { city } : {}) },
    include: { auditoriums: { include: { _count: { select: { seats: true } } } }, _count: { select: { auditoriums: true } } },
    orderBy: { name: "asc" },
  });

  const filtered = q ? theatres.filter((t) => (t.name + t.city + t.address).toLowerCase().includes(q.toLowerCase())) : theatres;
  const cities = [...new Set((await db.theatre.findMany({ where: { status: "APPROVED" }, select: { city: true } })).map((t) => t.city))].sort();

  return ok({
    cities,
    theatres: filtered.map((t) => ({
      id: t.id, name: t.name, city: t.city, address: t.address,
      amenities: JSON.parse(t.amenities),
      auditoriums: t.auditoriums.map((a) => ({ id: a.id, name: a.name, geometrySource: a.geometrySource, seatCount: a._count.seats })),
    })),
  });
});
