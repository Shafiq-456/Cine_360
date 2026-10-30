// CINE 360 — API test suite (run against the live dev server).
// bun test tests/booking.test.ts
// Covers the spec's critical paths: concurrent double-booking prevention,
// hold expiry, payment signature verification, ticket validation, RBAC.
const BASE = process.env.TEST_BASE_URL || "http://localhost:3000";

type Json = { ok: boolean; data?: Record<string, unknown>; error?: string };

async function req(
  path: string,
  opts: { method?: string; body?: unknown; cookie?: string } = {}
): Promise<{ status: number; body: Json; setCookie?: string }> {
  const res = await fetch(`${BASE}${path}`, {
    method: opts.method || "GET",
    headers: { "Content-Type": "application/json", ...(opts.cookie ? { cookie: opts.cookie } : {}) },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const setCookie = res.headers.get("set-cookie")?.split(";")[0];
  let body: Json = {};
  try {
    body = await res.json();
  } catch {
    /* ignore */
  }
  return { status: res.status, body, setCookie };
}

async function login(email: string, password = "Demo@1234"): Promise<string> {
  const r = await req("/api/auth/login", { method: "POST", body: { email, password } });
  if (!r.body.ok || !r.setCookie) throw new Error(`login failed for ${email}: ${JSON.stringify(r.body)}`);
  return r.setCookie;
}

let customerCookie = "";
let staffCookie = "";
let ownerCookie = "";
let adminCookie = "";
let SHOW_ID = "";

beforeAll(async () => {
  customerCookie = await login("customer@cine360.demo");
  staffCookie = await login("staff@cine360.demo");
  ownerCookie = await login("owner@cine360.demo");
  adminCookie = await login("admin@cine360.demo");

  const shows = await req("/api/shows");
  const first = (shows.body.data as { shows: { id: string }[] }).shows[0];
  SHOW_ID = first.id;
});

async function freeSeats(n: number): Promise<string[]> {
  const inv = await req(`/api/shows/${SHOW_ID}/seats`);
  const seats = (inv.body.data as { seats: { id: string; status: string }[] }).seats;
  return seats.filter((s) => s.status === "AVAILABLE").slice(0, n).map((s) => s.id);
}

// ---------------- Auth & RBAC ----------------
test("rejects bad credentials", async () => {
  const r = await req("/api/auth/login", { method: "POST", body: { email: "customer@cine360.demo", password: "wrong" } });
  expect(r.status).toBe(401);
  expect(r.body.ok).toBe(false);
});

test("owner APIs reject customers (RBAC)", async () => {
  const r = await req("/api/owner/overview", { cookie: customerCookie });
  expect(r.status).toBe(403);
});

test("admin APIs reject owners (RBAC)", async () => {
  const r = await req("/api/admin/overview", { cookie: ownerCookie });
  expect(r.status).toBe(403);
});

test("admin APIs accept admins", async () => {
  const r = await req("/api/admin/overview", { cookie: adminCookie });
  expect(r.status).toBe(200);
  expect(r.body.ok).toBe(true);
});

// ---------------- Holds ----------------
test("hold creation requires auth", async () => {
  const ids = await freeSeats(1);
  const r = await req("/api/seat-holds", { method: "POST", body: { showId: SHOW_ID, seatIds: ids } });
  expect(r.status).toBe(401);
});

test("creates a hold and marks seats HELD", async () => {
  const ids = await freeSeats(2);
  const r = await req("/api/seat-holds", { method: "POST", body: { showId: SHOW_ID, seatIds: ids }, cookie: customerCookie });
  expect(r.status).toBe(201);
  const hold = r.body.data as { holdId: string; expiresAt: string };
  expect(hold.expiresAt).toBeTruthy();

  const inv = await req(`/api/shows/${SHOW_ID}/seats`);
  const statuses = (inv.body.data as { seats: { id: string; status: string }[] }).seats;
  for (const id of ids) {
    expect(statuses.find((s) => s.id === id)?.status).toBe("HELD");
  }
  // cleanup: release
  await req(`/api/seat-holds/${hold.holdId}`, { method: "DELETE", cookie: customerCookie });
});

test("cannot hold already-held seats (another user)", async () => {
  const ids = await freeSeats(1);
  const other = await login("owner2@cine360.demo");
  const first = await req("/api/seat-holds", { method: "POST", body: { showId: SHOW_ID, seatIds: ids }, cookie: customerCookie });
  expect(first.status).toBe(201);
  const second = await req("/api/seat-holds", { method: "POST", body: { showId: SHOW_ID, seatIds: ids }, cookie: other });
  expect(second.status).toBe(409);
  const holdId = (first.body.data as { holdId: string }).holdId;
  await req(`/api/seat-holds/${holdId}`, { method: "DELETE", cookie: customerCookie });
});

test("CONCURRENCY: 8 parallel holds on the same seat → exactly 1 succeeds", async () => {
  const ids = await freeSeats(1);
  const seatId = ids[0];
  const attempts = await Promise.all(
    Array.from({ length: 8 }, (_, i) =>
      req("/api/seat-holds", {
        method: "POST",
        body: { showId: SHOW_ID, seatIds: [seatId] },
        cookie: i % 2 === 0 ? customerCookie : staffCookie,
      })
    )
  );
  const success = attempts.filter((a) => a.status === 201);
  expect(success.length).toBe(1);
  const winnerCookie = attempts.indexOf(success[0]) % 2 === 0 ? customerCookie : staffCookie;
  const holdId = (success[0].body.data as { holdId: string }).holdId;
  await req(`/api/seat-holds/${holdId}`, { method: "DELETE", cookie: winnerCookie });
}, 60000);

test("hold expiry releases seats", async () => {
  const ids = await freeSeats(1);
  const r = await req("/api/seat-holds", { method: "POST", body: { showId: SHOW_ID, seatIds: ids }, cookie: customerCookie });
  const holdId = (r.body.data as { holdId: string }).holdId;
  expect(r.status).toBe(201);

  // Force-expire the hold directly in the database layer (simulate TTL passing)
  const { PrismaClient } = await import("@prisma/client");
  const db = new PrismaClient();
  await db.seatHold.update({ where: { id: holdId }, data: { expiresAt: new Date(Date.now() - 1000) } });
  await db.$disconnect();

  // A read of inventory must trigger lazy expiry and free the seat
  const inv = await req(`/api/shows/${SHOW_ID}/seats`);
  const seat = (inv.body.data as { seats: { id: string; status: string }[] }).seats.find((s) => s.id === ids[0]);
  expect(seat?.status).toBe("AVAILABLE");
}, 20000);

// ---------------- Booking → payment → ticket ----------------
test("booking requires an active hold; double-use of a hold is rejected", async () => {
  const ids = await freeSeats(1);
  const hold = await req("/api/seat-holds", { method: "POST", body: { showId: SHOW_ID, seatIds: ids }, cookie: customerCookie });
  expect(hold.status).toBe(201);
  const holdId = (hold.body.data as { holdId: string }).holdId;

  const b1 = await req("/api/bookings", { method: "POST", body: { holdId }, cookie: customerCookie });
  expect(b1.status).toBe(201);
  const b2 = await req("/api/bookings", { method: "POST", body: { holdId }, cookie: customerCookie });
  expect(b2.status).toBe(409);

  // cleanup: cancel the pending booking and release its seats directly
  const bookingId = (b1.body.data as { booking: { id: string } }).booking.id;
  const { PrismaClient } = await import("@prisma/client");
  const db = new PrismaClient();
  await db.$transaction([
    db.showSeat.updateMany({ where: { holdId }, data: { status: "AVAILABLE", holdId: null } }),
    db.booking.update({ where: { id: bookingId }, data: { status: "CANCELLED" } }),
  ]);
  await db.$disconnect();
}, 20000);

test("payment signature verification rejects tampered signatures", async () => {
  const ids = await freeSeats(1);
  const hold = await req("/api/seat-holds", { method: "POST", body: { showId: SHOW_ID, seatIds: ids }, cookie: customerCookie });
  const holdId = (hold.body.data as { holdId: string }).holdId;
  const booking = await req("/api/bookings", { method: "POST", body: { holdId }, cookie: customerCookie });
  const bookingId = (booking.body.data as { booking: { id: string } }).booking.id;

  const order = await req("/api/payments/create-order", { method: "POST", body: { bookingId }, cookie: customerCookie });
  const orderId = (order.body.data as { orderId: string }).orderId;
  expect(orderId).toBeTruthy();

  // tampered signature must fail AND not confirm the booking
  const bad = await req("/api/payments/verify", {
    method: "POST",
    body: { orderId, gatewayPaymentId: "demo_pay_fake", signature: "deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef" },
    cookie: customerCookie,
  });
  expect(bad.status).toBe(400);

  const detail = await req(`/api/bookings/${bookingId}`, { cookie: customerCookie });
  expect((detail.body.data as { booking: { status: string } }).booking.status).toBe("PENDING_PAYMENT");
}, 20000);

test("full happy path: hold → booking → demo pay → verify → CONFIRMED + tickets", async () => {
  const ids = await freeSeats(2);
  const hold = await req("/api/seat-holds", { method: "POST", body: { showId: SHOW_ID, seatIds: ids }, cookie: customerCookie });
  const holdId = (hold.body.data as { holdId: string }).holdId;
  const booking = await req("/api/bookings", { method: "POST", body: { holdId }, cookie: customerCookie });
  const bookingId = (booking.body.data as { booking: { id: string } }).booking.id;
  const total = (booking.body.data as { booking: { totalAmount: number; seats: unknown[] } }).booking;
  expect(total.seats.length).toBe(2);
  expect(total.totalAmount).toBeGreaterThan(0);

  const order = await req("/api/payments/create-order", { method: "POST", body: { bookingId }, cookie: customerCookie });
  const orderId = (order.body.data as { orderId: string }).orderId;

  const settle = await req("/api/payments/demo-settle", { method: "POST", body: { orderId, outcome: "success", method: "upi" } });
  const { gatewayPaymentId, signature } = settle.body.data as { gatewayPaymentId: string; signature: string };
  expect(gatewayPaymentId).toMatch(/^demo_pay_/);
  expect(signature).toHaveLength(64);

  const verify = await req("/api/payments/verify", { method: "POST", body: { orderId, gatewayPaymentId, signature }, cookie: customerCookie });
  expect(verify.status).toBe(200);
  const confirmed = verify.body.data as { payment: { status: string }; booking: { status: string; tickets: { code: string }[] } };
  expect(confirmed.payment.status).toBe("PAID");
  expect(confirmed.booking.status).toBe("CONFIRMED");
  expect(confirmed.booking.tickets).toHaveLength(2);
  expect(confirmed.booking.tickets[0].code).toMatch(/^C360T-/);

  // seats must now be BOOKED
  const inv = await req(`/api/shows/${SHOW_ID}/seats`);
  const statuses = (inv.body.data as { seats: { id: string; status: string }[] }).seats;
  for (const id of ids) expect(statuses.find((s) => s.id === id)?.status).toBe("BOOKED");

  // ---- staff scanner: check → redeem → duplicate rejected ----
  const code = confirmed.booking.tickets[0].code;
  const check = await req("/api/tickets/validate", { method: "POST", body: { code, action: "check" }, cookie: staffCookie });
  expect((check.body.data as { result: string }).result).toBe("VALID");

  const redeem = await req("/api/tickets/validate", { method: "POST", body: { code, action: "redeem" }, cookie: staffCookie });
  expect((redeem.body.data as { result: string }).result).toBe("SUCCESS");

  const dup = await req("/api/tickets/validate", { method: "POST", body: { code, action: "redeem" }, cookie: staffCookie });
  expect((dup.body.data as { result: string }).result).toBe("ALREADY_REDEEMED");

  // customers cannot validate tickets (staff-only)
  const forbidden = await req("/api/tickets/validate", { method: "POST", body: { code, action: "redeem" }, cookie: customerCookie });
  expect(forbidden.status).toBe(403);
}, 30000);

test("webhook rejects unsigned payloads", async () => {
  const r = await req("/api/payments/webhook", { method: "POST", body: { event: "payment.captured", eventId: "evt_x", payload: {} } });
  expect(r.status).toBe(401);
});

test("owner overview returns real metrics", async () => {
  const r = await req("/api/owner/overview", { cookie: ownerCookie });
  expect(r.status).toBe(200);
  const m = (r.body.data as { metrics: { totalBookings: number; revenue: number } }).metrics;
  expect(m.totalBookings).toBeGreaterThanOrEqual(0);
  expect(m.revenue).toBeGreaterThanOrEqual(0);
});
