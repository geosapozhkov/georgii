import { rayForPixel, tonemap, traceRay, type Camera, type Prepared } from "./pathtrace";

export async function accumulate(options: {
  scene: Prepared[];
  camera: Camera;
  width: number;
  height: number;
  samples: number;
  bounces: number;
  exposure: number;
  shouldStop: () => boolean;
  onSample: (sample: number, pixels: Uint8ClampedArray) => void;
}): Promise<void> {
  const { width, height } = options;
  const acc = new Float32Array(width * height * 3);
  const pixels = new Uint8ClampedArray(width * height * 4);
  const samples = Math.max(1, Math.round(options.samples));
  for (let sample = 1; sample <= samples; sample += 1) {
    if (options.shouldStop()) return;
    const rng = Math.random;
    for (let y = 0; y < height; y += 1) {
      if (y % 2 === 0 && options.shouldStop()) return;
      for (let x = 0; x < width; x += 1) {
        const ray = rayForPixel(options.camera, x, y, width, height, rng);
        const color = traceRay(options.scene, ray.ox, ray.oy, ray.oz, ray.dx, ray.dy, ray.dz, options.bounces, rng);
        const index = (y * width + x) * 3;
        acc[index] += color.r;
        acc[index + 1] += color.g;
        acc[index + 2] += color.b;
      }
      if (y % 2 === 1) await nextFrame();
    }
    for (let pixel = 0; pixel < width * height; pixel += 1) {
      const index = pixel * 3;
      const out = pixel * 4;
      pixels[out] = Math.round(tonemap(acc[index] / sample, options.exposure) * 255);
      pixels[out + 1] = Math.round(tonemap(acc[index + 1] / sample, options.exposure) * 255);
      pixels[out + 2] = Math.round(tonemap(acc[index + 2] / sample, options.exposure) * 255);
      pixels[out + 3] = 255;
    }
    options.onSample(sample, pixels);
    await nextFrame();
  }
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => resolve());
    else setTimeout(resolve, 0);
  });
}
