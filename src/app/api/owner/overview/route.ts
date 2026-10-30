import { ok, handler } from "@/lib/api";
import { requireOwner, ownerMetrics } from "@/lib/owner";
import { sweepStalePendingBookings } from "@/lib/booking";

// GET /api/owner/overview — dashboard metrics computed from real application data
export const GET = handler(async () => {
  const user = await requireOwner();
  await sweepStalePendingBookings();
  const metrics = await ownerMetrics(user.id, user.role === "ADMIN");
  return ok({ metrics, role: user.role });
});
