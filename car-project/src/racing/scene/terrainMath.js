// Terrain height field. Near the circuit the ground follows the road height
// exactly; further out it blends into a smoothed version of the circuit's
// elevation, then rolling hills. The pit and paddock area is kept flat.
import { CIRCUIT_CURVE, projectToTrack } from "../circuitDefinition";

function hash(x, y) {
  const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return h - Math.floor(h);
}
function vnoise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}
export function fbm(x, y, octaves = 5) {
  let s = 0, a = 0.5;
  for (let i = 0; i < octaves; i++) {
    s += a * vnoise(x, y);
    x = x * 2.03 + 17.1;
    y = y * 2.03 + 5.3;
    a *= 0.5;
  }
  return s;
}
const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export const FLAT_RADIUS = 62;
export const TERRAIN_DROP = 0.06; // ground sits this far below the road surface

// World extent covered by the terrain (and the smoothed height grid).
const box = (() => {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < 400; i++) {
    const p = CIRCUIT_CURVE.getPointAt(i / 400);
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z);
    maxZ = Math.max(maxZ, p.z);
  }
  return { minX, maxX, minZ, maxZ };
})();
export const TERRAIN_CENTER = { x: (box.minX + box.maxX) / 2, z: (box.minZ + box.maxZ) / 2 };
export const TERRAIN_SIZE = Math.ceil((Math.max(box.maxX - box.minX, box.maxZ - box.minZ) + 2400) / 100) * 100;

// Pit lane, pit building and paddock: kept perfectly flat at road level.
const PADDOCK = { minX: -75, maxX: 112, minZ: 12, maxZ: 100 };
function paddockMask(x, z) {
  const dx = Math.max(PADDOCK.minX - x, 0, x - PADDOCK.maxX);
  const dz = Math.max(PADDOCK.minZ - z, 0, z - PADDOCK.maxZ);
  return 1 - smoothstep(0, 40, Math.hypot(dx, dz));
}

// Smoothed circuit elevation on a coarse grid (built once, on first use).
const CELL = 16;
let grid = null;
/** Build the smoothed elevation grid now (optional progress callback, 0..1). */
export function prepareTerrainGrid(onProgress) {
  if (!grid) buildGrid(onProgress);
}
function buildGrid(onProgress) {
  const n = Math.ceil(TERRAIN_SIZE / CELL) + 1;
  const x0 = TERRAIN_CENTER.x - TERRAIN_SIZE / 2;
  const z0 = TERRAIN_CENTER.z - TERRAIN_SIZE / 2;
  let h = new Float32Array(n * n);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) h[j * n + i] = projectToTrack(x0 + i * CELL, z0 + j * CELL).height;
    if (onProgress && j % 8 === 0) onProgress((j / n) * 0.85);
  }
  // Box blur, a few passes, so neighbouring sections at different heights blend smoothly.
  const r = 4;
  for (let pass = 0; pass < 3; pass++) {
    const out = new Float32Array(n * n);
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        let sum = 0, cnt = 0;
        for (let k = -r; k <= r; k++) {
          const ii = Math.min(n - 1, Math.max(0, i + k));
          sum += h[j * n + ii];
          cnt++;
        }
        out[j * n + i] = sum / cnt;
      }
    }
    const out2 = new Float32Array(n * n);
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        let sum = 0, cnt = 0;
        for (let k = -r; k <= r; k++) {
          const jj = Math.min(n - 1, Math.max(0, j + k));
          sum += out[jj * n + i];
          cnt++;
        }
        out2[j * n + i] = sum / cnt;
      }
    }
    h = out2;
  }
  grid = { n, x0, z0, h };
}

function smoothBase(x, z) {
  if (!grid) buildGrid();
  const { n, x0, z0, h } = grid;
  const gx = Math.min(n - 1.001, Math.max(0, (x - x0) / CELL));
  const gz = Math.min(n - 1.001, Math.max(0, (z - z0) / CELL));
  const i = Math.floor(gx), j = Math.floor(gz);
  const fx = gx - i, fz = gz - j;
  const a = h[j * n + i], b = h[j * n + i + 1], c = h[(j + 1) * n + i], d = h[(j + 1) * n + i + 1];
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
}

/** Ground height at (x, z), given the projection of that point onto the circuit. */
export function terrainHeightFromProjection(x, z, proj) {
  const dist = proj.absDistance;
  // Exact road height close to the circuit, smoothed elevation further out.
  const near = 1 - smoothstep(20, 32, dist);
  const base = near * proj.height + (1 - near) * smoothBase(x, z);
  const hills = (fbm(x / 430 + 3.1, z / 430 - 1.7) - 0.42) * 85 + (fbm(x / 120, z / 120) - 0.5) * 12;
  const mask = smoothstep(FLAT_RADIUS, 190, dist) * (1 - paddockMask(x, z));
  return base - TERRAIN_DROP + Math.max(hills, -3) * mask;
}

export function terrainHeight(x, z) {
  return terrainHeightFromProjection(x, z, projectToTrack(x, z));
}
