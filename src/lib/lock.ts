// Concurrency control for transactional seat operations.
//
// SQLite (this sandbox) allows only ONE writer at a time; parallel write
// transactions surface as Prisma P2024 ("Timed out fetching a connection" /
// SQLITE_BUSY) or P2034 ("Transaction failed due to a write conflict or a
// deadlock"). The business logic already picks exactly one winner via the
// conditional atomic UPDATE — the losers were just surfacing as 500s.
//
// Two production-grade mechanisms fix this without weakening the guarantees:
//
//  1. withShowLock(showId, fn) — in-process per-show async mutex. All mutating
//     seat operations (holds, releases, booking confirmation) for the same show
//     are serialized, so parallel requests queue up instead of colliding inside
//     SQLite. Losers then re-read state and get a clean 409.
//
//  2. runWrite(fn) — retries a transaction on Prisma write-conflict errors
//     (P2034 / P2024 / SQLITE_BUSY) with exponential backoff. HttpErrors from
//     business rules are never retried. This also helps under PostgreSQL when
//     multiple app instances run against the same rows.

import { HttpError } from "./api";
import { Prisma } from "@prisma/client";

type LockMap = Map<string, Promise<unknown>>;
const globalLocks = globalThis as unknown as { __cine360ShowLocks?: LockMap };
const locks: LockMap = (globalLocks.__cine360ShowLocks ??= new Map());

/**
 * Serializes async work per show. Any number of concurrent callers get the
 * same ordering guarantee; each waits for the previous critical section to
 * finish before starting its own.
 */
export function withShowLock<T>(showId: string, fn: () => Promise<T>): Promise<T> {
  const previous = locks.get(showId) ?? Promise.resolve();
  const run = previous.catch(() => undefined).then(fn);
  // Update the tail; drop the entry once this chain settles to avoid leaks.
  locks.set(
    showId,
    run.catch(() => undefined)
  );
  void run.finally(() => {
    if (locks.get(showId) === (run as unknown)) locks.delete(showId);
  });
  return run;
}

function isWriteConflict(err: unknown): boolean {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError)) return false;
  // P2024: connection pool timeout (usually SQLITE_BUSY under contention)
  // P2034: transaction conflict / deadlock / database locked
  return err.code === "P2034" || err.code === "P2024";
}

const MAX_WRITE_ATTEMPTS = 5;

/**
 * Runs a write transaction, retrying only on transient SQLite/DB lock
 * conflicts. Business-rule HttpErrors propagate immediately (no retry).
 */
export async function runWrite<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_WRITE_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (err instanceof HttpError || !isWriteConflict(err) || attempt === MAX_WRITE_ATTEMPTS) {
        throw err;
      }
      const jitter = Math.floor(Math.random() * 40);
      await new Promise((r) => setTimeout(r, attempt * 60 + jitter));
    }
  }
  throw lastError;
}
