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

// Visual identity — spec palette
export const BRAND = {
  obsidian: "#08090C",
  graphite: "#171A21",
  titanium: "#DDE1E8",
  frost: "#F5F7FA",
  electricBlue: "#477BFF",
  cyan: "#20D9E8",
  flame: "#FF713D",
};

// Seat state colours (never used alone — always paired with labels)
export const SEAT_COLORS: Record<SeatStatus | "SELECTED", string> = {
  AVAILABLE: "#2FBF71",
  HELD: "#F5C518",
  BOOKED: "#E5484D",
  UNAVAILABLE: "#3A3F4A",
  SELECTED: "#477BFF",
};

export const SEAT_STATE_LABELS: Record<SeatStatus | "SELECTED", string> = {
  AVAILABLE: "Available",
  HELD: "Temporarily held by another user",
  BOOKED: "Booked",
  UNAVAILABLE: "Unavailable",
  SELECTED: "Selected by you",
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
