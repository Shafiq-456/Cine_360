// One-off utility: force-run the rolling auto-scheduler so the 7-day window
// is pre-filled after a fresh seed (avoids a slow first API request).
// Usage: bun scripts/warm_schedule.ts
import { ensureRollingSchedule } from "../src/lib/schedule";
import { db } from "../src/lib/db";

const t0 = Date.now();
const res = await ensureRollingSchedule({ force: true });
console.log(`scheduler: created=${res.created} skipped=${res.skipped} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

const [theatres, auds, movies, shows] = await Promise.all([
  db.theatre.count(),
  db.auditorium.count(),
  db.movie.count(),
  db.show.count(),
]);
const cities = await db.theatre.findMany({ where: { status: "APPROVED" }, select: { city: true } });
const cityCounts = new Map<string, number>();
for (const { city } of cities) cityCounts.set(city, (cityCounts.get(city) ?? 0) + 1);
console.log(`theatres=${theatres} auditoriums=${auds} movies=${movies} shows(total)=${shows}`);
console.log("approved cities:", [...cityCounts.entries()].sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c}:${n}`).join("  "));
await db.$disconnect();
