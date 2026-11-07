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
  /** Interior design theme — colours the 3D seats, walls and row labels. */
  theme?: AuditoriumThemeCode;
};

/** Every auditorium gets its own interior identity — seats, walls and labels
 *  are tinted so guests instantly see which hall they are booking. */
export type AuditoriumThemeCode =
  | "emerald" | "teal" | "amber" | "crimson" | "azure" | "violet" | "rose" | "copper"
  | "indigo" | "saffron" | "orchid" | "sage" | "onyx" | "sandstone"
  | "garnet" | "pearl" | "mint" | "cocoa" | "sky" | "moss";

export const AUDITORIUM_THEMES: Record<
  AuditoriumThemeCode,
  { name: string; seat: string; tint: string; label: string }
> = {
  emerald: { name: "Emerald Classic", seat: "#2FBF71", tint: "#9DBBA8", label: "#0B7A4A" },
  teal:    { name: "Teal Modern",    seat: "#14B8A6", tint: "#9DC4C0", label: "#0B6E63" },
  amber:   { name: "Amber Luxe",     seat: "#F0A32A", tint: "#C9B49A", label: "#8A5A00" },
  crimson: { name: "Crimson Retro",  seat: "#E5484D", tint: "#C4A0A6", label: "#A31722" },
  azure:   { name: "Azure IMAX",     seat: "#477BFF", tint: "#A0B4D0", label: "#1D4FD8" },
  violet:  { name: "Violet Boutique", seat: "#8E6FD8", tint: "#AFA6C9", label: "#5B3FA8" },
  rose:    { name: "Rose Atrium",    seat: "#F06D9C", tint: "#C9A6B4", label: "#C2185B" },
  copper:  { name: "Copper Family",  seat: "#C97B4A", tint: "#C4AB98", label: "#8A4A1E" },
  indigo:  { name: "Indigo Stadium",  seat: "#6366F1", tint: "#A5ACD8", label: "#3730A3" },
  saffron: { name: "Saffron Premiere", seat: "#FF9933", tint: "#D8C0A0", label: "#9A5B00" },
  orchid:  { name: "Orchid Lounge",   seat: "#C86BFA", tint: "#B8A6C9", label: "#7A1FA8" },
  sage:    { name: "Sage Garden",     seat: "#9CB894", tint: "#B4C4AE", label: "#4A6B3F" },
  onyx:    { name: "Onyx Heritage",   seat: "#5A6072", tint: "#8E95A8", label: "#C9A227" },
  sandstone: { name: "Sandstone Heritage", seat: "#D9B380", tint: "#CDB9A0", label: "#8A6430" },
  garnet:  { name: "Garnet Classic",  seat: "#DC3D5E", tint: "#C4A0AE", label: "#9F1239" },
  pearl:   { name: "Pearl Palace",    seat: "#E7E3F2", tint: "#D6D0E8", label: "#6D5B8E" },
  mint:    { name: "Mint Terrace",    seat: "#5EEAD4", tint: "#A8D8CC", label: "#0F766E" },
  cocoa:   { name: "Cocoa Prime",     seat: "#A47551", tint: "#C0A48C", label: "#5C3A1E" },
  sky:     { name: "Sky Reels",       seat: "#38BDF8", tint: "#A5C8E8", label: "#0369A1" },
  moss:    { name: "Moss Garden",     seat: "#84CC16", tint: "#B8CC9E", label: "#4D7C0F" },
};

export function themeOf(code?: string | null) {
  return (code && (AUDITORIUM_THEMES as Record<string, (typeof AUDITORIUM_THEMES)[AuditoriumThemeCode]>)[code]) || null;
}

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
  /* Frost Cinemas Audi 1 — 206 seats, big 14 m screen, centre aisle */
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
    theme: "emerald",
    rows: [
      ...["A", "B", "C", "D"].map((label) => ({ label, seats: 16, categoryCode: "SILVER" })),
      ...["E", "F", "G", "H", "I", "J", "K"].map((label) => ({ label, seats: 16, categoryCode: "GOLD" })),
      ...["L", "M", "N"].map((label) => ({ label, seats: 10, categoryCode: "RECLINER" })),
    ],
  },
  /* Frost Cinemas Audi 2 — compact 140 seats, 12 m screen, centre aisle */
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
    theme: "teal",
    rows: [
      ...["A", "B", "C"].map((label) => ({ label, seats: 14, categoryCode: "SILVER" })),
      ...["D", "E", "F", "G", "H", "I", "J"].map((label) => ({ label, seats: 14, categoryCode: "GOLD" })),
    ],
  },
  /* Flame Multiplex Audi 1 — 88 recliner-heavy seats, generous 0.72 m pitch */
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
    theme: "amber",
    rows: [
      ...["A", "B"].map((label) => ({ label, seats: 12, categoryCode: "SILVER" })),
      ...["C", "D", "E", "F"].map((label) => ({ label, seats: 12, categoryCode: "GOLD" })),
      ...["G", "H"].map((label) => ({ label, seats: 8, categoryCode: "RECLINER" })),
    ],
  },
  /* Aurora Audi 1 — towering 17 m × 7.6 m screen, steep 0.42 m rake, 216 seats */
  imax: {
    screen: { widthM: 17, heightM: 7.6, bottomY: 2.4, z: 0 },
    firstRowZ: 11, // pushed back so the giant screen fits the field of view
    rowSpacingM: 1.3,
    rowStepUpM: 0.42,
    seatSpacingM: 0.64,
    centerAisle: true,
    aisleGapM: 1.6,
    sideMarginM: 2.0,
    eyeHeightM: 1.15,
    theme: "azure",
    rows: [
      ...["A", "B", "C", "D"].map((label) => ({ label, seats: 18, categoryCode: "SILVER" })),
      ...["E", "F", "G", "H", "I", "J", "K", "L"].map((label) => ({ label, seats: 18, categoryCode: "GOLD" })),
    ],
  },
  /* Aurora Audi 3 — intimate 48-seat screening lounge, one small screen, all recliners, no centre aisle */
  boutique: {
    screen: { widthM: 8, heightM: 3.6, bottomY: 1.6, z: 0 },
    firstRowZ: 7,
    rowSpacingM: 1.25,
    rowStepUpM: 0.26,
    seatSpacingM: 0.8,
    centerAisle: false,
    aisleGapM: 1.2,
    sideMarginM: 2.2,
    eyeHeightM: 1.12,
    theme: "violet",
    rows: ["A", "B", "C", "D", "E", "F"].map((label) => ({ label, seats: 8, categoryCode: "RECLINER" })),
  },
  /* Pearl Audi 1 — classic single-screen hall: 320 seats, 16 m screen, long shallow rake */
  retro: {
    screen: { widthM: 16, heightM: 6.4, bottomY: 2.0, z: 0 },
    firstRowZ: 9,
    rowSpacingM: 1.05,
    rowStepUpM: 0.24,
    seatSpacingM: 0.58,
    centerAisle: true,
    aisleGapM: 1.8,
    sideMarginM: 1.6,
    eyeHeightM: 1.15,
    theme: "crimson",
    rows: [
      ...["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K"].map((label) => ({ label, seats: 20, categoryCode: "SILVER" })),
      ...["L", "M", "N", "O", "P"].map((label) => ({ label, seats: 20, categoryCode: "GOLD" })),
    ],
  },
  /* Aurora Audi 2 — fan-shaped hall: rows widen 12 → 24 seats toward the back */
  fan: {
    screen: { widthM: 14, heightM: 6, bottomY: 1.8, z: 0 },
    firstRowZ: 8,
    rowSpacingM: 1.2,
    rowStepUpM: 0.3,
    seatSpacingM: 0.62,
    centerAisle: true,
    aisleGapM: 1.5,
    sideMarginM: 1.6,
    eyeHeightM: 1.15,
    theme: "rose",
    rows: (
      [
        ["A", 12, "SILVER"], ["B", 14, "SILVER"], ["C", 16, "SILVER"],
        ["D", 18, "GOLD"], ["E", 20, "GOLD"], ["F", 22, "GOLD"],
        ["G", 22, "RECLINER"], ["H", 24, "RECLINER"],
      ] as [string, number, string][]
    ).map(([label, seats, categoryCode]) => ({ label, seats, categoryCode })),
  },
  /* ---- 2026-11 city expansion: one-of-a-kind halls for the new theatres ---- */

  /* Imperial Audi 1 · Delhi — flagship spectrum hall: 16.5 m screen,
   * three-tier widths, 0.4 m rake, 264 seats */
  spectrum: {
    screen: { widthM: 16.5, heightM: 7, bottomY: 2.3, z: 0 },
    firstRowZ: 10.5,
    rowSpacingM: 1.28,
    rowStepUpM: 0.4,
    seatSpacingM: 0.64,
    centerAisle: true,
    aisleGapM: 1.6,
    sideMarginM: 2,
    eyeHeightM: 1.15,
    theme: "garnet",
    rows: [
      ...["A", "B", "C"].map((label) => ({ label, seats: 20, categoryCode: "SILVER" })),
      ...["D", "E", "F", "G", "H", "I", "J"].map((label) => ({ label, seats: 20, categoryCode: "GOLD" })),
      ...["K", "L", "M", "N"].map((label) => ({ label, seats: 16, categoryCode: "RECLINER" })),
    ],
  },
  /* Imperial Audi 2 · Delhi — diamond hall: side aisles only, symmetrical
   * 18–20 seat blocks, 12.8 m screen, 192 seats */
  diamond: {
    screen: { widthM: 12.8, heightM: 5.4, bottomY: 1.8, z: 0 },
    firstRowZ: 8,
    rowSpacingM: 1.15,
    rowStepUpM: 0.3,
    seatSpacingM: 0.6,
    centerAisle: false,
    aisleGapM: 1.2,
    sideMarginM: 2.2,
    eyeHeightM: 1.15,
    theme: "mint",
    rows: [
      ...["A", "B", "C"].map((label) => ({ label, seats: 18, categoryCode: "SILVER" })),
      ...["D", "E", "F"].map((label) => ({ label, seats: 20, categoryCode: "GOLD" })),
      ...["G", "H", "I"].map((label) => ({ label, seats: 18, categoryCode: "GOLD" })),
      ...["J", "K"].map((label) => ({ label, seats: 12, categoryCode: "RECLINER" })),
    ],
  },
  /* Yamuna Prime Audi 1 · Delhi — opus hall: 15 m screen, recliner-heavy
   * back section, 198 seats */
  opus: {
    screen: { widthM: 15, heightM: 6.3, bottomY: 2.1, z: 0 },
    firstRowZ: 9.5,
    rowSpacingM: 1.24,
    rowStepUpM: 0.36,
    seatSpacingM: 0.62,
    centerAisle: true,
    aisleGapM: 1.5,
    sideMarginM: 1.8,
    eyeHeightM: 1.15,
    theme: "cocoa",
    rows: [
      ...["A", "B", "C"].map((label) => ({ label, seats: 18, categoryCode: "SILVER" })),
      ...["D", "E", "F", "G", "H", "I"].map((label) => ({ label, seats: 18, categoryCode: "GOLD" })),
      ...["J", "K", "L"].map((label) => ({ label, seats: 12, categoryCode: "RECLINER" })),
    ],
  },
  /* Bengal Grand Audi 1 · Kolkata — heritage balcony single screen:
   * 17 m screen, 22-seat rows, shallow 0.22 m rake, 284 seats */
  heritage: {
    screen: { widthM: 17, heightM: 6.8, bottomY: 2.2, z: 0 },
    firstRowZ: 10,
    rowSpacingM: 1.02,
    rowStepUpM: 0.22,
    seatSpacingM: 0.56,
    centerAisle: true,
    aisleGapM: 1.9,
    sideMarginM: 1.7,
    eyeHeightM: 1.15,
    theme: "garnet",
    rows: [
      ...["A", "B", "C", "D", "E", "F", "G", "H"].map((label) => ({ label, seats: 22, categoryCode: "SILVER" })),
      ...["I", "J", "K", "L"].map((label) => ({ label, seats: 20, categoryCode: "GOLD" })),
      ...["M", "N"].map((label) => ({ label, seats: 14, categoryCode: "RECLINER" })),
    ],
  },
  /* Deccan Reels Audi 1 · Pune — velocity hall: compact steep-screen room,
   * 11 m screen, tight 1.06 m pitch, 160 seats */
  velocity: {
    screen: { widthM: 11, heightM: 4.9, bottomY: 1.8, z: 0 },
    firstRowZ: 7.5,
    rowSpacingM: 1.06,
    rowStepUpM: 0.34,
    seatSpacingM: 0.6,
    centerAisle: true,
    aisleGapM: 1.3,
    sideMarginM: 1.6,
    eyeHeightM: 1.15,
    theme: "sky",
    rows: [
      ...["A", "B"].map((label) => ({ label, seats: 14, categoryCode: "SILVER" })),
      ...["C", "D", "E"].map((label) => ({ label, seats: 16, categoryCode: "SILVER" })),
      ...["F", "G", "H", "I"].map((label) => ({ label, seats: 16, categoryCode: "GOLD" })),
      ...["J", "K"].map((label) => ({ label, seats: 10, categoryCode: "RECLINER" })),
    ],
  },
  /* Backwater Screens Audi 1 · Kochi — lagoon hall: relaxed mid-size room,
   * 12 m screen, wide 0.66 m pitch, 124 seats */
  lagoon: {
    screen: { widthM: 12, heightM: 5.2, bottomY: 1.8, z: 0 },
    firstRowZ: 8,
    rowSpacingM: 1.16,
    rowStepUpM: 0.3,
    seatSpacingM: 0.66,
    centerAisle: true,
    aisleGapM: 1.4,
    sideMarginM: 1.8,
    eyeHeightM: 1.15,
    theme: "moss",
    rows: [
      ...["A", "B", "C", "D"].map((label) => ({ label, seats: 16, categoryCode: "SILVER" })),
      ...["E", "F"].map((label) => ({ label, seats: 16, categoryCode: "GOLD" })),
      ...["G", "H"].map((label) => ({ label, seats: 14, categoryCode: "RECLINER" })),
    ],
  },
  /* Rajmahal Audi 1 · Jaipur — palace hall: pearl-and-gold interior,
   * 19 m screen, grand 24-seat rows, 240 seats */
  palace: {
    screen: { widthM: 19, heightM: 7.6, bottomY: 2.4, z: 0 },
    firstRowZ: 11,
    rowSpacingM: 1.22,
    rowStepUpM: 0.34,
    seatSpacingM: 0.62,
    centerAisle: true,
    aisleGapM: 1.8,
    sideMarginM: 2.2,
    eyeHeightM: 1.15,
    theme: "pearl",
    rows: [
      ...["A", "B", "C", "D", "E"].map((label) => ({ label, seats: 24, categoryCode: "SILVER" })),
      ...["F", "G", "H", "I"].map((label) => ({ label, seats: 24, categoryCode: "GOLD" })),
      ...["J", "K"].map((label) => ({ label, seats: 12, categoryCode: "RECLINER" })),
    ],
  },
  /* Lumière Audi 1 · Bengaluru — true stadium hall: steep 0.5 m rake,
   * 15 rows × 16, deep 1.25 m row pitch, 15.5 m screen, 240 seats */
  stadium: {
    screen: { widthM: 15.5, heightM: 6.6, bottomY: 2.2, z: 0 },
    firstRowZ: 9.5,
    rowSpacingM: 1.25,
    rowStepUpM: 0.5,
    seatSpacingM: 0.62,
    centerAisle: true,
    aisleGapM: 1.5,
    sideMarginM: 1.7,
    eyeHeightM: 1.15,
    theme: "indigo",
    rows: [
      ...["A", "B", "C", "D"].map((label) => ({ label, seats: 16, categoryCode: "SILVER" })),
      ...["E", "F", "G", "H", "I", "J", "K"].map((label) => ({ label, seats: 16, categoryCode: "GOLD" })),
      ...["L", "M", "N", "O"].map((label) => ({ label, seats: 16, categoryCode: "RECLINER" })),
    ],
  },
  /* Lumière Audi 2 · Bengaluru — sofa lounge: 1.15 m chair pitch (paired
   * love-seats), 10 chairs per row, no centre aisle, 9.8 m screen, 60 seats */
  lounge: {
    screen: { widthM: 9.8, heightM: 4.4, bottomY: 1.7, z: 0 },
    firstRowZ: 8,
    rowSpacingM: 1.45,
    rowStepUpM: 0.28,
    seatSpacingM: 1.15,
    centerAisle: false,
    aisleGapM: 1.2,
    sideMarginM: 2.4,
    eyeHeightM: 1.1,
    theme: "orchid",
    rows: ["A", "B", "C", "D", "E", "F"].map((label) => ({ label, seats: 10, categoryCode: "RECLINER" })),
  },
  /* Galaxy Multiplex Audi 1 · Bengaluru — mixed-width neighbourhood hall:
   * narrow front rows widening to 18 seats, 13.5 m screen, 174 seats */
  galaxy: {
    screen: { widthM: 13.5, heightM: 5.6, bottomY: 1.8, z: 0 },
    firstRowZ: 8,
    rowSpacingM: 1.18,
    rowStepUpM: 0.32,
    seatSpacingM: 0.6,
    centerAisle: true,
    aisleGapM: 1.3,
    sideMarginM: 1.6,
    eyeHeightM: 1.15,
    theme: "sage",
    rows: (
      [
        ["A", 14, "SILVER"], ["B", 14, "SILVER"], ["C", 16, "SILVER"],
        ["D", 16, "GOLD"], ["E", 18, "GOLD"], ["F", 18, "GOLD"],
        ["G", 18, "GOLD"], ["H", 18, "GOLD"], ["I", 18, "GOLD"],
        ["J", 12, "RECLINER"], ["K", 12, "RECLINER"],
      ] as [string, number, string][]
    ).map(([label, seats, categoryCode]) => ({ label, seats, categoryCode })),
  },
  /* Nizam Grand Audi 1 · Hyderabad — XL premiere screen 18.5 m × 7.8 m,
   * wide 20–22 seat rows, generous 0.38 m rake, 176 seats */
  premiere: {
    screen: { widthM: 18.5, heightM: 7.8, bottomY: 2.3, z: 0 },
    firstRowZ: 11.5,
    rowSpacingM: 1.3,
    rowStepUpM: 0.38,
    seatSpacingM: 0.66,
    centerAisle: true,
    aisleGapM: 1.7,
    sideMarginM: 2.1,
    eyeHeightM: 1.15,
    theme: "saffron",
    rows: [
      ...["A", "B", "C"].map((label) => ({ label, seats: 20, categoryCode: "SILVER" })),
      ...["D", "E", "F", "G"].map((label) => ({ label, seats: 22, categoryCode: "GOLD" })),
      ...["H", "I"].map((label) => ({ label, seats: 14, categoryCode: "RECLINER" })),
    ],
  },
  /* Marine Marquee Audi 1 · Mumbai — heritage single-screen marquee:
   * widest screen on the platform (22 m × 8.4 m), 26-seat rows, 324 seats */
  marquee: {
    screen: { widthM: 22, heightM: 8.4, bottomY: 2.6, z: 0 },
    firstRowZ: 13,
    rowSpacingM: 1.12,
    rowStepUpM: 0.26,
    seatSpacingM: 0.58,
    centerAisle: true,
    aisleGapM: 2,
    sideMarginM: 1.9,
    eyeHeightM: 1.15,
    theme: "onyx",
    rows: [
      ...["A", "B", "C", "D", "E"].map((label) => ({ label, seats: 26, categoryCode: "SILVER" })),
      ...["F", "G", "H", "I", "J"].map((label) => ({ label, seats: 26, categoryCode: "GOLD" })),
      ...["K", "L", "M", "N"].map((label) => ({ label, seats: 16, categoryCode: "RECLINER" })),
    ],
  },
  /* Tamil Screens Audi 1 · Madurai — compact neighbourhood single screen:
   * 9.8 m screen, 14-seat rows, shallow rake, 108 seats */
  cube: {
    screen: { widthM: 9.8, heightM: 4.6, bottomY: 1.7, z: 0 },
    firstRowZ: 7.5,
    rowSpacingM: 1.08,
    rowStepUpM: 0.24,
    seatSpacingM: 0.58,
    centerAisle: true,
    aisleGapM: 1.1,
    sideMarginM: 1.5,
    eyeHeightM: 1.15,
    theme: "sandstone",
    rows: [
      ...["A", "B", "C"].map((label) => ({ label, seats: 14, categoryCode: "SILVER" })),
      ...["D", "E", "F"].map((label) => ({ label, seats: 14, categoryCode: "GOLD" })),
      ...["G", "H"].map((label) => ({ label, seats: 12, categoryCode: "RECLINER" })),
    ],
  },
  /* Pearl Audi 2 — family hall: solid rows (side aisles only), 140 seats */
  family: {
    screen: { widthM: 11, heightM: 4.8, bottomY: 1.7, z: 0 },
    firstRowZ: 7.5,
    rowSpacingM: 1.1,
    rowStepUpM: 0.36,
    seatSpacingM: 0.6,
    centerAisle: false,
    aisleGapM: 1.2,
    sideMarginM: 1.8,
    eyeHeightM: 1.15,
    theme: "copper",
    rows: [
      ...["A", "B", "C"].map((label) => ({ label, seats: 14, categoryCode: "SILVER" })),
      ...["D", "E", "F", "G", "H"].map((label) => ({ label, seats: 14, categoryCode: "GOLD" })),
      ...["I", "J"].map((label) => ({ label, seats: 14, categoryCode: "RECLINER" })),
    ],
  },
};

export const DEFAULT_PRICES: Record<string, { name: string; color: string; price: number }> = {
  SILVER: { name: "Silver", color: "#A99BC6", price: 180 },
  GOLD: { name: "Gold", color: "#FFD166", price: 260 },
  RECLINER: { name: "Recliner", color: "#F0659A", price: 420 },
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
function round1(n: number) {
  return Math.round(n * 10) / 10;
}
