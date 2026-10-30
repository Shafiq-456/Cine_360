import { ok, handler } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { releaseSeatHold } from "@/lib/inventory";

// DELETE /api/seat-holds/[id] — release an active hold (user abandoned checkout)
export const DELETE = handler(async (_req, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireAuth();
  const { id } = await ctx.params;
  await releaseSeatHold(id, user.id);
  return ok({ released: true });
});
