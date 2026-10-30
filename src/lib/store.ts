"use client";
// Global client state: session, seat selection (3D + 2D), seat preview/compare.
import { create } from "zustand";
import type { SessionUser } from "./auth";

type AuthState = {
  session: SessionUser | null;
  sessionLoaded: boolean;
  setSession: (s: SessionUser | null) => void;
  loadSession: () => Promise<void>;
};

export const useAuth = create<AuthState>((set) => ({
  session: null,
  sessionLoaded: false,
  setSession: (session) => set({ session, sessionLoaded: true }),
  loadSession: async () => {
    try {
      const { api } = await import("./client");
      const me = await api.get<{ user: SessionUser }>("/api/auth/me");
      set({ session: me.user, sessionLoaded: true });
    } catch {
      set({ session: null, sessionLoaded: true });
    }
  },
}));

export type SelectedSeat = {
  showSeatId: string;
  rowLabel: string;
  seatNumber: number;
  price: number;
  category: string;
  status: string;
};

type BookingSelectionState = {
  selected: SelectedSeat[];
  toggleSeat: (seat: SelectedSeat) => void;
  clearSeats: () => void;
  isSelected: (showSeatId: string) => boolean;
  // Seat Experience Mode
  previewSeatId: string | null;
  setPreviewSeat: (id: string | null) => void;
  // comparison pins (SeatVision)
  compare: { showSeatId: string; label: string; distanceM: number; hAngle: number; vAngle: number; score: number; grade: string }[];
  addCompare: (entry: BookingSelectionState["compare"][number]) => void;
  removeCompare: (showSeatId: string) => void;
  clearCompare: () => void;
};

export const useBookingSelection = create<BookingSelectionState>((set, get) => ({
  selected: [],
  toggleSeat: (seat) =>
    set((s) => {
      const exists = s.selected.some((x) => x.showSeatId === seat.showSeatId);
      if (exists) return { selected: s.selected.filter((x) => x.showSeatId !== seat.showSeatId) };
      if (s.selected.length >= 10) return s; // max 10 seats per booking
      return { selected: [...s.selected, seat] };
    }),
  clearSeats: () => set({ selected: [] }),
  isSelected: (id) => get().selected.some((x) => x.showSeatId === id),
  previewSeatId: null,
  setPreviewSeat: (id) => set({ previewSeatId: id }),
  compare: [],
  addCompare: (entry) =>
    set((s) => ({
      compare: [...s.compare.filter((c) => c.showSeatId !== entry.showSeatId), entry].slice(-4),
    })),
  removeCompare: (showSeatId) => set((s) => ({ compare: s.compare.filter((c) => c.showSeatId !== showSeatId) })),
  clearCompare: () => set({ compare: [] }),
}));
