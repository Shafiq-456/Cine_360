import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, handler, parseBody, audit } from "@/lib/api";
import { requireOwner, assertAuditoriumAccess } from "@/lib/owner";
import { SEAT_STATUS } from "@/lib/constants";
import { emitShowInventoryChanged } from "@/lib/events";

const patchSchema = z.object({ status: z.enum(["SCHEDULED", "CANCELLED"]) });

// PATCH /api/owner/shows/[id] — cancel a show (frees inventory, keeps history)
export const PATCH = handler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireOwner();
  const { id } = await ctx.params;
  const body = await parseBody(req, patchSchema);

  const show = await db.show.findUnique({ where: { id }, include: { auditorium: true } });
  if (!show) return ok({ error: "Show not found" }, { status: 404 });
  await assertAuditoriumAccess(user, show.auditoriumId);

  await db.$transaction(async (tx) => {
    await tx.show.update({ where: { id }, data: { status: body.status } });
    if (body.status === "CANCELLED") {
      // Release held/booked seats that have not been redeemed yet; refundable bookings handled by admin flow
      await tx.showSeat.updateMany({
        where: { showId: id, status: { in: [SEAT_STATUS.HELD, SEAT_STATUS.AVAILABLE] } },
        data: { status: SEAT_STATUS.UNAVAILABLE, holdId: null },
      });
      await tx.seatHold.updateMany({ where: { showId: id, status: "ACTIVE" }, data: { status: "EXPIRED" } });
    }
  });

  emitShowInventoryChanged(id);
  await audit({ actorId: user.id, actorEmail: user.email, action: "SHOW_STATUS_CHANGED", entity: "Show", entityId: id, meta: { status: body.status } });
  return ok({ updated: true });
});
