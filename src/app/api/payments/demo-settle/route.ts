import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, handler, parseBody } from "@/lib/api";
import { demoSettle } from "@/lib/payments";

const schema = z.object({
  orderId: z.string().min(5),
  outcome: z.enum(["success", "failure"]),
  method: z.string().max(24).optional(),
});

/**
 * POST /api/payments/demo-settle — DEMO GATEWAY (TEST MODE, clearly labelled).
 * Stands in for Razorpay's servers in this sandbox: it issues the gateway
 * payment id + HMAC signature exactly like a real gateway would, then the
 * standard /api/payments/verify path does server-side verification.
 * In production this endpoint is removed; the real gateway calls the webhook.
 */
export const POST = handler(async (req: NextRequest) => {
  if (process.env.RAZORPAY_KEY_ID) {
    return ok({ enabled: false, message: "Demo gateway disabled while Razorpay keys are configured." }, { status: 409 });
  }
  const body = await parseBody(req, schema);
  const payment = await demoSettle(body);
  return ok({
    demo: true,
    orderId: payment.orderId,
    gatewayPaymentId: payment.gatewayPaymentId,
    signature: payment.signature,
    status: payment.status,
  });
});
