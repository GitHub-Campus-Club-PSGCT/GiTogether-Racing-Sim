// Heavy world data (terrain heights + normals, tree placement), as plain typed
// arrays. Pure: no DOM, no React, so it runs inside a Web Worker at startup and
// in tests. Takes ~2 s of CPU, which must stay off the main thread.
import * as THREE from "three";
import { projectToTrack } from "../../circuitDefinition";
import { terrainHeightFromProjection, prepareTerrainGrid, fbm, TERRAIN_CENTER, TERRAIN_SIZE } from "../terrainMath";
import { inExclusion, mulberry32 } from "../Scenery/layout";

export const TERRAIN_SEGMENTS = Math.round(TERRAIN_SIZE / 12);
export const TREE_STRIDE = 6; // x, y, z, scale, yaw, type

export function buildTerrainData(onProgress) {
  const seg = TERRAIN_SEGMENTS;
  const n = seg + 1;
  const step = TERRAIN_SIZE / seg;
  const x0 = TERRAIN_CENTER.x - TERRAIN_SIZE / 2;
  const z0 = TERRAIN_CENTER.z - TERRAIN_SIZE / 2;
  const positions = new Float32Array(n * n * 3);
  const uvs = new Float32Array(n * n * 2);
  const mow = new Float32Array(n * n);
  const heights = new Float32Array(n * n);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = x0 + i * step;
      const z = z0 + j * step;
      const proj = projectToTrack(x, z);
      const k = j * n + i;
      const h = terrainHeightFromProjection(x, z, proj);
      heights[k] = h;
      positions[k * 3] = x;
      positions[k * 3 + 1] = h;
      positions[k * 3 + 2] = z;
      uvs[k * 2] = x / 5;
      uvs[k * 2 + 1] = z / 5;
      mow[k] = 1 - THREE.MathUtils.smoothstep(proj.absDistance, 30, 95);
    }
    if (onProgress && j % 12 === 0) onProgress(j / n);
  }
  // Normals from central differences on the height grid (cheap, and done here
  // so the main thread doesn't have to run computeVertexNormals).
  const normals = new Float32Array(n * n * 3);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const hl = heights[j * n + Math.max(0, i - 1)];
      const hr = heights[j * n + Math.min(n - 1, i + 1)];
      const hd = heights[Math.max(0, j - 1) * n + i];
      const hu = heights[Math.min(n - 1, j + 1) * n + i];
      const nx = hl - hr;
      const nz = hd - hu;
      const ny = 2 * step;
      const len = Math.hypot(nx, ny, nz);
      const k = (j * n + i) * 3;
      normals[k] = nx / len;
      normals[k + 1] = ny / len;
      normals[k + 2] = nz / len;
    }
  }
  const indices = new Uint32Array(seg * seg * 6);
  let p = 0;
  for (let j = 0; j < seg; j++) {
    for (let i = 0; i < seg; i++) {
      const a = j * n + i;
      indices.set([a, a + n, a + 1, a + 1, a + n, a + n + 1], p);
      p += 6;
    }
  }
  return { positions, normals, uvs, mow, indices };
}

/** Forest clumps on the hills, scattered parkland near the circuit. */
export function computeTrees(onProgress) {
  const rand = mulberry32(1337);
  const trees = [];
  const spacing = 19;
  const extent = TERRAIN_SIZE / 2 - 60;
  for (let gx = TERRAIN_CENTER.x - extent; gx <= TERRAIN_CENTER.x + extent; gx += spacing) {
    if (onProgress) onProgress((gx - (TERRAIN_CENTER.x - extent)) / (2 * extent));
    for (let gz = TERRAIN_CENTER.z - extent; gz <= TERRAIN_CENTER.z + extent; gz += spacing) {
      const x = gx + (rand() - 0.5) * spacing * 0.9;
      const z = gz + (rand() - 0.5) * spacing * 0.9;
      const proj = projectToTrack(x, z);
      const dist = proj.absDistance;
      if (dist < 28 || inExclusion(x, z)) continue;
      const forest = fbm(x / 190 + 7.3, z / 190 - 2.1, 4);
      const nearBand = dist < 70 ? 0.18 : 0;
      const density = THREE.MathUtils.smoothstep(forest, 0.5, 0.66) * THREE.MathUtils.smoothstep(dist, 40, 220) + nearBand;
      if (rand() > density) continue;
      const type = rand() < 0.65 ? 0 : 1;
      trees.push({
        x,
        z,
        y: terrainHeightFromProjection(x, z, proj) - 0.2,
        scale: (type === 0 ? 2.2 : 2.6) * (0.8 + rand() * 0.45),
        yaw: rand() * Math.PI * 2,
        type,
      });
    }
  }
  return trees;
}

export function packTrees(trees) {
  const out = new Float32Array(trees.length * TREE_STRIDE);
  trees.forEach((t, i) => out.set([t.x, t.y, t.z, t.scale, t.yaw, t.type], i * TREE_STRIDE));
  return out;
}

/** onProgress(0..1) is called as the build runs: grid 25%, terrain 50%, trees 25%. */
export function buildWorld(onProgress = () => {}) {
  prepareTerrainGrid((p) => onProgress(0.25 * p));
  onProgress(0.25);
  const terrain = buildTerrainData((p) => onProgress(0.25 + 0.5 * p));
  const trees = packTrees(computeTrees((p) => onProgress(0.75 + 0.25 * p)));
  onProgress(1);
  return { terrain, trees };
}

/** Typed-array buffers to transfer (zero-copy) when posting from a worker. */
export function worldTransferables(world) {
  const t = world.terrain;
  return [t.positions.buffer, t.normals.buffer, t.uvs.buffer, t.mow.buffer, t.indices.buffer, world.trees.buffer];
}
