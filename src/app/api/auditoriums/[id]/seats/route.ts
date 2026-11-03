import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, handler, HttpError } from "@/lib/api";

// GET /api/auditoriums/[id]/seats — physical seat definitions (static geometry).
// Per-show availability lives at /api/shows/[id]/seats; this endpoint exposes
// the calibrated physical layout of the hall itself.
export const GET = handler(async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const auditorium = await db.auditorium.findUnique({ where: { id }, select: { id: true } });
  if (!auditorium) throw new HttpError("Auditorium not found", 404);

  const seats = await db.seat.findMany({
    where: { auditoriumId: id },
    orderBy: [{ rowIndex: "asc" }, { colIndex: "asc" }],
    select: {
      id: true, rowLabel: true, seatNumber: true, rowIndex: true, colIndex: true,
      x: true, z: true, baseY: true, eyeHeight: true, isAccessible: true,
      category: { select: { code: true, name: true, color: true, basePrice: true } },
    },
  });

  return ok({ count: seats.length, seats });
});
