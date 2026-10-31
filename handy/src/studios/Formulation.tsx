import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { uid } from "../model/ids";
import { useProject } from "../model/store";
import type { FormKind, FormObject } from "../model/types";
import type { StudioProps } from "../shell/meta";
import { syncForms } from "../three/formMesh";
import { useStage } from "../three/useStage";
import { ColorField, IconButton, NumberField, Slider, TextField, isTyping } from "../ui";

type Tool = "orbit" | "move" | "rotate" | "scale" | "sculpt" | "smooth";

export function Formulation({ focused, visible, onOpen }: StudioProps) {
  const { project, commit } = useProject();
  const objects = project.formulation.objects;
  const { ref, stage, frameRef, failed } = useStage(visible, { background: 0x2c2926, exposure: 1, shadows: false, tone: false });
  const [tool, setTool] = useState<Tool>("orbit");
  const [selectedId, setSelectedId] = useState<string | null>(objects[0]?.id ?? null);
  const [radius, setRadius] = useState(0.28);
  const [strength, setStrength] = useState(0.06);
  const toolRef = useRef(tool);
  const selectedRef = useRef(selectedId);
  const radiusRef = useRef(radius);
  const strengthRef = useRef(strength);
  const commitRef = useRef(commit);
  const objectsRef = useRef(objects);
  const groupRef = useRef<THREE.Group | null>(null);
  const gizmoRef = useRef<THREE.Group | null>(null);
  const dragRef = useRef(false);
  toolRef.current = tool;
  selectedRef.current = selectedId;
  radiusRef.current = radius;
  strengthRef.current = strength;
  commitRef.current = commit;
  objectsRef.current = objects;

  useEffect(() => {
    if (!stage) return;
    const { scene, camera, canvas, controls } = stage;
    scene.add(new THREE.HemisphereLight("#fff4e4", "#3a342c", 1.05));
    const key = new THREE.DirectionalLight("#ffffff", 1.25);
    key.position.set(4.5, 6.5, 3);
    scene.add(key);
    const fill = new THREE.DirectionalLight("#d5def0", 0.35);
    fill.position.set(-4, 2, -3);
    scene.add(fill);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(14, 64), new THREE.MeshStandardMaterial({ color: "#2a2724", roughness: 1 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    const grid = new THREE.GridHelper(10, 20, "#6a6258", "#3e3a34");
    grid.position.y = 0.002;
    scene.add(grid);
    const group = new THREE.Group();
    scene.add(group);
    groupRef.current = group;
    const gizmo = makeGizmo();
    scene.add(gizmo);
    gizmoRef.current = gizmo;
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let drag: { kind: "gizmo" | "rotate" | "scale" | "sculpt"; id: string; axis?: THREE.Vector3; plane?: THREE.Plane; startHit?: THREE.Vector3; startPos?: THREE.Vector3; startScale?: THREE.Vector3; dy: number } | null = null;

    const setPointer = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
    };
    const meshById = (id: string | null) => group.children.find((child) => child.userData.id === id) as THREE.Mesh | undefined;

    const onDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      setPointer(event);
      const mode = toolRef.current;
      if (mode === "move" && gizmo.visible) {
        const hit = raycaster.intersectObjects(gizmo.children, true)[0];
        const mesh = meshById(selectedRef.current);
        if (hit && mesh) {
          const axisName = hit.object.name;
          const axis = new THREE.Vector3(axisName === "x" ? 1 : 0, axisName === "y" ? 1 : 0, axisName === "z" ? 1 : 0);
          const eye = new THREE.Vector3();
          camera.getWorldDirection(eye);
          const side = new THREE.Vector3().crossVectors(axis, eye);
          if (side.lengthSq() < 1e-6) side.set(0, 1, 0);
          const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(new THREE.Vector3().crossVectors(side, axis).normalize(), mesh.position);
          const startHit = new THREE.Vector3();
          if (raycaster.ray.intersectPlane(plane, startHit)) {
            controls.enabled = false;
            dragRef.current = true;
            drag = { kind: "gizmo", id: mesh.userData.id as string, axis, plane, startHit, startPos: mesh.position.clone(), dy: 0 };
            canvas.setPointerCapture(event.pointerId);
            return;
          }
        }
      }
      const hit = raycaster.intersectObjects(group.children, false)[0];
      if (!hit) return;
      const mesh = hit.object as THREE.Mesh;
      const id = String(mesh.userData.id);
      setSelectedId(id);
      if (mode === "rotate" || mode === "scale" || mode === "sculpt" || mode === "smooth") {
        controls.enabled = false;
        dragRef.current = true;
        drag = { kind: mode === "rotate" ? "rotate" : mode === "scale" ? "scale" : "sculpt", id, startScale: mesh.scale.clone(), dy: 0 };
        canvas.setPointerCapture(event.pointerId);
        if (mode === "sculpt" || mode === "smooth") paint(mesh, hit, event.altKey, mode === "smooth");
      }
    };
    const onMove = (event: PointerEvent) => {
      if (!drag) return;
      setPointer(event);
      const mesh = meshById(drag.id);
      if (!mesh) return;
      if (drag.kind === "gizmo" && drag.plane && drag.axis && drag.startHit && drag.startPos) {
        const hit = new THREE.Vector3();
        if (raycaster.ray.intersectPlane(drag.plane, hit)) mesh.position.copy(drag.startPos).addScaledVector(drag.axis, hit.clone().sub(drag.startHit).dot(drag.axis));
      } else if (drag.kind === "rotate") {
        mesh.rotation.y += event.movementX * 0.01;
        mesh.rotation.x += event.movementY * 0.01;
      } else if (drag.kind === "scale" && drag.startScale) {
        drag.dy += event.movementY;
        const factor = Math.max(0.12, 1 - drag.dy * 0.008);
        mesh.scale.copy(drag.startScale).multiplyScalar(factor);
      } else if (drag.kind === "sculpt") {
        const hit = raycaster.intersectObject(mesh, false)[0];
        if (hit) paint(mesh, hit, event.altKey, toolRef.current === "smooth");
      }
    };
    const paint = (mesh: THREE.Mesh, hit: THREE.Intersection, inward: boolean, smooth: boolean) => {
      const position = mesh.geometry.getAttribute("position") as THREE.BufferAttribute;
      const localPoint = mesh.worldToLocal(hit.point.clone());
      const probe = mesh.worldToLocal(hit.point.clone().add(new THREE.Vector3(radiusRef.current, 0, 0)));
      const reach = Math.max(0.03, localPoint.distanceTo(probe));
      const normal = (hit.face?.normal ?? new THREE.Vector3(0, 1, 0)).clone();
      if (smooth) {
        let ax = 0, ay = 0, az = 0, count = 0;
        const indices: number[] = [];
        for (let i = 0; i < position.count; i += 1) {
          const dx = position.getX(i) - localPoint.x;
          const dy = position.getY(i) - localPoint.y;
          const dz = position.getZ(i) - localPoint.z;
          if (dx * dx + dy * dy + dz * dz < reach * reach) {
            indices.push(i);
            ax += position.getX(i);
            ay += position.getY(i);
            az += position.getZ(i);
            count += 1;
          }
        }
        if (!count) return;
        ax /= count; ay /= count; az /= count;
        for (const index of indices) {
          position.setXYZ(index, position.getX(index) + (ax - position.getX(index)) * 0.35, position.getY(index) + (ay - position.getY(index)) * 0.35, position.getZ(index) + (az - position.getZ(index)) * 0.35);
        }
      } else {
        const amount = (inward ? -1 : 1) * strengthRef.current;
        for (let i = 0; i < position.count; i += 1) {
          const dx = position.getX(i) - localPoint.x;
          const dy = position.getY(i) - localPoint.y;
          const dz = position.getZ(i) - localPoint.z;
          const distance = Math.hypot(dx, dy, dz);
          if (distance < reach) {
            const falloff = 0.5 + 0.5 * Math.cos((distance / reach) * Math.PI);
            position.setXYZ(i, position.getX(i) + normal.x * amount * falloff, position.getY(i) + normal.y * amount * falloff, position.getZ(i) + normal.z * amount * falloff);
          }
        }
      }
      position.needsUpdate = true;
      mesh.geometry.computeVertexNormals();
      mesh.geometry.computeBoundingSphere();
    };
    const onUp = () => {
      if (!drag) return;
      const mesh = meshById(drag.id);
      const id = drag.id;
      const sculpted = drag.kind === "sculpt";
      drag = null;
      dragRef.current = false;
      controls.enabled = true;
      if (!mesh) return;
      const positions = sculpted ? Array.from(mesh.geometry.getAttribute("position").array as ArrayLike<number>) : null;
      commitRef.current((project) => {
        const object = project.formulation.objects.find((item) => item.id === id);
        if (!object) return;
        object.position = { x: mesh.position.x, y: mesh.position.y, z: mesh.position.z };
        object.rotation = { x: THREE.MathUtils.radToDeg(mesh.rotation.x), y: THREE.MathUtils.radToDeg(mesh.rotation.y), z: THREE.MathUtils.radToDeg(mesh.rotation.z) };
        object.scale = { x: mesh.scale.x, y: mesh.scale.y, z: mesh.scale.z };
        if (positions) object.sculpt = positions;
      });
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("contextmenu", (event) => event.preventDefault());
    return () => {
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      groupRef.current = null;
      gizmoRef.current = null;
    };
  }, [stage]);

  useEffect(() => {
    if (!stage || !groupRef.current) return;
    syncForms(groupRef.current, objects, selectedId, dragRef.current ? selectedId : null);
  }, [stage, objects, selectedId]);

  frameRef.current = (current) => {
    const gizmo = gizmoRef.current;
    const mesh = groupRef.current?.children.find((child) => child.userData.id === selectedRef.current) as THREE.Mesh | undefined;
    if (!gizmo) return;
    gizmo.visible = toolRef.current === "move" && Boolean(mesh);
    if (mesh && gizmo.visible) {
      gizmo.position.copy(mesh.position);
      gizmo.scale.setScalar(Math.max(0.45, current.camera.position.distanceTo(mesh.position) * 0.18));
    }
    current.controls.enableRotate = toolRef.current === "orbit";
  };

  useEffect(() => {
    if (!focused) return;
    const onKey = (event: KeyboardEvent) => {
      if (isTyping(event.target) || !selectedRef.current) return;
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        const id = selectedRef.current;
        commit((project) => {
          project.formulation.objects = project.formulation.objects.filter((object) => object.id !== id);
        });
        setSelectedId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focused, commit]);

  const selected = objects.find((object) => object.id === selectedId) ?? null;

  function add(kind: FormKind) {
    const id = uid("form");
    commit((draft) => {
      draft.formulation.objects.push({
        id,
        name: kind[0].toUpperCase() + kind.slice(1),
        kind,
        position: { x: draft.formulation.objects.length * 0.25, y: kind === "torus" ? 0.18 : 0.5, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        color: "#d9d3c8",
        metalness: 0,
        roughness: 0.55,
        sculpt: null,
      });
    });
    setSelectedId(id);
  }

  function patch(recipe: (object: FormObject) => void, history: "push" | "coalesce" | "end" = "push") {
    if (!selectedId) return;
    commit((draft) => {
      const object = draft.formulation.objects.find((item) => item.id === selectedId);
      if (object) recipe(object);
    }, history);
  }

  return (
    <div className="studio">
      <div className="tools">
        {(["orbit", "move", "rotate", "scale", "sculpt", "smooth"] as Tool[]).map((item) => (
          <IconButton key={item} title={item[0].toUpperCase() + item.slice(1)} active={tool === item} onClick={() => setTool(item)}>
            {item[0].toUpperCase()}
          </IconButton>
        ))}
      </div>
      <div className="stage" ref={ref}>
        {failed && <div className="studio-error"><strong>Formulation</strong><p>This device could not start the 3D view. Close another 3D room and reopen this one.</p></div>}
      </div>
      <aside className="side">
        <h3>Formulation</h3>
        <p>Orbit looks around. Move uses the colored axes. Sculpt pushes a surface; hold Alt to press in. Smooth relaxes it.</p>
        <div className="row">
          {(["box", "sphere", "cylinder", "torus"] as FormKind[]).map((kind) => (
            <button type="button" key={kind} onClick={() => add(kind)}>{kind}</button>
          ))}
        </div>
        <button type="button" onClick={() => onOpen("rendering")}>Open in Rendering</button>
        {(tool === "sculpt" || tool === "smooth") && (
          <>
            <Slider label="Radius" min={0.08} max={0.8} step={0.01} value={radius} onChange={(value) => setRadius(value)} />
            <Slider label="Strength" min={0.01} max={0.2} step={0.005} value={strength} onChange={(value) => setStrength(value)} />
          </>
        )}
        {selected && (
          <>
            <TextField label="Name" value={selected.name} onCommit={(value) => patch((object) => { object.name = value; })} />
            <ColorField label="Color" value={selected.color} onChange={(value, history) => patch((object) => { object.color = value; }, history)} />
            <Slider label="Metal" min={0} max={1} step={0.01} value={selected.metalness} onChange={(value, history) => patch((object) => { object.metalness = value; }, history)} />
            <Slider label="Rough" min={0.04} max={1} step={0.01} value={selected.roughness} onChange={(value, history) => patch((object) => { object.roughness = value; }, history)} />
            <NumberField label="X" value={selected.position.x} onChange={(value, history) => patch((object) => { object.position.x = value; }, history)} />
            <NumberField label="Y" value={selected.position.y} onChange={(value, history) => patch((object) => { object.position.y = value; }, history)} />
            <NumberField label="Z" value={selected.position.z} onChange={(value, history) => patch((object) => { object.position.z = value; }, history)} />
            <NumberField label="Rot Y" value={selected.rotation.y} step={1} onChange={(value, history) => patch((object) => { object.rotation.y = value; }, history)} />
            <div className="row">
              <button
                type="button"
                onClick={() => {
                  const id = uid("form");
                  commit((draft) => {
                    const source = draft.formulation.objects.find((object) => object.id === selected.id);
                    if (!source) return;
                    draft.formulation.objects.push({ ...structuredClone(source), id, name: `${source.name} copy`, position: { ...source.position, x: source.position.x + 0.45 }, sculpt: source.sculpt ? [...source.sculpt] : null });
                  });
                  setSelectedId(id);
                }}
              >
                Duplicate
              </button>
              <button type="button" className="danger" onClick={() => { commit((draft) => { draft.formulation.objects = draft.formulation.objects.filter((object) => object.id !== selected.id); }); setSelectedId(null); }}>Delete</button>
            </div>
          </>
        )}
        <div className="layers">
          {objects.map((object) => (
            <button type="button" key={object.id} className={object.id === selectedId ? "on" : ""} onClick={() => setSelectedId(object.id)}>{object.name}</button>
          ))}
        </div>
      </aside>
    </div>
  );
}

function makeGizmo() {
  const group = new THREE.Group();
  const add = (name: "x" | "y" | "z", dir: THREE.Vector3, color: number) => {
    const material = new THREE.MeshBasicMaterial({ color, depthTest: false });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1, 8), material);
    shaft.geometry.translate(0, 0.5, 0);
    shaft.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    shaft.name = name;
    shaft.renderOrder = 5;
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.22, 10), material);
    head.position.copy(dir.clone().multiplyScalar(1.12));
    head.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    head.name = name;
    head.renderOrder = 5;
    group.add(shaft, head);
  };
  add("x", new THREE.Vector3(1, 0, 0), 0xe25b45);
  add("y", new THREE.Vector3(0, 1, 0), 0x73c7a8);
  add("z", new THREE.Vector3(0, 0, 1), 0x7eb6ff);
  return group;
}
