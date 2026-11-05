// Procedural 3D assets for the auditorium: low-poly merged seat geometry,
// canvas-texture labels (no network fonts), and the emissive screen material.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * Builds ONE merged low-poly cinema chair geometry (~600 tris) so every seat
 * can be rendered as an instanced mesh (1 draw call) while still being an
 * individually raycast-selectable object (drei <Instance>).
 * Origin: seat centre on the floor. Chair faces -Z (toward the screen).
 */
export function buildSeatGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const W = 0.52; // seat width
  const D = 0.5; // seat depth
  const H = 0.42; // cushion height
  const BACK_H = 0.62;

  const box = (
    w: number, h: number, d: number,
    x: number, y: number, z: number,
    rotX = 0
  ) => {
    const g = new THREE.BoxGeometry(w, h, d);
    if (rotX) g.rotateX(rotX);
    g.translate(x, y, z);
    parts.push(g);
  };

  // pedestal
  box(0.34, 0.12, 0.34, 0, 0.06, 0);
  // cushion (slight rake)
  box(W - 0.06, 0.09, D - 0.04, 0, H, 0.02, -0.08);
  // backrest (tilted back)
  box(W, BACK_H, 0.09, 0, H + BACK_H / 2 - 0.06, D / 2 - 0.1, 0.12);
  // armrests
  box(0.07, 0.3, D - 0.06, -(W / 2 - 0.045), H + 0.15, 0);
  box(0.07, 0.3, D - 0.06, W / 2 - 0.045, H + 0.15, 0);
  // armrest caps
  box(0.09, 0.05, D - 0.06, -(W / 2 - 0.045), H + 0.32, 0);
  box(0.09, 0.05, D - 0.06, W / 2 - 0.045, H + 0.32, 0);

  const merged = mergeGeometries(parts, false);
  merged.computeVertexNormals();
  return merged;
}

/** Small canvas-texture label (row letters, EXIT, etc.) — avoids webfont fetches. */
export function makeLabelTexture(text: string, opts?: { color?: string; bg?: string; size?: number; bold?: boolean }): THREE.CanvasTexture {
  const size = opts?.size ?? 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  if (opts?.bg) {
    ctx.fillStyle = opts.bg;
    ctx.fillRect(0, 0, size, size);
  }
  ctx.fillStyle = opts?.color ?? "#DDE1E8";
  ctx.font = `${opts?.bold === false ? "" : "bold "}${Math.floor(size * 0.6)}px Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, size / 2, size / 2 + size * 0.02);
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  return tex;
}

/** Emissive "movie playing" screen texture with title + light sweep. */
export function makeScreenTexture(title: string, accent: string): THREE.CanvasTexture {
  const w = 1024;
  const h = 432;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, "#2A3E77");
  grad.addColorStop(0.5, "#4A67B8");
  grad.addColorStop(1, "#26304E");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // light sweep
  const sweep = ctx.createRadialGradient(w * 0.7, h * 0.35, 40, w * 0.7, h * 0.35, w * 0.5);
  sweep.addColorStop(0, "#9FC0FFCC");
  sweep.addColorStop(1, "transparent");
  ctx.fillStyle = sweep;
  ctx.fillRect(0, 0, w, h);

  // frames strip (like a reel)
  ctx.strokeStyle = "rgba(221,225,232,0.18)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 8; i++) {
    ctx.strokeRect(40 + i * 122, 40, 100, 70);
  }

  ctx.fillStyle = "#F5F7FA";
  ctx.font = "bold 92px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(title.toUpperCase().slice(0, 22), w / 2, h / 2 + 30);

  ctx.fillStyle = accent;
  ctx.font = "30px Arial, sans-serif";
  ctx.fillText("CINE 360 · FEATURE PRESENTATION", w / 2, h / 2 + 110);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Floor carpet strip texture for aisles. */
export function makeAisleTexture(bright = false): THREE.CanvasTexture {
  const w = 64;
  const h = 64;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = bright ? "#6E7787" : "#12151C";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = bright ? "rgba(255,255,255,0.10)" : "rgba(221,225,232,0.05)";
  for (let y = 0; y < h; y += 8) ctx.fillRect(0, y, w, 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 8);
  return tex;
}

/* ------------------------------------------------------------------ */
/* Animated pre-show reel — the auditorium screen "plays" content:     */
/* ken-burns over the movie's real backdrop, title cards, showtime     */
/* ticker and film grain, looping like a pre-show trailer reel.        */
/* ------------------------------------------------------------------ */
export type ScreenReel = {
  texture: THREE.CanvasTexture;
  /** Advance the animation; call from useFrame. */
  tick: (dt: number) => void;
  dispose: () => void;
};

export function createScreenReel(opts: {
  title: string;
  accent: string;
  backdropUrl?: string | null;
  showLabel?: string;
  bright?: boolean;
}): ScreenReel {
  const W = 1024;
  const H = 432;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  const img = new Image();
  let imgOk = false;
  if (opts.backdropUrl) {
    img.onload = () => {
      imgOk = true;
    };
    img.onerror = () => {
      imgOk = false;
    };
    img.src = opts.backdropUrl;
  }

  const LOOP = 12; // seconds
  let t = 2.5; // start mid-reel so the title is visible immediately
  let acc = 0;

  function draw() {
    const phase = t % LOOP;
    // background: ken-burns over backdrop (fallback: animated gradient)
    if (imgOk && img.naturalWidth > 0) {
      const p = phase / LOOP;
      const zoom = 1.12 + 0.18 * Math.sin(p * Math.PI * 2);
      const panX = Math.sin(p * Math.PI * 2 + 1.2) * 0.04;
      const panY = Math.cos(p * Math.PI * 2) * 0.03;
      const iw = img.naturalWidth;
      const ih = img.naturalHeight;
      const cover = Math.max(W / iw, H / ih) * zoom;
      const dw = iw * cover;
      const dh = ih * cover;
      ctx.drawImage(img, (W - dw) / 2 + panX * W, (H - dh) / 2 + panY * H, dw, dh);
      // cinematic dark gradient for legibility
      const shade = ctx.createLinearGradient(0, 0, 0, H);
      shade.addColorStop(0, "rgba(5,6,10,0.30)");
      shade.addColorStop(0.55, "rgba(5,6,10,0.45)");
      shade.addColorStop(1, "rgba(5,6,10,0.78)");
      ctx.fillStyle = shade;
      ctx.fillRect(0, 0, W, H);
    } else {
      const g = ctx.createLinearGradient(0, 0, W, H);
      const hueShift = Math.sin((t / LOOP) * Math.PI * 2) * 14;
      g.addColorStop(0, `hsl(${228 + hueShift} 48% 26%)`);
      g.addColorStop(0.55, `hsl(${222 + hueShift} 52% 38%)`);
      g.addColorStop(1, `hsl(${224 + hueShift} 42% 20%)`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }

    // phase 2 (4.5s..9s): title + showtime
    const titlePhase = phase > 3 && phase < 9.5;
    if (titlePhase) {
      const a = Math.min(1, (phase - 3) / 1.2) * Math.min(1, (9.5 - phase) / 1.2);
      ctx.globalAlpha = a;
      // title
      ctx.fillStyle = "#F5F7FA";
      ctx.font = "bold 96px Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.shadowColor = "rgba(0,0,0,0.6)";
      ctx.shadowBlur = 24;
      ctx.fillText(opts.title.toUpperCase().slice(0, 22), W / 2, H / 2 + 8);
      ctx.shadowBlur = 0;
      // accent underline
      ctx.fillStyle = opts.accent;
      ctx.fillRect(W / 2 - 140, H / 2 + 36, 280, 5);
      // showtime ticker
      if (opts.showLabel) {
        ctx.font = "30px Arial, sans-serif";
        ctx.fillStyle = "#E9EDF5";
        ctx.fillText(`NOW SHOWING  ·  ${opts.showLabel.toUpperCase()}`, W / 2, H / 2 + 104);
      }
      ctx.globalAlpha = 1;
    }

    // phase 1/3 (edges of loop): "CINE 360" ident + feature-presentation card
    if (phase <= 3 || phase >= 9.5) {
      const a = phase <= 3 ? Math.min(1, phase / 1.2) * Math.min(1, (3 - phase) / 0.8 + 0.4) : Math.min(1, (phase - 9.5) / 1.2);
      ctx.globalAlpha = Math.max(0, Math.min(1, a));
      ctx.fillStyle = "rgba(5,6,10,0.55)";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#F5F7FA";
      ctx.font = "bold 64px Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("CINE 360", W / 2, H / 2 - 6);
      ctx.fillStyle = opts.accent;
      ctx.font = "28px Arial, sans-serif";
      ctx.fillText("FEATURE PRESENTATION", W / 2, H / 2 + 52);
      ctx.globalAlpha = 1;
    }

    // light sweep
    const sweepX = ((t * 140) % (W + 500)) - 250;
    const sweep = ctx.createLinearGradient(sweepX - 220, 0, sweepX + 220, 0);
    sweep.addColorStop(0, "rgba(255,255,255,0)");
    sweep.addColorStop(0.5, "rgba(255,255,255,0.07)");
    sweep.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = sweep;
    ctx.fillRect(0, 0, W, H);

    // film grain (cheap: sparse random specks)
    ctx.fillStyle = "rgba(255,255,255,0.028)";
    for (let i = 0; i < 90; i++) {
      ctx.fillRect(Math.random() * W, Math.random() * H, 2, 2);
    }
    // vignette
    const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, W * 0.72);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(0,0,0,0.42)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);
  }

  draw();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  return {
    texture,
    tick: (dt: number) => {
      t += dt;
      acc += dt;
      if (acc >= 1 / 24) {
        // cap at ~24 fps — plenty for a screen across the room
        acc = 0;
        draw();
        texture.needsUpdate = true;
      }
    },
    dispose: () => {
      texture.dispose();
    },
  };
}
