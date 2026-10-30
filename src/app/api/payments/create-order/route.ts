import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, handler, parseBody } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { createPaymentOrder } from "@/lib/payments";

const schema = z.object({ bookingId: z.string().min(5) });

// POST /api/payments/create-order
// Creates the gateway order for a pending booking. Uses DEMO provider unless
// real Razorpay keys are configured (env) — the mode is always reported to the
// client so the UI can label it honestly.
const provider = process.env.RAZORPAY_KEY_ID ? "RAZORPAY" : "DEMO";

export const POST = handler(async (req: NextRequest) => {
  const user = await requireAuth();
  const body = await parseBody(req, schema);

  if (provider === "RAZORPAY") {
    // Real Razorpay path requires the razorpay npm package + verified credentials.
    // Intentionally NOT wired in this sandbox build: no credentials exist here and
    // pretending to integrate would violate honest-payment rules. See README.
    return ok({ mode: "RAZORPAY", configured: false, message: "Razorpay keys detected but the live SDK is not enabled in this environment. Use demo mode." }, { status: 501 });
  }

  const payment = await createPaymentOrder({ bookingId: body.bookingId, userId: user.id, provider: "DEMO" });
  return ok({
    mode: "DEMO",
    orderId: payment.orderId,
    amount: payment.amount,
    currency: payment.currency,
    note: "TEST MODE — no real money is charged. This is a clearly labelled demo gateway.",
  });
});
