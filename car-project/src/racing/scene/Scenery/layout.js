// Scenery layout as plain data. Everything is placed from the track spline and
// checked against it (see layout.test.js) so nothing can sit on the circuit.
import * as THREE from "three";
import {
  CIRCUIT_CURVE,
  CIRCUIT_LENGTH,
  BARRIER_OFFSET,
  BARRIER_THICKNESS,
  CURVATURE,
  SAMPLE_COUNT,
  SAMPLE_SPACING,
  START_CONFIG,
  projectToTrack,
} from "../../circuitDefinition";

export const CLEARANCE = BARRIER_OFFSET + BARRIER_THICKNESS + 1.5;

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Place an object beside the track. `lateral` is the distance of its front
 * face from the centreline (+ = left of travel). The object's local +Z faces the track.
 */
export function placeAlongTrack(u, lateral, { length = 0, depth = 0 } = {}) {
  const uu = ((u % 1) + 1) % 1;
  const p = CIRCUIT_CURVE.getPointAt(uu);
  const t = CIRCUIT_CURVE.getTangentAt(uu).normalize();
  const n = new THREE.Vector3(t.z, 0, -t.x);
  const side = Math.sign(lateral) || 1;
  const toward = n.clone().multiplyScalar(-side);
  // Push the object's centre back by half its depth so the front face sits at `lateral`.
  const centre = p.clone().addScaledVector(n, lateral).addScaledVector(toward, -depth / 2);
  return {
    x: centre.x,
    y: p.y,
    z: centre.z,
    rotY: Math.atan2(toward.x, toward.z),
    // Rotation that faces oncoming traffic (local +Z points against the direction of travel).
    upstreamRotY: Math.atan2(-t.x, -t.z),
    length,
    depth,
  };
}

/** Footprint outline points (world xz) of a placed box, sampled every ~2 m. */
export function footprintPoints({ x, z, rotY, length, depth }) {
  const pts = [];
  const c = Math.cos(rotY), s = Math.sin(rotY);
  const nx = Math.max(2, Math.ceil(length / 2)), nz = Math.max(2, Math.ceil(depth / 2));
  for (let i = 0; i <= nx; i++) {
    for (let j = 0; j <= nz; j++) {
      if (i > 0 && i < nx && j > 0 && j < nz) continue;
      const lx = -length / 2 + (i / nx) * length;
      const lz = -depth / 2 + (j / nz) * depth;
      pts.push({ x: x + lx * c + lz * s, z: z - lx * s + lz * c });
    }
  }
  return pts;
}

export function minTrackDistance(item) {
  return Math.min(...footprintPoints(item).map((p) => projectToTrack(p.x, p.z).absDistance));
}

const uAtX = (x) => (x >= 0 ? x / CIRCUIT_LENGTH : 1 + x / CIRCUIT_LENGTH);

// ---------------------------------------------------------------------------
// Grandstands (front face parallel to the track at the given u)
// ---------------------------------------------------------------------------
const STAND_TIERS = 12;
export const STAND_DEPTH = STAND_TIERS * 0.85 + 1.2;
/** Track progress u nearest to a world point. */
const uAt = (x, z) => projectToTrack(x, z).u;
/** +1 / -1: the side on the outside of the corner at u. */
const outside = (u) => {
  const i = Math.round(u * SAMPLE_COUNT) % SAMPLE_COUNT;
  return -Math.sign(CURVATURE[i]) || 1;
};

export const GRANDSTANDS = [
  { id: "main-a", u: uAtX(-22), lateral: -20, length: 58, scheme: 0 },
  { id: "main-b", u: uAtX(46), lateral: -20, length: 58, scheme: 1 },
  { id: "hairpin", u: uAt(300, 140), lateral: outside(uAt(300, 140)) * 23, length: 40, scheme: 2 },
  // Outside the left at the bottom of the compression, looking up the climb.
  { id: "compression", u: uAt(202, 441), lateral: outside(uAt(202, 441)) * 26, length: 44, scheme: 0 },
  { id: "chicane", u: uAt(310, 1215), lateral: 24, length: 40, scheme: 1 },
  { id: "double-left", u: uAt(-200, 1420), lateral: outside(uAt(-200, 1420)) * 23, length: 46, scheme: 2 },
  { id: "bus-stop", u: uAt(-330, 260), lateral: 22, length: 40, scheme: 0 },
].map((g) => {
  // Step outward from the preferred distance until the whole footprint clears the circuit.
  const side = Math.sign(g.lateral);
  for (let d = Math.abs(g.lateral); d < Math.abs(g.lateral) + 40; d += 1) {
    const placed = { ...g, lateral: side * d, tiers: STAND_TIERS, ...placeAlongTrack(g.u, side * d, { length: g.length, depth: STAND_DEPTH }) };
    if (minTrackDistance(placed) > CLEARANCE + 1) return placed;
  }
  throw new Error(`No clear spot for grandstand ${g.id}`);
});

// ---------------------------------------------------------------------------
// Pit complex on the main-straight infield (the straight runs along +X at z = 100)
// ---------------------------------------------------------------------------
const straightZ = START_CONFIG.z;
export const PIT = {
  laneFront: straightZ - BARRIER_OFFSET - BARRIER_THICKNESS, // z of the barrier back face
  laneBack: straightZ - 26, // z of the building front
  xStart: -44,
  xEnd: 92,
  building: { x: 22, z: straightZ - 26 - 8, rotY: 0, length: 120, depth: 16 },
  control: { x: -50, z: straightZ - 26 - 9, rotY: 0, length: 14, depth: 14 },
  paddock: { xMin: -62, xMax: 100, zMin: 22, zMax: straightZ - 42 },
};
export const MOTORHOMES = (() => {
  const out = [];
  for (let r = 0; r < 2; r++) {
    for (let i = 0; i < 6; i++) {
      out.push({ x: -36 + i * 22, z: 50 - r * 18, rotY: 0, length: 15, depth: 5, team: (i + r * 3) % 6 });
    }
  }
  return out;
})();

// ---------------------------------------------------------------------------
// Brake boards before the slow corners, floodlights, marshal posts
// ---------------------------------------------------------------------------
export const BRAKE_BOARDS = (() => {
  const boards = [];
  const k = Array.from(CURVATURE, Math.abs);
  for (let i = 0; i < SAMPLE_COUNT; i++) {
    const prev = k[(i - 1 + SAMPLE_COUNT) % SAMPLE_COUNT];
    // Corner entry: curvature crosses 1/70 m⁻¹ going up.
    if (k[i] > 1 / 70 && prev <= 1 / 70) {
      const sign = Math.sign(CURVATURE[i]);
      for (const d of [150, 100, 50]) {
        const idx = (i - Math.round(d / SAMPLE_SPACING) + SAMPLE_COUNT) % SAMPLE_COUNT;
        // Boards go on the outside of the coming corner.
        boards.push({ distance: d, ...placeAlongTrack(idx / SAMPLE_COUNT, -sign * (BARRIER_OFFSET + 2.2)) });
      }
    }
  }
  return boards;
})();

function spaced(count, lateralFn, filter) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const u = (i + 0.5) / count;
    const lateral = lateralFn(i);
    const p = placeAlongTrack(u, lateral, { length: 2, depth: 2 });
    if (!filter || filter(p)) out.push(p);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Exclusion zones (for scatter): buildings, stands, paddock.
// ---------------------------------------------------------------------------
const PAD = 6;
export const EXCLUSIONS = [
  ...GRANDSTANDS,
  PIT.building,
  PIT.control,
  {
    x: (PIT.paddock.xMin + PIT.paddock.xMax) / 2,
    z: (PIT.paddock.zMin + PIT.paddock.zMax) / 2,
    rotY: 0,
    length: PIT.paddock.xMax - PIT.paddock.xMin,
    depth: PIT.paddock.zMax - PIT.paddock.zMin,
  },
];

export function inExclusion(x, z, pad = PAD) {
  for (const e of EXCLUSIONS) {
    const c = Math.cos(e.rotY), s = Math.sin(e.rotY);
    const dx = x - e.x, dz = z - e.z;
    const lx = dx * c - dz * s;
    const lz = dx * s + dz * c;
    if (Math.abs(lx) < e.length / 2 + pad && Math.abs(lz) < e.depth / 2 + pad) return true;
  }
  return false;
}

export const FLOODLIGHTS = spaced(44, (i) => (i % 2 ? 1 : -1) * (BARRIER_OFFSET + 7), (p) => !inExclusion(p.x, p.z, 3));
export const MARSHAL_POSTS = spaced(20, () => -(BARRIER_OFFSET + 3.2), (p) => !inExclusion(p.x, p.z, 2));

// Trees are placed in scene/world/worldBuild.js (built off the main thread).
