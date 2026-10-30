import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, fail, handler, parseBody, audit, HttpError } from "@/lib/api";
import { requireOwner, assertAuditoriumAccess } from "@/lib/owner";
import { buildAuditoriumInventory, layoutSchema } from "../route";

const patchSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  layout: layoutSchema.optional(),
});

// GET /api/owner/auditoriums/[id] — full detail for the builder
export const GET = handler(async (_req, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireOwner();
  const { id } = await ctx.params;
  const { auditorium } = await assertAuditoriumAccess(user, id);
  const detail = await db.auditorium.findUnique({
    where: { id },
    include: {
      categories: true,
      seats: { orderBy: [{ rowIndex: "asc" }, { colIndex: "asc" }] },
      shows: { where: { status: "SCHEDULED" }, select: { id: true, startsAt: true } },
      models: { orderBy: { version: "desc" } },
      _count: { select: { seats: true, shows: true } },
    },
  });
  return ok({ auditorium: detail });
});

// PATCH /api/owner/auditoriums/[id] — rename and/or rebuild layout+seats
export const PATCH = handler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireOwner();
  const { id } = await ctx.params;
  const { auditorium } = await assertAuditoriumAccess(user, id);
  const body = await parseBody(req, patchSchema);

  if (body.layout) {
    const scheduledShows = await db.show.count({ where: { auditoriumId: id, status: "SCHEDULED", startsAt: { gte: new Date() } } });
    if (scheduledShows > 0) {
      throw new HttpError(
        "This auditorium has scheduled shows. Cancel them first, then rebuild the layout (existing seat maps would be invalidated).",
        409
      );
    }
  }

  await db.auditorium.update({
    where: { id },
    data: {
      ...(body.name ? { name: body.name.trim() } : {}),
      ...(body.layout ? { layoutConfig: JSON.stringify(body.layout), geometrySource: "PROCEDURAL" } : {}),
    },
  });

  let seatCount: number | undefined;
  if (body.layout) {
    ({ seatCount } = await buildAuditoriumInventory(id, body.layout));
    await audit({ actorId: user.id, actorEmail: user.email, action: "AUDITORIUM_REBUILT", entity: "Auditorium", entityId: id, meta: { seatCount } });
  }
  return ok({ updated: true, seatCount: seatCount ?? (await db.seat.count({ where: { auditoriumId: id } })) });
});

// DELETE /api/owner/auditoriums/[id]
export const DELETE = handler(async (_req, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireOwner();
  const { id } = await ctx.params;
  await assertAuditoriumAccess(user, id);
  const shows = await db.show.count({ where: { auditoriumId: id } });
  if (shows > 0) return fail("This auditorium has shows attached and cannot be deleted. Cancel its shows first.", 409);
  await db.auditorium.delete({ where: { id } });
  await audit({ actorId: user.id, actorEmail: user.email, action: "AUDITORIUM_DELETED", entity: "Auditorium", entityId: id });
  return ok({ deleted: true });
});
