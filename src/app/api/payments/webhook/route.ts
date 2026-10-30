import { NextRequest } from "next/server";
import { ok, handler, fail } from "@/lib/api";
import { processWebhook } from "@/lib/payments";

/**
 * POST /api/payments/webhook — gateway webhook endpoint.
 * Validates the HMAC signature header, is idempotent (unique event ids),
 * and confirms/cancels bookings exactly like the interactive verify path.
 */
export const POST = handler(async (req: NextRequest) => {
  const raw = await req.text();
  const signature = req.headers.get("x-webhook-signature");
  try {
    const result = await processWebhook(raw, signature);
    return ok({ received: true, ...result });
  } catch (err) {
    if (err instanceof Error && err.message.includes("signature")) return fail(err.message, 401);
    throw err;
  }
});
