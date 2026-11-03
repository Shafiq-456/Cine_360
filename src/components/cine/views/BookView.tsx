"use client";
// CINE 360 — THE booking experience: 3D auditorium + selection panel +
// Seat Experience Mode (SeatVision) + accessible 2D map + hold → checkout.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { navigate } from "@/lib/router";
import { api, inr, fmtDateTime } from "@/lib/client";
import { useAuth, useBookingSelection, type SelectedSeat } from "@/lib/store";
import type { InventorySeat } from "@/lib/inventory";
import type { LayoutConfig } from "@/lib/geometry";
import { measureSeat, deriveSightline } from "@/lib/geometry";
import dynamicImport from "next/dynamic";
import type { SceneMode, MoveVector } from "@/components/cine/three/AuditoriumScene";
import SeatMap2D from "./SeatMap2D";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Spinner, EmptyState } from "./bits";
import { toast } from "sonner";

// The 3D engine (three.js + R3F ≈ 1MB) is code-split: it is fetched only when
// the auditorium stage actually mounts, keeping movies/booking screens instant.
const AuditoriumCanvas = dynamicImport(() => import("@/components/cine/three/AuditoriumScene"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center" aria-live="polite" aria-busy="true">
      <Spinner label="Loading 3D auditorium" />
    </div>
  ),
});
import {
  Armchair, Orbit, Footprints, Eye, LayoutGrid, RotateCcw, Maximize, ChevronLeft, ChevronRight,
  Pin, PinOff, X, MousePointerClick, Loader2, Info, Accessibility,
} from "lucide-react";

type Inventory = {
  show: {
    id: string; startsAt: string; language: string; format: string; status: string;
    movie: { id: string; title: string; posterUrl: string; certification: string; durationMins: number };
    auditorium: { id: string; name: string; geometrySource: string; theatre: { id: string; name: string; city: string; address: string } };
  };
  layout: LayoutConfig;
  dimensions: { widthM: number; depthM: number; heightM: number; lastRowZ: number; screenCenterY: number; maxRowWidthM: number };
  categories: { code: string; name: string; color: string; basePrice: number }[];
  seats: InventorySeat[];
  counts: Record<string, number>;
};

const LEGEND = [
  { color: "#2FBF71", label: "Available" },
  { color: "#F5C518", label: "Held by others" },
  { color: "#E5484D", label: "Booked" },
  { color: "#477BFF", label: "Your selection" },
  { color: "#3A3F4A", label: "Unavailable" },
];

function hasWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(window.WebGLRenderingContext && (canvas.getContext("webgl2") || canvas.getContext("webgl")));
  } catch {
    return false;
  }
}

export default function BookView({ showId, params }: { showId: string; params: URLSearchParams }) {
  const { session } = useAuth();
  const { selected, toggleSeat, clearSeats, previewSeatId, setPreviewSeat, compare, addCompare, removeCompare } = useBookingSelection();

  const [inv, setInv] = useState<Inventory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [force2D, setForce2D] = useState(params.get("mode") === "2d");
  const [webglOk, setWebglOk] = useState(true);
  const [mode, setMode] = useState<SceneMode>("orbit");
  const [hoveredSeat, setHoveredSeat] = useState<InventorySeat | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const [holding, setHolding] = useState(false);
  const [live, setLive] = useState<"live" | "polling">("polling");
  const [showInstructions, setShowInstructions] = useState(true);
  const moveRef = useRef<MoveVector>({ x: 0, z: 0 });
  const containerRef = useRef<HTMLDivElement | null>(null);

  const isTouch = useMemo(
    () => typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches,
    []
  );

  // ---------- data + realtime ----------
  const fetchInventory = useCallback(async () => {
    try {
      const data = await api.get<Inventory>(`/api/shows/${showId}/seats`);
      setInv(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load this show");
    }
  }, [showId]);

  useEffect(() => {
    setWebglOk(hasWebGL());
    if (!hasWebGL()) {
      setForce2D(true);
      toast.info("WebGL is not available — switched to the accessible 2D seat map.");
    }
    fetchInventory();
  }, [fetchInventory]);

  // socket.io live seat updates + polling fallback
  useEffect(() => {
    let cancelled = false;
    let socket: { emit: (e: string, d: unknown) => void; disconnect: () => void; connected: boolean } | null = null;
    (async () => {
      try {
        const { io } = await import("socket.io-client");
        const s = io("/?XTransformPort=3003", {
          transports: ["websocket", "polling"],
          reconnection: true,
          reconnectionAttempts: 3,
          timeout: 8000,
        });
        socket = s as unknown as typeof socket;
        s.on("connect", () => {
          if (!cancelled) {
            setLive("live");
            s.emit("join-show", showId);
          }
        });
        s.on("seats:changed", () => {
          if (!cancelled) fetchInventory();
        });
        s.on("disconnect", () => !cancelled && setLive("polling"));
      } catch {
        setLive("polling");
      }
    })();
    const poll = setInterval(() => {
      if (!cancelled && document.visibilityState === "visible") fetchInventory();
    }, 15000);
    return () => {
      cancelled = true;
      clearInterval(poll);
      socket?.disconnect();
    };
  }, [showId, fetchInventory]);

  // keep the selection store in sync with fresh inventory (e.g., seat became HELD elsewhere)
  useEffect(() => {
    if (!inv) return;
    const byId = new Map(inv.seats.map((s) => [s.id, s]));
    const stale = selected.filter((sel) => {
      const live = byId.get(sel.showSeatId);
      return !live || live.status !== "AVAILABLE";
    });
    if (stale.length > 0) {
      toast.warning(`${stale.length === 1 ? "One seat is" : stale.length + " seats are"} no longer available and were removed from your selection.`);
      stale.forEach((s) => toggleSeat(s));
    }
     
  }, [inv]);

  // ---------- derived ----------
  const selectedSeats = useMemo(() => {
    if (!inv) return [];
    const byId = new Map(inv.seats.map((s) => [s.id, s]));
    return selected
      .map((sel) => byId.get(sel.showSeatId))
      .filter((s): s is InventorySeat => !!s);
  }, [inv, selected]);

  const total = selectedSeats.reduce((sum, s) => sum + s.price, 0);

  const previewSeat = useMemo(
    () => inv?.seats.find((s) => s.id === previewSeatId) || null,
    [inv, previewSeatId]
  );

  useEffect(() => {
    if (previewSeatId) setMode("preview");
  }, [previewSeatId]);

  const previewVision = useMemo(() => {
    if (!inv || !previewSeat) return null;
    const m = measureSeat(previewSeat, inv.layout.screen);
    const g = deriveSightline(m, inv.layout.screen);
    return { ...m, ...g };
  }, [inv, previewSeat]);

  // preview navigation: next/prev AVAILABLE seat (falls back to any seat)
  const stepPreview = useCallback(
    (dir: 1 | -1) => {
      if (!inv || !previewSeat) return;
      const idx = inv.seats.findIndex((s) => s.id === previewSeat.id);
      const isSel = (s: InventorySeat) => s.status === "AVAILABLE";
      let j = idx;
      for (let n = 0; n < inv.seats.length; n++) {
        j = (j + dir + inv.seats.length) % inv.seats.length;
        if (isSel(inv.seats[j])) {
          setPreviewSeat(inv.seats[j].id);
          return;
        }
      }
    },
    [inv, previewSeat, setPreviewSeat]
  );

  // keyboard: Esc exits preview/walk, arrows step preview
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (mode === "preview") setPreviewSeat(null);
        if (mode === "walk") setMode("orbit");
      }
      if (mode === "preview" && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
        e.preventDefault();
        stepPreview(e.key === "ArrowRight" ? 1 : -1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, stepPreview, setPreviewSeat]);

  const onToggleFromScene = useCallback(
    (seat: InventorySeat) => {
      if (seat.status !== "AVAILABLE" && !selected.some((x) => x.showSeatId === seat.id)) return;
      toggleSeat({
        showSeatId: seat.id, rowLabel: seat.rowLabel, seatNumber: seat.seatNumber,
        price: seat.price, category: seat.category, status: seat.status,
      });
    },
    [selected, toggleSeat]
  );

  const selectedIds = useMemo(() => new Set(selected.map((s) => s.showSeatId)), [selected]);

  // ---------- hold → booking → checkout ----------
  const holdAndCheckout = async () => {
    if (!session) {
      sessionStorage.setItem("c360_return", window.location.hash);
      toast.info("Please sign in to hold your seats — your selection will be kept.");
      navigate("/login");
      return;
    }
    if (selectedSeats.length === 0) return;
    setHolding(true);
    try {
      const hold = await api.post<{ holdId: string; expiresAt: string }>("/api/seat-holds", {
        showId,
        seatIds: selectedSeats.map((s) => s.id),
      });
      const { booking } = await api.post<{ booking: { id: string } }>("/api/bookings", { holdId: hold.holdId });
      toast.success(`Seats held for you until ${new Date(hold.expiresAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}`);
      clearSeats();
      setPreviewSeat(null);
      navigate(`/checkout/${booking.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not hold these seats");
      fetchInventory();
    } finally {
      setHolding(false);
    }
  };

  // ---------- render ----------
  if (error) return <EmptyState title="Show unavailable" hint={error} action={<Button onClick={() => navigate("/movies")}>Browse movies</Button>} />;
  if (!inv) return <div className="py-32 flex justify-center"><Spinner label="Loading auditorium…" /></div>;

  const { show } = inv;
  const walkAvailable = !isTouch && webglOk;

  return (
    <div className="max-w-[1500px] mx-auto px-3 md:px-4 py-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="min-w-0">
          <button onClick={() => navigate(`/movies/${show.movie.id}`)} className="text-xs text-[#477BFF] hover:underline cursor-pointer">← {show.movie.title}</button>
          <h1 className="text-lg md:text-xl font-bold mt-0.5 truncate">
            {show.auditorium.theatre.name} · {show.auditorium.name}
          </h1>
          <p className="text-xs text-[#8FA3BF] mt-0.5">
            {fmtDateTime(show.startsAt)} · {show.format} · {show.language} · {show.movie.certification}
            <span className="ml-2 inline-flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full cine-pulse-dot ${live === "live" ? "bg-[#2FBF71]" : "bg-[#F5C518]"}`} />
              {live === "live" ? "Live seat sync" : "Auto-refresh (15s)"}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] px-2 py-1 rounded-full border ${show.auditorium.geometrySource === "UPLOADED" ? "border-[#2FBF71]/40 text-[#2FBF71] bg-[#2FBF71]/10" : "border-white/15 text-[#8FA3BF] bg-white/5"}`}>
            {show.auditorium.geometrySource === "UPLOADED" ? "CALIBRATED 3D MODEL" : "DEMO GEOMETRY"}
          </span>
          <Button size="sm" variant={force2D ? "default" : "outline"} onClick={() => setForce2D((v) => !v)} className={force2D ? "bg-[#477BFF]" : "border-white/15"}>
            <Accessibility className="w-3.5 h-3.5 mr-1.5" /> {force2D ? "3D view" : "2D seat map"}
          </Button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        {/* ==================== 3D / 2D STAGE ==================== */}
        <div className="flex-1 min-w-0">
          <div ref={containerRef} className="relative rounded-2xl overflow-hidden border border-white/10 bg-[#050609]" style={{ height: "min(72vh, 780px)" }}>
            {force2D || !webglOk ? (
              <SeatMap2D
                seats={inv.seats}
                selectedIds={selectedIds}
                onToggle={onToggleFromScene}
                categories={inv.categories}
              />
            ) : (
              <>
                <AuditoriumCanvas
                  seats={inv.seats}
                  layout={inv.layout}
                  dimensions={inv.dimensions}
                  selectedIds={selectedIds}
                  onToggleSeat={onToggleFromScene}
                  onHoverSeat={setHoveredSeat}
                  mode={mode}
                  previewSeat={previewSeat}
                  movieTitle={show.movie.title}
                  accent="#477BFF"
                  isTouch={isTouch}
                  moveRef={moveRef}
                  resetKey={resetKey}
                />

                {/* floating controls */}
                <div className="absolute top-3 left-3 flex flex-col gap-2 z-10">
                  <div className="flex rounded-xl overflow-hidden border border-white/10 bg-[#0B0D12]/90 backdrop-blur">
                    <SceneModeButton active={mode === "orbit"} icon={<Orbit className="w-4 h-4" />} label="Orbit" onClick={() => { setMode("orbit"); setPreviewSeat(null); }} disabled={!webglOk} />
                    {walkAvailable && (
                      <SceneModeButton active={mode === "walk"} icon={<Footprints className="w-4 h-4" />} label="Walk" onClick={() => { setMode("walk"); setPreviewSeat(null); }} />
                    )}
                    <SceneModeButton active={mode === "preview"} icon={<Eye className="w-4 h-4" />} label="Seat view" disabled={!previewSeat && mode !== "preview"} onClick={() => previewSeat ? setMode("preview") : toast.info("Select a seat first, then press Preview This Seat.")} />
                    <SceneModeButton active={false} icon={<LayoutGrid className="w-4 h-4" />} label="2D" onClick={() => { setMode("orbit"); setForce2D(true); }} />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setResetKey((k) => k + 1); setPreviewSeat(null); setMode("orbit"); }}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#0B0D12]/90 border border-white/10 text-xs text-[#DDE1E8] hover:border-[#477BFF]/50 transition-colors cursor-pointer"
                      aria-label="Reset camera"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Reset
                    </button>
                    <button
                      onClick={() => {
                        const el = containerRef.current;
                        if (!document.fullscreenElement) el?.requestFullscreen?.().catch(() => toast.error("Fullscreen is blocked by the browser"));
                        else document.exitFullscreen?.();
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#0B0D12]/90 border border-white/10 text-xs text-[#DDE1E8] hover:border-[#477BFF]/50 transition-colors cursor-pointer"
                      aria-label="Toggle fullscreen"
                    >
                      <Maximize className="w-3.5 h-3.5" /> Fullscreen
                    </button>
                  </div>
                </div>

                {/* walk instructions / touch dpad */}
                {mode === "walk" && (
                  <WalkHints moveRef={moveRef} isTouch={isTouch} onExit={() => setMode("orbit")} />
                )}
                {mode === "orbit" && showInstructions && (
                  <div className="absolute bottom-3 left-3 right-3 md:right-auto md:max-w-md z-10 flex items-start gap-3 px-4 py-3 rounded-xl bg-[#0B0D12]/90 backdrop-blur border border-white/10 text-xs text-[#B9C4D6]">
                    <MousePointerClick className="w-4 h-4 text-[#477BFF] shrink-0 mt-0.5" />
                    <div>
                      <b className="text-white">Drag</b> to orbit, <b className="text-white">scroll</b> to zoom, <b className="text-white">right-drag</b> to pan. <b className="text-white">Click any green seat</b> to select it. Hover a chair for details.
                      <button onClick={() => setShowInstructions(false)} className="ml-2 text-[#8FA3BF] hover:text-white cursor-pointer underline">Got it</button>
                    </div>
                  </div>
                )}

                {/* ==================== SEAT EXPERIENCE HUD (compact, keeps screen visible) ==================== */}
                {mode === "preview" && previewSeat && previewVision && (
                  <div className="absolute inset-x-2 bottom-2 z-20 rounded-xl bg-[#0B0D12]/90 backdrop-blur border border-[#477BFF]/30 px-3 py-2.5 shadow-2xl">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <span className="text-[9px] uppercase tracking-widest text-[#20D9E8]">Seat Experience · eye-position preview</span>
                        <div className="font-bold text-sm leading-tight truncate">
                          Row {previewSeat.rowLabel} · Seat {previewSeat.seatNumber}
                          <span className="ml-2 text-xs font-medium text-[#F5C518]">{previewSeat.category}</span>
                          <span className="ml-2 text-xs text-[#2FBF71]">{inr(previewSeat.price)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button onClick={() => setPreviewSeat(null)} className="p-1.5 rounded-lg hover:bg-white/10 text-[#8FA3BF] cursor-pointer" aria-label="Return to auditorium" title="Return to auditorium (Esc)">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-1.5 mb-2">
                      <Metric label="Distance" value={`${previewVision.distanceM} m`} />
                      <Metric label="Horiz. angle" value={`${previewVision.horizontalAngleDeg}°`} />
                      <Metric label="Vert. angle" value={`${previewVision.verticalAngleDeg}°`} />
                      <Metric label="Sightline" value={previewVision.grade} accent={previewVision.score >= 82 ? "#2FBF71" : previewVision.score >= 64 ? "#F5C518" : "#FF713D"} />
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <Button size="sm" variant="outline" className="border-white/15 h-7 text-[11px] px-2.5" onClick={() => stepPreview(-1)}>
                        <ChevronLeft className="w-3 h-3" /> Prev
                      </Button>
                      <Button size="sm" variant="outline" className="border-white/15 h-7 text-[11px] px-2.5" onClick={() => stepPreview(1)}>
                        Next <ChevronRight className="w-3 h-3" />
                      </Button>
                      {compare.some((c) => c.showSeatId === previewSeat.id) ? (
                        <Button size="sm" variant="outline" className="border-[#FF713D]/40 text-[#FF713D] h-7 text-[11px] px-2.5" onClick={() => removeCompare(previewSeat.id)}>
                          <PinOff className="w-3 h-3 mr-1" /> Unpin
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" className="border-[#20D9E8]/40 text-[#20D9E8] h-7 text-[11px] px-2.5" onClick={() => addCompare({ showSeatId: previewSeat.id, label: `R${previewSeat.rowLabel}·S${previewSeat.seatNumber}`, distanceM: previewVision.distanceM, hAngle: previewVision.horizontalAngleDeg, vAngle: previewVision.verticalAngleDeg, score: previewVision.score, grade: previewVision.grade })}>
                          <Pin className="w-3 h-3 mr-1" /> Compare
                        </Button>
                      )}
                      <Button
                        size="sm"
                        className={`h-7 text-[11px] px-2.5 ${selectedIds.has(previewSeat.id) ? "bg-[#E5484D] hover:bg-[#F05A5F]" : "bg-[#477BFF] hover:bg-[#5C89FF]"}`}
                        onClick={() => onToggleFromScene(previewSeat)}
                      >
                        {selectedIds.has(previewSeat.id) ? "Deselect seat" : "Select this seat"}
                      </Button>
                      <span className="text-[9px] text-[#8FA3BF]/80 ml-auto hidden md:inline" title="Measured from the configured auditorium geometry (eye height). Sightline grade is a derived indicator using THX/SMPTE-style bands — not a guaranteed experience.">
                        Measured from configured geometry · derived indicator
                      </span>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Legend + compare strip */}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 px-1">
            {LEGEND.map((l) => (
              <span key={l.label} className="flex items-center gap-1.5 text-[11px] text-[#8FA3BF]">
                <span className="w-3 h-3 rounded-[4px] border border-white/20" style={{ background: l.color }} aria-hidden="true" />
                {l.label}
              </span>
            ))}
            <span className="text-[11px] text-[#8FA3BF] ml-auto flex items-center gap-1"><Info className="w-3 h-3" /> Availability also labelled on hover and in the 2D map</span>
          </div>

          {compare.length > 0 && (
            <div className="mt-3 cine-card p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold flex items-center gap-1.5"><Pin className="w-3.5 h-3.5 text-[#20D9E8]" /> SeatVision comparison</h3>
                <button onClick={() => useBookingSelection.getState().clearCompare()} className="text-xs text-[#8FA3BF] hover:text-white cursor-pointer">Clear</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-[#8FA3BF] text-left">
                      <th className="py-1.5 pr-3 font-medium">Seat</th>
                      <th className="py-1.5 pr-3 font-medium">Distance</th>
                      <th className="py-1.5 pr-3 font-medium">Horiz. angle</th>
                      <th className="py-1.5 pr-3 font-medium">Vert. angle</th>
                      <th className="py-1.5 pr-3 font-medium">Grade</th>
                      <th className="py-1.5 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {compare.map((c) => (
                      <tr key={c.showSeatId} className="border-t border-white/5">
                        <td className="py-1.5 pr-3 font-semibold text-white">{c.label}</td>
                        <td className="py-1.5 pr-3">{c.distanceM} m</td>
                        <td className="py-1.5 pr-3">{c.hAngle}°</td>
                        <td className="py-1.5 pr-3">{c.vAngle}°</td>
                        <td className="py-1.5 pr-3" style={{ color: c.score >= 82 ? "#2FBF71" : c.score >= 64 ? "#F5C518" : "#FF713D" }}>{c.grade}</td>
                        <td className="py-1.5">
                          <button onClick={() => removeCompare(c.showSeatId)} className="text-[#8FA3BF] hover:text-white cursor-pointer" aria-label={`Remove ${c.label} from comparison`}><X className="w-3.5 h-3.5" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* ==================== SELECTION PANEL ==================== */}
        <aside className="w-full lg:w-[360px] shrink-0 space-y-4" aria-label="Seat selection and checkout">
          <div className="cine-card p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-bold flex items-center gap-2"><Armchair className="w-4 h-4 text-[#477BFF]" /> Your selection</h2>
              {selected.length > 0 && (
                <button onClick={clearSeats} className="text-xs text-[#8FA3BF] hover:text-white cursor-pointer">Clear all</button>
              )}
            </div>

            <div className="mt-3 text-xs text-[#8FA3BF]">
              {inv.counts.AVAILABLE ?? 0} of {inv.seats.length} seats available right now
            </div>

            <div className="mt-4 min-h-[92px] max-h-56 overflow-y-auto cine-scroll space-y-1.5" aria-live="polite">
              {selectedSeats.length === 0 ? (
                <p className="text-sm text-[#8FA3BF] py-4 text-center">
                  {force2D ? "Tap seats on the 2D map" : "Click seats in the 3D auditorium"} to add them here, then use <b className="text-[#20D9E8]">Preview This Seat</b> to experience the view.
                </p>
              ) : (
                selectedSeats.map((s) => (
                  <div key={s.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.04] border border-white/5 text-sm">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-8 h-8 rounded-md bg-[#477BFF]/15 border border-[#477BFF]/40 text-[#9FC0FF] text-[11px] font-bold flex items-center justify-center shrink-0">
                        {s.rowLabel}{s.seatNumber}
                      </span>
                      <div className="min-w-0">
                        <div className="font-medium truncate">{s.category}</div>
                        <div className="text-[11px] text-[#8FA3BF]">Row {s.rowLabel} · Seat {s.seatNumber}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setPreviewSeat(s.id)}
                        className="text-[11px] px-2 py-1 rounded-md border border-[#20D9E8]/40 text-[#20D9E8] hover:bg-[#20D9E8]/10 transition-colors cursor-pointer"
                        disabled={force2D}
                        title={force2D ? "Preview is available in the 3D view" : "Preview the screen from this seat"}
                      >
                        <Eye className="w-3 h-3 inline mr-1" />Preview
                      </button>
                      <span className="font-semibold">{inr(s.price)}</span>
                      <button onClick={() => onToggleFromScene(s)} className="text-[#8FA3BF] hover:text-[#E5484D] cursor-pointer" aria-label={`Remove seat ${s.rowLabel}${s.seatNumber}`}>
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <Separator className="my-4 bg-white/5" />

            <div className="flex items-center justify-between text-sm">
              <span className="text-[#8FA3BF]">{selectedSeats.length} ticket{selectedSeats.length === 1 ? "" : "s"}</span>
              <span className="font-bold text-xl">{inr(total)}</span>
            </div>
            {selectedSeats.length > 0 && selectedSeats.length < 4 && (
              <p className="text-[11px] text-[#8FA3BF] mt-1">Convenience fee: none in demo · taxes included</p>
            )}

            <Button
              className="w-full mt-4 h-11 bg-[#477BFF] hover:bg-[#5C89FF] font-semibold"
              disabled={selectedSeats.length === 0 || holding}
              onClick={holdAndCheckout}
            >
              {holding ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Securing seats…</>
              ) : (
                <>Hold {selectedSeats.length > 0 ? `${selectedSeats.length} seat${selectedSeats.length === 1 ? "" : "s"}` : "seats"} · {inr(total)} <span className="text-[#DDE1E8]/70 font-normal ml-1">(5 min)</span></>
              )}
            </Button>
            <p className="text-[11px] text-[#8FA3BF] mt-2.5 leading-relaxed">
              Seats are protected for 5 minutes while you check out. Unpaid holds expire automatically and seats return to inventory.
            </p>
          </div>

          {/* mini show card */}
          <div className="cine-card p-4 flex gap-3">
            { }
            <img src={show.movie.posterUrl} alt={`${show.movie.title} poster`} className="w-14 h-20 rounded-lg object-cover border border-white/10" />
            <div className="text-sm min-w-0">
              <div className="font-semibold truncate">{show.movie.title}</div>
              <div className="text-xs text-[#8FA3BF] mt-0.5">{show.movie.durationMins} min · {show.movie.certification}</div>
              <div className="text-xs text-[#20D9E8] mt-1">{show.format} · {show.language}</div>
              <button onClick={() => navigate(`/theatres/${show.auditorium.theatre.id}`)} className="text-xs text-[#477BFF] hover:underline mt-1.5 cursor-pointer">
                {show.auditorium.theatre.name}
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function SceneModeButton({ active, icon, label, onClick, disabled }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`flex items-center gap-1.5 px-3 py-2 text-xs transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
        active ? "bg-[#477BFF] text-white" : "text-[#B9C4D6] hover:bg-white/10"
      }`}
    >
      {icon} {label}
    </button>
  );
}

function Metric({ label, value, accent = "#F5F7FA" }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-lg bg-white/[0.04] border border-white/5 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-[#8FA3BF]">{label}</div>
      <div className="text-sm font-bold mt-0.5" style={{ color: accent }}>{value}</div>
    </div>
  );
}

function WalkHints({ moveRef, isTouch, onExit }: { moveRef: React.MutableRefObject<MoveVector>; isTouch: boolean; onExit: () => void }) {
  const set = (x: number, z: number) => {
    moveRef.current = { x, z };
  };
  const btn = "w-11 h-11 rounded-lg bg-[#0B0D12]/90 border border-white/15 text-white flex items-center justify-center active:bg-[#477BFF] select-none touch-none";
  return (
    <div className="absolute inset-0 z-10 pointer-events-none">
      {!isTouch && (
        <div className="absolute top-3 right-3 px-4 py-3 rounded-xl bg-[#0B0D12]/90 border border-white/10 text-xs text-[#B9C4D6] max-w-[260px] pointer-events-auto">
          <b className="text-white">Walk mode.</b> Click to capture the mouse · <b>WASD / arrows</b> to move · <b>Esc</b> to release & exit. You cannot walk through walls or seats.
          <button onClick={onExit} className="block mt-2 text-[#477BFF] hover:underline cursor-pointer">Exit walk mode</button>
        </div>
      )}
      {isTouch && (
        <div className="absolute bottom-4 left-4 pointer-events-auto" style={{ touchAction: "none" }}>
          <div className="grid grid-cols-3 gap-1 w-[132px]">
            <span />
            <button className={btn} aria-label="Move forward" onPointerDown={() => set(0, 1)} onPointerUp={() => set(0, 0)} onPointerLeave={() => set(0, 0)}>▲</button>
            <span />
            <button className={btn} aria-label="Move left" onPointerDown={() => set(-1, 0)} onPointerUp={() => set(0, 0)} onPointerLeave={() => set(0, 0)}>◀</button>
            <button className={btn} aria-label="Move back" onPointerDown={() => set(0, -1)} onPointerUp={() => set(0, 0)} onPointerLeave={() => set(0, 0)}>▼</button>
            <button className={btn} aria-label="Move right" onPointerDown={() => set(1, 0)} onPointerUp={() => set(0, 0)} onPointerLeave={() => set(0, 0)}>▶</button>
          </div>
          <button onClick={onExit} className="mt-2 w-full py-2 rounded-lg bg-[#0B0D12]/90 border border-white/15 text-xs text-white cursor-pointer">Exit walk</button>
        </div>
      )}
    </div>
  );
}
