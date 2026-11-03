#!/usr/bin/env bash
set -u
cd /home/z/my-project
bun run dev > /tmp/dev.log 2>&1 &
SERVER_PID=$!
trap 'kill $SERVER_PID 2>/dev/null; agent-browser close 2>/dev/null' EXIT
for i in $(seq 1 60); do
  curl -s --max-time 2 http://localhost:3000/api/movies 2>/dev/null | head -c1 | grep -q '{' && break
  sleep 1
done
AB="agent-browser"
$AB set viewport 1440 900
$AB open http://localhost:3000/ > /dev/null 2>&1
$AB wait --load networkidle > /dev/null 2>&1
echo "== owner login eval =="
$AB eval "fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'owner@cine360.demo',password:'Demo@1234'}),credentials:'include'}).then(r=>r.json()).then(d=>JSON.stringify(d).slice(0,150))" 2>&1
echo "== cookies in browser =="
$AB eval "document.cookie" 2>&1
echo "== auth/me in browser =="
$AB eval "fetch('/api/auth/me',{credentials:'include'}).then(r=>r.json()).then(d=>JSON.stringify(d).slice(0,150))" 2>&1
$AB close > /dev/null 2>&1
