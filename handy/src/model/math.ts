import type { AnimKey, Grade } from "./types";

export type Rgb = { r: number; g: number; b: number };
export type Cmyk = { c: number; m: number; y: number; k: number };

export function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

export function hexToRgb(hex: string): [number, number, number] {
  const raw = hex.trim().replace("#", "");
  const full = raw.length === 3 ? raw.split("").map((part) => part + part).join("") : raw;
  const value = Number.parseInt(full, 16);
  if (!Number.isFinite(value) || full.length !== 6) return [0.72, 0.7, 0.66];
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const channel = (value: number) => Math.round(clamp(value) * 255).toString(16).padStart(2, "0");
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

export function rgbToCmyk(r: number, g: number, b: number): Cmyk {
  const red = clamp(r);
  const green = clamp(g);
  const blue = clamp(b);
  const k = 1 - Math.max(red, green, blue);
  if (k >= 0.999) return { c: 0, m: 0, y: 0, k: 1 };
  return {
    c: (1 - red - k) / (1 - k),
    m: (1 - green - k) / (1 - k),
    y: (1 - blue - k) / (1 - k),
    k,
  };
}

export function cmykToRgb(ink: Cmyk): Rgb {
  return {
    r: (1 - ink.c) * (1 - ink.k),
    g: (1 - ink.m) * (1 - ink.k),
    b: (1 - ink.y) * (1 - ink.k),
  };
}

export function totalAreaCoverage(ink: Cmyk): number {
  return (ink.c + ink.m + ink.y + ink.k) * 100;
}

export function softProof(
  r: number,
  g: number,
  b: number,
  paper: "coated" | "uncoated",
  inkLimit: number,
): { rgb: Rgb; ink: Cmyk; tac: number } {
  const gain = paper === "uncoated" ? 0.14 : 0.06;
  const base = rgbToCmyk(r, g, b);
  const grow = (channel: number) => clamp(channel + (1 - channel) * channel * gain);
  let ink: Cmyk = { c: grow(base.c), m: grow(base.m), y: grow(base.y), k: grow(base.k) };
  let tac = totalAreaCoverage(ink);
  if (tac > inkLimit) {
    const scale = inkLimit / tac;
    ink = { c: ink.c * scale, m: ink.m * scale, y: ink.y * scale, k: ink.k * scale };
    tac = totalAreaCoverage(ink);
  }
  const rgb = cmykToRgb(ink);
  const paperWhite = paper === "uncoated" ? [0.94, 0.9, 0.82] : [0.98, 0.97, 0.95];
  return {
    rgb: { r: rgb.r * paperWhite[0], g: rgb.g * paperWhite[1], b: rgb.b * paperWhite[2] },
    ink,
    tac,
  };
}

export function gradePixel(r: number, g: number, b: number, grade: Grade): Rgb {
  const expose = Math.pow(2, grade.exposure);
  let red = r * expose;
  let green = g * expose;
  let blue = b * expose;
  red = (red - 0.5) * grade.contrast + 0.5;
  green = (green - 0.5) * grade.contrast + 0.5;
  blue = (blue - 0.5) * grade.contrast + 0.5;
  red += grade.temperature * 0.08;
  blue -= grade.temperature * 0.08;
  green += grade.tint * 0.08;
  const luma = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  red = luma + (red - luma) * grade.saturation;
  green = luma + (green - luma) * grade.saturation;
  blue = luma + (blue - luma) * grade.saturation;
  const shadowMask = clamp(1 - luma * 2);
  const highMask = clamp(luma * 2 - 1);
  const lift = grade.shadows * 0.22 * shadowMask + grade.highlights * 0.22 * highMask;
  return { r: clamp(red + lift), g: clamp(green + lift), b: clamp(blue + lift) };
}

export function sampleKeys(keys: AnimKey[], time: number): AnimKey {
  if (keys.length === 0) return { t: time, x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 };
  const sorted = [...keys].sort((a, b) => a.t - b.t);
  if (time <= sorted[0].t) return { ...sorted[0] };
  const last = sorted[sorted.length - 1];
  if (time >= last.t) return { ...last };
  for (let index = 0; index < sorted.length - 1; index += 1) {
    const from = sorted[index];
    const to = sorted[index + 1];
    if (time >= from.t && time <= to.t) {
      const span = to.t - from.t || 1;
      const amount = (time - from.t) / span;
      return {
        t: time,
        x: from.x + (to.x - from.x) * amount,
        y: from.y + (to.y - from.y) * amount,
        scale: from.scale + (to.scale - from.scale) * amount,
        rotation: from.rotation + (to.rotation - from.rotation) * amount,
        opacity: from.opacity + (to.opacity - from.opacity) * amount,
      };
    }
  }
  return { ...last };
}

export function upsertKey(keys: AnimKey[], time: number, patch: Partial<AnimKey>): AnimKey[] {
  const next = keys.map((key) => ({ ...key }));
  const near = next.find((key) => Math.abs(key.t - time) < 0.04);
  if (near) {
    Object.assign(near, patch, { t: near.t });
  } else {
    const current = sampleKeys(next, time);
    next.push({ ...current, ...patch, t: time });
  }
  next.sort((a, b) => a.t - b.t);
  return next;
}
