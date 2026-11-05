"use client";
// CINE 360 — Interactive 3D auditorium engine (React Three Fiber + Drei).
// • Procedural demonstration geometry (walls, screen, stepped floor, aisles, exits)
// • Every seat is an individually raycast-selectable instanced object
// • Orbit + first-person walk (WASD/arrows + collision) + Seat Experience Mode
// • Adaptive DPR, no shadow maps, one merged seat geometry (1 draw call)
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Html, Instance, Instances, PointerLockControls } from "@react-three/drei";
import * as THREE from "three";
import { useMemo, useRef, useEffect, useState, useCallback } from "react";
import { SEAT_COLORS } from "@/lib/constants";
import type { LayoutConfig } from "@/lib/geometry";
import { seatEyePosition } from "@/lib/geometry";
import type { InventorySeat } from "@/lib/inventory";
import { buildSeatGeometry, makeLabelTexture, makeAisleTexture, createScreenReel } from "./seatAssets";

export type SceneMode = "orbit" | "walk" | "preview";

export type MoveVector = { x: number; z: number };

type SceneProps = {
  seats: InventorySeat[];
  layout: LayoutConfig;
  dimensions: { widthM: number; depthM: number; heightM: number; lastRowZ: number; screenCenterY: number };
  selectedIds: Set<string>;
  onToggleSeat: (seat: InventorySeat) => void;
  onHoverSeat: (seat: InventorySeat | null) => void;
  mode: SceneMode;
  previewSeat: InventorySeat | null;
  movieTitle: string;
  accent: string;
  isTouch: boolean;
  moveRef: React.MutableRefObject<MoveVector>;
  resetKey: number;
  /** House lights fully up — bright, readable auditorium (default). */
  bright?: boolean;
  /** Colour AVAILABLE seats by row demand instead of plain green. */
  heatmap?: boolean;
  /** Movie backdrop used by the animated pre-show reel. */
  backdropUrl?: string | null;
  /** e.g. "Tue, 3 Nov · 5:00 pm" — shown on the screen reel. */
  showLabel?: string;
};

/* Bright/dim material palettes. "Bright" keeps the house lights fully up so
   every seat, row label and aisle is clearly visible; "Dim" is the classic
   cinematic mood for the Seat Experience preview. */
const PALETTE = {
  bright: {
    bg: "#C9D3E0",
    fog: "#C9D3E0",
    floor: "#8E97A8",
    floorAlt: "#9AA3B4",
    floorAlt2: "#98A1B2",
    wall: "#B4BDCD",
    wallSide: "#AEB7C8",
    ceiling: "#C2CAD8",
    downlight: "#FFF3D6",
    stage: "#98A2B4",
    screenFrame: "#7E8798",
  },
  dim: {
    bg: "#050609",
    fog: "#050609",
    floor: "#101218",
    floorAlt: "#14171F",
    floorAlt2: "#111319",
    wall: "#0B0D12",
    wallSide: "#0C0E14",
    ceiling: "#07080B",
    downlight: "#8A94AC",
    stage: "#0D0F15",
    screenFrame: "#05060A",
  },
} as const;

/* ------------------------------------------------------------------ */
/* Room shell: floor, stepped rows, walls, ceiling, screen, exits      */
/* ------------------------------------------------------------------ */
function RoomShell({ layout, dimensions, movieTitle, accent, bright, backdropUrl, showLabel }: { layout: LayoutConfig; dimensions: SceneProps["dimensions"]; movieTitle: string; accent: string; bright: boolean; backdropUrl?: string | null; showLabel?: string }) {
  const P = PALETTE[bright ? "bright" : "dim"];
  // Pre-show reel owns an animated canvas texture; recreated when the movie changes.
  const reel = useMemo(
    () => createScreenReel({ title: movieTitle, accent, backdropUrl, showLabel, bright }),
    [movieTitle, accent, backdropUrl, showLabel, bright]
  );
  useEffect(() => () => reel.dispose(), [reel]);
  useFrame((_, dt) => reel.tick(dt));
  const screenTex = reel.texture;
  const aisleTex = useMemo(() => makeAisleTexture(bright), [bright]);
  const rowLabels = useMemo(() => layout.rows.map((r) => r.label), [layout]);

  const stepPlanes = useMemo(() => {
    const planes: { z: number; y: number; w: number }[] = [];
    layout.rows.forEach((_, i) => {
      const z = layout.firstRowZ + i * layout.rowSpacingM;
      planes.push({ z, y: i * layout.rowStepUpM, w: dimensions.widthM });
    });
    return planes;
  }, [layout, dimensions.widthM]);

  return (
    <group>
      {/* floor base */}
      <mesh position={[0, 0, dimensions.depthM / 2 - 2]} receiveShadow={false}>
        <boxGeometry args={[dimensions.widthM, 0.2, dimensions.depthM]} />
        <meshStandardMaterial color={P.floor} roughness={0.95} />
      </mesh>
      {/* stepped row platforms */}
      {stepPlanes.map((p, i) => (
        <mesh key={i} position={[0, p.y + 0.05, p.z]}>
          <boxGeometry args={[p.w, 0.3, layout.rowSpacingM]} />
          <meshStandardMaterial color={i % 2 === 0 ? P.floorAlt : P.floorAlt2} roughness={0.9} />
        </mesh>
      ))}
      {/* walls */}
      <mesh position={[0, dimensions.heightM / 2, -0.35]}>
        <boxGeometry args={[dimensions.widthM + 1, dimensions.heightM, 0.4]} />
        <meshStandardMaterial color={P.wall} roughness={1} />
      </mesh>
      <mesh position={[-(dimensions.widthM / 2 + 0.35), dimensions.heightM / 2, dimensions.depthM / 2 - 2]}>
        <boxGeometry args={[0.4, dimensions.heightM, dimensions.depthM]} />
        <meshStandardMaterial color={P.wallSide} roughness={1} />
      </mesh>
      <mesh position={[dimensions.widthM / 2 + 0.35, dimensions.heightM / 2, dimensions.depthM / 2 - 2]}>
        <boxGeometry args={[0.4, dimensions.heightM, dimensions.depthM]} />
        <meshStandardMaterial color={P.wallSide} roughness={1} />
      </mesh>
      {/* ceiling */}
      <mesh position={[0, dimensions.heightM, dimensions.depthM / 2 - 2]}>
        <boxGeometry args={[dimensions.widthM + 1, 0.3, dimensions.depthM]} />
        <meshStandardMaterial color={P.ceiling} roughness={1} />
      </mesh>
      {/* ceiling downlights (emissive only — no real lights, cheap) */}
      {Array.from({ length: 6 }).map((_, i) => (
        <group key={i}>
          {[0, 1].map((side) => (
            <mesh key={side} position={[(side === 0 ? -1 : 1) * dimensions.widthM * 0.22, dimensions.heightM - 0.25, 4 + i * ((dimensions.depthM - 8) / 5)]}>
              <circleGeometry args={[0.22, 12]} />
              <meshBasicMaterial color={P.downlight} />
            </mesh>
          ))}
        </group>
      ))}

      {/* SCREEN */}
      <group position={[0, 0, 0]}>
        {/* frame sits BEHIND the screen surface (box spans z-0.14..z-0.02) */}
        <mesh position={[0, layout.screen.bottomY + layout.screen.heightM / 2, layout.screen.z - 0.08]}>
          <boxGeometry args={[layout.screen.widthM + 0.6, layout.screen.heightM + 0.6, 0.12]} />
          <meshStandardMaterial color={P.screenFrame} roughness={0.8} />
        </mesh>
        {/* screen surface in front of the frame so it is never occluded */}
        <mesh position={[0, layout.screen.bottomY + layout.screen.heightM / 2, layout.screen.z + 0.02]}>
          <planeGeometry args={[layout.screen.widthM, layout.screen.heightM]} />
          <meshBasicMaterial map={screenTex} toneMapped={false} />
        </mesh>
        {/* stage front */}
        <mesh position={[0, layout.screen.bottomY / 2, layout.screen.z + 0.6]}>
          <boxGeometry args={[layout.screen.widthM + 1.2, layout.screen.bottomY, 1.2]} />
          <meshStandardMaterial color={P.stage} roughness={0.95} />
        </mesh>
      </group>

      {/* aisle carpet strips */}
      {layout.centerAisle && (
        <mesh
          position={[0, 0.22, layout.firstRowZ + (layout.rows.length * layout.rowSpacingM) / 2]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[layout.aisleGapM * 0.6, layout.rows.length * layout.rowSpacingM]} />
          <meshStandardMaterial map={aisleTex} roughness={1} />
        </mesh>
      )}

      {/* EXIT signs */}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * (dimensions.widthM / 2 - 1.4), dimensions.heightM - 1.1, 2.2]}>
          <mesh>
            <planeGeometry args={[0.9, 0.34]} />
            <meshBasicMaterial map={makeLabelTexture("EXIT", { color: bright ? "#0B7A3E" : "#39FF7A", bg: bright ? "#E4F8EC" : "#06130A", size: 128 })} toneMapped={false} />
          </mesh>
        </group>
      ))}

      {/* row labels */}
      {rowLabels.map((label, i) => {
        const rowWidth = layout.rows[i].seats * layout.seatSpacingM + (layout.centerAisle && layout.rows[i].seats >= 6 ? layout.aisleGapM : 0);
        const y = i * layout.rowStepUpM + 1.15;
        const z = layout.firstRowZ + i * layout.rowSpacingM;
        const tex = makeLabelTexture(label, { color: bright ? "#155E8A" : "#20D9E8", bg: bright ? "#EAF2FB" : undefined, size: 96 });
        return (
          <group key={label}>
            <mesh position={[-(rowWidth / 2 + 0.55), y, z]} rotation={[0, Math.PI / 2, 0]}>
              <planeGeometry args={[0.42, 0.42]} />
              <meshBasicMaterial map={tex} transparent toneMapped={false} />
            </mesh>
            <mesh position={[rowWidth / 2 + 0.55, y, z]} rotation={[0, -Math.PI / 2, 0]}>
              <planeGeometry args={[0.42, 0.42]} />
              <meshBasicMaterial map={tex} transparent toneMapped={false} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Seats: one instanced mesh, per-instance events and colours          */
/* ------------------------------------------------------------------ */
function SeatInstances({ seats, selectedIds, onToggleSeat, onHoverSeat, interactive, heatmap }: {
  seats: InventorySeat[];
  selectedIds: Set<string>;
  onToggleSeat: (seat: InventorySeat) => void;
  onHoverSeat: (seat: InventorySeat | null) => void;
  interactive: boolean;
  heatmap: boolean;
}) {
  const geometry = useMemo(() => buildSeatGeometry(), []);

  // Row demand: booked+held share per row (real inventory), used by the heatmap
  const rowDemand = useMemo(() => {
    const totals = new Map<string, number>();
    const busy = new Map<string, number>();
    for (const s of seats) {
      totals.set(s.rowLabel, (totals.get(s.rowLabel) || 0) + 1);
      if (s.status === "BOOKED" || s.status === "HELD") busy.set(s.rowLabel, (busy.get(s.rowLabel) || 0) + 1);
    }
    const demand = new Map<string, number>();
    for (const [row, total] of totals) demand.set(row, total ? (busy.get(row) || 0) / total : 0);
    return demand;
  }, [seats]);

  const freeCool = new THREE.Color("#2FBF71");
  const freeWarm = new THREE.Color("#FF713D");

  const colorFor = (s: InventorySeat) => {
    if (selectedIds.has(s.id)) return SEAT_COLORS.SELECTED;
    if (heatmap && s.status === "AVAILABLE") {
      const d = rowDemand.get(s.rowLabel) || 0;
      return "#" + freeCool.clone().lerp(freeWarm, Math.min(1, d * 1.6)).getHexString();
    }
    return SEAT_COLORS[(s.status as keyof typeof SEAT_COLORS)] || SEAT_COLORS.UNAVAILABLE;
  };

  return (
    <Instances geometry={geometry} limit={seats.length + 1} range={seats.length} castShadow={false} receiveShadow={false}>
      <meshStandardMaterial roughness={0.55} metalness={0.08} />
      {seats.map((s) => (
        <Instance
          key={s.id}
          position={[s.x, s.baseY, s.z]}
          color={colorFor(s)}
          scale={selectedIds.has(s.id) ? 1.14 : 1}
          onPointerMove={interactive ? (e) => { e.stopPropagation(); onHoverSeat(s); } : undefined}
          onPointerOut={interactive ? () => onHoverSeat(null) : undefined}
          onClick={interactive ? (e) => { e.stopPropagation(); if (e.delta > 8) return; if (s.status === "AVAILABLE" || selectedIds.has(s.id)) onToggleSeat(s); } : undefined}
        />
      ))}
    </Instances>
  );
}

/* ------------------------------------------------------------------ */
/* Camera rig: orbit / walk / preview                                  */
/* ------------------------------------------------------------------ */
function CameraRig({ mode, previewSeat, layout, dimensions, seats, moveRef, isTouch, resetKey }: {
  mode: SceneMode;
  previewSeat: InventorySeat | null;
  layout: LayoutConfig;
  dimensions: SceneProps["dimensions"];
  seats: InventorySeat[];
  moveRef: React.MutableRefObject<MoveVector>;
  isTouch: boolean;
  resetKey: number;
}) {
  const { camera } = useThree();
  const keys = useRef<Set<string>>(new Set());
  const [locked, setLocked] = useState(false);
  const tween = useRef<{
    fromPos: THREE.Vector3; fromQuat: THREE.Quaternion;
    toPos: THREE.Vector3; toQuat: THREE.Quaternion;
    t: number; dur: number;
  } | null>(null);
  const homeRef = useRef<{ pos: THREE.Vector3; quat: THREE.Quaternion } | null>(null);

  const goTo = useCallback(
    (toPos: THREE.Vector3, toQuat: THREE.Quaternion, dur = 1.1) => {
      tween.current = {
        fromPos: camera.position.clone(),
        fromQuat: camera.quaternion.clone(),
        toPos,
        toQuat,
        t: 0,
        dur,
      };
    },
    [camera]
  );

  const floorH = (z: number) => {
    const idx = Math.floor((z - layout.firstRowZ + layout.rowSpacingM / 2) / layout.rowSpacingM);
    return Math.max(0, Math.min(layout.rows.length - 1, idx)) * layout.rowStepUpM;
  };

  // keyboard for walk mode
  useEffect(() => {
    const WALK_KEYS = new Set(["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"]);
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (WALK_KEYS.has(k)) keys.current.add(k);
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // reset camera to overview
  useEffect(() => {
    if (resetKey === 0) return;
    if (mode === "orbit") {
      camera.position.set(dimensions.widthM * 0.28, dimensions.heightM * 0.72, dimensions.lastRowZ + 6.5);
      camera.lookAt(0, dimensions.screenCenterY, dimensions.lastRowZ * 0.35);
    }
     
  }, [resetKey]);

  // enter/leave preview — deterministic, time-based camera tween
  useEffect(() => {
    if (mode === "preview" && previewSeat) {
      if (!homeRef.current) {
        homeRef.current = { pos: camera.position.clone(), quat: camera.quaternion.clone() };
      }
      const eye = seatEyePosition(previewSeat);
      const pos = new THREE.Vector3(eye.x, eye.y + 0.12, eye.z + 0.12);
      // Use a real camera for lookAt: cameras orient -Z toward the target,
      // plain Object3D.lookAt orients +Z (i.e. faces AWAY from the screen).
      const look = new THREE.PerspectiveCamera();
      look.position.copy(pos);
      look.up.set(0, 1, 0);
      // aim slightly below screen centre so the screen sits in the upper part of
      // the frame, clear of the compact measurement HUD at the bottom
      look.lookAt(0, layout.screen.bottomY + layout.screen.heightM * 0.45, layout.screen.z);
      goTo(pos, look.quaternion.clone(), 1.2);
    } else if (mode !== "preview" && homeRef.current) {
      const home = homeRef.current;
      homeRef.current = null;
      goTo(home.pos.clone(), home.quat.clone(), 1.0);
    }
     
  }, [mode, previewSeat, goTo]);

  useFrame((_, dt) => {
    // debug handle for support/verification (read-only)
    (window as unknown as { __cine360cam?: unknown }).__cine360cam = {
      mode,
      pos: camera.position.toArray().map((n) => Math.round(n * 100) / 100),
      quat: [camera.quaternion.x, camera.quaternion.y, camera.quaternion.z, camera.quaternion.w].map((n) => Math.round(n * 1000) / 1000),
      previewActive: !!tween.current,
    };

    // --- deterministic camera tween (Seat Experience Mode / return) ---
    const tw = tween.current;
    if (tw) {
      tw.t = Math.min(1, tw.t + dt / tw.dur);
      const e = 1 - Math.pow(1 - tw.t, 3); // easeOutCubic
      camera.position.lerpVectors(tw.fromPos, tw.toPos, e);
      camera.quaternion.slerpQuaternions(tw.fromQuat, tw.toQuat, e);
      if (tw.t >= 1) tween.current = null;
      return;
    }

    // --- first-person walk ---
    if (mode === "walk" && (locked || isTouch)) {
      const mv = moveRef.current;
      let mx = mv.x;
      let mz = mv.z;
      if (keys.current.has("w") || keys.current.has("arrowup")) mz += 1;
      if (keys.current.has("s") || keys.current.has("arrowdown")) mz -= 1;
      if (keys.current.has("a") || keys.current.has("arrowleft")) mx -= 1;
      if (keys.current.has("d") || keys.current.has("arrowright")) mx += 1;

      const speed = 3.2 * dt;
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      forward.y = 0;
      forward.normalize();
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
      right.y = 0;
      right.normalize();

      const step = new THREE.Vector3()
        .addScaledVector(forward, mz * speed)
        .addScaledVector(right, mx * speed);

      const nx = camera.position.x + step.x;
      const nz = camera.position.z + step.z;

      // bounds + screen wall
      const halfW = dimensions.widthM / 2 - 0.7;
      const minZ = layout.screen.z + 1.6;
      const maxZ = dimensions.lastRowZ + 2.6;
      const cx = Math.max(-halfW, Math.min(halfW, nx));
      const cz = Math.max(minZ, Math.min(maxZ, nz));

      // seat collision (slide along axes)
      const blocked = (x: number, z: number) => {
        for (const s of seats) {
          if (Math.abs(s.x - x) < 0.48 && Math.abs(s.z - z) < 0.48) return true;
        }
        return false;
      };
      let px = camera.position.x + (cx - camera.position.x);
      let pz = camera.position.z + (cz - camera.position.z);
      if (blocked(px, pz)) {
        if (!blocked(px, camera.position.z)) pz = camera.position.z;
        else if (!blocked(camera.position.x, pz)) px = camera.position.x;
        else { px = camera.position.x; pz = camera.position.z; }
      }
      // eye height follows the stepped floor
      const targetY = floorH(pz) + 1.62;
      const py = camera.position.y + (targetY - camera.position.y) * Math.min(1, dt * 8);
      camera.position.set(px, py, pz);
    }
  });

  if (mode === "walk" && !isTouch) {
    return (
      <>
        <PointerLockControls
          onLock={() => setLocked(true)}
          onUnlock={() => setLocked(false)}
          selector="#walk-lock-overlay"
        />
      </>
    );
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Hover badge (single DOM overlay)                                    */
/* ------------------------------------------------------------------ */
function HoverBadge({ seat, layout }: { seat: InventorySeat; layout: LayoutConfig }) {
  const stateLabels: Record<string, string> = {
    AVAILABLE: "Available",
    HELD: "Temporarily held",
    BOOKED: "Booked",
    UNAVAILABLE: "Unavailable",
  };
  const eye = seatEyePosition(seat);
  const dz = Math.max(0.1, eye.z - layout.screen.z);
  const dx = Math.abs(eye.x);
  const dy = layout.screen.bottomY + layout.screen.heightM / 2 - eye.y;
  const dist = Math.sqrt(dz * dz + dx * dx + dy * dy);
  return (
    <Html position={[seat.x, seat.baseY + 1.5, seat.z]} center distanceFactor={9} zIndexRange={[10, 0]}>
      <div className="pointer-events-none px-3 py-2 rounded-lg bg-[#0B0D12]/95 border border-white/15 text-[11px] leading-relaxed whitespace-nowrap shadow-xl">
        <div className="font-semibold text-white">Row {seat.rowLabel} · Seat {seat.seatNumber}</div>
        <div className="text-[#20D9E8]">{seat.category} · ₹{seat.price}</div>
        <div className={seat.status === "AVAILABLE" ? "text-[#2FBF71]" : seat.status === "HELD" ? "text-[#F5C518]" : "text-[#E5484D]"}>
          {stateLabels[seat.status] || seat.status}
        </div>
        <div className="text-[#8FA3BF]">{dist.toFixed(1)} m from screen centre</div>
      </div>
    </Html>
  );
}

/* ------------------------------------------------------------------ */
/* Canvas wrapper                                                      */
/* ------------------------------------------------------------------ */
export default function AuditoriumCanvas(props: SceneProps) {
  const { seats, layout, dimensions, mode, previewSeat, onHoverSeat } = props;
  const [hovered, setHovered] = useState<InventorySeat | null>(null);
  const bright = props.bright !== false; // default ON — readable theatre

  useEffect(() => {
    onHoverSeat(hovered);
     
  }, [hovered]);

  const dpr: [number, number] = props.isTouch ? [1, 1.4] : [1, 1.75];

  return (
    <Canvas
      dpr={dpr}
      camera={{ position: [dimensions.widthM * 0.28, dimensions.heightM * 0.72, dimensions.lastRowZ + 6.5], fov: 58, near: 0.1, far: 200 }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      onPointerMissed={() => setHovered(null)}
      aria-label="3D auditorium view"
    >
      <color attach="background" args={[bright ? "#C9D3E0" : "#050609"]} />
      <fog attach="fog" args={[bright ? "#C9D3E0" : "#050609", dimensions.depthM * 1.9, dimensions.depthM * 3.4]} />

      <ambientLight intensity={bright ? 1.25 : 0.55} />
      <hemisphereLight args={bright ? ["#F2F6FC", "#9AA3B4", 0.95] : ["#33415C", "#08090C", 0.5]} />
      {/* projector glow */}
      <pointLight position={[0, layout.screen.bottomY + layout.screen.heightM * 0.7, layout.screen.z + 2.2]} intensity={bright ? 10 : 26} distance={26} color="#9FC0FF" />
      <pointLight position={[0, layout.screen.bottomY + layout.screen.heightM / 2, layout.screen.z + 1]} intensity={bright ? 8 : 18} distance={18} color="#477BFF" />
      <pointLight position={[0, dimensions.heightM - 1, dimensions.lastRowZ - 1]} intensity={bright ? 18 : 10} distance={22} color={bright ? "#FFE9C4" : "#20D9E8"} />

      <RoomShell layout={layout} dimensions={dimensions} movieTitle={props.movieTitle} accent={props.accent} bright={bright} backdropUrl={props.backdropUrl} showLabel={props.showLabel} />

      <SeatInstances
        seats={seats}
        selectedIds={props.selectedIds}
        onToggleSeat={props.onToggleSeat}
        onHoverSeat={setHovered}
        interactive={mode !== "preview"}
        heatmap={props.heatmap === true}
      />

      {hovered && mode !== "preview" && <HoverBadge seat={hovered} layout={layout} />}

      <CameraRig
        mode={mode}
        previewSeat={previewSeat}
        layout={layout}
        dimensions={dimensions}
        seats={seats}
        moveRef={props.moveRef}
        isTouch={props.isTouch}
        resetKey={props.resetKey}
      />

      <OrbitControls
        enabled={mode === "orbit"}
        target={[0, dimensions.screenCenterY * 0.7, dimensions.lastRowZ * 0.42]}
        maxPolarAngle={Math.PI / 2.03}
        minDistance={1.5}
        maxDistance={dimensions.depthM * 1.15}
        enablePan
        panSpeed={0.6}
        makeDefault
      />
    </Canvas>
  );
}
