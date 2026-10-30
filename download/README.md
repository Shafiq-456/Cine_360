# 🎬 CINE 360 — Immersive 3D Cinema Ticket Booking Ecosystem

**Your Cinema. Your View. Your Seat.**
Built by **FROST & FLAME** — Mohammed Shafiq AS · Jaiyanth B

CINE 360 is a multi-theatre cinema booking platform where customers **walk into a virtual 3D
auditorium**, select individual chairs, **preview the screen from the seat's exact eye position**,
compare sightlines with real geometry measurements, and complete a fully transactional booking —
QR ticket included.

---

## ⚡ Quick start (local)

```bash
# 1. install dependencies
bun install          # or npm install

# 2. configure environment
cp .env.example .env # defaults work out of the box for demo mode

# 3. create the database schema + demo data
bun run db:push
bun scripts/generate-posters.ts   # procedural demo artwork
bun scripts/seed.ts               # demo accounts, theatres, movies, shows

# 4. start the realtime seat-update hub (separate terminal)
cd mini-services/realtime-hub && bun run dev

# 5. start the app
bun run dev          # http://localhost:3000
```

### Demo accounts (all use password `Demo@1234`)

| Account | Role | Purpose |
|---|---|---|
| `customer@cine360.demo` | Customer | Book seats, hold, test-pay, own QR tickets |
| `owner@cine360.demo` | Theatre owner | Frost Cinemas (APPROVED) — full owner console |
| `owner2@cine360.demo` | Theatre owner | Flame Multiplex (**PENDING**) — demonstrates the admin approval flow |
| `staff@cine360.demo` | Gate staff | Frost Cinemas — QR ticket scanner |
| `admin@cine360.demo` | Super admin | Platform approvals, refunds, settings, audit logs |

Demo accounts authenticate through the **real backend** (bcrypt + JWT + role checks). They do not
bypass authorization anywhere.

---

## 🎟️ The MVP demo journey (primary acceptance criterion)

1. Open CINE 360 → hero → **ENTER 3D CINEMA EXPERIENCE**
2. Browse **Movies** (search / language / genre filters)
3. Open a movie → see theatres & showtimes → pick a **show**
4. The **3D auditorium** loads (procedural demo geometry, labelled as such)
5. **Orbit** (drag/scroll/pan) or switch to **Walk** mode (WASD + mouse, collision-safe)
6. **Click a green seat** → selection panel shows row/seat/category/price/availability
7. Press **Preview** → **Seat Experience Mode**: camera moves to the seat's calibrated eye
   position, shows screen distance, horizontal & vertical angles, derived sightline grade
8. **Compare** pins measurements for multiple seats into a comparison table
9. Select **multiple seats** → total pricing
10. **Hold seats** → transactional 5-minute hold (backend-verified)
11. **Demo payment** (clearly labelled TEST MODE: order → gateway settle → HMAC verification)
12. Booking CONFIRMED → **QR tickets** generated
13. **My Tickets** shows the QR codes
14. Sign in as staff → **Gate Scanner** → redeem the QR
15. Try re-scanning → backend rejects the duplicate

The accessible **2D seat map** (keyboard focusable, screen-reader labelled) is available from the
booking screen at any time; it is also the automatic fallback when WebGL is unavailable.

---

## 🧱 What's inside

```
src/
  app/
    page.tsx                 # single-route SPA shell (sandbox preview constraint)
    api/                     # REST API (route handlers, Next.js 16)
      auth/*                 # register, login, logout, me
      movies/* theatres/*    # discovery + detail
      shows/* seats          # showtime + live seat inventory
      seat-holds/*           # transactional holds (5-min TTL)
      bookings/*             # create from hold, my bookings, detail
      payments/*             # create-order, verify, demo-settle, webhook
      tickets/*              # detail + staff validate/redeem
      owner/*                # overview, theatres, auditoriums+builder, model upload, shows, bookings, staff, analytics
      admin/*                # overview, theatres, users, movies, bookings, refunds, settings, audit-logs
  components/cine/
    CineApp.tsx              # hash router shell, nav, footer
    three/
      AuditoriumScene.tsx    # R3F engine: room, instanced seats, camera rig (orbit/walk/preview)
      seatAssets.ts          # merged low-poly seat geometry, canvas textures
    views/                   # Home, Movies, MovieDetail, Theatres, TheatreDetail,
                             # Book (3D + HUD + panel), SeatMap2D, Checkout, Tickets,
                             # TicketDetail, Login, Owner console, Admin console, Scanner
  lib/
    geometry.ts              # layout generator + SeatVision measurement math (shared)
    inventory.ts             # live per-show inventory + hold engine
    booking.ts               # booking transactions, confirmation, refunds, sweeps
    payments.ts              # demo gateway (HMAC) + webhook processing (idempotent)
    auth.ts                  # JWT (jose) + bcrypt + role guards
    events.ts                # server → realtime hub emitter
mini-services/realtime-hub/  # socket.io seat-inventory broadcast (ports 3003/3004)
prisma/schema.prisma         # full relational schema (see below)
scripts/                     # seed + poster generation
tests/booking.test.ts        # API test suite (bun test)
```

### Database (Prisma / SQLite for this build)

`users, theatres, theatre_staff, auditoriums, seat_categories, seats, auditorium_models,
movies, shows, show_seats, seat_holds, bookings, booking_seats, payments, tickets,
ticket_validations, audit_logs, settings`

Key design points (as specified):
- `seats` = permanent **physical** seat definitions with calibrated coordinates
  (x lateral, z distance from screen, baseY floor elevation, eye height).
- `show_seats` = **per-show inventory overlay**: status (AVAILABLE / HELD / BOOKED / UNAVAILABLE)
  and price, unique per `(show, seat)`. Booking state is never stored in frontend memory.
- `bookings` → `booking_seats` → `tickets` (one ticket per seat, unique opaque QR code).
- `payments` carries provider/orderId/signature/eventId (unique → idempotent webhook replays).
- `audit_logs` records registrations, approvals, redemptions, refunds, settings changes.

---

## 🔐 Booking integrity

- **Transactional holds**: conditional atomic update
  (`UPDATE … WHERE status='AVAILABLE'`) inside a transaction + DB-level
  `unique(showId, seatId)` backstop. **8 parallel attempts → exactly 1 winner** (tested).
- **Hold expiry**: lazy sweep on every inventory read / hold / booking (5-min TTL, configurable
  via `HOLD_TTL_SECONDS`), plus socket events on changes.
- **Payment verification**: server-side HMAC signature check (exactly like Razorpay's
  `razorpay_signature`). A booking is **never** confirmed from a frontend success screen.
- **Idempotency**: payment events carry unique event ids; verify/redeem endpoints are replay-safe.
- **Failed payments**: booking is cancelled and seats are returned to inventory.
- **Refunds** (admin): release seats, void tickets, mark payment refunded — audited.

## 📡 Realtime

A socket.io hub (`mini-services/realtime-hub`) broadcasts `seats:changed` to per-show rooms
whenever inventory changes. Clients join `show:{id}` on the booking screen; a 15-second polling
fallback keeps views fresh if the hub is down.

## 💳 Payments — honest demo mode

This build ships with a **clearly labelled DEMO gateway** that mirrors Razorpay's flow shape:
`create-order → gateway settle (signs with HMAC-SHA256) → server verify → confirm`.
Nothing pretends to be a real transaction, and the UI badges it **TEST MODE** everywhere.

To go live with Razorpay (production checklist):
1. `bun add razorpay` and set `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` (+ `RAZORPAY_WEBHOOK_SECRET`).
2. Replace `demoSettle()` calls with real `orders.create()` + Checkout SDK on the client.
3. Implement signature check `hmac_sha256(order_id + '|' + payment_id, KEY_SECRET)` in
   `verifyAndConfirm()` (the routine is already provider-agnostic).
4. Point the Razorpay dashboard webhook at `POST /api/payments/webhook` and verify
   `x-razorpay-signature` in `processWebhook()`.
The demo settle endpoint auto-disables when real keys are present.

## 🧊 3D engine notes

- Seats are ONE merged low-poly geometry rendered through instancing (1 draw call), each instance
  individually raycast-selectable and colour-coded (colour is always paired with text labels).
- Camera modes: **Orbit** (drag/zoom/pan), **Walk** (pointer-lock + WASD/arrows, bounds + seat
  collision, stepped-floor eye height), **Seat Experience** (tween to the seat's eye position,
  look-at screen centre).
- **SeatVision** computes distance, horizontal/vertical angles purely from configured geometry.
  The sightline grade is a *derived indicator* using THX/SMPTE-style bands and is labelled as
  such — no invented "guaranteed view" claims. Demo geometry is explicitly badged
  `DEMO GEOMETRY`; owner-uploaded calibrated models are badged `CALIBRATED MODEL`.
- Performance: adaptive DPR, no shadow maps, fog culling, instancing, lazy loading of the 3D
  bundle, WebGL detection with automatic 2D fallback.

## 🧪 Tests

```bash
bun test tests/booking.test.ts    # requires dev server running on :3000
```
14 tests cover RBAC, hold lifecycle, hold-expiry release, 8-way concurrent double-booking
prevention, tampered payment signatures, the full happy path to CONFIRMED + tickets, staff
validation + duplicate rejection, webhook signature enforcement, and owner metrics.

## 🚀 Deployment (production mapping)

| Concern | This sandbox build | Production target |
|---|---|---|
| Frontend + BFF | Next.js 16 SPA + API routes (one port) | Vercel (frontend) — split API per below |
| Backend | Next.js route handlers | FastAPI + Pydantic + SQLAlchemy 2.0 + Alembic on Render/Railway |
| Database | SQLite (file) | PostgreSQL (Supabase) — schema is portable; swap the datasource, run migrations |
| Realtime | socket.io mini-service | Same service on Render, or Supabase Realtime channels |
| Auth | JWT (jose) httpOnly cookie + bcrypt | Same, or Supabase Auth / Firebase Auth with server-side token verification + RBAC table mapping |
| Payments | Demo gateway (HMAC) | Razorpay (see checklist above) |
| Assets | `/public/posters` (procedural), GLB uploads to `public/uploads/models` | Supabase Storage / S3 with signed URLs + GLB validation |
| Caching/coordination | Lazy DB sweeps | Redis for hold coordination + Pub/Sub fan-out (DB stays authoritative) |

The schema in `prisma/schema.prisma` maps 1:1 to the specified PostgreSQL design (SQLite is used
here only because the sandbox runs a single Next.js service). SQLAlchemy/Alembic equivalents of
every table are straightforward — no Prisma-specific constructs are used beyond portable types.

## ⚙️ Environment variables

See `.env.example`. Everything works with defaults in demo mode.

## 🧭 API summary

`POST /api/auth/register|login|logout` · `GET /api/auth/me`
`GET /api/movies[?q&genre&language&status]` · `GET /api/movies/{id}`
`GET /api/theatres[?city&q]` · `GET /api/theatres/{id}`
`GET /api/shows?movieId&date&theatreId` · `GET /api/shows/{id}/seats` (live inventory)
`POST /api/seat-holds` · `DELETE /api/seat-holds/{id}`
`POST /api/bookings` · `GET /api/bookings/my` · `GET /api/bookings/{id}`
`POST /api/payments/create-order|verify|demo-settle|webhook`
`GET /api/tickets/{id}` · `POST /api/tickets/validate`
`/api/owner/*` (overview, theatres, auditoriums, model, shows, bookings, staff, analytics)
`/api/admin/*` (overview, theatres, users, movies, bookings, refunds, settings, audit-logs)

Errors use consistent envelopes `{ ok: false, error }` with proper HTTP status codes
(401 unauthenticated, 403 forbidden, 409 conflicts, 410 expired holds, 422 validation).

---

**CINE 360 — Don't Just Book a Seat. Experience It Before You Sit.**
