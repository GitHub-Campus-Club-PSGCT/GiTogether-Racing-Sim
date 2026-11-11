// Bakes 8-view albedo + normal impostor atlases for a glTF tree.
// Driven by scripts/bake-impostors.mjs through Playwright; exposes window.bake(url, frameSize).
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const VIEWS = 8;

const normalMaterial = (src) =>
  new THREE.ShaderMaterial({
    uniforms: {
      map: { value: src.map ?? null },
      hasMap: { value: src.map ? 1 : 0 },
      alphaTest: { value: src.alphaTest || (src.transparent ? 0.5 : 0) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec2 vUv;
      void main() { vUv = uv; vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D map; uniform float hasMap; uniform float alphaTest;
      varying vec3 vN; varying vec2 vUv;
      void main() {
        float a = hasMap > 0.5 ? texture2D(map, vUv).a : 1.0;
        if (a < max(alphaTest, 0.01)) discard;
        vec3 n = normalize(vN);
        if (!gl_FrontFacing) n = -n;
        gl_FragColor = vec4(n * 0.5 + 0.5, 1.0);
      }`,
    side: THREE.DoubleSide,
  });

const albedoMaterial = (src) =>
  new THREE.MeshBasicMaterial({
    map: src.map ?? null,
    color: src.color ?? new THREE.Color(1, 1, 1),
    alphaTest: src.alphaTest || (src.transparent ? 0.5 : 0.01),
    transparent: false,
    side: THREE.DoubleSide,
  });

window.bake = async (url, frameSize) => {
  const gltf = await new GLTFLoader().loadAsync(url);
  const root = gltf.scene;
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  root.position.set(-center.x, -box.min.y, -center.z);

  const meshes = [];
  root.traverse((o) => {
    if (o.isMesh) meshes.push({ mesh: o, src: o.material });
  });
  const albedo = new Map(meshes.map(({ src }) => [src, albedoMaterial(src)]));
  const normals = new Map(meshes.map(({ src }) => [src, normalMaterial(src)]));

  const scene = new THREE.Scene();
  scene.add(root);
  const half = Math.max(size.x, size.z, size.y) / 2;
  const camera = new THREE.OrthographicCamera(-half, half, half, -half, 0.1, half * 8);

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(frameSize, frameSize);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const atlas = (pass) => {
    const canvas = document.createElement("canvas");
    canvas.width = frameSize * VIEWS;
    canvas.height = frameSize;
    const ctx = canvas.getContext("2d");
    for (const { mesh, src } of meshes) mesh.material = (pass === "albedo" ? albedo : normals).get(src);
    renderer.outputColorSpace = pass === "albedo" ? THREE.SRGBColorSpace : THREE.LinearSRGBColorSpace;
    for (let k = 0; k < VIEWS; k++) {
      const phi = (k / VIEWS) * Math.PI * 2;
      const dist = half * 4;
      camera.position.set(Math.sin(phi) * dist, half, Math.cos(phi) * dist);
      camera.lookAt(0, half, 0);
      renderer.render(scene, camera);
      ctx.drawImage(renderer.domElement, k * frameSize, 0);
    }
    return canvas.toDataURL("image/png");
  };

  return {
    albedo: atlas("albedo"),
    normal: atlas("normal"),
    // World size of one frame and the tree's real dimensions (metres).
    frameWorld: half * 2,
    height: size.y,
    width: Math.max(size.x, size.z),
  };
};
window.bakeReady = true;
