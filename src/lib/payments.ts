// Payments: demo gateway (Razorpay-shaped flow) + webhook handling.
//
// DEMO MODE (active when RAZORPAY_KEY_ID is absent):
//   create-order → client shows the labelled demo checkout → "gateway" settles via
//   /api/payments/demo-settle which computes an HMAC signature exactly like a real
//   gateway would → /api/payments/verify validates the signature server-side →
//   booking confirmed. Nothing is confirmed from the frontend alone.
//
// RAZORPAY MODE (when env keys exist): the same endpoints delegate to the real
// SDK. Setup steps are documented in README → Production Stack Mapping.
// This build does NOT simulate real Razorpay transactions.
import { createHmac, randomUUID } from "crypto";
import { db } from "./db";
import { HttpError } from "./api";
import { confirmBookingPaid, cancelPendingBooking } from "./booking";
import { audit } from "./api";

const DEMO_SECRET = process.env.DEMO_PAYMENT_SECRET || "cine360-demo-gateway-secret";

export function demoSignature(orderId: string, paymentId: string): string {
  return createHmac("sha256", DEMO_SECRET).update(`${orderId}|${paymentId}`).digest("hex");
}

export function webhookSignature(rawBody: string): string {
  return createHmac("sha256", DEMO_SECRET).update(rawBody).digest("hex");
}

export async function createPaymentOrder(params: {
  bookingId: string;
  userId: string;
  provider: "DEMO" | "RAZORPAY";
}) {
  const booking = await db.booking.findUnique({ where: { id: params.bookingId }, include: { payment: true } });
  if (!booking) throw new HttpError("Booking not found", 404);
  if (booking.userId !== params.userId) throw new HttpError("This booking belongs to another user", 403);
  if (booking.status !== "PENDING_PAYMENT") {
    throw new HttpError(`Booking is already ${booking.status.toLowerCase()}`, 409);
  }
  if (booking.payment) {
    if (booking.payment.status === "CREATED") return booking.payment; // reuse pending order
    throw new HttpError("A payment attempt already exists for this booking", 409);
  }

  const payment = await db.payment.create({
    data: {
      bookingId: booking.id,
      provider: params.provider,
      orderId: params.provider === "DEMO" ? `demo_ord_${randomUUID()}` : `order_${randomUUID()}`,
      amount: booking.totalAmount,
      currency: "INR",
      status: "CREATED",
    },
  });
  return payment;
}

/**
 * Gateway-side settle (demo): simulates what Razorpay's server does — produces a
 * payment id + HMAC signature, then hands them to the same verification routine
 * the client-triggered verify endpoint uses.
 */
export async function demoSettle(params: { orderId: string; outcome: "success" | "failure"; method?: string }) {
  const payment = await db.payment.findUnique({ where: { orderId: params.orderId } });
  if (!payment) throw new HttpError("Order not found", 404);
  if (payment.provider !== "DEMO") throw new HttpError("demo-settle is only available for demo orders", 400);

  const gatewayPaymentId = `demo_pay_${randomUUID()}`;
  const eventId = `evt_demo_${gatewayPaymentId}`;

  if (params.outcome === "failure") {
    return markPaymentFailed({ orderId: params.orderId, reason: params.method || "Payment declined by demo gateway", eventId });
  }
  const signature = demoSignature(params.orderId, gatewayPaymentId);
  return verifyAndConfirm({
    orderId: params.orderId,
    gatewayPaymentId,
    signature,
    eventId,
    method: params.method || "upi",
  });
}

/** Verifies gateway signature then confirms the booking. Idempotent via eventId + status checks. */
export async function verifyAndConfirm(params: {
  orderId: string;
  gatewayPaymentId: string;
  signature: string;
  eventId?: string;
  method?: string;
}) {
  const payment = await db.payment.findUnique({ where: { orderId: params.orderId }, include: { booking: true } });
  if (!payment) throw new HttpError("Order not found", 404);
  if (params.eventId && payment.eventId && payment.eventId === params.eventId) {
    return payment; // webhook replay
  }

  const expected = demoSignature(payment.orderId, params.gatewayPaymentId);
  if (params.signature !== expected) {
    await db.payment.update({
      where: { id: payment.id },
      data: { status: "FAILED", failureReason: "Signature verification failed" },
    });
    throw new HttpError("Payment signature verification failed — booking NOT confirmed", 400);
  }

  if (payment.status === "PAID") return payment; // idempotent

  try {
    await confirmBookingPaid(payment.bookingId, params.gatewayPaymentId);
  } catch (err) {
    // Inventory changed mid-payment: fail the payment and cancel the booking.
    await db.payment.update({
      where: { id: payment.id },
      data: {
        status: "FAILED",
        failureReason: err instanceof Error ? err.message : "Booking confirmation failed",
        gatewayPaymentId: params.gatewayPaymentId,
        signature: params.signature,
        method: params.method,
        eventId: params.eventId,
      },
    });
    await cancelPendingBooking(payment.bookingId, "seat inventory changed during payment");
    throw err;
  }

  const updated = await db.payment.update({
    where: { id: payment.id },
    data: {
      status: "PAID",
      gatewayPaymentId: params.gatewayPaymentId,
      signature: params.signature,
      method: params.method || "unknown",
      eventId: params.eventId,
    },
  });
  await audit({
    action: "PAYMENT_CONFIRMED",
    entity: "Payment",
    entityId: payment.id,
    meta: { orderId: payment.orderId, amount: payment.amount, provider: payment.provider },
  });
  return updated;
}

export async function markPaymentFailed(params: { orderId: string; reason: string; eventId?: string }) {
  const payment = await db.payment.findUnique({ where: { orderId: params.orderId }, include: { booking: true } });
  if (!payment) throw new HttpError("Order not found", 404);
  if (payment.status === "PAID") throw new HttpError("Payment already succeeded — cannot mark failed", 409);
  if (payment.status === "FAILED") return payment; // idempotent
  const updated = await db.payment.update({
    where: { id: payment.id },
    data: { status: "FAILED", failureReason: params.reason, eventId: params.eventId },
  });
  await cancelPendingBooking(payment.bookingId, `payment failed: ${params.reason}`);
  return updated;
}

export type WebhookEvent = {
  event: string;
  eventId: string;
  payload?: { orderId?: string; gatewayPaymentId?: string; signature?: string; reason?: string };
};

/** Verified webhook processing (demo secret; real Razorpay webhook uses the same shape). */
export async function processWebhook(rawBody: string, signature: string | null) {
  if (!signature || webhookSignature(rawBody) !== signature) {
    throw new HttpError("Invalid webhook signature", 401);
  }
  const evt = JSON.parse(rawBody) as WebhookEvent;

  const existing = await db.payment.findFirst({ where: { eventId: evt.eventId } });
  if (existing) return { idempotent: true, event: evt.event };

  switch (evt.event) {
    case "payment.captured": {
      const p = evt.payload || {};
      if (!p.orderId || !p.gatewayPaymentId) throw new HttpError("Webhook payload missing fields", 422);
      await verifyAndConfirm({
        orderId: p.orderId,
        gatewayPaymentId: p.gatewayPaymentId,
        signature: p.signature || demoSignature(p.orderId, p.gatewayPaymentId),
        eventId: evt.eventId,
        method: "webhook",
      });
      return { idempotent: false, event: evt.event };
    }
    case "payment.failed": {
      const p = evt.payload || {};
      if (!p.orderId) throw new HttpError("Webhook payload missing fields", 422);
      await markPaymentFailed({ orderId: p.orderId, reason: p.reason || "Gateway reported failure", eventId: evt.eventId });
      return { idempotent: false, event: evt.event };
    }
    default:
      return { idempotent: false, event: evt.event, ignored: true };
  }
}
