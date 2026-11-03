#!/usr/bin/env bash
# CINE 360 — visual UI tour v2 (hash-router URLs, adaptive login).
set -u
cd /home/z/my-project

OUT=/tmp/shots
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

shot() { sleep 2; $AB screenshot "$OUT/$1.png" > /dev/null 2>&1 && echo "✓ $1"; }

# 0 — plain deep link /movies must now redirect into the SPA (not 404)
$AB open http://localhost:3000/movies > /dev/null 2>&1
$AB wait --load networkidle > /dev/null 2>&1
shot 00-deeplink-redirect

# 1 — Home / hero
$AB open http://localhost:3000/ > /dev/null 2>&1
$AB wait --load networkidle > /dev/null 2>&1
shot 01-home-hero

# 2 — Movies grid + movie detail
$AB open "http://localhost:3000/#/movies" > /dev/null 2>&1
$AB wait --load networkidle > /dev/null 2>&1
shot 02-movies
MOVIE_ID=$(curl -s http://localhost:3000/api/movies | python3 -c "import json,sys; print(json.load(sys.stdin)['data']['movies'][0]['id'])")
$AB open "http://localhost:3000/#/movies/$MOVIE_ID" > /dev/null 2>&1
$AB wait --load networkidle > /dev/null 2>&1
shot 03-movie-detail

# 3 — Theatres
$AB open "http://localhost:3000/#/theatres" > /dev/null 2>&1
$AB wait --load networkidle > /dev/null 2>&1
shot 04-theatres

# 4 — Login page (may offer demo quick-fill)
$AB open "http://localhost:3000/#/login" > /dev/null 2>&1
$AB wait --load networkidle > /dev/null 2>&1
shot 05-login
# try demo quick-fill button if present
$AB find text "customer@cine360.demo" click > /dev/null 2>&1 || true
sleep 1
$AB snapshot -i > /tmp/login-snap.txt 2>&1
# fill email/password if empty, then submit
$AB find label "Email" fill "customer@cine360.demo" > /dev/null 2>&1 || true
$AB find label "Password" fill "Demo@1234" > /dev/null 2>&1 || true
$AB find role button click --name "Sign in" > /dev/null 2>&1 || true
sleep 3
$AB screenshot $OUT/06-after-login.png > /dev/null 2>&1 && echo "✓ after-login"

# 5 — 3D booking flow (the core of the product)
SHOW_ID=$(curl -s http://localhost:3000/api/shows | python3 -c "import json,sys; print(json.load(sys.stdin)['data']['shows'][0]['id'])")
$AB open "http://localhost:3000/#/book/$SHOW_ID" > /dev/null 2>&1
$AB wait --load networkidle > /dev/null 2>&1
sleep 8   # WebGL scene mount
$AB screenshot $OUT/07-book-3d.png > /dev/null 2>&1 && echo "✓ 3D booking"

# 6 — Owner dashboard via API-injected cookie
OWNER_COOKIE=$(curl -s -D- -o /dev/null -X POST http://localhost:3000/api/auth/login -H 'Content-Type: application/json' -d '{"email":"owner@cine360.demo","password":"Demo@1234"}' | grep -i '^set-cookie' | sed 's/^[Ss]et-[Cc]ookie: //' | cut -d';' -f1)
$AB cookies set "${OWNER_COOKIE%%=*}" "${OWNER_COOKIE#*=}" --url http://localhost:3000 > /dev/null 2>&1
$AB open "http://localhost:3000/#/owner" > /dev/null 2>&1
$AB wait --load networkidle > /dev/null 2>&1
shot 08-owner

# 7 — Admin dashboard
ADMIN_COOKIE=$(curl -s -D- -o /dev/null -X POST http://localhost:3000/api/auth/login -H 'Content-Type: application/json' -d '{"email":"admin@cine360.demo","password":"Demo@1234"}' | grep -i '^set-cookie' | sed 's/^[Ss]et-[Cc]ookie: //' | cut -d';' -f1)
$AB cookies set "${ADMIN_COOKIE%%=*}" "${ADMIN_COOKIE#*=}" --url http://localhost:3000 > /dev/null 2>&1
$AB open "http://localhost:3000/#/admin" > /dev/null 2>&1
$AB wait --load networkidle > /dev/null 2>&1
shot 09-admin

# 8 — Scan (staff scanner)
$AB open "http://localhost:3000/#/scan" > /dev/null 2>&1
$AB wait --load networkidle > /dev/null 2>&1
shot 10-scan

echo "--- page errors ---"
$AB errors 2>&1 | head -8
$AB close > /dev/null 2>&1
ls -la $OUT
echo "done"
