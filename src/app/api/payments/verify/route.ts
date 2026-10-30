import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, handler, parseBody } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { verifyAndConfirm } from "@/lib/payments";
import { db } from "@/lib/db";

const schema = z.object({
  orderId: z.string().min(5),
  gatewayPaymentId: z.string().min(3),
  signature: z.string().min(8),
});

// POST /api/payments/verify — server-side signature validation + booking confirmation.
// A booking is NEVER confirmed from a frontend success screen alone.
export const POST = handler(async (req: NextRequest) => {
  await requireAuth();
  const body = await parseBody(req, schema);
  const payment = await verifyAndConfirm(body);

  const booking = await db.booking.findUnique({
    where: { id: payment.bookingId },
    include: { seats: true, tickets: true },
  });
  return ok({ payment: { id: payment.id, status: payment.status, orderId: payment.orderId }, booking });
});
