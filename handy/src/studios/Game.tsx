import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { uid } from "../model/ids";
import { useProject } from "../model/store";
import type { FormObject, GameEntity } from "../model/types";
import type { StudioProps } from "../shell/meta";
import { syncForms } from "../three/formMesh";
import { useStage } from "../three/useStage";
import { TextField } from "../ui";

type Sim = { x: number; y: number; z: number; vy: number; won: boolean; spawnX: number; spawnZ: number };

export function Game({ focused, visible }: StudioProps) {
  const { project, commit } = useProject();
  const { ref, stage, frameRef, failed } = useStage(visible, { background: 0x171512, exposure: 1.05, shadows: true, tone: true });
  const [selectedId, setSelectedId] = useState<string | null>("player");
  const [armed, setArmed] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [banner, setBanner] = useState("");
  const [nub, setNub] = useState({ x: 0, y: 0 });
  const groupRef = useRef<THREE.Group | null>(null);
  const floorRef = useRef<THREE.Mesh | null>(null);
  const playingRef = useRef(false);
  const simRef = useRef<Sim>({ x: 0, y: 0, z: 2, vy: 0, won: false, spawnX: 0, spawnZ: 2 });
  const keys = useRef(new Set<string>());
  const stick = useRef({ x: 0, y: 0 });
  const jump = useRef(false);
  const armedRef = useRef<string | null>(null);
  const entitiesRef = useRef(project.game.entities);
  const formsRef = useRef(project.formulation.objects);
  const commitRef = useRef(commit);
  playingRef.current = playing;
  armedRef.current = armed;
  entitiesRef.current = project.game.entities;
  formsRef.current = project.formulation.objects;
  commitRef.current = commit;

  useEffect(() => {
    if (!stage) return;
    const { scene, canvas, camera, controls } = stage;
    scene.add(new THREE.HemisphereLight("#fff0d8", "#241c16", 0.7));
    const sun = new THREE.DirectionalLight("#fff4e2", 1.8);
    sun.position.set(5, 8, 3);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    scene.add(sun);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(18, 64), new THREE.MeshStandardMaterial({ color: "#3a342c", roughness: 0.95 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    floor.userData.floor = true;
    scene.add(floor);
    const grid = new THREE.GridHelper(16, 16, "#8a8174", "#4a453d");
    grid.position.y = 0.01;
    scene.add(grid);
    floorRef.current = floor;
    const group = new THREE.Group();
    scene.add(group);
    groupRef.current = group;
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    let drag: { id: string } | null = null;
    const aim = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
    };
    const onDown = (event: PointerEvent) => {
      if (playingRef.current || event.button !== 0) return;
      aim(event);
      const hit = raycaster.intersectObjects(group.children, false)[0];
      if (hit) {
        const id = String(hit.object.userData.id);
        setSelectedId(id);
        controls.enabled = false;
        drag = { id };
        canvas.setPointerCapture(event.pointerId);
        return;
      }
      const floorHit = new THREE.Vector3();
      if (armedRef.current && raycaster.ray.intersectPlane(plane, floorHit)) {
        const formId = armedRef.current;
        const form = formsRef.current.find((item) => item.id === formId);
        commitRef.current((draft) => {
          draft.game.entities.push(entityFromForm(form, floorHit.x, floorHit.z));
        });
        setArmed(null);
      }
    };
    const onMove = (event: PointerEvent) => {
      if (!drag) return;
      aim(event);
      const point = new THREE.Vector3();
      if (!raycaster.ray.intersectPlane(plane, point)) return;
      const mesh = group.children.find((child) => child.userData.id === drag?.id);
      if (mesh) {
        mesh.position.x = point.x;
        mesh.position.z = point.z;
      }
    };
    const onUp = () => {
      if (!drag) return;
      const mesh = group.children.find((child) => child.userData.id === drag?.id);
      const id = drag.id;
      drag = null;
      controls.enabled = true;
      if (!mesh) return;
      commitRef.current((draft) => {
        const entity = draft.game.entities.find((item) => item.id === id);
        if (!entity) return;
        entity.x = mesh.position.x;
        entity.z = mesh.position.z;
      });
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    return () => {
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      groupRef.current = null;
      floorRef.current = null;
    };
  }, [stage]);

  useEffect(() => {
    if (!stage || !groupRef.current) return;
    const visuals = project.game.entities.map((entity) => visualFor(entity, project.formulation.objects));
    const playerId = project.game.entities.find((entity) => entity.role === "player")?.id ?? null;
    syncForms(groupRef.current, visuals, selectedId, playing ? playerId : null);
    for (const entity of project.game.entities) {
      const mesh = groupRef.current.children.find((child) => child.userData.id === entity.id) as THREE.Mesh | undefined;
      const material = mesh?.material as THREE.MeshStandardMaterial | undefined;
      if (!mesh || !material) continue;
      mesh.userData.role = entity.role;
      if (entity.role === "goal") {
        material.emissive.set("#0e6b58");
        material.emissiveIntensity = 0.5;
      } else if (entity.role === "hazard") {
        material.emissive.set("#6a2418");
        material.emissiveIntensity = 0.4;
      }
      if (playing && entity.role === "player") {
        mesh.position.x = simRef.current.x;
        mesh.position.z = simRef.current.z;
        mesh.position.y = Number(mesh.userData.baseY ?? 0.3) + simRef.current.y;
      }
    }
    const floor = floorRef.current;
    if (floor) {
      const temperature = project.idea.grade.temperature;
      const color = new THREE.Color("#3a342c");
      color.lerp(new THREE.Color(temperature >= 0 ? "#6a4030" : "#243844"), Math.min(1, Math.abs(temperature)));
      (floor.material as THREE.MeshStandardMaterial).color.copy(color);
    }
  }, [stage, project.game.entities, project.formulation.objects, project.idea.grade.temperature, selectedId, playing]);

  useEffect(() => {
    if (!stage) return;
    const last = project.rendering.frames.at(-1);
    if (!project.game.showRenderCard || !last) return;
    const texture = new THREE.TextureLoader().load(last.url);
    texture.colorSpace = THREE.SRGBColorSpace;
    const card = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.96), new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }));
    card.position.set(-3.4, 0.95, -1.1);
    card.rotation.y = 0.45;
    stage.scene.add(card);
    return () => {
      stage.scene.remove(card);
      texture.dispose();
      card.geometry.dispose();
      (card.material as THREE.Material).dispose();
    };
  }, [stage, project.rendering.frames, project.game.showRenderCard]);

  useEffect(() => {
    if (!focused && !playing) return;
    const down = (event: KeyboardEvent) => {
      if (isTextEntry(event.target)) return;
      keys.current.add(event.key.toLowerCase());
      if (event.code === "Space" && playingRef.current) {
        event.preventDefault();
        if (!event.repeat) jump.current = true;
      }
    };
    const up = (event: KeyboardEvent) => keys.current.delete(event.key.toLowerCase());
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [focused, playing]);

  const last = useRef(performance.now());
  frameRef.current = (current) => {
    current.controls.enabled = !playingRef.current;
    if (!playingRef.current || !groupRef.current) return;
    const now = performance.now();
    const dt = Math.min(0.033, (now - last.current) / 1000);
    last.current = now;
    const sim = simRef.current;
    if (!sim.won) {
      let ix = stick.current.x;
      let iz = stick.current.y;
      if (keys.current.has("a") || keys.current.has("arrowleft")) ix -= 1;
      if (keys.current.has("d") || keys.current.has("arrowright")) ix += 1;
      if (keys.current.has("w") || keys.current.has("arrowup")) iz -= 1;
      if (keys.current.has("s") || keys.current.has("arrowdown")) iz += 1;
      const length = Math.hypot(ix, iz) || 1;
      sim.x += (ix / length) * (ix === 0 && iz === 0 ? 0 : 3.4) * dt;
      sim.z += (iz / length) * (ix === 0 && iz === 0 ? 0 : 3.4) * dt;
      sim.x = Math.max(-12, Math.min(12, sim.x));
      sim.z = Math.max(-12, Math.min(12, sim.z));
      if (jump.current && sim.y < 0.04) {
        sim.vy = 5.5;
        jump.current = false;
      }
      sim.vy -= 14 * dt;
      sim.y += sim.vy * dt;
      if (sim.y <= 0) {
        sim.y = 0;
        sim.vy = 0;
      }
      for (const entity of entitiesRef.current) {
        if (entity.role === "player") continue;
        const dx = sim.x - entity.x;
        const dz = sim.z - entity.z;
        const distance = Math.hypot(dx, dz) || 0.0001;
        const limit = 0.34 + entity.radius;
        if (distance >= limit) continue;
        if (entity.role === "goal" && sim.y < 1.1) {
          sim.won = true;
          setBanner("You reached the mark.");
        } else if (entity.role === "hazard" && sim.y < entity.block) {
          sim.x = sim.spawnX;
          sim.z = sim.spawnZ;
          sim.y = 0;
          sim.vy = 0;
          setBanner("Back to the start.");
        } else if (entity.role === "prop" && sim.y < entity.block) {
          const push = (limit - distance) / distance;
          sim.x += dx * push;
          sim.z += dz * push;
        }
      }
    }
    const player = groupRef.current.children.find((child) => child.userData.role === "player");
    if (player) {
      player.position.x = sim.x;
      player.position.z = sim.z;
      player.position.y = Number(player.userData.baseY ?? 0.3) + sim.y;
    }
    const look = new THREE.Vector3(sim.x, 0.45, sim.z);
    current.camera.position.lerp(new THREE.Vector3(sim.x + 0.2, 3.2, sim.z + 4.8), 0.12);
    current.camera.lookAt(look);
  };

  function play() {
    const player = project.game.entities.find((entity) => entity.role === "player");
    if (!player) return;
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    simRef.current = { x: player.x, y: 0, z: player.z, vy: 0, won: false, spawnX: player.x, spawnZ: player.z };
    last.current = performance.now();
    setBanner(project.game.title);
    setPlaying(true);
  }

  const selected = project.game.entities.find((entity) => entity.id === selectedId) ?? null;

  return (
    <div className="studio">
      <div className="tools">
        <button type="button" className={playing ? "tool active" : "tool"} onClick={() => (playing ? setPlaying(false) : play())}>{playing ? "Stop" : "Play"}</button>
      </div>
      <div className="stage">
        <div className="gl-host" ref={ref} />
        {failed && <div className="studio-error"><strong>Game</strong><p>This device could not start the play view.</p></div>}
        {playing && <div className="hud">{banner}</div>}
        {playing && (
          <div
            className="stick"
            onPointerDown={(event) => event.currentTarget.setPointerCapture(event.pointerId)}
            onPointerMove={(event) => {
              if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
              const rect = event.currentTarget.getBoundingClientRect();
              const dx = event.clientX - (rect.left + rect.width / 2);
              const dy = event.clientY - (rect.top + rect.height / 2);
              const mag = Math.hypot(dx, dy) || 1;
              const reach = Math.min(36, mag);
              stick.current = { x: dx / mag * (mag > 8 ? 1 : 0), y: dy / mag * (mag > 8 ? 1 : 0) };
              setNub({ x: (dx / mag) * reach, y: (dy / mag) * reach });
            }}
            onPointerUp={() => {
              stick.current = { x: 0, y: 0 };
              setNub({ x: 0, y: 0 });
            }}
          >
            <i className="nub" style={{ transform: `translate(${nub.x}px, ${nub.y}px)` }} />
          </div>
        )}
      </div>
      <aside className="side">
        <h3>Game</h3>
        <p>Place forms from Formulation, then press Play. WASD or the stick walks. Space jumps. Hazards send you back. Reach the mark.</p>
        <p>The floor warmth follows the grade in Idea. The last Rendering frame can stand in the scene.</p>
        <TextField label="Title" value={project.game.title} onCommit={(value) => commit((draft) => { draft.game.title = value; })} />
        <button type="button" onClick={() => commit((draft) => { draft.game.showRenderCard = !draft.game.showRenderCard; })}>
          {project.game.showRenderCard ? "Render card on" : "Render card off"}
        </button>
        <div className="layers">
          {project.formulation.objects.map((object) => (
            <button type="button" key={object.id} className={armed === object.id ? "on" : ""} onClick={() => setArmed(armed === object.id ? null : object.id)}>
              Place {object.name}
            </button>
          ))}
        </div>
        {armed && <p>Click the floor to place {project.formulation.objects.find((object) => object.id === armed)?.name}.</p>}
        <div className="row">
          <button type="button" onClick={() => commit((draft) => { draft.game.entities.push({ id: uid("hazard"), name: "Hazard", role: "hazard", formId: null, kind: "box", color: "#ff6b4a", scale: 0.5, x: 0, z: -2, rotY: 0, radius: 0.4, block: 0.45 }); })}>Add hazard</button>
          <button type="button" onClick={() => commit((draft) => { draft.game.entities.push({ id: uid("goal"), name: "Mark", role: "goal", formId: null, kind: "torus", color: "#7dcfb6", scale: 0.8, x: 0, z: -4, rotY: 0, radius: 0.5, block: 0.2 }); })}>Add mark</button>
        </div>
        {selected && (
          <>
            <p>{selected.name} · {selected.role}</p>
            <button type="button" className="danger" onClick={() => { commit((draft) => { draft.game.entities = draft.game.entities.filter((entity) => entity.id !== selected.id); }); setSelectedId(null); }}>Delete</button>
          </>
        )}
        <div className="layers">
          {project.game.entities.map((entity) => (
            <button type="button" key={entity.id} className={entity.id === selectedId ? "on" : ""} onClick={() => setSelectedId(entity.id)}>{entity.name}</button>
          ))}
        </div>
      </aside>
    </div>
  );
}

function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable || target.tagName === "TEXTAREA") return true;
  if (target.tagName !== "INPUT") return false;
  const type = (target as HTMLInputElement).type;
  return type === "text" || type === "number" || type === "search" || type === "email" || type === "password" || type === "";
}

function visualFor(entity: GameEntity, forms: FormObject[]): FormObject {
  const source = entity.formId ? forms.find((form) => form.id === entity.formId) : undefined;
  if (source) {
    return {
      ...source,
      id: entity.id,
      position: { x: entity.x, y: source.position.y, z: entity.z },
      rotation: { ...source.rotation, y: source.rotation.y + entity.rotY },
      sculpt: source.sculpt ? [...source.sculpt] : null,
    };
  }
  return {
    id: entity.id,
    name: entity.name,
    kind: entity.kind,
    position: { x: entity.x, y: entity.kind === "torus" ? entity.scale * 0.2 : entity.scale * 0.5, z: entity.z },
    rotation: { x: 0, y: entity.rotY, z: 0 },
    scale: { x: entity.scale, y: entity.scale, z: entity.scale },
    color: entity.color,
    metalness: entity.role === "goal" ? 0.35 : 0.05,
    roughness: 0.48,
    sculpt: null,
  };
}

function entityFromForm(form: FormObject | undefined, x: number, z: number): GameEntity {
  const scale = form ? Math.max(form.scale.x, form.scale.z) : 0.6;
  return {
    id: uid("prop"),
    name: form?.name ?? "Prop",
    role: "prop",
    formId: form?.id ?? null,
    kind: form?.kind ?? "box",
    color: form?.color ?? "#d9d3c8",
    scale,
    x,
    z,
    rotY: 0,
    radius: 0.5 * scale,
    block: 1,
  };
}
