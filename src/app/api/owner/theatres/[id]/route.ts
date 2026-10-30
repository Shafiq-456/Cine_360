import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, handler, parseBody, audit } from "@/lib/api";
import { requireOwner, assertTheatreAccess } from "@/lib/owner";

const patchSchema = z.object({
  name: z.string().min(3).max(120).optional(),
  city: z.string().min(2).max(80).optional(),
  address: z.string().min(6).max(240).optional(),
  amenities: z.array(z.string().max(60)).max(12).optional(),
});

// PATCH /api/owner/theatres/[id]
export const PATCH = handler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireOwner();
  const { id } = await ctx.params;
  await assertTheatreAccess(user, id);
  const body = await parseBody(req, patchSchema);

  const theatre = await db.theatre.update({
    where: { id },
    data: {
      ...(body.name ? { name: body.name.trim() } : {}),
      ...(body.city ? { city: body.city.trim() } : {}),
      ...(body.address ? { address: body.address.trim() } : {}),
      ...(body.amenities ? { amenities: JSON.stringify(body.amenities) } : {}),
    },
  });
  await audit({ actorId: user.id, actorEmail: user.email, action: "THEATRE_UPDATED", entity: "Theatre", entityId: id });
  return ok({ theatre });
});
