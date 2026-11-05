// Rolling auto-programmer: keeps a rolling 7-day window of upcoming shows for
// every PUBLISHED auditorium in APPROVED theatres, so movies always have
// bookable showtimes (the original bug: hardcoded seed dates went stale and
// every movie showed "No upcoming shows yet").
//
// The routine is idempotent and race-safe:
//  • It only fills (day, slot, auditorium) combos that do not exist yet.
//  • Show has a DB-level unique(auditoriumId, startsAt) — a parallel run that
//    loses the race gets P2002 and is ignored.
//  • Called opportunistically (throttled to once per 5 min per process) from
//    the showtimes endpoints, and on demand from the Owner Console button.
import { db } from "./db";
import { Prisma } from "@prisma/client";

const SLOT_MINUTES = [10 * 60, 13 * 60 + 30, 17 * 60, 20 * 60 + 30]; // civil IST times
const IST_OFFSET_MIN = 330; // UTC+5:30
const SHOWS_PER_DAY = 3; // slots per auditorium per day

type EnsureResult = { created: number; skipped: boolean };

const globalState = globalThis as unknown as { __cine360LastScheduleRun?: number };

function istSlotStart(dayOffset: number, slotMinutes: number): Date {
  const now = new Date();
  const utcMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  // Civil IST day start expressed in UTC
  const istDayStartUtc = utcMidnight - IST_OFFSET_MIN * 60000;
  // Day 0 = today; shows earlier than (now + 30 min) are skipped by callers' date filter anyway,
  // but we still schedule them so "today" tabs are populated all day.
  return new Date(istDayStartUtc + dayOffset * 86400000 + slotMinutes * 60000);
}

export async function ensureRollingSchedule(opts?: { days?: number; force?: boolean }): Promise<EnsureResult> {
  const days = opts?.days ?? 7;
  const last = globalState.__cine360LastScheduleRun ?? 0;
  if (!opts?.force && Date.now() - last < 5 * 60 * 1000) return { created: 0, skipped: true };
  globalState.__cine360LastScheduleRun = Date.now();

  const [auditoriums, movies] = await Promise.all([
    db.auditorium.findMany({
      where: { status: "PUBLISHED", theatre: { status: "APPROVED" } },
      include: { seats: { include: { category: true } } },
    }),
    db.movie.findMany({ where: { status: "NOW_SHOWING" }, orderBy: { createdAt: "asc" } }),
  ]);
  if (auditoriums.length === 0 || movies.length === 0) return { created: 0, skipped: false };

  const formats = ["3D", "2D", "IMAX 2D"];
  let created = 0;

  for (let a = 0; a < auditoriums.length; a++) {
    const aud = auditoriums[a];
    if (aud.seats.length === 0) continue;
    for (let day = 0; day < days; day++) {
      for (let s = 0; s < SHOWS_PER_DAY; s++) {
        const slotIdx = (a * 2 + day + s * 2) % SLOT_MINUTES.length; // deterministic rotation
        const startsAt = istSlotStart(day, SLOT_MINUTES[slotIdx]);
        const movie = movies[(a * 5 + day * 3 + s) % movies.length];
        const format = formats[(day + s) % formats.length];
        const language = movie.languages ? (JSON.parse(movie.languages as string)[0] as string) : "English";

        try {
          const show = await db.show.create({
            data: { movieId: movie.id, auditoriumId: aud.id, startsAt, language, format, status: "SCHEDULED" },
          });
          const seatRows = aud.seats.map((seat) => ({
            showId: show.id,
            seatId: seat.id,
            status: "AVAILABLE",
            price: seat.category.basePrice,
          }));
          for (let c = 0; c < seatRows.length; c += 60) {
            await db.showSeat.createMany({ data: seatRows.slice(c, c + 60) });
          }
          created++;
        } catch (e) {
          // unique(auditoriumId, startsAt) lost the race or slot already exists — fine.
          if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
        }
      }
    }
  }
  return { created, skipped: false };
}
