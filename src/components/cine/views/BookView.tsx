"use client";
// CINE 360 — THE booking experience: 3D auditorium + selection panel +
// Seat Experience Mode (SeatVision) + accessible 2D map + hold → checkout.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { navigate } from "@/lib/router";
import { api, inr, fmtDateTime } from "@/lib/client";
import { useAuth, useBookingSelection, type SelectedSeat } from "@/lib/store";
import type { InventorySeat } from "@/lib/inventory";
import type { LayoutConfig } from "@/lib/geometry";
import {
  measureSeat,
  deriveSightline,
  themeOf,
  findSmartSeatRecommendations,
  findContiguousGroupSeats,
  type SmartSeatRec,
  type GroupSeatCluster,
} from "@/lib/geometry";
import dynamicImport from "next/dynamic";
import type { SceneMode, MoveVector } from "@/components/cine/three/AuditoriumScene";
import SeatMap2D from "./SeatMap2D";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Pin, PinOff, X, MousePointerClick, Loader2, Info, Accessibility, Sun, Moon, Flame, Play,
  Sparkles, Users, Calculator, Bell, CheckCircle2,
} from "lucide-react";

type Inventory = {
  show: {
    id: string; startsAt: string; language: string; format: string; status: string;
    movie: { id: string; title: string; posterUrl: string; backdropUrl?: string | null; trailerId?: string | null; trailerUrl?: string | null; certification: string; durationMins: number };
    auditorium: { id: string; name: string; geometrySource: string; theatre: { id: string; name: string; city: string; address: string } };
  };
  layout: LayoutConfig;
  dimensions: { widthM: number; depthM: number; heightM: number; lastRowZ: number; screenCenterY: number; maxRowWidthM: number };
  categories: { code: string; name: string; color: string; basePrice: number }[];
  seats: InventorySeat[];
  counts: Record<string, number>;
};

const LEGEND = [
  { color: "#34D399", label: "Available", key: "AVAILABLE" as const },
  { color: "#FFD166", label: "Held by others", key: null },
  { color: "#E5484D", label: "Booked", key: null },
  { color: "#8B5CF6", label: "Your selection", key: null },
  { color: "#4A3D63", label: "Unavailable", key: null },
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
  const [bright, setBright] = useState(true); // house lights up by default
  const [heatmap, setHeatmap] = useState(false); // row-demand heat colouring
  const [trailerOpen, setTrailerOpen] = useState(false);

  // Smart Recommendations modal
  const [smartRecOpen, setSmartRecOpen] = useState(false);
  // Group Seat Finder modal
  const [groupFinderOpen, setGroupFinderOpen] = useState(false);
  const [groupSize, setGroupSize] = useState(2);
  // Price Estimator modal
  const [estimatorOpen, setEstimatorOpen] = useState(false);
  // Waitlist state
  const [waitlistJoining, setWaitlistJoining] = useState(false);

  // Close the trailer overlay with Escape (a11y)
  useEffect(() => {
    if (!trailerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setTrailerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [trailerOpen]);
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

  // Safety net: if the preview target disappears while still in preview mode
  // (✕ pressed, seat removed, hold completed) return to the orbit overview
  // instead of leaving the camera frozen at a seat with no HUD.
  useEffect(() => {
    if (mode === "preview" && !previewSeat) setMode("orbit");
  }, [mode, previewSeat]);

  const previewVision = useMemo(() => {
    if (!inv || !previewSeat) return null;
    const m = measureSeat(previewSeat, inv.layout.screen);
    const g = deriveSightline(m, inv.layout.screen);
    return { ...m, ...g };
  }, [inv, previewSeat]);

  // Auditorium interior identity — seats, 2D map and legend all follow this colour.
  const themeSeatColor = themeOf(inv?.layout.theme)?.seat || "#34D399";

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
        if (mode === "preview") { setPreviewSeat(null); setMode("orbit"); }
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

  /** Geometrically best AVAILABLE seat (centre distance + smallest off-axis angles). */
  const recommendedSeat = (seats: InventorySeat[], screen: LayoutConfig["screen"]) => {
    let best: InventorySeat | null = null;
    let bestScore = Infinity;
    for (const s of seats) {
      if (s.status !== "AVAILABLE") continue;
      const m = measureSeat(s, screen);
      const score =
        Math.abs(m.horizontalDistanceM - screen.widthM * 1.5) +
        Math.abs(m.horizontalAngleDeg) * 0.45 +
        Math.abs(m.verticalAngleDeg) * 0.25;
      if (score < bestScore) {
        bestScore = score;
        best = s;
      }
    }
    return best;
  };

  // "Seat view" must ALWAYS respond. Priority:
  //   1. already previewing (keep the target, even if it was stepped via Next/Prev)
  //   2. a freshly selected seat
  //   3. geometrically recommended seat (with an explanatory toast)
  const enterSeatView = useCallback(() => {
    if (!inv) return;
    if (mode === "preview" && previewSeat) {
      setMode("preview");
      return;
    }
    const sel = selectedSeats[0];
    if (sel) {
      if (previewSeat?.id !== sel.id) setPreviewSeat(sel.id);
      setMode("preview");
      return;
    }
    if (previewSeat) {
      setMode("preview");
      return;
    }
    const best = recommendedSeat(inv.seats, inv.layout.screen);
    if (best) {
      setPreviewSeat(best.id);
      setMode("preview");
      toast.info(`No seat picked yet — showing the view from recommended seat ${best.rowLabel}${best.seatNumber}. Click any green seat to choose your own.`, { duration: 6000 });
    } else {
      toast.info("Click any green seat in the auditorium first, then press Seat view.");
    }
  }, [inv, mode, previewSeat, selectedSeats, setPreviewSeat]);

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

  const availableSeats = useMemo(() => {
    if (!inv) return [];
    return inv.seats
      .filter((s) => s.status === "AVAILABLE")
      .map((s) => ({
        showSeatId: s.id,
        seatId: s.id,
        rowLabel: s.rowLabel,
        seatNumber: s.seatNumber,
        price: s.price,
        category: s.category,
        x: s.x,
        z: s.z,
        baseY: s.baseY,
        eyeHeight: s.eyeHeight,
      }));
  }, [inv]);

  const smartRecommendations = useMemo(() => {
    if (!inv || availableSeats.length === 0) return [];
    return findSmartSeatRecommendations(availableSeats, inv.layout.screen);
  }, [inv, availableSeats]);

  const groupClusters = useMemo(() => {
    if (!inv || availableSeats.length === 0) return [];
    return findContiguousGroupSeats(availableSeats, groupSize, inv.layout.screen);
  }, [inv, availableSeats, groupSize]);

  const handleJoinWaitlist = async () => {
    if (!session) {
      sessionStorage.setItem("c360_return", `#/book/${showId}`);
      toast.info("Please sign in to join the show waitlist");
      navigate("/login");
      return;
    }
    setWaitlistJoining(true);
    try {
      const res = await api.post<{ message?: string }>("/api/waitlist", { showId });
      toast.success(res?.message || "Joined show waitlist! We will alert you if seats become available.");
    } catch (e: any) {
      toast.error(e?.message || "Failed to join waitlist");
    } finally {
      setWaitlistJoining(false);
    }
  };

  const selectGroupCluster = (cluster: GroupSeatCluster) => {
    for (const st of cluster.seats) {
      if (!selected.some((s) => s.showSeatId === st.showSeatId)) {
        toggleSeat({
          showSeatId: st.showSeatId,
          rowLabel: st.rowLabel,
          seatNumber: st.seatNumber,
          price: st.price,
          category: st.category,
          status: "AVAILABLE",
        });
      }
    }
    setGroupFinderOpen(false);
    toast.success(`Selected ${cluster.count} seats in Row ${cluster.rowLabel}!`);
  };

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
          <button onClick={() => navigate(`/movies/${show.movie.id}`)} className="text-xs text-[#8B5CF6] hover:underline cursor-pointer">← {show.movie.title}</button>
          <h1 className="text-lg md:text-xl font-bold mt-0.5 truncate">
            {show.auditorium.theatre.name} · {show.auditorium.name}
          </h1>
          <p className="text-xs text-[#B4A6D4] mt-0.5">
            {fmtDateTime(show.startsAt)} · {show.format} · {show.language} · {show.movie.certification}
            <span className="ml-2 inline-flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full cine-pulse-dot ${live === "live" ? "bg-[#34D399]" : "bg-[#FFD166]"}`} />
              {live === "live" ? "Live seat sync" : "Auto-refresh (15s)"}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSmartRecOpen(true)}
            className="border-[#F59E0B]/40 text-[#F59E0B] hover:bg-[#F59E0B]/10 gap-1.5 text-xs h-8 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" /> Smart Picks
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setGroupFinderOpen(true)}
            className="border-[#38BDF8]/40 text-[#38BDF8] hover:bg-[#38BDF8]/10 gap-1.5 text-xs h-8 cursor-pointer"
          >
            <Users className="w-3.5 h-3.5" /> Group Finder
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setEstimatorOpen(true)}
            className="border-white/15 text-white hover:border-[#10B981] gap-1.5 text-xs h-8 cursor-pointer"
          >
            <Calculator className="w-3.5 h-3.5 text-[#10B981]" /> Price Breakdown
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleJoinWaitlist}
            disabled={waitlistJoining}
            className="border-white/15 text-[#94A3B8] hover:text-white gap-1.5 text-xs h-8 cursor-pointer"
          >
            <Bell className="w-3.5 h-3.5" /> Waitlist
          </Button>
          <Button size="sm" variant={force2D ? "default" : "outline"} onClick={() => setForce2D((v) => !v)} className={force2D ? "bg-[#8B5CF6] text-xs h-8" : "border-white/15 text-xs h-8"}>
            <Accessibility className="w-3.5 h-3.5 mr-1.5" /> {force2D ? "3D view" : "2D seat map"}
          </Button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        {/* ==================== 3D / 2D STAGE ==================== */}
        <div className="flex-1 min-w-0">
          <div ref={containerRef} className="relative rounded-2xl overflow-hidden border border-white/10 bg-[#0E0817]" style={{ height: "min(72vh, 780px)" }}>
            {force2D || !webglOk ? (
              <SeatMap2D
                seats={inv.seats}
                selectedIds={selectedIds}
                onToggle={onToggleFromScene}
                categories={inv.categories}
                availableColor={themeSeatColor}
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
                  accent="#8B5CF6"
                  isTouch={isTouch}
                  moveRef={moveRef}
                  resetKey={resetKey}
                  bright={bright}
                  heatmap={heatmap}
                  backdropUrl={show.movie.backdropUrl}
                  showLabel={fmtDateTime(show.startsAt)}
                  theme={inv.layout.theme ?? null}
                />

                {/* floating controls */}
                <div className="absolute top-3 left-3 flex flex-col gap-2 z-10">
                  <div className="flex rounded-xl overflow-hidden border border-white/10 bg-[#150C22]/90 backdrop-blur">
                    <SceneModeButton active={mode === "orbit"} icon={<Orbit className="w-4 h-4" />} label="Orbit" onClick={() => { setMode("orbit"); setPreviewSeat(null); }} disabled={!webglOk} />
                    {walkAvailable && (
                      <SceneModeButton active={mode === "walk"} icon={<Footprints className="w-4 h-4" />} label="Walk" onClick={() => { setMode("walk"); setPreviewSeat(null); }} />
                    )}
                    <SceneModeButton active={mode === "preview"} icon={<Eye className="w-4 h-4" />} label="Seat view" onClick={enterSeatView} title={previewSeat ? "Return to the eye-position view" : selectedSeats.length > 0 ? "See the screen from your selected seat" : "See the view from the recommended centre seat"} />
                    <SceneModeButton active={false} icon={<LayoutGrid className="w-4 h-4" />} label="2D" onClick={() => { setMode("orbit"); setForce2D(true); }} />
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => { setResetKey((k) => k + 1); setPreviewSeat(null); setMode("orbit"); }}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#150C22]/90 border border-white/10 text-xs text-[#EAE2FA] hover:border-[#8B5CF6]/50 transition-colors cursor-pointer"
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
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#150C22]/90 border border-white/10 text-xs text-[#EAE2FA] hover:border-[#8B5CF6]/50 transition-colors cursor-pointer"
                      aria-label="Toggle fullscreen"
                    >
                      <Maximize className="w-3.5 h-3.5" /> Fullscreen
                    </button>
                    <button
                      onClick={() => setBright((v) => !v)}
                      aria-pressed={bright}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs transition-colors cursor-pointer ${bright ? "bg-[#FFF3D6] border-[#FFD59E] text-[#5A4300]" : "bg-[#150C22]/90 border-white/10 text-[#EAE2FA] hover:border-[#8B5CF6]/50"}`}
                      aria-label="Toggle house lights"
                      title={bright ? "House lights: ON — click to dim the theatre" : "House lights: DIM — click to brighten"}
                    >
                      {bright ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />} Lights {bright ? "ON" : "DIM"}
                    </button>
                    <button
                      onClick={() => setHeatmap((v) => !v)}
                      aria-pressed={heatmap}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs transition-colors cursor-pointer ${heatmap ? "bg-[#F0659A] border-[#F0659A] text-white" : "bg-[#150C22]/90 border-white/10 text-[#EAE2FA] hover:border-[#8B5CF6]/50"}`}
                      aria-label="Toggle demand heatmap"
                      title="Colour available seats by how busy each row is"
                    >
                      <Flame className="w-3.5 h-3.5" /> Heatmap
                    </button>
                    {(show.movie.trailerId || show.movie.trailerUrl) && (
                      <button
                        onClick={() => setTrailerOpen(true)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#F43F5E]/90 border border-[#F43F5E] text-xs text-white hover:bg-[#F43F5E] transition-colors cursor-pointer"
                        aria-label="Play trailer on screen"
                        title="Play the official trailer"
                      >
                        <Play className="w-3.5 h-3.5" /> Trailer
                      </button>
                    )}
                  </div>
                </div>

                {/* walk instructions / touch dpad */}
                {mode === "walk" && (
                  <WalkHints moveRef={moveRef} isTouch={isTouch} onExit={() => setMode("orbit")} />
                )}
                {mode === "orbit" && showInstructions && (
                  <div className="absolute bottom-3 left-3 right-3 md:right-auto md:max-w-md z-10 flex items-start gap-3 px-4 py-3 rounded-xl bg-[#150C22]/90 backdrop-blur border border-white/10 text-xs text-[#D5C9F0]">
                    <MousePointerClick className="w-4 h-4 text-[#8B5CF6] shrink-0 mt-0.5" />
                    <div>
                      <b className="text-white">Drag</b> to orbit, <b className="text-white">scroll</b> to zoom, <b className="text-white">right-drag</b> to pan. <b className="text-white">Click any green seat</b> to select it. Hover a chair for details.
                      <button onClick={() => setShowInstructions(false)} className="ml-2 text-[#B4A6D4] hover:text-white cursor-pointer underline">Got it</button>
                    </div>
                  </div>
                )}

                {/* ==================== SEAT EXPERIENCE HUD (compact, keeps screen visible) ==================== */}
                {mode === "preview" && previewSeat && previewVision && (
                  <div className="absolute inset-x-2 bottom-2 z-20 max-h-[calc(100%-1rem)] overflow-y-auto cine-scroll rounded-xl bg-[#150C22]/90 backdrop-blur border border-[#8B5CF6]/30 px-3 py-2.5 shadow-2xl">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <span className="text-[9px] uppercase tracking-widest text-[#F2B04C]">Seat Experience · eye-position preview</span>
                        <div className="font-bold text-sm leading-tight truncate">
                          Row {previewSeat.rowLabel} · Seat {previewSeat.seatNumber}
                          <span className="ml-2 text-xs font-medium text-[#FFD166]">{previewSeat.category}</span>
                          <span className="ml-2 text-xs text-[#34D399]">{inr(previewSeat.price)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button onClick={() => { setPreviewSeat(null); setMode("orbit"); }} className="p-1.5 rounded-lg hover:bg-white/10 text-[#B4A6D4] cursor-pointer" aria-label="Return to auditorium" title="Return to auditorium (Esc)">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Cinematic Seat View Score */}
                    <div className="flex items-center justify-between p-2 rounded-lg bg-black/40 border border-white/10 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-white">Cinematic Seat View Score:</span>
                        <span
                          className="px-2 py-0.5 rounded-md font-mono font-bold text-xs shadow-sm"
                          style={{
                            background: previewVision.score >= 82 ? "#10B981" : previewVision.score >= 64 ? "#F59E0B" : "#EF4444",
                            color: "white",
                          }}
                        >
                          {previewVision.score} / 100
                        </span>
                        <span
                          className="text-[11px] font-medium"
                          style={{ color: previewVision.score >= 82 ? "#34D399" : previewVision.score >= 64 ? "#FFD166" : "#F87171" }}
                        >
                          ({previewVision.grade})
                        </span>
                      </div>
                      <span className="text-[10px] text-[#94A3B8] hidden sm:inline">
                        Estimated from SMPTE / THX cinema eye geometry
                      </span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 mb-2">
                      <Metric label="Distance" value={`${previewVision.distanceM} m`} />
                      <Metric label="Horiz. angle" value={`${previewVision.horizontalAngleDeg}°`} />
                      <Metric label="Vert. angle" value={`${previewVision.verticalAngleDeg}°`} />
                      <Metric label="Sightline" value={previewVision.grade} accent={previewVision.score >= 82 ? "#34D399" : previewVision.score >= 64 ? "#FFD166" : "#F0659A"} />
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <Button size="sm" variant="outline" className="border-white/15 h-7 text-[11px] px-2.5" onClick={() => stepPreview(-1)}>
                        <ChevronLeft className="w-3 h-3" /> Prev
                      </Button>
                      <Button size="sm" variant="outline" className="border-white/15 h-7 text-[11px] px-2.5" onClick={() => stepPreview(1)}>
                        Next <ChevronRight className="w-3 h-3" />
                      </Button>
                      {compare.some((c) => c.showSeatId === previewSeat.id) ? (
                        <Button size="sm" variant="outline" className="border-[#F0659A]/40 text-[#F0659A] h-7 text-[11px] px-2.5" onClick={() => removeCompare(previewSeat.id)}>
                          <PinOff className="w-3 h-3 mr-1" /> Unpin
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" className="border-[#F2B04C]/40 text-[#F2B04C] h-7 text-[11px] px-2.5" onClick={() => addCompare({ showSeatId: previewSeat.id, label: `R${previewSeat.rowLabel}·S${previewSeat.seatNumber}`, distanceM: previewVision.distanceM, hAngle: previewVision.horizontalAngleDeg, vAngle: previewVision.verticalAngleDeg, score: previewVision.score, grade: previewVision.grade })}>
                          <Pin className="w-3 h-3 mr-1" /> Compare
                        </Button>
                      )}
                      <Button
                        size="sm"
                        className={`h-7 text-[11px] px-2.5 ${selectedIds.has(previewSeat.id) ? "bg-[#E5484D] hover:bg-[#F05A5F]" : "bg-[#8B5CF6] hover:bg-[#A78BFA]"}`}
                        onClick={() => onToggleFromScene(previewSeat)}
                      >
                        {selectedIds.has(previewSeat.id) ? "Deselect seat" : "Select this seat"}
                      </Button>
                      <span className="text-[9px] text-[#B4A6D4]/80 ml-auto hidden md:inline" title="Measured from the configured auditorium geometry (eye height). Sightline grade is a derived indicator using THX/SMPTE-style bands — not a guaranteed experience.">
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
              <span key={l.label} className="flex items-center gap-1.5 text-[11px] text-[#B4A6D4]">
                <span className="w-3 h-3 rounded-[4px] border border-white/20" style={{ background: l.key === "AVAILABLE" ? themeSeatColor : l.color }} aria-hidden="true" />
                {l.label}
              </span>
            ))}
            {heatmap && (
              <span className="flex items-center gap-1.5 text-[11px] text-[#FF9A6B]" title="Available seats shift from green to orange as a row fills up">
                <Flame className="w-3 h-3" /> Heatmap: warmer = busier row
              </span>
            )}
            <span className="text-[11px] text-[#B4A6D4] ml-auto flex items-center gap-1"><Info className="w-3 h-3" /> Availability also labelled on hover and in the 2D map</span>
          </div>

          {compare.length > 0 && (
            <div className="mt-3 cine-card p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold flex items-center gap-1.5"><Pin className="w-3.5 h-3.5 text-[#F2B04C]" /> SeatVision comparison</h3>
                <button onClick={() => useBookingSelection.getState().clearCompare()} className="text-xs text-[#B4A6D4] hover:text-white cursor-pointer">Clear</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-[#B4A6D4] text-left">
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
                        <td className="py-1.5 pr-3" style={{ color: c.score >= 82 ? "#34D399" : c.score >= 64 ? "#FFD166" : "#F0659A" }}>{c.grade}</td>
                        <td className="py-1.5">
                          <button onClick={() => removeCompare(c.showSeatId)} className="text-[#B4A6D4] hover:text-white cursor-pointer" aria-label={`Remove ${c.label} from comparison`}><X className="w-3.5 h-3.5" /></button>
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
              <h2 className="font-bold flex items-center gap-2"><Armchair className="w-4 h-4 text-[#8B5CF6]" /> Your selection</h2>
              {selected.length > 0 && (
                <button onClick={clearSeats} className="text-xs text-[#B4A6D4] hover:text-white cursor-pointer">Clear all</button>
              )}
            </div>

            <div className="mt-3 text-xs text-[#B4A6D4]">
              {inv.counts.AVAILABLE ?? 0} of {inv.seats.length} seats available right now
            </div>

            <div className="mt-4 min-h-[92px] max-h-56 overflow-y-auto cine-scroll space-y-1.5" aria-live="polite">
              {selectedSeats.length === 0 ? (
                <p className="text-sm text-[#B4A6D4] py-4 text-center">
                  {force2D ? "Tap seats on the 2D map" : "Click seats in the 3D auditorium"} to add them here, then use <b className="text-[#F2B04C]">Preview This Seat</b> to experience the view.
                </p>
              ) : (
                selectedSeats.map((s) => (
                  <div key={s.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.04] border border-white/5 text-sm">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-8 h-8 rounded-md bg-[#8B5CF6]/15 border border-[#8B5CF6]/40 text-[#C4B5FD] text-[11px] font-bold flex items-center justify-center shrink-0">
                        {s.rowLabel}{s.seatNumber}
                      </span>
                      <div className="min-w-0">
                        <div className="font-medium truncate">{s.category}</div>
                        <div className="text-[11px] text-[#B4A6D4]">Row {s.rowLabel} · Seat {s.seatNumber}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setPreviewSeat(s.id)}
                        className="text-[11px] px-2 py-1 rounded-md border border-[#F2B04C]/40 text-[#F2B04C] hover:bg-[#F2B04C]/10 transition-colors cursor-pointer"
                        disabled={force2D}
                        title={force2D ? "Preview is available in the 3D view" : "Preview the screen from this seat"}
                      >
                        <Eye className="w-3 h-3 inline mr-1" />Preview
                      </button>
                      <span className="font-semibold">{inr(s.price)}</span>
                      <button onClick={() => onToggleFromScene(s)} className="text-[#B4A6D4] hover:text-[#E5484D] cursor-pointer" aria-label={`Remove seat ${s.rowLabel}${s.seatNumber}`}>
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <Separator className="my-4 bg-white/5" />

            <div className="flex items-center justify-between text-sm">
              <span className="text-[#B4A6D4]">{selectedSeats.length} ticket{selectedSeats.length === 1 ? "" : "s"}</span>
              <span className="font-bold text-xl">{inr(total)}</span>
            </div>
            {selectedSeats.length > 0 && selectedSeats.length < 4 && (
              <p className="text-[11px] text-[#B4A6D4] mt-1">Convenience fee: none in demo · taxes included</p>
            )}

            <Button
              className="w-full mt-4 h-11 bg-[#8B5CF6] hover:bg-[#A78BFA] font-semibold"
              disabled={selectedSeats.length === 0 || holding}
              onClick={holdAndCheckout}
            >
              {holding ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Securing seats…</>
              ) : (
                <>Hold {selectedSeats.length > 0 ? `${selectedSeats.length} seat${selectedSeats.length === 1 ? "" : "s"}` : "seats"} · {inr(total)} <span className="text-[#EAE2FA]/70 font-normal ml-1">(5 min)</span></>
              )}
            </Button>
            <p className="text-[11px] text-[#B4A6D4] mt-2.5 leading-relaxed">
              Seats are protected for 5 minutes while you check out. Unpaid holds expire automatically and seats return to inventory.
            </p>
          </div>

          {/* mini show card */}
          <div className="cine-card p-4 flex gap-3">
            { }
            <img src={show.movie.posterUrl} alt={`${show.movie.title} poster`} className="w-14 h-20 rounded-lg object-cover border border-white/10" />
            <div className="text-sm min-w-0">
              <div className="font-semibold truncate">{show.movie.title}</div>
              <div className="text-xs text-[#B4A6D4] mt-0.5">{show.movie.durationMins} min · {show.movie.certification}</div>
              <div className="text-xs text-[#F2B04C] mt-1">{show.format} · {show.language}</div>
              <button onClick={() => navigate(`/theatres/${show.auditorium.theatre.id}`)} className="text-xs text-[#8B5CF6] hover:underline mt-1.5 cursor-pointer">
                {show.auditorium.theatre.name}
              </button>
            </div>
          </div>
        </aside>
      </div>

      {/* Smart Recommendations Dialog */}
      <Dialog open={smartRecOpen} onOpenChange={setSmartRecOpen}>
        <DialogContent className="bg-[#150A24] border-white/10 text-white sm:max-w-xl max-h-[85vh] overflow-y-auto cine-scroll">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg text-white">
              <Sparkles className="w-5 h-5 text-[#F59E0B]" /> Smart Seat Recommendations
            </DialogTitle>
            <DialogDescription className="text-xs text-[#94A3B8]">
              Computed live from the auditorium&apos;s physical screen geometry and current seat availability.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {smartRecommendations.length === 0 ? (
              <p className="text-xs text-[#94A3B8] text-center py-6">No available seats to recommend.</p>
            ) : (
              smartRecommendations.map((rec) => (
                <div
                  key={rec.key}
                  className="p-3.5 rounded-xl border border-white/10 bg-white/[0.03] hover:border-[#F59E0B]/40 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-white">{rec.title}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#F59E0B]/20 text-[#F59E0B] font-semibold">
                        {rec.badge}
                      </span>
                      <span className="text-[11px] font-bold text-[#10B981] ml-auto sm:ml-0">
                        {rec.score}/100
                      </span>
                    </div>
                    <div className="text-xs text-[#E2E8F0] font-medium">
                      Row {rec.rowLabel} · Seat {rec.seatNumber} ({rec.category}) · <span className="text-[#34D399] font-bold">{inr(rec.price)}</span>
                    </div>
                    <div className="text-[11px] text-[#94A3B8] mt-1">{rec.reason}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setPreviewSeat(rec.seatId);
                        setMode("preview");
                        setSmartRecOpen(false);
                      }}
                      className="border-white/15 text-xs h-8 text-[#F59E0B] cursor-pointer"
                    >
                      <Eye className="w-3 h-3 mr-1" /> Preview
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        const target = inv.seats.find((s) => s.id === rec.seatId);
                        if (target) onToggleFromScene(target);
                        setSmartRecOpen(false);
                      }}
                      className={`text-xs h-8 cursor-pointer ${selectedIds.has(rec.seatId) ? "bg-[#EF4444]" : "bg-[#8B5CF6] hover:bg-[#A78BFA]"}`}
                    >
                      {selectedIds.has(rec.seatId) ? "Deselect" : "Select"}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Group Seat Finder Dialog */}
      <Dialog open={groupFinderOpen} onOpenChange={setGroupFinderOpen}>
        <DialogContent className="bg-[#150A24] border-white/10 text-white sm:max-w-xl max-h-[85vh] overflow-y-auto cine-scroll">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg text-white">
              <Users className="w-5 h-5 text-[#38BDF8]" /> Group Seat Finder
            </DialogTitle>
            <DialogDescription className="text-xs text-[#94A3B8]">
              Find available contiguous seats in the same row so your whole group sits together.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-4">
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/10">
              <span className="text-xs text-white font-medium">Number of Guests:</span>
              <div className="flex items-center gap-1.5">
                {[2, 3, 4, 5, 6, 8].map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setGroupSize(size)}
                    className={`w-8 h-8 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      groupSize === size
                        ? "bg-[#38BDF8] text-black shadow-lg shadow-[#38BDF8]/20"
                        : "bg-white/[0.05] text-[#94A3B8] hover:text-white"
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2.5 max-h-72 overflow-y-auto cine-scroll pr-1">
              {groupClusters.length === 0 ? (
                <p className="text-xs text-[#94A3B8] text-center py-6">
                  No contiguous block of {groupSize} seats found in a single row. Try a smaller group or check other showtimes.
                </p>
              ) : (
                groupClusters.slice(0, 6).map((c, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] transition-all flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-2">
                        <span>Row {c.rowLabel} · Seats {c.startSeat}–{c.endSeat}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-[#38BDF8]/15 text-[#38BDF8] font-mono">
                          {c.category}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#94A3B8] mt-0.5">
                        Avg Sightline: <b className="text-white">{c.avgScore}/100</b> · Total: <b className="text-[#34D399]">{inr(c.totalPrice)}</b>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => selectGroupCluster(c)}
                      className="bg-[#38BDF8] hover:bg-[#0284C7] text-black font-semibold text-xs h-8 cursor-pointer"
                    >
                      Select All {c.count}
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Price Estimator Dialog */}
      <Dialog open={estimatorOpen} onOpenChange={setEstimatorOpen}>
        <DialogContent className="bg-[#150A24] border-white/10 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg text-white">
              <Calculator className="w-5 h-5 text-[#10B981]" /> Transparent Price Breakdown
            </DialogTitle>
            <DialogDescription className="text-xs text-[#94A3B8]">
              Authoritative price calculation breakdown according to cinema regulations and seat categories.
            </DialogDescription>
          </DialogHeader>
          <div className="py-3 space-y-3 text-xs">
            {(() => {
              const seatCount = selectedSeats.length || 1;
              const subtotal = selectedSeats.length > 0 ? total : (inv.categories[0]?.basePrice || 250);
              const basePriceTotal = Math.round(subtotal * 0.82);
              const gst = Math.round(subtotal * 0.18);
              return (
                <div className="space-y-2.5">
                  <div className="flex justify-between py-1 border-b border-white/5 text-[#CBD5E1]">
                    <span>Tickets ({seatCount} seat{seatCount > 1 ? "s" : ""}):</span>
                    <span className="font-mono text-white">{inr(basePriceTotal)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5 text-[#CBD5E1]">
                    <span>GST &amp; Entertainment Tax (18%):</span>
                    <span className="font-mono text-white">{inr(gst)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5 text-[#CBD5E1]">
                    <span>Convenience Fee:</span>
                    <span className="font-mono text-[#10B981]">₹0 (Free in Demo Mode)</span>
                  </div>
                  <div className="flex justify-between py-2 text-sm font-bold text-white border-t border-white/10">
                    <span>Estimated Total Payable:</span>
                    <span className="text-[#34D399] font-mono text-base">{inr(subtotal)}</span>
                  </div>
                  {selectedSeats.length === 0 && (
                    <p className="text-[11px] text-[#94A3B8] italic">
                      * Sample breakdown calculated for a single {inv.categories[0]?.name || "Standard"} seat. Select seats in the auditorium for exact live totals.
                    </p>
                  )}
                </div>
              );
            })()}
          </div>
          <DialogFooter>
            <Button
              onClick={() => setEstimatorOpen(false)}
              className="bg-[#10B981] hover:bg-[#059669] text-white font-semibold text-xs h-9 w-full cursor-pointer"
            >
              Close Breakdown
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== TRAILER OVERLAY (YouTube embed of the official trailer) ==================== */}
      {trailerOpen && (show.movie.trailerId || show.movie.trailerUrl) && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`${show.movie.title} official trailer`}
          onClick={() => setTrailerOpen(false)}
        >
          <div className="relative w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold text-white flex items-center gap-2">
                <Play className="w-4 h-4 text-[#F43F5E]" /> {show.movie.title} — Official trailer
              </div>
              <button
                onClick={() => setTrailerOpen(false)}
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
                aria-label="Close trailer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="relative rounded-xl overflow-hidden border border-white/15 shadow-2xl bg-black" style={{ aspectRatio: "16 / 9" }}>
              {show.movie.trailerId ? (
                <iframe
                  key={show.movie.trailerId}
                  src={`https://www.youtube.com/embed/${show.movie.trailerId}?autoplay=1&rel=0`}
                  title={`${show.movie.title} official trailer`}
                  className="absolute inset-0 w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-sm text-[#B4A6D4]">
                  Open trailer:&nbsp;
                  <a className="text-[#8B5CF6] underline" href={show.movie.trailerUrl || "#"} target="_blank" rel="noopener noreferrer">external link</a>
                </div>
              )}
            </div>
            <p className="mt-2 text-[11px] text-[#B4A6D4]">
              Plays the film's publicly available trailer via YouTube. The in-theatre screen also runs a pre-show reel generated from the movie artwork.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function SceneModeButton({ active, icon, label, onClick, disabled, title }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean; title?: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-pressed={active}
      className={`flex items-center gap-1.5 px-3 py-2 text-xs transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
        active ? "bg-[#8B5CF6] text-white" : "text-[#D5C9F0] hover:bg-white/10"
      }`}
    >
      {icon} {label}
    </button>
  );
}

function Metric({ label, value, accent = "#F7F2FE" }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-lg bg-white/[0.04] border border-white/5 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-[#B4A6D4]">{label}</div>
      <div className="text-sm font-bold mt-0.5" style={{ color: accent }}>{value}</div>
    </div>
  );
}

function WalkHints({ moveRef, isTouch, onExit }: { moveRef: React.MutableRefObject<MoveVector>; isTouch: boolean; onExit: () => void }) {
  const set = (x: number, z: number) => {
    moveRef.current = { x, z };
  };
  const btn = "w-11 h-11 rounded-lg bg-[#150C22]/90 border border-white/15 text-white flex items-center justify-center active:bg-[#8B5CF6] select-none touch-none";
  return (
    <div className="absolute inset-0 z-10 pointer-events-none">
      {!isTouch && (
        <div className="absolute top-3 right-3 px-4 py-3 rounded-xl bg-[#150C22]/90 border border-white/10 text-xs text-[#D5C9F0] max-w-[260px] pointer-events-auto">
          <b className="text-white">Walk mode.</b> Click to capture the mouse · <b>WASD / arrows</b> to move · <b>Esc</b> to release & exit. You cannot walk through walls or seats.
          <button onClick={onExit} className="block mt-2 text-[#8B5CF6] hover:underline cursor-pointer">Exit walk mode</button>
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
          <button onClick={onExit} className="mt-2 w-full py-2 rounded-lg bg-[#150C22]/90 border border-white/15 text-xs text-white cursor-pointer">Exit walk</button>
        </div>
      )}
    </div>
  );
}
