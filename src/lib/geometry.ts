// CINE 360 — Auditorium geometry & SeatVision measurement engine.
// Shared by server (seeding, owner builder) and client (3D scene, metrics HUD).
// All values are METRES. Coordinate system: screen faces +Z; screen plane sits at z = screen.z.
// x = lateral (0 = auditorium centre axis), y = up, z = distance from screen wall.

export type RowSpec = { label: string; seats: number; categoryCode: string };

export type LayoutConfig = {
  screen: { widthM: number; heightM: number; bottomY: number; z: number };
  firstRowZ: number;
  rowSpacingM: number;
  rowStepUpM: number; // floor rake per row
  seatSpacingM: number;
  centerAisle: boolean;
  aisleGapM: number;
  sideMarginM: number;
  eyeHeightM: number;
  rows: RowSpec[];
};

export type SeatLayoutSeat = {
  rowLabel: string;
  seatNumber: number;
  rowIndex: number;
  colIndex: number;
  x: number;
  z: number;
  baseY: number;
  eyeHeight: number;
  categoryCode: string;
  isAccessible: boolean;
};

export type AuditoriumDimensions = {
  widthM: number;
  depthM: number;
  heightM: number;
  maxRowWidthM: number;
  lastRowZ: number;
  screenCenterY: number;
};

/** Generates default row labels A..Z, AA.. */
export function rowLabelsFor(count: number): string[] {
  const labels: string[] = [];
  let i = 0;
  while (labels.length < count) {
    let n = i++;
    let label = "";
    do {
      label = String.fromCharCode(65 + (n % 26)) + label;
      n = Math.floor(n / 26) - 1;
    } while (n >= 0);
    labels.push(label);
  }
  return labels;
}

/**
 * Expands a LayoutConfig into individual seats with calibrated coordinates.
 * Aisles: a centre aisle (if enabled) splits each row into two blocks; the gap
 * is inserted after ceil(seats/2) seats of every row.
 */
export function generateLayout(config: LayoutConfig): {
  seats: SeatLayoutSeat[];
  dimensions: AuditoriumDimensions;
} {
  const seats: SeatLayoutSeat[] = [];
  let maxRowWidth = 0;
  let lastRowZ = config.firstRowZ;

  config.rows.forEach((row, rowIndex) => {
    const count = Math.max(1, row.seats);
    const gap = config.centerAisle && count >= 6 ? config.aisleGapM : 0;
    const rowWidth = count * config.seatSpacingM + gap;
    maxRowWidth = Math.max(maxRowWidth, rowWidth);
    lastRowZ = config.firstRowZ + rowIndex * config.rowSpacingM;
    const baseY = rowIndex * config.rowStepUpM;

    const leftCount = gap > 0 ? Math.ceil(count / 2) : count;
    let xCursor = -rowWidth / 2;

    for (let i = 0; i < count; i++) {
      const x = xCursor + config.seatSpacingM / 2;
      xCursor += config.seatSpacingM;
      if (gap > 0 && i + 1 === leftCount) xCursor += gap;

      // Accessible positions: front two seats of rows C and D (wheelchair bays)
      const isAccessible =
        (row.label === "C" || row.label === "D") && (i === 0 || i === count - 1);

      seats.push({
        rowLabel: row.label,
        seatNumber: i + 1,
        rowIndex,
        colIndex: i,
        x: round2(x),
        z: round2(config.firstRowZ + rowIndex * config.rowSpacingM),
        baseY: round2(baseY),
        eyeHeight: config.eyeHeightM,
        categoryCode: row.categoryCode,
        isAccessible,
      });
    }
  });

  const width = maxRowWidth + 2 * (config.sideMarginM + 1.2);
  const depth = lastRowZ + 4;
  const height = config.screen.bottomY + config.screen.heightM + 2.6;

  return {
    seats,
    dimensions: {
      widthM: round2(width),
      depthM: round2(depth),
      heightM: round2(height),
      maxRowWidthM: round2(maxRowWidth),
      lastRowZ: round2(lastRowZ),
      screenCenterY: round2(config.screen.bottomY + config.screen.heightM / 2),
    },
  };
}

/** SeatVision: geometry-based viewing measurements for one seat. */
export type SeatVision = {
  distanceM: number; // eye → screen centre (3D)
  horizontalDistanceM: number; // along auditorium axis
  horizontalAngleDeg: number; // off-axis viewing angle (0° = centre)
  verticalAngleDeg: number; // elevation angle to screen centre
  eyePosition: { x: number; y: number; z: number };
};

export function seatEyePosition(seat: { x: number; z: number; baseY: number; eyeHeight: number }) {
  return { x: seat.x, y: round2(seat.baseY + seat.eyeHeight), z: seat.z };
}

export function measureSeat(
  seat: { x: number; z: number; baseY: number; eyeHeight: number },
  screen: LayoutConfig["screen"]
): SeatVision {
  const eye = seatEyePosition(seat);
  const screenCenterY = screen.bottomY + screen.heightM / 2;
  const dz = Math.max(0.1, eye.z - screen.z);
  const dx = Math.abs(eye.x - 0);
  const dy = screenCenterY - eye.y;
  return {
    distanceM: round2(Math.sqrt(dz * dz + dx * dx + dy * dy)),
    horizontalDistanceM: round2(dz),
    horizontalAngleDeg: round1((Math.atan2(dx, dz) * 180) / Math.PI),
    verticalAngleDeg: round1((Math.atan2(dy, dz) * 180) / Math.PI),
    eyePosition: eye,
  };
}

/**
 * Derived sightline indicator — computed ONLY from the configured geometry using
 * widely published viewing guidelines (THX/SMPTE-style bands). It is explicitly
 * labelled as a derived indicator, not a guaranteed experience.
 */
export type SightlineGrade = {
  score: number; // 0–100
  grade: "Excellent" | "Good" | "Fair" | "Off-centre";
  notes: string[];
};

export function deriveSightline(m: SeatVision, screen: LayoutConfig["screen"]): SightlineGrade {
  const notes: string[] = [];
  let score = 100;

  const idealMin = screen.widthM * 1.1;
  const idealMax = screen.widthM * 2.0;
  if (m.horizontalDistanceM < idealMin) {
    score -= Math.round(idealMin - m.horizontalDistanceM > 1.5 ? 30 : 18);
    notes.push("Very close to the screen — significant head movement needed.");
  } else if (m.horizontalDistanceM > idealMax) {
    score -= 22;
    notes.push("Far from the screen — detail may be harder to see.");
  }
  if (m.horizontalAngleDeg > 28) {
    score -= 26;
    notes.push("Strong off-axis angle (>28°) — perceived distortion increases.");
  } else if (m.horizontalAngleDeg > 16) {
    score -= 10;
    notes.push("Moderately off-axis (16–28°).");
  }
  if (Math.abs(m.verticalAngleDeg) > 16) {
    score -= 16;
    notes.push("Steep vertical angle to screen centre (>16°).");
  }
  if (notes.length === 0) notes.push("Within recommended viewing bands for distance and angles.");

  score = Math.max(5, Math.min(100, score));
  const grade = score >= 82 ? "Excellent" : score >= 64 ? "Good" : score >= 45 ? "Fair" : "Off-centre";
  return { score, grade, notes };
}

/** Walk-mode collision bounds helper: is a point inside the seat block footprint? */
export function seatFootprintAt(
  seats: { x: number; z: number; baseY: number }[],
  px: number,
  pz: number,
  radius = 0.45
): { x: number; z: number; baseY: number } | null {
  // seats are sorted by rowIndex; linear scan is fine for ≤ 300 seats
  for (const s of seats) {
    if (Math.abs(s.x - px) < radius && Math.abs(s.z - pz) < radius) return s;
  }
  return null;
}

export const DEMO_LAYOUTS: Record<string, LayoutConfig> = {
  grand: {
    screen: { widthM: 14, heightM: 5.9, bottomY: 1.8, z: 0 },
    firstRowZ: 8,
    rowSpacingM: 1.15,
    rowStepUpM: 0.3,
    seatSpacingM: 0.6,
    centerAisle: true,
    aisleGapM: 1.4,
    sideMarginM: 1.6,
    eyeHeightM: 1.15,
    rows: [
      ...["A", "B", "C", "D"].map((label) => ({ label, seats: 16, categoryCode: "SILVER" })),
      ...["E", "F", "G", "H", "I", "J", "K"].map((label) => ({ label, seats: 16, categoryCode: "GOLD" })),
      ...["L", "M", "N"].map((label) => ({ label, seats: 10, categoryCode: "RECLINER" })),
    ],
  },
  classic: {
    screen: { widthM: 12, heightM: 5, bottomY: 1.7, z: 0 },
    firstRowZ: 7.5,
    rowSpacingM: 1.1,
    rowStepUpM: 0.28,
    seatSpacingM: 0.58,
    centerAisle: true,
    aisleGapM: 1.2,
    sideMarginM: 1.5,
    eyeHeightM: 1.15,
    rows: [
      ...["A", "B", "C"].map((label) => ({ label, seats: 14, categoryCode: "SILVER" })),
      ...["D", "E", "F", "G", "H", "I", "J"].map((label) => ({ label, seats: 14, categoryCode: "GOLD" })),
    ],
  },
  luxe: {
    screen: { widthM: 13, heightM: 5.5, bottomY: 1.8, z: 0 },
    firstRowZ: 8.5,
    rowSpacingM: 1.35,
    rowStepUpM: 0.34,
    seatSpacingM: 0.72,
    centerAisle: true,
    aisleGapM: 1.5,
    sideMarginM: 1.6,
    eyeHeightM: 1.12,
    rows: [
      ...["A", "B"].map((label) => ({ label, seats: 12, categoryCode: "SILVER" })),
      ...["C", "D", "E", "F"].map((label) => ({ label, seats: 12, categoryCode: "GOLD" })),
      ...["G", "H"].map((label) => ({ label, seats: 8, categoryCode: "RECLINER" })),
    ],
  },
};

export const DEFAULT_PRICES: Record<string, { name: string; color: string; price: number }> = {
  SILVER: { name: "Silver", color: "#8FA3BF", price: 180 },
  GOLD: { name: "Gold", color: "#F5C518", price: 260 },
  RECLINER: { name: "Recliner", color: "#FF713D", price: 420 },
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
function round1(n: number) {
  return Math.round(n * 10) / 10;
}
