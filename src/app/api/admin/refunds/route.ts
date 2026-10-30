import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, handler, parseBody } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { refundBooking } from "@/lib/booking";

const schema = z.object({ bookingId: z.string().min(5) });

// POST /api/admin/refunds — refund a confirmed booking (releases seats, voids tickets, marks payment refunded)
export const POST = handler(async (req: NextRequest) => {
  const admin = await requireAuth(["ADMIN"]);
  const body = await parseBody(req, schema);
  await refundBooking(body.bookingId, admin.id);
  return ok({ refunded: true });
});
