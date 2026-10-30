"use client";
// Accessible 2D seat map — the non-3D alternative booking interface.
// Keyboard focusable buttons, screen-reader labels with status + price.
import type { InventorySeat } from "@/lib/inventory";

export default function SeatMap2D({ seats, selectedIds, onToggle, categories }: {
  seats: InventorySeat[];
  selectedIds: Set<string>;
  onToggle: (seat: InventorySeat) => void;
  categories: { code: string; name: string; color: string; basePrice: number }[];
}) {
  const rows = useMemoRows(seats);

  const stateOf = (s: InventorySeat): { color: string; label: string; enabled: boolean } => {
    if (selectedIds.has(s.id)) return { color: "#477BFF", label: "Selected by you", enabled: true };
    if (s.status === "AVAILABLE") return { color: "#2FBF71", label: "Available", enabled: true };
    if (s.status === "HELD") return { color: "#F5C518", label: "Temporarily held by another user", enabled: false };
    if (s.status === "BOOKED") return { color: "#E5484D", label: "Booked", enabled: false };
    return { color: "#3A3F4A", label: "Unavailable", enabled: false };
  };

  return (
    <div className="h-full overflow-auto cine-scroll p-4 md:p-6" role="group" aria-label="2D seat map">
      {/* Screen */}
      <div className="mx-auto max-w-xl mb-2">
        <div className="h-2 rounded-[100%] bg-gradient-to-r from-transparent via-[#9FC0FF] to-transparent" />
        <p className="text-center text-[11px] tracking-[0.4em] text-[#8FA3BF] mt-2">SCREEN</p>
      </div>

      <div className="mx-auto max-w-3xl space-y-1.5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center gap-1.5">
            <span className="w-6 text-right text-[11px] font-bold text-[#20D9E8] shrink-0">{row.label}</span>
            <div className="flex gap-1 flex-1 justify-center flex-wrap">
              {row.seats.map((s) => {
                const st = stateOf(s);
                return (
                  <button
                    key={s.id}
                    disabled={!st.enabled}
                    onClick={() => onToggle(s)}
                    aria-label={`Row ${s.rowLabel} seat ${s.seatNumber}, ${s.category}, ₹${s.price}, ${st.label}${s.isAccessible ? ", wheelchair accessible" : ""}`}
                    title={`Row ${s.rowLabel} · Seat ${s.seatNumber} · ${st.label} · ₹${s.price}`}
                    className={`w-6 h-6 md:w-7 md:h-7 rounded-t-md rounded-b-sm text-[9px] font-semibold transition-transform ${
                      st.enabled ? "cursor-pointer hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#477BFF]" : "cursor-not-allowed opacity-80"
                    } ${selectedIds.has(s.id) ? "ring-2 ring-white ring-offset-1 ring-offset-[#050609]" : ""}`}
                    style={{
                      background: st.color,
                      color: s.status === "AVAILABLE" || selectedIds.has(s.id) ? "#04120A" : "rgba(255,255,255,0.75)",
                      border: s.isAccessible ? "2px solid #20D9E8" : "none",
                    }}
                  >
                    {s.seatNumber}
                  </button>
                );
              })}
            </div>
            <span className="w-6 text-[11px] font-bold text-[#20D9E8] shrink-0">{row.label}</span>
          </div>
        ))}
      </div>

      <div className="mx-auto max-w-3xl mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-[11px] text-[#8FA3BF]">
        <Legend color="#2FBF71" label="Available" />
        <Legend color="#477BFF" label="Your selection" />
        <Legend color="#F5C518" label="Held" />
        <Legend color="#E5484D" label="Booked" />
        <Legend color="#3A3F4A" label="Unavailable" />
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm border-2 border-[#20D9E8]" /> Wheelchair accessible</span>
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="w-3 h-3 rounded-sm" style={{ background: color }} aria-hidden="true" /> {label}
    </span>
  );
}

function useMemoRows(seats: InventorySeat[]) {
  const rows: { label: string; seats: InventorySeat[] }[] = [];
  const map = new Map<string, InventorySeat[]>();
  for (const s of seats) {
    if (!map.has(s.rowLabel)) map.set(s.rowLabel, []);
    map.get(s.rowLabel)!.push(s);
  }
  for (const [label, list] of map) {
    list.sort((a, b) => a.colIndex - b.colIndex);
    rows.push({ label, seats: list });
  }
  rows.sort((a, b) => a.seats[0].rowIndex - b.seats[0].rowIndex);
  return rows;
}
