// main.js
(function() {
  // Basic three.js setup
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  let camera;
  let mesh;

  // Cube size in world units
  const CUBE_SIZE = 1.0;
  // Desired diagonal in screen pixels
  const DIAGONAL_PX = 500;

  function fitCameraToCube() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    const aspect = w / h;
    if (camera) scene.remove(camera);
    // Use 60 deg FOV for typical view
    const fov = 60;
    camera = new THREE.PerspectiveCamera(fov, aspect, 0.1, 100);
    // Cube diagonal in world units
    const cubeDiagonal = Math.sqrt(3) * CUBE_SIZE;
    // Use the shortest screen side for fit
    const minScreen = Math.min(w, h);
    const vFovRad = fov * Math.PI / 180;
    // Camera distance so that cube diagonal fits exactly DIAGONAL_PX on minScreen
    // Projected size: S_px = 2 * tan(fov/2) * z * (minScreen/h)
    // For centered cube, use h for vertical fit, w for horizontal fit
    // We'll use minScreen for both, so cube is always fully visible
    const z = (cubeDiagonal / 2) / Math.tan(vFovRad / 2) * (minScreen / DIAGONAL_PX);
    camera.position.set(0, 0, z);
    camera.lookAt(0, 0, 0);
    scene.add(camera);
    addCube();
  }

  function addCube() {
    if (mesh) {
      scene.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
    const geometry = new THREE.BoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE);
    const material = new THREE.MeshNormalMaterial();
    mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(0, 0, 0);
    scene.add(mesh);
  }

  window.addEventListener('resize', fitCameraToCube);
  fitCameraToCube();

  function animate() {
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  animate();
})();
