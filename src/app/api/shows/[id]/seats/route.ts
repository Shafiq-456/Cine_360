import { ok, handler, HttpError } from "@/lib/api";
import { getShowInventory } from "@/lib/inventory";

// GET /api/shows/[id]/seats — live per-show inventory (3D engine + 2D map)
export const GET = handler(async (_req, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const inventory = await getShowInventory(id);
  return ok(inventory);
});
