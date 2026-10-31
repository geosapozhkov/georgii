import { describe, expect, it } from "vitest";
import { distanceAt, formsToPrims, marchScene, prepareScene, rayForPixel, traceRay, type Prim } from "./pathtrace";
import type { FormObject } from "../model/types";

const sphere: Prim = {
  kind: "sphere",
  position: [0, 0.5, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
  color: [0.8, 0.4, 0.2],
  metalness: 0,
  roughness: 0.4,
};

describe("path tracer", () => {
  it("finds the inside of a sphere and the floor", () => {
    const scene = prepareScene([sphere]);
    expect(distanceAt(scene, 0, 0.5, 0)).toBeLessThan(0);
    expect(distanceAt(scene, 0, 3, 0)).toBeGreaterThan(0.4);
    const floor = marchScene(scene, 2, 3, 2, 0, -1, 0);
    expect(floor).not.toBeNull();
    expect(floor?.y ?? 1).toBeLessThan(0.05);
  });

  it("hits a sphere from the side and misses a ray aimed at the sky", () => {
    const scene = prepareScene([sphere]);
    const hit = marchScene(scene, 0, 0.5, 3, 0, 0, -1);
    expect(hit).not.toBeNull();
    expect(hit?.index).toBe(0);
    expect(marchScene(scene, 0, 3, 0, 0, 1, 0)).toBeNull();
  });

  it("keeps a rotated box solid at its center", () => {
    const scene = prepareScene([
      {
        kind: "box",
        position: [0, 0.5, 0],
        rotation: [0, Math.PI / 2, 0],
        scale: [1, 1, 1],
        color: [1, 1, 1],
        metalness: 0,
        roughness: 0.5,
      },
    ]);
    expect(distanceAt(scene, 0, 0.5, 0)).toBeLessThan(0);
  });

  it("returns a finite color for the center pixel", () => {
    const scene = prepareScene([sphere]);
    const ray = rayForPixel({ origin: [2.4, 1.8, 3.2], forward: [-2.4, -1.3, -3.2], fov: 34 }, 16, 12, 32, 24, () => 0.5);
    const color = traceRay(scene, ray.ox, ray.oy, ray.oz, ray.dx, ray.dy, ray.dz, 1, () => 0.5);
    expect(Number.isFinite(color.r + color.g + color.b)).toBe(true);
  });

  it("reads form colors into primitives", () => {
    const form: FormObject = {
      id: "a",
      name: "Clay",
      kind: "sphere",
      position: { x: 0, y: 1, z: 0 },
      rotation: { x: 0, y: 90, z: 0 },
      scale: { x: 2, y: 2, z: 2 },
      color: "#ff0000",
      metalness: 0.2,
      roughness: 0.3,
      sculpt: null,
    };
    const prim = formsToPrims([form])[0];
    expect(prim.color[0]).toBeCloseTo(1);
    expect(prim.scale[0]).toBe(2);
    expect(prim.rotation[1]).toBeCloseTo(Math.PI / 2);
  });
});
