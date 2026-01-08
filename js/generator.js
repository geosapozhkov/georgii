// 3D Generator with metallic petals
// THREE is loaded from CDN
console.log('🎨 3D Generator v2.0 loaded - Metallic Petals Generator');
let scene, camera, renderer, controls;
let petals = [];
let petalGroup;
let light1, light2, light3;

// Parameters
let params = {
  petalCount: 6,
  petalLength: 1.5,
  petalRotation: 0,
  metalness: 0.9,
  roughness: 0.1,
  cameraDistance: 15
};

// Initialize the 3D scene
function init() {
  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xFAFAFA);

  // Camera
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(0, 0, params.cameraDistance);

  // Renderer
  const container = document.getElementById('canvas-container');
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  // Orbit Controls
  // In r128, OrbitControls is available globally after loading the script
  try {
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 5;
    controls.maxDistance = 30;
    controls.enablePan = false;
  } catch (e) {
    console.error('Error initializing OrbitControls:', e);
    console.log('THREE object:', THREE);
    console.log('Available controls:', Object.keys(THREE).filter(k => k.includes('Control')));
    // Continue without controls - user can still see the 3D scene
  }

  // Lighting - multiple lights for metallic reflections
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
  scene.add(ambientLight);

  // Main directional light
  light1 = new THREE.DirectionalLight(0xffffff, 0.8);
  light1.position.set(5, 10, 5);
  light1.castShadow = true;
  light1.shadow.mapSize.width = 2048;
  light1.shadow.mapSize.height = 2048;
  scene.add(light1);

  // Additional lights for metallic highlights
  light2 = new THREE.DirectionalLight(0xffffff, 0.5);
  light2.position.set(-5, 5, -5);
  scene.add(light2);

  light3 = new THREE.PointLight(0xffffff, 0.6);
  light3.position.set(0, 10, 0);
  scene.add(light3);

  // Create petal group
  petalGroup = new THREE.Group();
  scene.add(petalGroup);

  // Create petals
  createPetals();

  // Setup controls
  setupControls();

  // Handle window resize
  window.addEventListener('resize', onWindowResize);

  // Start animation loop
  animate();
}

// Create rounded petal shape
function createPetalShape(length, width = 0.3) {
  const shape = new THREE.Shape();
  
  // Create a smooth, rounded petal shape using curves
  const points = 32;
  
  // Start from the tip (top)
  shape.moveTo(0, -length);
  
  // Create smooth curve for the right side
  for (let i = 1; i <= points / 2; i++) {
    const t = i / (points / 2);
    const angle = t * Math.PI;
    
    // Smooth petal shape: wider at base, narrow at tip
    // Use easing function for smoother curve
    const ease = 1 - Math.pow(1 - t, 3);
    const x = Math.sin(angle) * width * (1 - ease * 0.3);
    const y = -Math.cos(angle) * length;
    
    shape.lineTo(x, y);
  }
  
  // Create smooth curve for the left side
  for (let i = points / 2 - 1; i >= 0; i--) {
    const t = i / (points / 2);
    const angle = t * Math.PI;
    
    const ease = 1 - Math.pow(1 - t, 3);
    const x = -Math.sin(angle) * width * (1 - ease * 0.3);
    const y = -Math.cos(angle) * length;
    
    shape.lineTo(x, y);
  }
  
  // Close the shape back to tip
  shape.lineTo(0, -length);
  
  return shape;
}

// Create a single petal geometry
function createPetalGeometry(length, width = 0.3) {
  const shape = createPetalShape(length, width);
  
  // Extrude the shape to create 3D petal with rounded edges
  const extrudeSettings = {
    depth: 0.15,
    bevelEnabled: true,
    bevelThickness: 0.08,
    bevelSize: 0.08,
    bevelSegments: 12,
    curveSegments: 64
  };
  
  const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  
  // Center the geometry
  geometry.center();
  
  // Smooth the geometry for better appearance
  geometry.computeVertexNormals();
  
  return geometry;
}

// Create all petals
function createPetals() {
  // Clear existing petals
  petals.forEach(petal => {
    petalGroup.remove(petal);
    petal.geometry.dispose();
    petal.material.dispose();
  });
  petals = [];

  // Create metallic material with reflections
  const material = new THREE.MeshStandardMaterial({
    color: 0xcccccc,
    metalness: params.metalness,
    roughness: params.roughness
  });
  
  // Create environment map for metallic reflections
  try {
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color(0xffffff);
    const envLight = new THREE.AmbientLight(0xffffff, 1.0);
    envScene.add(envLight);
    
    const envMap = pmremGenerator.fromScene(envScene, 0.04).texture;
    material.envMap = envMap;
    material.needsUpdate = true;
    
    pmremGenerator.dispose();
  } catch (e) {
    console.warn('Could not create environment map:', e);
  }

  // Create petals
  const angleStep = (Math.PI * 2) / params.petalCount;
  
  for (let i = 0; i < params.petalCount; i++) {
    const geometry = createPetalGeometry(params.petalLength, 0.3);
    const petal = new THREE.Mesh(geometry, material.clone());
    
    // Position petal in a circle
    const angle = i * angleStep;
    petal.position.x = Math.cos(angle) * 1.5;
    petal.position.z = Math.sin(angle) * 1.5;
    
    // Rotate petal to face outward
    petal.rotation.y = angle + Math.PI / 2;
    
    // Store initial rotation
    petal.userData.initialRotation = petal.rotation.y;
    
    petal.castShadow = true;
    petal.receiveShadow = true;
    
    petalGroup.add(petal);
    petals.push(petal);
  }

  // Add central core
  const coreGeometry = new THREE.SphereGeometry(0.3, 32, 32);
  const coreMaterial = material.clone();
  const core = new THREE.Mesh(coreGeometry, coreMaterial);
  core.castShadow = true;
  core.receiveShadow = true;
  petalGroup.add(core);
}

// Update petal rotation
function updatePetalRotation() {
  petals.forEach((petal, index) => {
    const angleStep = (Math.PI * 2) / params.petalCount;
    const angle = index * angleStep;
    petal.rotation.y = angle + Math.PI / 2 + (params.petalRotation * Math.PI / 180);
  });
}

// Update petal length
function updatePetalLength() {
  petals.forEach(petal => {
    petalGroup.remove(petal);
    petal.geometry.dispose();
    petal.material.dispose();
  });
  petals = [];

  const material = new THREE.MeshStandardMaterial({
    color: 0xcccccc,
    metalness: params.metalness,
    roughness: params.roughness
  });
  
  // Create environment map for reflections
  try {
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color(0xffffff);
    const envLight = new THREE.AmbientLight(0xffffff, 1.0);
    envScene.add(envLight);
    
    const envMap = pmremGenerator.fromScene(envScene, 0.04).texture;
    material.envMap = envMap;
    material.needsUpdate = true;
    
    pmremGenerator.dispose();
  } catch (e) {
    console.warn('Could not create environment map:', e);
  }

  const angleStep = (Math.PI * 2) / params.petalCount;
  
  for (let i = 0; i < params.petalCount; i++) {
    const geometry = createPetalGeometry(params.petalLength, 0.3);
    const petal = new THREE.Mesh(geometry, material.clone());
    
    const angle = i * angleStep;
    petal.position.x = Math.cos(angle) * 1.5;
    petal.position.z = Math.sin(angle) * 1.5;
    petal.rotation.y = angle + Math.PI / 2 + (params.petalRotation * Math.PI / 180);
    
    petal.castShadow = true;
    petal.receiveShadow = true;
    
    petalGroup.add(petal);
    petals.push(petal);
  }
}

// Update material properties
function updateMaterial() {
  petals.forEach(petal => {
    petal.material.metalness = params.metalness;
    petal.material.roughness = params.roughness;
    petal.material.needsUpdate = true;
  });
  
  // Update core material too
  const core = petalGroup.children.find(child => child.geometry.type === 'SphereGeometry');
  if (core) {
    core.material.metalness = params.metalness;
    core.material.roughness = params.roughness;
    core.material.needsUpdate = true;
  }
}

// Setup UI controls
function setupControls() {
  // Camera distance
  const cameraDistanceSlider = document.getElementById('camera-distance');
  const cameraDistanceValue = document.getElementById('camera-distance-value');
  cameraDistanceSlider.addEventListener('input', (e) => {
    params.cameraDistance = parseFloat(e.target.value);
    cameraDistanceValue.textContent = params.cameraDistance;
    camera.position.setLength(params.cameraDistance);
  });

  // Petal count
  const petalCountSlider = document.getElementById('petal-count');
  const petalCountValue = document.getElementById('petal-count-value');
  petalCountSlider.addEventListener('input', (e) => {
    params.petalCount = parseInt(e.target.value);
    petalCountValue.textContent = params.petalCount;
    createPetals();
    updatePetalRotation();
  });

  // Petal length
  const petalLengthSlider = document.getElementById('petal-length');
  const petalLengthValue = document.getElementById('petal-length-value');
  petalLengthSlider.addEventListener('input', (e) => {
    params.petalLength = parseFloat(e.target.value);
    petalLengthValue.textContent = params.petalLength;
    updatePetalLength();
  });

  // Petal rotation
  const petalRotationSlider = document.getElementById('petal-rotation');
  const petalRotationValue = document.getElementById('petal-rotation-value');
  petalRotationSlider.addEventListener('input', (e) => {
    params.petalRotation = parseFloat(e.target.value);
    petalRotationValue.textContent = params.petalRotation + '°';
    updatePetalRotation();
  });

  // Metalness
  const metalnessSlider = document.getElementById('metalness');
  const metalnessValue = document.getElementById('metalness-value');
  metalnessSlider.addEventListener('input', (e) => {
    params.metalness = parseFloat(e.target.value);
    metalnessValue.textContent = params.metalness.toFixed(2);
    updateMaterial();
  });

  // Roughness
  const roughnessSlider = document.getElementById('roughness');
  const roughnessValue = document.getElementById('roughness-value');
  roughnessSlider.addEventListener('input', (e) => {
    params.roughness = parseFloat(e.target.value);
    roughnessValue.textContent = params.roughness.toFixed(2);
    updateMaterial();
  });

  // Reset camera
  const resetCameraBtn = document.getElementById('reset-camera');
  resetCameraBtn.addEventListener('click', () => {
    camera.position.set(0, 0, params.cameraDistance);
    controls.reset();
  });
}

// Handle window resize
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  
  if (controls) {
    controls.update();
  }
  
  // Rotate the entire petal group slowly
  if (petalGroup) {
    petalGroup.rotation.y += 0.005;
  }
  
  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
}

// Initialize custom cursor (if exists)
function initCustomCursor() {
  const cursor = document.getElementById('custom-cursor');
  if (!cursor) return;

  let mouseX = 0, mouseY = 0;
  let cursorX = 0, cursorY = 0;

  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });

  function updateCursor() {
    cursorX += (mouseX - cursorX) * 0.1;
    cursorY += (mouseY - cursorY) * 0.1;
    cursor.style.left = cursorX + 'px';
    cursor.style.top = cursorY + 'px';
    requestAnimationFrame(updateCursor);
  }
  updateCursor();
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    init();
    initCustomCursor();
  });
} else {
  init();
  initCustomCursor();
}

