import { useMemo, useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  createCircuitGeometries,
  samplePlacements,
  FENCE_MASK,
  BARRIER_OFFSET,
  BARRIER_HEIGHT,
  FENCE_HEIGHT,
  HALF_WIDTH,
  START_CONFIG,
  GRID,
} from "../circuitDefinition";
import {
  useSurfaceTextures,
  createAsphaltMaterial,
  createKerbMaterial,
  createRunoffMaterial,
  createBarrierMaterial,
  createFenceMaterial,
  createPaintMaterial,
} from "./materials";

function checkerTexture() {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 512;
  const g = c.getContext("2d");
  const cols = 2, rows = 16;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      g.fillStyle = (x + y) % 2 ? "#141414" : "#f2f2ee";
      g.fillRect((x * c.width) / cols, (y * c.height) / rows, c.width / cols, c.height / rows);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

// White grid boxes behind the start line (the straight runs along +X).
function gridSlotGeometry() {
  const parts = [];
  for (let k = 0; k < 8; k++) {
    const x = START_CONFIG.x - GRID.firstBox - k * GRID.spacing;
    const z = START_CONFIG.z + (k % 2 === 0 ? -GRID.offset : GRID.offset);
    const bar = new THREE.PlaneGeometry(0.16, 2.6).rotateX(-Math.PI / 2).translate(x, 0.026, z);
    const left = new THREE.PlaneGeometry(1.2, 0.12).rotateX(-Math.PI / 2).translate(x - 0.6, 0.026, z - 1.24);
    const right = new THREE.PlaneGeometry(1.2, 0.12).rotateX(-Math.PI / 2).translate(x - 0.6, 0.026, z + 1.24);
    parts.push(bar, left, right);
  }
  return mergeGeometries(parts);
}

function FencePosts() {
  const ref = useRef();
  const posts = useMemo(
    () => [0, 1].flatMap((sideIdx) =>
      samplePlacements(4, sideIdx, BARRIER_OFFSET + 0.25, (s, i) => FENCE_MASK[s][i] === 1)),
    [],
  );
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    posts.forEach((p, i) => {
      m.makeTranslation(p.x, p.y + BARRIER_HEIGHT + FENCE_HEIGHT / 2, p.z);
      ref.current.setMatrixAt(i, m);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  }, [posts]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, posts.length]} castShadow>
      <cylinderGeometry args={[0.05, 0.05, FENCE_HEIGHT, 8]} />
      <meshStandardMaterial color="#8d969e" metalness={0.8} roughness={0.35} />
    </instancedMesh>
  );
}

export default function RaceTrack() {
  const textures = useSurfaceTextures();
  const geo = useMemo(() => createCircuitGeometries(), []);
  const mats = useMemo(
    () => ({
      asphalt: createAsphaltMaterial(textures),
      kerb: createKerbMaterial(textures),
      runoff: createRunoffMaterial(textures),
      barrier: createBarrierMaterial(textures),
      fence: createFenceMaterial(),
      paint: createPaintMaterial(),
    }),
    [textures],
  );
  const checker = useMemo(() => checkerTexture(), []);
  const grid = useMemo(() => gridSlotGeometry(), []);

  return (
    <group>
      <mesh geometry={geo.roadGeom} material={mats.asphalt} receiveShadow />
      {geo.kerbs.map((g, i) => (
        <mesh key={`kerb${i}`} geometry={g} material={mats.kerb} receiveShadow />
      ))}
      {geo.runoffs.map((g, i) => (
        <mesh key={`runoff${i}`} geometry={g} material={mats.runoff} receiveShadow />
      ))}
      {geo.lines.map((g, i) => (
        <mesh key={`line${i}`} geometry={g} material={mats.paint} receiveShadow />
      ))}
      {geo.barriers.flat().map((g, i) => (
        <mesh key={`barrier${i}`} geometry={g} material={mats.barrier} castShadow receiveShadow />
      ))}
      {geo.fences.map((g, i) => (
        <mesh key={`fence${i}`} geometry={g} material={mats.fence} />
      ))}
      <FencePosts />

      {/* Start / finish line across the 14 m track */}
      <mesh
        position={[START_CONFIG.x, 0.026, START_CONFIG.z]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[1.6, HALF_WIDTH * 2]} />
        <meshStandardMaterial map={checker} roughness={0.5} polygonOffset polygonOffsetFactor={-2} />
      </mesh>
      <mesh geometry={grid} material={mats.paint} receiveShadow />
    </group>
  );
}
