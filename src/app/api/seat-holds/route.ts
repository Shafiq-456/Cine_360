import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, handler, parseBody } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { createSeatHold } from "@/lib/inventory";

const schema = z.object({
  showId: z.string().min(5),
  seatIds: z.array(z.string().min(5)).min(1).max(10),
});

// POST /api/seat-holds — transactional temporary hold (5 min TTL)
export const POST = handler(async (req: NextRequest) => {
  const user = await requireAuth();
  const body = await parseBody(req, schema);
  const hold = await createSeatHold({ showId: body.showId, seatIds: body.seatIds, userId: user.id });
  return ok(
    { holdId: hold.id, showId: hold.showId, expiresAt: hold.expiresAt },
    { status: 201 }
  );
});
