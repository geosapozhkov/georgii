import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export type Stage = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  canvas: HTMLCanvasElement;
};

export function createStage(
  host: HTMLElement,
  options: { background: number; exposure: number; shadows: boolean; tone: boolean },
): Stage {
  const canvas = document.createElement("canvas");
  canvas.className = "gl";
  host.appendChild(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = options.tone ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
  renderer.toneMappingExposure = options.exposure;
  renderer.shadowMap.enabled = options.shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(options.background);
  const camera = new THREE.PerspectiveCamera(34, 1, 0.05, 80);
  camera.position.set(3.5, 2.35, 4.5);
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 0.4, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.minDistance = 0.7;
  controls.maxDistance = 28;
  controls.update();
  return { renderer, scene, camera, controls, canvas };
}

export function fitStage(stage: Stage, host: HTMLElement) {
  const width = Math.max(1, host.clientWidth);
  const height = Math.max(1, host.clientHeight);
  stage.camera.aspect = width / height;
  stage.camera.updateProjectionMatrix();
  stage.renderer.setSize(width, height, false);
}
