import { useEffect, useRef, useState } from "react";
import type * as THREE from "three";
import { createStage, fitStage, type Stage } from "./stage";

type StageOptions = { background: number; exposure: number; shadows: boolean; tone: boolean };

export function useStage(visible: boolean, options: StageOptions) {
  const ref = useRef<HTMLDivElement>(null);
  const frameRef = useRef<(stage: Stage) => void>(() => {});
  const visibleRef = useRef(visible);
  const optionsRef = useRef(options);
  visibleRef.current = visible;
  const [stage, setStage] = useState<Stage | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    let created: Stage;
    try {
      created = createStage(host, optionsRef.current);
    } catch {
      setFailed(true);
      return;
    }
    setStage(created);
    let frame = 0;
    const loop = () => {
      frame = requestAnimationFrame(loop);
      if (!visibleRef.current || host.clientWidth === 0) return;
      created.controls.update();
      frameRef.current(created);
      created.renderer.render(created.scene, created.camera);
    };
    frame = requestAnimationFrame(loop);
    const observer = new ResizeObserver(() => fitStage(created, host));
    observer.observe(host);
    fitStage(created, host);
    const onLost = (event: Event) => {
      event.preventDefault();
      setFailed(true);
    };
    created.canvas.addEventListener("webglcontextlost", onLost);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      created.canvas.removeEventListener("webglcontextlost", onLost);
      created.controls.dispose();
      created.renderer.dispose();
      created.scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const material = mesh.material;
        if (Array.isArray(material)) material.forEach((item) => item.dispose());
        else if (material && "dispose" in material) material.dispose();
      });
      host.replaceChildren();
      setStage(null);
    };
  }, []);

  return { ref, stage, frameRef, failed };
}
