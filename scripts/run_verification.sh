#!/usr/bin/env bash
# CINE 360 — one-shot verification: boot dev server, run test suite + E2E journey.
set -u
cd /home/z/my-project

echo "════════ [1/4] Booting dev server ════════"
rm -f /tmp/dev.log
bun run dev > /tmp/dev.log 2>&1 &
SERVER_PID=$!

cleanup() { kill $SERVER_PID 2>/dev/null; wait $SERVER_PID 2>/dev/null; }
trap cleanup EXIT

# wait for readiness (JSON from /api/movies)
ready=0
for i in $(seq 1 60); do
  if curl -s --max-time 2 http://localhost:3000/api/movies 2>/dev/null | head -c1 | grep -q '{'; then
    ready=1; break
  fi
  sleep 1
done
if [ "$ready" -ne 1 ]; then
  echo "❌ Server failed to become ready. Log tail:"; tail -30 /tmp/dev.log; exit 1
fi
echo "✅ Server ready on :3000 (after ${i}s)"

echo ""
echo "════════ [2/4] bun test — booking engine suite ════════"
bun test tests/booking.test.ts 2>&1 | tail -30
TEST_EXIT=$?

echo ""
echo "════════ [3/4] E2E MVP journey (17 steps) ════════"
python3 scripts/e2e_journey.py
JOURNEY_EXIT=$?

echo ""
echo "════════ [4/4] Server error scan ════════"
if grep -Eqi "unhandled|ECONNREFUSED|Cannot find module|Internal Server Error" /tmp/dev.log; then
  grep -Ei "unhandled|ECONNREFUSED|Cannot find module|Internal Server Error" /tmp/dev.log | head -5
  echo "⚠️  suspicious log lines above"
else
  echo "✅ no server errors in dev.log"
fi

echo ""
echo "════════ SUMMARY ════════"
echo "bun test exit: $TEST_EXIT · journey exit: $JOURNEY_EXIT"
[ $TEST_EXIT -eq 0 ] && [ $JOURNEY_EXIT -eq 0 ] && echo "ALL GREEN" || echo "FAILURES PRESENT"
exit $(( TEST_EXIT || JOURNEY_EXIT ))
