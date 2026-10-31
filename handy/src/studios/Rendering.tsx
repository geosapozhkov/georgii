import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { accumulate } from "../render/accumulate";
import { formsToPrims, prepareScene, type Camera } from "../render/pathtrace";
import { uid } from "../model/ids";
import { useProject } from "../model/store";
import type { StudioProps } from "../shell/meta";
import { syncForms } from "../three/formMesh";
import { useStage } from "../three/useStage";
import { Slider } from "../ui";

type Mode = "live" | "sample";

export function Rendering({ visible, onOpen }: StudioProps) {
  const { project, commit } = useProject();
  const objects = project.formulation.objects;
  const settings = project.rendering;
  const { ref, stage, frameRef, failed } = useStage(visible, { background: 0x141210, exposure: settings.exposure, shadows: true, tone: true });
  const [mode, setMode] = useState<Mode>("live");
  const [progress, setProgress] = useState("");
  const traceRef = useRef<HTMLCanvasElement>(null);
  const groupRef = useRef<THREE.Group | null>(null);
  const stopRef = useRef(false);
  const runRef = useRef(0);
  const sequenceRef = useRef(false);

  useEffect(() => {
    if (!stage) return;
    const { scene } = stage;
    const hemi = new THREE.HemisphereLight("#ffe7c4", "#201c18", 0.45);
    const key = new THREE.DirectionalLight("#fff1dc", 2.6);
    key.position.set(4.2, 7.2, 2.4);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 0.4;
    key.shadow.camera.far = 24;
    key.shadow.camera.left = -7;
    key.shadow.camera.right = 7;
    key.shadow.camera.top = 7;
    key.shadow.camera.bottom = -7;
    key.shadow.bias = -0.0008;
    const rim = new THREE.DirectionalLight("#8eb6ff", 0.7);
    rim.position.set(-5, 3, -3);
    scene.add(hemi, key, rim);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(16, 80), new THREE.MeshStandardMaterial({ color: "#24211e", roughness: 0.92, metalness: 0.04 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    const group = new THREE.Group();
    scene.add(group);
    groupRef.current = group;
    return () => {
      groupRef.current = null;
    };
  }, [stage]);

  useEffect(() => {
    if (!stage || !groupRef.current) return;
    stage.renderer.toneMappingExposure = settings.exposure;
    syncForms(groupRef.current, objects, null, null);
  }, [stage, objects, settings.exposure]);

  frameRef.current = () => undefined;

  useEffect(() => {
    if (mode !== "sample" || !stage || sequenceRef.current) return;
    const camera = readCamera(stage);
    return start(camera, settings.samples, settings.width, settings.height, "Sampling");
  }, [mode, stage, settings.samples, settings.width, settings.height, settings.bounces, settings.exposure, objects]);

  function start(camera: Camera, samples: number, width: number, height: number, label: string) {
    const canvas = traceRef.current;
    if (!canvas) return;
    stopRef.current = false;
    const token = ++runRef.current;
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return;
    const scene = prepareScene(formsToPrims(objects));
    void accumulate({
      scene,
      camera,
      width,
      height,
      samples,
      bounces: settings.bounces,
      exposure: settings.exposure,
      shouldStop: () => stopRef.current || token !== runRef.current,
      onSample: (sample, pixels) => {
        if (token !== runRef.current) return;
        context.putImageData(new ImageData(new Uint8ClampedArray(pixels), width, height), 0, 0);
        setProgress(`${label} ${sample} / ${samples}`);
      },
    }).then(() => {
      if (token === runRef.current) setProgress(`${label} ready`);
    });
    return () => {
      stopRef.current = true;
    };
  }

  function keepFrame() {
    const canvas = traceRef.current;
    if (!canvas || canvas.width === 0) return;
    const big = document.createElement("canvas");
    big.width = canvas.width * 2;
    big.height = canvas.height * 2;
    const context = big.getContext("2d");
    if (!context) return;
    context.imageSmoothingEnabled = true;
    context.drawImage(canvas, 0, 0, big.width, big.height);
    const url = big.toDataURL("image/jpeg", 0.86);
    commit((draft) => {
      draft.rendering.frames.push({ id: uid("frame"), name: `Frame ${draft.rendering.frames.length + 1}`, url });
      if (draft.rendering.frames.length > 24) draft.rendering.frames.splice(0, draft.rendering.frames.length - 24);
    });
  }

  async function turntable() {
    if (!stage) return;
    sequenceRef.current = true;
    const target = stage.controls.target;
    const offset = stage.camera.position.clone().sub(target);
    const radius = Math.max(1, Math.hypot(offset.x, offset.z));
    const urls: string[] = [];
    stopRef.current = true;
    runRef.current += 1;
    for (let index = 0; index < 6; index += 1) {
      const angle = (index / 6) * Math.PI * 2;
      const origin: [number, number, number] = [target.x + Math.sin(angle) * radius, target.y + offset.y, target.z + Math.cos(angle) * radius];
      const camera: Camera = { origin, forward: [target.x - origin[0], target.y + 0.15 - origin[1], target.z - origin[2]], fov: stage.camera.fov };
      setMode("sample");
      await new Promise<void>((resolve) => {
        const canvas = traceRef.current;
        if (!canvas) return resolve();
        const token = ++runRef.current;
        stopRef.current = false;
        canvas.width = 160;
        canvas.height = 90;
        const context = canvas.getContext("2d");
        if (!context) return resolve();
        void accumulate({
          scene: prepareScene(formsToPrims(objects)),
          camera,
          width: 160,
          height: 90,
          samples: 4,
          bounces: Math.min(2, settings.bounces),
          exposure: settings.exposure,
          shouldStop: () => stopRef.current || token !== runRef.current,
          onSample: (sample, pixels) => {
            context.putImageData(new ImageData(new Uint8ClampedArray(pixels), 160, 90), 0, 0);
            setProgress(`Orbit ${index + 1} / 6 · sample ${sample}`);
          },
        }).then(() => {
          if (token === runRef.current && canvas.width) {
            const big = document.createElement("canvas");
            big.width = 320;
            big.height = 180;
            const out = big.getContext("2d");
            if (out) {
              out.drawImage(canvas, 0, 0, 320, 180);
              urls.push(big.toDataURL("image/jpeg", 0.84));
            }
          }
          resolve();
        });
      });
    }
    sequenceRef.current = false;
    if (!urls.length) return;
    commit((draft) => {
      urls.forEach((url, index) => draft.rendering.frames.push({ id: uid("frame"), name: `Orbit ${index + 1}`, url }));
      if (draft.rendering.frames.length > 24) draft.rendering.frames.splice(0, draft.rendering.frames.length - 24);
    });
    setProgress("Orbit sequence kept");
  }

  function sendSequence() {
    if (!project.rendering.frames.length) return;
    commit((draft) => {
      draft.animation.layers.push({
        id: uid("layer"),
        name: "Render sequence",
        kind: "sequence",
        color: "#ffffff",
        text: "",
        frameIds: draft.rendering.frames.map((frame) => frame.id),
        images: [],
        in: 0,
        out: draft.animation.duration,
        visible: true,
        keys: [{ t: 0, x: draft.animation.width / 2, y: draft.animation.height / 2, scale: 1.6, rotation: 0, opacity: 1 }],
      });
    });
    onOpen("animation");
  }

  return (
    <div className="studio">
      <div className="tools">
        <button type="button" className={mode === "live" ? "tool active" : "tool"} onClick={() => { stopRef.current = true; setMode("live"); }}>Live</button>
        <button type="button" className={mode === "sample" ? "tool active" : "tool"} onClick={() => setMode("sample")}>Still</button>
      </div>
      <div className="stage" ref={ref}>
        <canvas ref={traceRef} className="trace-canvas" hidden={mode !== "sample"} />
        {failed && <div className="studio-error"><strong>Rendering</strong><p>This device could not start the live view.</p></div>}
      </div>
      <aside className="side">
        <h3>Rendering</h3>
        <p>Live is the realtime view. Still samples light across the base forms. Sculpted detail stays in the live view.</p>
        <p>{progress || "Choose Still to sample the picture."}</p>
        <Slider label="Exposure" min={0.4} max={2.4} step={0.01} value={settings.exposure} onChange={(value, history) => commit((draft) => { draft.rendering.exposure = value; }, history)} />
        <Slider label="Bounces" min={0} max={3} step={1} digits={0} value={settings.bounces} onChange={(value, history) => commit((draft) => { draft.rendering.bounces = value; }, history)} />
        <Slider label="Samples" min={4} max={64} step={1} digits={0} value={settings.samples} onChange={(value, history) => commit((draft) => { draft.rendering.samples = value; }, history)} />
        <div className="row">
          <button type="button" onClick={() => commit((draft) => { draft.rendering.width = 128; draft.rendering.height = 72; draft.rendering.samples = 8; })}>Draft</button>
          <button type="button" onClick={() => commit((draft) => { draft.rendering.width = 200; draft.rendering.height = 112; draft.rendering.samples = 20; })}>Still</button>
          <button type="button" onClick={() => commit((draft) => { draft.rendering.width = 280; draft.rendering.height = 158; draft.rendering.samples = 32; })}>Fine</button>
        </div>
        <div className="row">
          <button type="button" onClick={keepFrame} disabled={mode !== "sample"}>Keep frame</button>
          <button type="button" onClick={() => void turntable()}>Orbit sequence</button>
        </div>
        <button type="button" onClick={sendSequence} disabled={!settings.frames.length}>Send sequence to Animation</button>
        <button type="button" className="danger" onClick={() => commit((draft) => { draft.rendering.frames = []; })}>Clear frames</button>
        <div className="film">
          {settings.frames.map((frame) => (
            <button type="button" key={frame.id} onClick={() => commit((draft) => { draft.rendering.frames = draft.rendering.frames.filter((item) => item.id !== frame.id); })}>
              <img src={frame.url} alt={frame.name} />
            </button>
          ))}
        </div>
      </aside>
    </div>
  );
}

function readCamera(stage: { camera: THREE.PerspectiveCamera }): Camera {
  const direction = new THREE.Vector3();
  stage.camera.getWorldDirection(direction);
  return {
    origin: [stage.camera.position.x, stage.camera.position.y, stage.camera.position.z],
    forward: [direction.x, direction.y, direction.z],
    fov: stage.camera.fov,
  };
}
