import { describe, expect, it } from "vitest";
import { gradePixel, rgbToCmyk, sampleKeys, softProof, totalAreaCoverage, upsertKey } from "./math";

describe("print color", () => {
  it("turns black into black ink", () => {
    const ink = rgbToCmyk(0, 0, 0);
    expect(ink.k).toBe(1);
    expect(totalAreaCoverage(ink)).toBeCloseTo(100);
  });

  it("keeps white free of ink", () => {
    const ink = rgbToCmyk(1, 1, 1);
    expect(ink.c).toBeCloseTo(0);
    expect(ink.k).toBeCloseTo(0);
  });

  it("pulls saturated cyan under an ink limit on uncoated paper", () => {
    const proof = softProof(0, 0.75, 1, "uncoated", 240);
    expect(proof.tac).toBeLessThanOrEqual(240.01);
    expect(proof.rgb.b).toBeLessThan(1);
  });
});

describe("grade", () => {
  it("leaves a mid pixel near itself at neutral settings", () => {
    const pixel = gradePixel(0.4, 0.4, 0.4, {
      exposure: 0,
      contrast: 1,
      saturation: 1,
      temperature: 0,
      tint: 0,
      shadows: 0,
      highlights: 0,
    });
    expect(pixel.r).toBeCloseTo(0.4, 2);
  });

  it("warms the red channel when temperature rises", () => {
    const pixel = gradePixel(0.4, 0.4, 0.4, {
      exposure: 0,
      contrast: 1,
      saturation: 1,
      temperature: 1,
      tint: 0,
      shadows: 0,
      highlights: 0,
    });
    expect(pixel.r).toBeGreaterThan(pixel.b);
  });
});

describe("animation keys", () => {
  it("blends halfway between two keys", () => {
    const sample = sampleKeys(
      [
        { t: 0, x: 0, y: 0, scale: 1, rotation: 0, opacity: 0 },
        { t: 2, x: 10, y: 20, scale: 3, rotation: 90, opacity: 1 },
      ],
      1,
    );
    expect(sample.x).toBeCloseTo(5);
    expect(sample.opacity).toBeCloseTo(0.5);
    expect(sample.rotation).toBeCloseTo(45);
  });

  it("updates a key that already sits on the playhead", () => {
    const keys = upsertKey([{ t: 1, x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 }], 1, { x: 12 });
    expect(keys).toHaveLength(1);
    expect(keys[0].x).toBe(12);
  });
});
