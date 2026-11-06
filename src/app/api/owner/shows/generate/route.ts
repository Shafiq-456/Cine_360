import { NextRequest } from "next/server";
import { ok, handler, audit } from "@/lib/api";
import { requireOwner } from "@/lib/owner";
import { ensureRollingSchedule } from "@/lib/schedule";

// POST /api/owner/shows/generate — auto-programme the rolling 7-day window
// across every published auditorium of approved theatres (incl. own).
// Idempotent: only missing (auditorium, slot) combos are created.
export const POST = handler(async (_req: NextRequest) => {
  const user = await requireOwner();
  const result = await ensureRollingSchedule({ force: true });
  await audit({
    actorId: user.id,
    actorEmail: user.email,
    action: "SCHEDULE_GENERATED",
    entity: "Show",
    meta: { created: result.created },
  });
  return ok({ created: result.created });
});
