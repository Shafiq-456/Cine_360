// Shared constants for CINE 360

export const ROLES = {
  CUSTOMER: "CUSTOMER",
  OWNER: "OWNER",
  STAFF: "STAFF",
  ADMIN: "ADMIN",
} as const;
export type Role = (typeof ROLES)[keyof typeof ROLES];

export const SEAT_STATUS = {
  AVAILABLE: "AVAILABLE",
  HELD: "HELD",
  BOOKED: "BOOKED",
  UNAVAILABLE: "UNAVAILABLE",
} as const;
export type SeatStatus = (typeof SEAT_STATUS)[keyof typeof SEAT_STATUS];

export const HOLD_TTL_SECONDS = 300; // 5 minutes, configurable via env HOLD_TTL_SECONDS

// Visual identity — Obsidian Amber Cinema Palette
export const BRAND = {
  obsidian: "#070709",
  graphite: "#0F1117",
  slate: "#181B24",
  titanium: "#E2E8F0",
  frost: "#F8FAFC",
  amber: "#F59E0B",
  gold: "#FBBF24",
  accent: "#D97706",
  electricBlue: "#38BDF8",
};

// Seat state colours (compliant with cinema standards & accessibility)
export const SEAT_COLORS: Record<SeatStatus | "SELECTED", string> = {
  AVAILABLE: "#10B981", // Emerald Green
  HELD: "#FBBF24",      // Soft Amber Held
  BOOKED: "#EF4444",    // Crimson Red Occupied
  UNAVAILABLE: "#475569", // Slate Grey Restricted
  SELECTED: "#F59E0B",  // Obsidian Amber Selected
};

export const SEAT_STATE_LABELS: Record<SeatStatus | "SELECTED", string> = {
  AVAILABLE: "Available (Green)",
  HELD: "Temporarily held by another user",
  BOOKED: "Booked (Red)",
  UNAVAILABLE: "Restricted / Unavailable (Grey)",
  SELECTED: "Selected by you (Amber)",
};

export const TICKET_STATUSES = ["VALID", "REDEEMED", "VOID"] as const;
export const BOOKING_STATUSES = ["PENDING_PAYMENT", "CONFIRMED", "CANCELLED", "REFUNDED"] as const;

export const PAYMENT_MODE = process.env.RAZORPAY_KEY_ID ? "RAZORPAY" : "DEMO";

export function generateBookingReference(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `C360-${s}`;
}
