import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, handler, parseBody, audit } from "@/lib/api";
import { requireAuth } from "@/lib/auth";

const patchSchema = z.object({
  status: z.enum(["NOW_SHOWING", "UPCOMING", "ARCHIVED"]).optional(),
  featured: z.boolean().optional(),
  synopsis: z.string().min(10).max(2000).optional(),
});

// PATCH /api/admin/movies/[id]
export const PATCH = handler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const admin = await requireAuth(["ADMIN"]);
  const { id } = await ctx.params;
  const body = await parseBody(req, patchSchema);
  const movie = await db.movie.update({
    where: { id },
    data: {
      ...(body.status ? { status: body.status } : {}),
      ...(body.featured !== undefined ? { featured: body.featured } : {}),
      ...(body.synopsis ? { synopsis: body.synopsis } : {}),
    },
  });
  await audit({ actorId: admin.id, actorEmail: admin.email, action: "MOVIE_UPDATED", entity: "Movie", entityId: id, meta: body });
  return ok({ movie });
});

// DELETE /api/admin/movies/[id] — only when no shows reference it
export const DELETE = handler(async (_req, ctx: { params: Promise<{ id: string }> }) => {
  const admin = await requireAuth(["ADMIN"]);
  const { id } = await ctx.params;
  const shows = await db.show.count({ where: { movieId: id } });
  if (shows > 0) {
    // soft-archive instead of breaking referential history
    const movie = await db.movie.update({ where: { id }, data: { status: "ARCHIVED" } });
    await audit({ actorId: admin.id, actorEmail: admin.email, action: "MOVIE_ARCHIVED", entity: "Movie", entityId: id });
    return ok({ archived: true, movie });
  }
  await db.movie.delete({ where: { id } });
  await audit({ actorId: admin.id, actorEmail: admin.email, action: "MOVIE_DELETED", entity: "Movie", entityId: id });
  return ok({ deleted: true });
});
