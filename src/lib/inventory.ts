// Server-side seat inventory + transactional hold engine.
// PostgreSQL remains the authoritative source; SQLite here plays the same role.
// Concurrency protection: conditional atomic UPDATE ... WHERE status='AVAILABLE'
// inside a transaction + DB-level unique(showId, seatId) constraint.
import { db } from "./db";
import { SEAT_STATUS, HOLD_TTL_SECONDS } from "./constants";
import { HttpError } from "./api";
import { withShowLock, runWrite } from "./lock";
import { emitShowInventoryChanged } from "./events";
import type { LayoutConfig } from "./geometry";
import { generateLayout } from "./geometry";

/** Releases seats held by expired holds. Called before every inventory read / hold / booking. */
export async function expireStaleHolds(showId?: string): Promise<string[]> {
  const expired = await db.seatHold.findMany({
    where: { status: "ACTIVE", expiresAt: { lte: new Date() }, ...(showId ? { showId } : {}) },
    select: { id: true, showId: true },
  });
  if (expired.length === 0) return [];
  const ids = expired.map((h) => h.id);
  const showIds: string[] = Array.from(new Set<string>(expired.map((h) => h.showId)));
  await runWrite(() =>
    db.$transaction([
      db.showSeat.updateMany({
        where: { holdId: { in: ids }, status: SEAT_STATUS.HELD },
        data: { status: SEAT_STATUS.AVAILABLE, holdId: null },
      }),
      db.seatHold.updateMany({ where: { id: { in: ids } }, data: { status: "EXPIRED" } }),
    ])
  );
  showIds.forEach((sid) => emitShowInventoryChanged(sid));
  return ids;
}

/** Creates a transactional hold on multiple seats for one user. Throws 409 on conflict. */
export async function createSeatHold(params: { showId: string; seatIds: string[]; userId: string }) {
  const ttl = Number(process.env.HOLD_TTL_SECONDS || HOLD_TTL_SECONDS);
  await expireStaleHolds(params.showId);

  const show = await db.show.findUnique({
    where: { id: params.showId },
    include: { auditorium: true },
  });
  if (!show) throw new HttpError("Show not found", 404);
  if (show.status !== "SCHEDULED") throw new HttpError("This show is no longer bookable", 409);
  if (show.startsAt.getTime() < Date.now()) throw new HttpError("This show has already started", 409);

  // Serialize per-show so parallel hold attempts queue cleanly instead of
  // colliding inside SQLite's single-writer lock; retry absorbs residual
  // write conflicts. Exactly one concurrent attempt still wins.
  const hold = await withShowLock(params.showId, () =>
    runWrite(() =>
      db.$transaction(async (tx) => {
    // Validate every requested seat belongs to this show and is currently free
    const rows = await tx.showSeat.findMany({
      where: { id: { in: params.seatIds }, showId: params.showId },
      select: { id: true, status: true, seatId: true },
    });
    if (rows.length !== params.seatIds.length) {
      throw new HttpError("One or more selected seats do not belong to this show", 422);
    }
    const notFree = rows.filter((r) => r.status !== SEAT_STATUS.AVAILABLE);
    if (notFree.length > 0) {
      throw new HttpError(
        "Some of your selected seats were just taken by another user. Please pick different seats.",
        409
      );
    }

    const expiresAt = new Date(Date.now() + ttl * 1000);
    const created = await tx.seatHold.create({
      data: { showId: params.showId, userId: params.userId, expiresAt, status: "ACTIVE" },
    });

    // Atomic conditional update — the concurrency backstop
    const claimed = await tx.showSeat.updateMany({
      where: { id: { in: params.seatIds }, showId: params.showId, status: SEAT_STATUS.AVAILABLE },
      data: { status: SEAT_STATUS.HELD, holdId: created.id, updatedAt: new Date() },
    });
    if (claimed.count !== params.seatIds.length) {
      // rolls back the whole transaction (hold row + partial claims)
      throw new HttpError("Seat conflict: one or more seats are no longer available", 409);
    }
    return created;
      })
    )
  );

  emitShowInventoryChanged(params.showId);
  return hold;
}

/** Releases an active hold owned by the user (user abandoned checkout). */
export async function releaseSeatHold(holdId: string, userId: string) {
  const hold = await db.seatHold.findUnique({ where: { id: holdId } });
  if (!hold) throw new HttpError("Hold not found", 404);
  if (hold.userId !== userId) throw new HttpError("You can only release your own holds", 403);
  if (hold.status !== "ACTIVE") return; // already released/converted/expired
  await withShowLock(hold.showId, () =>
    runWrite(() =>
      db.$transaction([
        db.showSeat.updateMany({
          where: { holdId: hold.id, status: SEAT_STATUS.HELD },
          data: { status: SEAT_STATUS.AVAILABLE, holdId: null },
        }),
        db.seatHold.update({ where: { id: hold.id }, data: { status: "EXPIRED" } }),
      ])
    )
  );
  emitShowInventoryChanged(hold.showId);
}

export type InventorySeat = {
  id: string;
  rowLabel: string;
  seatNumber: number;
  rowIndex: number;
  colIndex: number;
  x: number;
  z: number;
  baseY: number;
  eyeHeight: number;
  isAccessible: boolean;
  category: string;
  categoryColor: string;
  price: number;
  status: string;
};

/** Full per-show inventory for the 3D engine + 2D map. */
export async function getShowInventory(showId: string) {
  await expireStaleHolds(showId);
  const show = await db.show.findUnique({
    where: { id: showId },
    include: {
      movie: true,
      auditorium: { include: { theatre: true, categories: true } },
      showSeats: { include: { seat: { include: { category: true } } } },
    },
  });
  if (!show) throw new HttpError("Show not found", 404);

  const layout: LayoutConfig = JSON.parse(show.auditorium.layoutConfig);
  const { dimensions } = generateLayout(layout);

  const seats: InventorySeat[] = show.showSeats
    .map((ss): InventorySeat => ({
      id: ss.id,
      rowLabel: ss.seat.rowLabel,
      seatNumber: ss.seat.seatNumber,
      rowIndex: ss.seat.rowIndex,
      colIndex: ss.seat.colIndex,
      x: ss.seat.x,
      z: ss.seat.z,
      baseY: ss.seat.baseY,
      eyeHeight: ss.seat.eyeHeight,
      isAccessible: ss.seat.isAccessible,
      category: ss.seat.category.code,
      categoryColor: ss.seat.category.color,
      price: ss.price,
      status: ss.status,
    }))
    .sort((a, b) => a.rowIndex - b.rowIndex || a.colIndex - b.colIndex);

  const counts = seats.reduce<Record<string, number>>((acc, s) => {
    acc[s.status] = (acc[s.status] || 0) + 1;
    return acc;
  }, {});

  return {
    show: {
      id: show.id,
      startsAt: show.startsAt.toISOString(),
      language: show.language,
      format: show.format,
      status: show.status,
      movie: {
        id: show.movie.id,
        title: show.movie.title,
        posterUrl: show.movie.posterUrl,
        certification: show.movie.certification,
        durationMins: show.movie.durationMins,
      },
      auditorium: {
        id: show.auditorium.id,
        name: show.auditorium.name,
        geometrySource: show.auditorium.geometrySource,
        theatre: {
          id: show.auditorium.theatre.id,
          name: show.auditorium.theatre.name,
          city: show.auditorium.theatre.city,
          address: show.auditorium.theatre.address,
        },
      },
    },
    layout,
    dimensions,
    categories: show.auditorium.categories.map((c) => ({
      code: c.code,
      name: c.name,
      color: c.color,
      basePrice: c.basePrice,
    })),
    seats,
    counts,
  };
}
