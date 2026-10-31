import * as THREE from "three";
import type { FormObject } from "../model/types";

export function createFormGeometry(kind: FormObject["kind"]): THREE.BufferGeometry {
  let geometry: THREE.BufferGeometry;
  if (kind === "sphere") geometry = new THREE.SphereGeometry(0.5, 32, 24);
  else if (kind === "box") geometry = new THREE.BoxGeometry(1, 1, 1, 4, 4, 4);
  else if (kind === "cylinder") geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 24, 4);
  else {
    geometry = new THREE.TorusGeometry(0.42, 0.14, 12, 28);
    geometry.rotateX(Math.PI / 2);
  }
  const position = geometry.getAttribute("position");
  geometry.userData.base = new Float32Array(position.array);
  return geometry;
}

export function createFormMesh(object: FormObject): THREE.Mesh {
  const mesh = new THREE.Mesh(
    createFormGeometry(object.kind),
    new THREE.MeshStandardMaterial({
      color: object.color,
      metalness: object.metalness,
      roughness: object.roughness,
    }),
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.id = object.id;
  mesh.userData.kind = object.kind;
  applyForm(mesh, object, false);
  return mesh;
}

export function applyForm(mesh: THREE.Mesh, object: FormObject, selected: boolean) {
  mesh.position.set(object.position.x, object.position.y, object.position.z);
  mesh.rotation.set(
    THREE.MathUtils.degToRad(object.rotation.x),
    THREE.MathUtils.degToRad(object.rotation.y),
    THREE.MathUtils.degToRad(object.rotation.z),
  );
  mesh.scale.set(object.scale.x, object.scale.y, object.scale.z);
  const material = mesh.material as THREE.MeshStandardMaterial;
  material.color.set(object.color);
  material.metalness = object.metalness;
  material.roughness = object.roughness;
  material.emissive.set(selected ? "#6a4a16" : "#000000");
  material.emissiveIntensity = selected ? 0.28 : 0;
  const position = mesh.geometry.getAttribute("position") as THREE.BufferAttribute;
  const base = mesh.geometry.userData.base as Float32Array | undefined;
  if (object.sculpt && object.sculpt.length === position.count * 3) position.array.set(object.sculpt);
  else if (base) position.array.set(base);
  position.needsUpdate = true;
  mesh.geometry.computeVertexNormals();
  mesh.geometry.computeBoundingSphere();
}

export function disposeMesh(mesh: THREE.Mesh) {
  mesh.geometry.dispose();
  const material = mesh.material;
  if (Array.isArray(material)) material.forEach((item) => item.dispose());
  else material.dispose();
}

export function syncForms(group: THREE.Group, objects: FormObject[], selectedId: string | null, skipId: string | null) {
  const existing = new Map<string, THREE.Mesh>();
  for (const child of [...group.children]) {
    if (child instanceof THREE.Mesh && typeof child.userData.id === "string") existing.set(child.userData.id, child);
  }
  const ids = new Set(objects.map((object) => object.id));
  for (const [id, mesh] of existing) {
    if (!ids.has(id)) {
      group.remove(mesh);
      disposeMesh(mesh);
    }
  }
  for (const object of objects) {
    let mesh = existing.get(object.id);
    if (!mesh || mesh.userData.kind !== object.kind) {
      if (mesh) {
        group.remove(mesh);
        disposeMesh(mesh);
      }
      mesh = createFormMesh(object);
      group.add(mesh);
    }
    if (object.id !== skipId) applyForm(mesh, object, object.id === selectedId);
    mesh.userData.baseY = object.position.y;
  }
}
