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
export function makeAisleTexture(): THREE.CanvasTexture {
  const w = 64;
  const h = 64;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#12151C";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "rgba(221,225,232,0.05)";
  for (let y = 0; y < h; y += 8) ctx.fillRect(0, y, w, 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 8);
  return tex;
}
