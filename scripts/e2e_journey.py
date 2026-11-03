#!/usr/bin/env python3
"""CINE 360 — End-to-end MVP journey via the live HTTP API.
Mirrors the 17-step acceptance journey: browse → movie → theatre → show →
3D inventory → seat hold → booking → demo payment → QR ticket → staff scan.
Run: python3 scripts/e2e_journey.py   (dev server must be up on :3000)
"""
import json
import urllib.request
import urllib.error
import sys

BASE = "http://localhost:3000"
STEP = [0]


def call(path, method="GET", body=None, cookie=None):
    req = urllib.request.Request(BASE + path, method=method)
    req.add_header("Content-Type", "application/json")
    if cookie:
        req.add_header("Cookie", cookie)
    data = json.dumps(body).encode() if body is not None else None
    try:
        with urllib.request.urlopen(req, data=data, timeout=30) as res:
            set_cookie = res.headers.get("Set-Cookie", "").split(";")[0] or None
            return res.status, json.loads(res.read().decode()), set_cookie
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw), None
        except Exception:
            return e.code, {"raw": raw[:200]}, None


def step(title):
    STEP[0] += 1
    print(f"\n[{STEP[0]:02d}] {title}")


def check(cond, detail=""):
    print(f"     {'✅' if cond else '❌'} {detail}")
    if not cond:
        FAILURES.append(detail)
    return cond


FAILURES = []

# ── Step 1-2: browse movies ────────────────────────────────────────────────
step("Browse movies (GET /api/movies)")
s, d, _ = call("/api/movies")
check(s == 200 and d["ok"], f"{len(d['data']['movies'])} movies listed")
featured = [m for m in d["data"]["movies"] if m.get("featured")]
movie = featured[0] if featured else d["data"]["movies"][0]
print(f"     selected: {movie['title']} ({movie['certification']}, {movie['durationMins']} min)")

step("Open movie detail (GET /api/movies/{id})")
s, d, _ = call(f"/api/movies/{movie['id']}")
check(s == 200, f"detail ok: {d['data']['movie']['title']}")

# ── Step 3-5: theatre → show ───────────────────────────────────────────────
step("Browse theatres (GET /api/theatres)")
s, d, _ = call("/api/theatres")
theatres = d["data"]["theatres"]
check(s == 200 and len(theatres) > 0, f"{len(theatres)} approved theatres")
theatre = theatres[0]
print(f"     selected: {theatre['name']} ({theatre['city']})")

step("Open theatre detail (GET /api/theatres/{id})")
s, d, _ = call(f"/api/theatres/{theatre['id']}")
check(s == 200, f"auditoriums: {[a['name'] for a in d['data']['theatre']['auditoriums']]}")

step("List shows for movie (GET /api/shows?movieId=...)")
s, d, _ = call(f"/api/shows?movieId={movie['id']}")
shows = d["data"]["shows"]
check(s == 200 and len(shows) > 0, f"{len(shows)} shows found")
show = shows[0]
print(f"     selected: {show.get('format')} · {show.get('language')} · startsAt {show.get('startsAt')}")

# ── Step 6-7: 3D inventory ─────────────────────────────────────────────────
step("Enter 3D auditorium — per-show seat inventory (GET /api/shows/{id}/seats)")
s, inv, _ = call(f"/api/shows/{show['id']}/seats")
seats = inv["data"]["seats"]
check(s == 200 and len(seats) > 0, f"{len(seats)} seats with 3D geometry (x,z,baseY,eyeHeight)")
check(all("x" in s and "z" in s and "eyeHeight" in s for s in seats[:50]), "geometry fields present on seats")
print(f"     status counts: {inv['data']['counts']}")

step("Auditorium 3D model descriptor (GET /api/auditoriums/{id}/model)")
aud_id = inv["data"]["show"]["auditorium"]["id"]
s, d, _ = call(f"/api/auditoriums/{aud_id}/model")
check(s == 200, f"model kind = {d['data']['model']['kind']} ({d['data']['model'].get('label', 'uploaded GLB')})")

step("Physical seat map (GET /api/auditoriums/{id}/seats)")
s, d, _ = call(f"/api/auditoriums/{aud_id}/seats")
check(s == 200 and d["data"]["count"] == len(seats), f"{d['data']['count']} physical seats calibrated")

# ── Step 8: sign in ────────────────────────────────────────────────────────
step("Customer sign-in (POST /api/auth/login)")
s, d, cookie = call("/api/auth/login", "POST", {"email": "customer@cine360.demo", "password": "Demo@1234"})
check(s == 200 and cookie, f"session cookie issued for {d['data']['user']['email']}")

step("Session check (GET /api/auth/me)")
s, d, _ = call("/api/auth/me", cookie=cookie)
check(s == 200 and d["data"]["user"]["role"] == "CUSTOMER", f"role={d['data']['user']['role']}")

# ── Step 9-11: pick seats, hold ────────────────────────────────────────────
step("Pick two free seats and create seat hold (POST /api/seat-holds)")
free = [s0 for s0 in seats if s0["status"] == "AVAILABLE"][:2]
picked = [f["id"] for f in free]
labels = [f"{f['rowLabel']}{f['seatNumber']}" for f in free]
print(f"     picked seats: {labels} · prices ₹{free[0]['price']} / ₹{free[1]['price']}")
s, d, _ = call("/api/seat-holds", "POST", {"showId": show["id"], "seatIds": picked}, cookie)
check(s == 201, f"hold created, expires {d['data']['expiresAt']}")
hold_id = d["data"]["holdId"]

step("Verify seats now HELD for everyone else")
s, inv2, _ = call(f"/api/shows/{show['id']}/seats")
statuses = {s0["id"]: s0["status"] for s0 in inv2["data"]["seats"]}
check(all(statuses[p] == "HELD" for p in picked), f"both seats report HELD")

# ── Step 12-13: booking + payment ──────────────────────────────────────────
step("Create booking from hold (POST /api/bookings)")
s, d, _ = call("/api/bookings", "POST", {"holdId": hold_id}, cookie)
check(s == 201, f"booking {d['data']['booking']['reference']} · total ₹{d['data']['booking']['totalAmount']}")
booking = d["data"]["booking"]
booking_id = booking["id"]

step("Create payment order (POST /api/payments/create-order)")
s, d, _ = call("/api/payments/create-order", "POST", {"bookingId": booking_id}, cookie)
check(s == 201 or s == 200, f"demo gateway order {d['data']['orderId'][:20]}…")
order_id = d["data"]["orderId"]

step("Settle payment on the demo gateway (POST /api/payments/demo-settle)")
s, d, _ = call("/api/payments/demo-settle", "POST", {"orderId": order_id, "outcome": "success", "method": "upi"})
check(s == 200, f"gatewayPaymentId={d['data']['gatewayPaymentId']}")
gpid, sig = d["data"]["gatewayPaymentId"], d["data"]["signature"]

step("Verify signature & confirm (POST /api/payments/verify)")
s, d, _ = call("/api/payments/verify", "POST",
               {"orderId": order_id, "gatewayPaymentId": gpid, "signature": sig}, cookie)
check(s == 200 and d["data"]["booking"]["status"] == "CONFIRMED",
      f"booking status = {d['data']['booking']['status']}")
tickets = d["data"]["booking"]["tickets"]
check(len(tickets) == 2, f"{len(tickets)} QR tickets issued (codes {tickets[0]['code']}…)")
ticket_code = tickets[0]["code"]

# ── Step 14-15: ticket with QR ─────────────────────────────────────────────
step("Open ticket detail with QR (GET /api/tickets/{id})")
ticket_id = tickets[0]["id"]
s, d, _ = call(f"/api/tickets/{ticket_id}", cookie=cookie)
check(s == 200 and d["data"]["ticket"].get("qrDataUrl", "").startswith("data:image/png;base64,"),
      "server-rendered QR present (encodes opaque ticket code only)")

step("My tickets list (GET /api/bookings/my)")
s, d, _ = call("/api/bookings/my", cookie=cookie)
check(s == 200 and any(b["id"] == booking_id for b in d["data"]["bookings"]),
      f"{len(d['data']['bookings'])} bookings in history incl. {booking['reference']}")

# ── Step 16: staff scanner ─────────────────────────────────────────────────
step("Staff sign-in and ticket SCAN — check (POST /api/tickets/validate)")
s, d, staff_cookie = call("/api/auth/login", "POST", {"email": "staff@cine360.demo", "password": "Demo@1234"})
check(s == 200, "staff session ok")
s, d, _ = call("/api/tickets/validate", "POST", {"code": ticket_code, "action": "check"}, staff_cookie)
check(s == 200 and d["data"]["result"] == "VALID", f"scan result: {d['data']['result']}")

step("Redeem ticket at the gate, then try duplicate")
s, d, _ = call("/api/tickets/validate", "POST", {"code": ticket_code, "action": "redeem"}, staff_cookie)
check(s == 200 and d["data"]["result"] == "SUCCESS", "first redeem → SUCCESS")
s, d, _ = call("/api/tickets/validate", "POST", {"code": ticket_code, "action": "redeem"}, staff_cookie)
check(s == 200 and d["data"]["result"] == "ALREADY_REDEEMED", "second redeem → ALREADY_REDEEMED (fraud blocked)")

# ── Step 17: negative path — no double booking ─────────────────────────────
step("Concurrency guard: second user tries to book a now-BOOKED seat (expect 409)")
s, d, owner_cookie = call("/api/auth/login", "POST", {"email": "owner@cine360.demo", "password": "Demo@1234"})
s, d, _ = call("/api/seat-holds", "POST", {"showId": show["id"], "seatIds": picked}, owner_cookie)
check(s == 409, f"hold on BOOKED seat rejected with {s} — {d.get('error', '')[:60]}")

# ── summary ────────────────────────────────────────────────────────────────
print("\n" + "=" * 64)
if FAILURES:
    print(f"RESULT: ❌ {len(FAILURES)} check(s) failed")
    for f in FAILURES:
        print("   -", f)
    sys.exit(1)
print("RESULT: ✅ Full MVP booking journey passed — all checks green")
