#!/usr/bin/env bash
# CINE 360 — dashboard screenshots via in-page login fetch (deterministic).
set -u
cd /home/z/my-project
OUT=/tmp/shots3
rm -rf $OUT && mkdir -p $OUT

bun run dev > /tmp/dev.log 2>&1 &
SERVER_PID=$!
trap 'kill $SERVER_PID 2>/dev/null; agent-browser close 2>/dev/null' EXIT
for i in $(seq 1 60); do
  curl -s --max-time 2 http://localhost:3000/api/movies 2>/dev/null | head -c1 | grep -q '{' && break
  sleep 1
done
echo "server ready (${i}s)"
AB="agent-browser"
$AB set viewport 1440 900

login_as() { # $1 email — eval-login, then force full reload so the store re-fetches the session
  $AB open http://localhost:3000/ > /dev/null 2>&1
  $AB wait --load networkidle > /dev/null 2>&1
  $AB eval "fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'$1',password:'Demo@1234'}),credentials:'include'}).then(r=>r.json()).then(d=>d.ok)" > /tmp/login-eval.txt 2>&1
  echo "login($1) → $(cat /tmp/login-eval.txt | head -1)"
}

goto() { # full document navigation (unique query param) then wait
  $AB open "http://localhost:3000/?_=$RANDOM$1" > /dev/null 2>&1
  $AB wait --load networkidle > /dev/null 2>&1
}

# ---- Owner ----
login_as "owner@cine360.demo"
goto "#/owner"
sleep 3
$AB screenshot $OUT/owner-overview.png > /dev/null 2>&1 && echo "✓ owner overview"
goto "#/owner?tab=auditoriums"
sleep 3
$AB screenshot $OUT/owner-auditoriums.png > /dev/null 2>&1 && echo "✓ owner auditoriums"
goto "#/owner?tab=shows"
sleep 3
$AB screenshot $OUT/owner-shows.png > /dev/null 2>&1 && echo "✓ owner shows"

# ---- Admin ----
login_as "admin@cine360.demo"
goto "#/admin"
sleep 3
$AB screenshot $OUT/admin-overview.png > /dev/null 2>&1 && echo "✓ admin overview"

# ---- Customer: my tickets + a confirmed ticket with QR ----
login_as "customer@cine360.demo"
goto "#/tickets"
sleep 3
$AB screenshot $OUT/my-tickets.png > /dev/null 2>&1 && echo "✓ my tickets"

# find a CONFIRMED booking id via API and open its ticket
TICKET_JSON=$(curl -s http://localhost:3000/api/bookings/my -H "Cookie: $(curl -s -D- -o /dev/null -X POST http://localhost:3000/api/auth/login -H 'Content-Type: application/json' -d '{"email":"customer@cine360.demo","password":"Demo@1234"}' | grep -i '^set-cookie' | sed 's/^[Ss]et-[Cc]ookie: //' | cut -d';' -f1)")
echo "$TICKET_JSON" | python3 -c "
import json,sys
d=json.load(sys.stdin)
conf=[b for b in d['data']['bookings'] if b.get('status')=='CONFIRMED']
print(conf[0]['id'] if conf else '')" > /tmp/booking-id.txt
BOOKING_ID=$(cat /tmp/booking-id.txt)
echo "confirmed booking: $BOOKING_ID"
if [ -n "$BOOKING_ID" ]; then
  goto "#/tickets/$BOOKING_ID"
  sleep 3
  $AB screenshot $OUT/ticket-detail.png > /dev/null 2>&1 && echo "✓ ticket detail"
fi

echo "--- page errors ---"
$AB errors 2>&1 | head -6
$AB close > /dev/null 2>&1
ls -la $OUT
