import { useMemo } from "react";
import * as THREE from "three";
import { CIRCUIT_CURVE, BARRIER_OFFSET } from "../circuitDefinition";
import { TERRAIN_CENTER, TERRAIN_SIZE } from "./terrainMath";
import { useWorld } from "./world/worldResource";
import { useSurfaceTextures, createTerrainMaterial } from "./materials";

const SIZE = TERRAIN_SIZE;

function terrainGeometry(data) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(data.positions, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(data.normals, 3));
  g.setAttribute("uv", new THREE.BufferAttribute(data.uvs, 2));
  g.setAttribute("aMow", new THREE.BufferAttribute(data.mow, 1));
  g.setIndex(new THREE.BufferAttribute(data.indices, 1));
  g.computeBoundingSphere();
  return g;
}

// Top-down mask of the track corridor (well inside the barriers; the runoff and
// barrier skirts cover the rest). Terrain fragments inside it are discarded.
const MASK_PX = 2048;
const CORRIDOR = BARRIER_OFFSET - 1.7;

function buildTrackMask() {
  const x0 = TERRAIN_CENTER.x - SIZE / 2;
  const z0 = TERRAIN_CENTER.z - SIZE / 2;
  const scale = MASK_PX / SIZE;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = MASK_PX;
  const g = canvas.getContext("2d");
  g.fillStyle = "#000";
  g.fillRect(0, 0, MASK_PX, MASK_PX);
  g.strokeStyle = "#fff";
  g.lineWidth = CORRIDOR * 2 * scale;
  g.lineJoin = "round";
  g.lineCap = "round";
  g.beginPath();
  const n = 3000;
  for (let i = 0; i <= n; i++) {
    const p = CIRCUIT_CURVE.getPointAt((i / n) % 1);
    const px = (p.x - x0) * scale;
    const pz = (p.z - z0) * scale;
    if (i === 0) g.moveTo(px, pz);
    else g.lineTo(px, pz);
  }
  g.closePath();
  g.stroke();
  const texture = new THREE.CanvasTexture(canvas);
  texture.flipY = false;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.colorSpace = THREE.NoColorSpace;
  return { texture, x0, z0, size: SIZE };
}

export default function Terrain() {
  const textures = useSurfaceTextures();
  const world = useWorld();
  const geometry = useMemo(() => terrainGeometry(world.terrain), [world]);
  const mask = useMemo(() => buildTrackMask(), []);
  const material = useMemo(() => createTerrainMaterial(textures, mask), [textures, mask]);
  return <mesh geometry={geometry} material={material} receiveShadow />;
}
