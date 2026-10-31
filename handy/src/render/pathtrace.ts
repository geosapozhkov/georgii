import { hexToRgb } from "../model/math";
import type { FormObject } from "../model/types";

export type Prim = {
  kind: "sphere" | "box" | "cylinder" | "torus" | "plane";
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  color: [number, number, number];
  metalness: number;
  roughness: number;
};

export type Prepared = {
  kind: Prim["kind"];
  px: number;
  py: number;
  pz: number;
  m: number[];
  sx: number;
  sy: number;
  sz: number;
  minScale: number;
  color: [number, number, number];
  metalness: number;
  roughness: number;
};

export type Camera = {
  origin: [number, number, number];
  forward: [number, number, number];
  fov: number;
};

type Hit = { t: number; x: number; y: number; z: number; index: number };

const SUN = { x: 0.42, y: 0.84, z: 0.34 };

function rotationMatrix(rx: number, ry: number, rz: number): number[] {
  const a = Math.cos(rx);
  const b = Math.sin(rx);
  const c = Math.cos(ry);
  const d = Math.sin(ry);
  const e = Math.cos(rz);
  const f = Math.sin(rz);
  const ae = a * e;
  const af = a * f;
  const be = b * e;
  const bf = b * f;
  return [c * e, be * d - af, ae * d + bf, c * f, bf * d + ae, af * d - be, -d, b * c, a * c];
}

export function prepareScene(prims: Prim[]): Prepared[] {
  return prims.map((prim) => {
    const sx = Math.max(0.04, prim.scale[0]);
    const sy = Math.max(0.04, prim.scale[1]);
    const sz = Math.max(0.04, prim.scale[2]);
    return {
      kind: prim.kind,
      px: prim.position[0],
      py: prim.position[1],
      pz: prim.position[2],
      m: rotationMatrix(prim.rotation[0], prim.rotation[1], prim.rotation[2]),
      sx,
      sy,
      sz,
      minScale: Math.min(sx, sy, sz),
      color: prim.color,
      metalness: prim.metalness,
      roughness: prim.roughness,
    };
  });
}

function worldToUnit(prim: Prepared, x: number, y: number, z: number) {
  const dx = x - prim.px;
  const dy = y - prim.py;
  const dz = z - prim.pz;
  const m = prim.m;
  return {
    x: (m[0] * dx + m[3] * dy + m[6] * dz) / prim.sx,
    y: (m[1] * dx + m[4] * dy + m[7] * dz) / prim.sy,
    z: (m[2] * dx + m[5] * dy + m[8] * dz) / prim.sz,
  };
}

function sdfUnit(kind: Prepared["kind"], x: number, y: number, z: number): number {
  if (kind === "sphere") return Math.hypot(x, y, z) - 0.5;
  if (kind === "box") {
    const qx = Math.abs(x) - 0.5;
    const qy = Math.abs(y) - 0.5;
    const qz = Math.abs(z) - 0.5;
    const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0));
    const inside = Math.min(Math.max(qx, qy, qz), 0);
    return outside + inside;
  }
  if (kind === "cylinder") {
    const dx = Math.hypot(x, z) - 0.5;
    const dy = Math.abs(y) - 0.5;
    return Math.min(Math.max(dx, dy), 0) + Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
  }
  const major = Math.hypot(x, z);
  const ring = major - 0.42;
  return Math.hypot(ring, y) - 0.14;
}

function sceneSdf(scene: Prepared[], x: number, y: number, z: number): { d: number; index: number } {
  let best = y;
  let index = -1;
  for (let i = 0; i < scene.length; i += 1) {
    const prim = scene[i];
    const local = worldToUnit(prim, x, y, z);
    const distance = sdfUnit(prim.kind, local.x, local.y, local.z) * prim.minScale;
    if (distance < best) {
      best = distance;
      index = i;
    }
  }
  return { d: best, index };
}

export function distanceAt(scene: Prepared[], x: number, y: number, z: number): number {
  return sceneSdf(scene, x, y, z).d;
}

export function marchScene(
  scene: Prepared[],
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
): Hit | null {
  let t = 0.012;
  for (let step = 0; step < 48; step += 1) {
    const x = ox + dx * t;
    const y = oy + dy * t;
    const z = oz + dz * t;
    const hit = sceneSdf(scene, x, y, z);
    if (hit.d < 0.002) return { t, x, y, z, index: hit.index };
    t += Math.max(hit.d, 0.0025);
    if (t > 26) return null;
  }
  return null;
}

function normalize3(x: number, y: number, z: number) {
  const length = Math.hypot(x, y, z) || 1;
  return { x: x / length, y: y / length, z: z / length };
}

function analyticNormal(scene: Prepared[], hit: Hit) {
  if (hit.index < 0) return { x: 0, y: 1, z: 0 };
  const prim = scene[hit.index];
  const local = worldToUnit(prim, hit.x, hit.y, hit.z);
  let nx = 0;
  let ny = 0;
  let nz = 0;
  if (prim.kind === "sphere") {
    nx = local.x;
    ny = local.y;
    nz = local.z;
  } else if (prim.kind === "box") {
    const ax = Math.abs(local.x);
    const ay = Math.abs(local.y);
    const az = Math.abs(local.z);
    if (ax >= ay && ax >= az) nx = Math.sign(local.x) || 1;
    else if (ay >= az) ny = Math.sign(local.y) || 1;
    else nz = Math.sign(local.z) || 1;
  } else if (prim.kind === "cylinder") {
    const side = Math.hypot(local.x, local.z) - 0.5;
    const cap = Math.abs(local.y) - 0.5;
    if (cap > side) {
      nx = 0;
      ny = Math.sign(local.y) || 1;
      nz = 0;
    } else {
      nx = local.x;
      ny = 0;
      nz = local.z;
    }
  } else {
    const major = Math.hypot(local.x, local.z) || 1;
    const ring = major - 0.42;
    nx = (ring * local.x) / major;
    ny = local.y;
    nz = (ring * local.z) / major;
  }
  nx /= prim.sx;
  ny /= prim.sy;
  nz /= prim.sz;
  const m = prim.m;
  return normalize3(m[0] * nx + m[1] * ny + m[2] * nz, m[3] * nx + m[4] * ny + m[5] * nz, m[6] * nx + m[7] * ny + m[8] * nz);
}

function sky(dx: number, dy: number, dz: number) {
  const lift = Math.min(1, Math.max(0, dy * 0.55 + 0.38));
  const warmth = dx * 0.03 + dz * 0.015;
  return {
    r: 0.58 * (1 - lift) + 0.1 * lift + warmth,
    g: 0.48 * (1 - lift) + 0.13 * lift,
    b: 0.38 * (1 - lift) + 0.18 * lift - warmth,
  };
}

function cone(dx: number, dy: number, dz: number, amount: number, rng: () => number) {
  const base = normalize3(dx, dy, dz);
  const ax = Math.abs(base.x) < 0.9 ? 1 : 0;
  const ay = Math.abs(base.x) < 0.9 ? 0 : 1;
  let tx = base.y * 0 - base.z * ay;
  let ty = base.z * ax - base.x * 0;
  let tz = base.x * ay - base.y * ax;
  const tl = Math.hypot(tx, ty, tz) || 1;
  tx /= tl;
  ty /= tl;
  tz /= tl;
  const bx = base.y * tz - base.z * ty;
  const by = base.z * tx - base.x * tz;
  const bz = base.x * ty - base.y * tx;
  const radius = amount * Math.sqrt(rng());
  const phi = rng() * Math.PI * 2;
  const jx = Math.cos(phi) * radius;
  const jy = Math.sin(phi) * radius;
  return normalize3(base.x + tx * jx + bx * jy, base.y + ty * jx + by * jy, base.z + tz * jx + bz * jy);
}

function cosineDirection(nx: number, ny: number, nz: number, rng: () => number) {
  const u1 = rng();
  const u2 = rng();
  const radius = Math.sqrt(u1);
  const phi = 2 * Math.PI * u2;
  const x = radius * Math.cos(phi);
  const z = radius * Math.sin(phi);
  const y = Math.sqrt(Math.max(0, 1 - u1));
  const ax = Math.abs(nx) < 0.9 ? 1 : 0;
  const ay = Math.abs(nx) < 0.9 ? 0 : 1;
  let tx = ny * 0 - nz * ay;
  let ty = nz * ax - nx * 0;
  let tz = nx * ay - ny * ax;
  const tl = Math.hypot(tx, ty, tz) || 1;
  tx /= tl;
  ty /= tl;
  tz /= tl;
  const bx = ny * tz - nz * ty;
  const by = nz * tx - nx * tz;
  const bz = nx * ty - ny * tx;
  return normalize3(tx * x + bx * z + nx * y, ty * x + by * z + ny * y, tz * x + bz * z + nz * y);
}

type Rgb = { r: number; g: number; b: number };

function trace(
  scene: Prepared[],
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  depth: number,
  rng: () => number,
): Rgb {
  const hit = marchScene(scene, ox, oy, oz, dx, dy, dz);
  if (!hit) return sky(dx, dy, dz);
  const normal = analyticNormal(scene, hit);
  const facing = dx * normal.x + dy * normal.y + dz * normal.z;
  const nx = facing > 0 ? -normal.x : normal.x;
  const ny = facing > 0 ? -normal.y : normal.y;
  const nz = facing > 0 ? -normal.z : normal.z;
  let albedoR = 0.5;
  let albedoG = 0.47;
  let albedoB = 0.42;
  let metal = 0.02;
  let rough = 0.55;
  if (hit.index < 0) {
    const check = ((Math.floor(hit.x + 8) + Math.floor(hit.z + 8)) & 1) === 0;
    albedoR = check ? 0.52 : 0.16;
    albedoG = check ? 0.47 : 0.15;
    albedoB = check ? 0.4 : 0.13;
  } else {
    const prim = scene[hit.index];
    albedoR = prim.color[0];
    albedoG = prim.color[1];
    albedoB = prim.color[2];
    metal = prim.metalness;
    rough = Math.min(1, Math.max(0.04, prim.roughness));
  }
  const sun = cone(SUN.x, SUN.y, SUN.z, 0.05, rng);
  const ndotl = Math.max(0, nx * sun.x + ny * sun.y + nz * sun.z);
  let shadow = 1;
  if (ndotl > 0) {
    const blocked = marchScene(scene, hit.x + nx * 0.04, hit.y + ny * 0.04, hit.z + nz * 0.04, sun.x, sun.y, sun.z);
    if (blocked && blocked.t < 18) shadow = 0.07;
  }
  const diffuse = (1 - metal) * ndotl * shadow * 2.35;
  const vx = -dx;
  const vy = -dy;
  const vz = -dz;
  const hx = sun.x + vx;
  const hy = sun.y + vy;
  const hz = sun.z + vz;
  const half = normalize3(hx, hy, hz);
  const ndoth = Math.max(0, nx * half.x + ny * half.y + nz * half.z);
  const shine = Math.max(6, (1 - rough) * (1 - rough) * 160);
  const spec = Math.min(3, Math.pow(ndoth, shine) * shadow * (0.2 + ndotl));
  const specTintR = albedoR * metal + (1 - metal) * 0.18;
  const specTintG = albedoG * metal + (1 - metal) * 0.16;
  const specTintB = albedoB * metal + (1 - metal) * 0.14;
  const fill = Math.max(0, nx * -0.55 + ny * 0.25 + nz * -0.35);
  let r = albedoR * diffuse + spec * specTintR + albedoR * 0.07 * (1 - metal) + albedoR * fill * 0.22;
  let g = albedoG * diffuse + spec * specTintG + albedoG * 0.075 * (1 - metal) + albedoG * fill * 0.24;
  let b = albedoB * diffuse + spec * specTintB + albedoB * 0.09 * (1 - metal) + albedoB * fill * 0.32;
  if (depth > 0) {
    const bounce = rng() < metal
      ? cone(
          dx - 2 * (dx * nx + dy * ny + dz * nz) * nx,
          dy - 2 * (dx * nx + dy * ny + dz * nz) * ny,
          dz - 2 * (dx * nx + dy * ny + dz * nz) * nz,
          rough * rough,
          rng,
        )
      : cosineDirection(nx, ny, nz, rng);
    const toward = bounce.x * nx + bounce.y * ny + bounce.z * nz;
    if (toward > 0) {
      const next = trace(scene, hit.x + nx * 0.045, hit.y + ny * 0.045, hit.z + nz * 0.045, bounce.x, bounce.y, bounce.z, depth - 1, rng);
      const weight = metal ? 0.85 : 0.55;
      r += next.r * (metal ? specTintR : albedoR) * weight;
      g += next.g * (metal ? specTintG : albedoG) * weight;
      b += next.b * (metal ? specTintB : albedoB) * weight;
    }
  }
  return { r: Math.min(r, 8), g: Math.min(g, 8), b: Math.min(b, 8) };
}

export function traceRay(
  scene: Prepared[],
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  bounces: number,
  rng: () => number,
): Rgb {
  const dir = normalize3(dx, dy, dz);
  return trace(scene, ox, oy, oz, dir.x, dir.y, dir.z, bounces, rng);
}

export function rayForPixel(camera: Camera, x: number, y: number, width: number, height: number, rng: () => number) {
  const jx = (x + rng()) / width;
  const jy = (y + rng()) / height;
  const aspect = width / height;
  const scale = Math.tan((camera.fov * Math.PI) / 360);
  const ndcX = (2 * jx - 1) * aspect * scale;
  const ndcY = (1 - 2 * jy) * scale;
  const forward = normalize3(camera.forward[0], camera.forward[1], camera.forward[2]);
  let rx = forward.y * 0 - forward.z * 1;
  let ry = forward.z * 0 - forward.x * 0;
  let rz = forward.x * 1 - forward.y * 0;
  if (Math.abs(forward.y) > 0.96) {
    rx = 1;
    ry = 0;
    rz = 0;
  }
  const right = normalize3(rx, ry, rz);
  const up = normalize3(
    right.y * forward.z - right.z * forward.y,
    right.z * forward.x - right.x * forward.z,
    right.x * forward.y - right.y * forward.x,
  );
  const dir = normalize3(
    forward.x + right.x * ndcX + up.x * ndcY,
    forward.y + right.y * ndcX + up.y * ndcY,
    forward.z + right.z * ndcX + up.z * ndcY,
  );
  return { ox: camera.origin[0], oy: camera.origin[1], oz: camera.origin[2], dx: dir.x, dy: dir.y, dz: dir.z };
}

export function tonemap(channel: number, exposure: number): number {
  const mapped = 1 - Math.exp(-Math.max(0, channel) * exposure);
  return Math.pow(Math.min(1, mapped), 1 / 2.2);
}

export function formsToPrims(objects: FormObject[]): Prim[] {
  return objects.map((object) => ({
    kind: object.kind,
    position: [object.position.x, object.position.y, object.position.z],
    rotation: [
      (object.rotation.x * Math.PI) / 180,
      (object.rotation.y * Math.PI) / 180,
      (object.rotation.z * Math.PI) / 180,
    ],
    scale: [object.scale.x, object.scale.y, object.scale.z],
    color: hexToRgb(object.color),
    metalness: object.metalness,
    roughness: object.roughness,
  }));
}

export function mulberry32(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) | 0;
    let t = Math.imul(value ^ (value >>> 15), 1 | value);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
