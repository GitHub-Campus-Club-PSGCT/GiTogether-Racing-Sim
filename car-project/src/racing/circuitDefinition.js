// =============================================================================
// CIRCUIT ARCHITECTURE & DEFINITION (SINGLE SOURCE OF TRUTH)
// =============================================================================
// All track geometry, kerbs, runoff areas, collision boundaries, and lap
// checkpoints derive from this single underlying circuit curve.
// =============================================================================

import * as THREE from "three";

// 1. Control points (x, height, z) of the circuit: an original ~4.7 km layout
// with Spa-like character — hairpin, a climbing left-right-left esses, a long
// uphill straight, fast downhill sweepers, a flowing infield and a bus-stop
// chicane. The start straight stays flat along +X at z = 100 for the pit complex.
export const CIRCUIT_POINTS = [
  new THREE.Vector3(0, 0, 100), // 0: Start / finish line
  new THREE.Vector3(117.0, 0, 100), // 1
  new THREE.Vector3(221.0, 0, 100), // 2: End of the start straight
  new THREE.Vector3(265, 0, 104), // 3
  new THREE.Vector3(288, -0.5, 130), // 4: Hairpin (T1)
  new THREE.Vector3(280, -1, 162), // 5
  new THREE.Vector3(252, -2, 180), // 6
  new THREE.Vector3(222, -5, 218), // 7
  new THREE.Vector3(183.6, -12, 297.2), // 8
  new THREE.Vector3(152.3, -17, 358.4), // 9: Downhill run
  new THREE.Vector3(138.7, -19, 406.0), // 10: Esses: compression at the bottom
  new THREE.Vector3(154, -17.5, 442), // 11: Esses: left
  new THREE.Vector3(143, -14, 481), // 12: Esses: right
  new THREE.Vector3(162, -9.5, 522), // 13: Esses: left, climbing
  new THREE.Vector3(179.5, -5, 576.0), // 14: Crest, onto the long uphill straight
  new THREE.Vector3(224.4, 3, 752.8), // 15
  new THREE.Vector3(272.0, 12, 956.8), // 16
  new THREE.Vector3(310.1, 18, 1133.6), // 17: Top of the hill
  new THREE.Vector3(321.0, 19, 1188.0), // 18
  new THREE.Vector3(304.6, 19, 1228.8), // 19: Chicane
  new THREE.Vector3(326.4, 18, 1272.3), // 20
  new THREE.Vector3(350.9, 15, 1337.6), // 21
  new THREE.Vector3(333.2, 12, 1405.6), // 22: Long right, descending
  new THREE.Vector3(278.8, 9, 1439.6), // 23
  new THREE.Vector3(217.6, 7, 1426.0), // 24
  new THREE.Vector3(108.8, 3, 1392.0), // 25
  new THREE.Vector3(-27.2, -2, 1378.4), // 26: Fast downhill run west
  new THREE.Vector3(-149.6, -6, 1398.8), // 27
  new THREE.Vector3(-231.2, -8, 1453.2), // 28: Double left
  new THREE.Vector3(-278.8, -9, 1528.0), // 29
  new THREE.Vector3(-292.4, -10, 1602.8), // 30
  new THREE.Vector3(-326.4, -11, 1657.2), // 31: Long right at the far end
  new THREE.Vector3(-394.4, -12, 1670.8), // 32
  new THREE.Vector3(-448.8, -11, 1630.0), // 33
  new THREE.Vector3(-476.0, -9, 1555.2), // 34
  new THREE.Vector3(-492, -6, 1440), // 35: Fast sweep north
  new THREE.Vector3(-480, -4, 1300), // 36
  new THREE.Vector3(-430, -3, 1180), // 37
  new THREE.Vector3(-350, -2, 1110), // 38: Into the infield
  new THREE.Vector3(-262, -1, 1072), // 39
  new THREE.Vector3(-208, 0, 1028), // 40
  new THREE.Vector3(-196, 0, 962), // 41: Infield left
  new THREE.Vector3(-226, 0, 898), // 42
  new THREE.Vector3(-300, 0, 852), // 43
  new THREE.Vector3(-380, 0, 792), // 44: Right onto the back straight
  new THREE.Vector3(-420, 0, 700), // 45
  new THREE.Vector3(-412, 0, 560), // 46
  new THREE.Vector3(-382, 0, 420), // 47
  new THREE.Vector3(-346, 0, 300), // 48
  new THREE.Vector3(-322, 0, 214), // 49: Bus-stop chicane
  new THREE.Vector3(-300, 0, 168), // 50
  new THREE.Vector3(-270, 0, 150), // 51
  new THREE.Vector3(-252, 0, 126), // 52
  new THREE.Vector3(-224, 0, 106), // 53
  new THREE.Vector3(-150, 0, 100), // 54
  new THREE.Vector3(-70, 0, 100), // 55: Run onto the start straight
];

// Closed 3D Catmull-Rom spline with centripetal parameterization for smooth curvature
export const CIRCUIT_CURVE = new THREE.CatmullRomCurve3(
  CIRCUIT_POINTS,
  true,
  "centripetal"
);

export const CIRCUIT_LENGTH = CIRCUIT_CURVE.getLength(); // ~4.69 km

// Track dimensional standards
export const TRACK_WIDTH = 14.0;          // Clean tarmac width (7.0m each side)
export const HALF_WIDTH = TRACK_WIDTH / 2;
export const KERB_WIDTH = 1.2;           // Red-and-white 3D kerbs
export const RUNOFF_WIDTH = 4.0;         // Runoff apron (asphalt/gravel)
export const BARRIER_OFFSET = 12.2;      // Collision barrier boundary (12.2m from center)

// Start grid configuration
export const START_CONFIG = {
  x: 0,
  y: 0,
  z: 100,
  yaw: -Math.PI / 2, // Facing +X direction down the Main Straight
  forwardX: 1,
  forwardZ: 0,
};

// Grid boxes painted behind the line (the straight runs along +X). Box k's front bar is
// at x = START_CONFIG.x - firstBox - k * spacing, alternating sides of the centreline.
export const GRID = { firstBox: 9, spacing: 8, offset: 2.6 };

// Where the car starts a session: in pole box, nose (2.86 m ahead of the car's centre)
// just behind the box's front bar, so the car crosses the line after lights out.
export const GRID_START = {
  x: START_CONFIG.x - GRID.firstBox - 3.2,
  z: START_CONFIG.z - GRID.offset,
  yaw: START_CONFIG.yaw,
};

// Checkpoint gates around the track for 100% reliable lap validation
export const CHECKPOINTS = [
  { id: 0, u: 0.00, name: "Start/Finish" },
  { id: 1, u: 0.15, name: "Turn 1" },
  { id: 2, u: 0.28, name: "Turn 3 Apex" },
  { id: 3, u: 0.40, name: "Esses Complex" },
  { id: 4, u: 0.55, name: "Back Straight DRS" },
  { id: 5, u: 0.70, name: "Turn 6 Hairpin" },
  { id: 6, u: 0.82, name: "Infield Chicane" },
  { id: 7, u: 0.94, name: "Final Corner" },
];

// ─────────────────────────────────────────────────────────────────────────────
// PRECOMPUTED TRACK SAMPLING FOR PROJECTION & COLLISION (windowed search)
// ─────────────────────────────────────────────────────────────────────────────

// One sample every ~1.25 m.
const N_SAMPLES = Math.round(CIRCUIT_LENGTH / 1.25);
const centerlineSamples = [];
const tangents = [];
const normals = [];

for (let i = 0; i <= N_SAMPLES; i++) {
  const u = (i / N_SAMPLES) % 1;
  const pt = CIRCUIT_CURVE.getPointAt(u);
  const tan = CIRCUIT_CURVE.getTangentAt(u).normalize();
  // Normal is horizontal and perpendicular to the tangent: (tan.z, 0, -tan.x). Points left.
  const norm = new THREE.Vector3(tan.z, 0, -tan.x).normalize();

  centerlineSamples.push(pt);
  tangents.push(tan);
  normals.push(norm);
}

// Gradient (rise over horizontal run) at each sample.
export const GRADE = Float32Array.from({ length: N_SAMPLES }, (_, i) => {
  const t = tangents[i];
  return t.y / Math.max(Math.hypot(t.x, t.z), 1e-6);
});

// Spatial hash of samples, so full nearest-sample searches stay fast on a big circuit.
const HASH_CELL = 20;
const sampleHash = new Map();
for (let i = 0; i < N_SAMPLES; i++) {
  const p = centerlineSamples[i];
  const key = `${Math.floor(p.x / HASH_CELL)},${Math.floor(p.z / HASH_CELL)}`;
  let list = sampleHash.get(key);
  if (!list) sampleHash.set(key, (list = []));
  list.push(i);
}

function nearestSampleGlobal(x, z) {
  const cx = Math.floor(x / HASH_CELL);
  const cz = Math.floor(z / HASH_CELL);
  let best = -1;
  let bestSq = Infinity;
  // Ring search out to ~120 m.
  for (let r = 0; r <= 6; r++) {
    for (let ix = cx - r; ix <= cx + r; ix++) {
      for (let iz = cz - r; iz <= cz + r; iz++) {
        if (Math.max(Math.abs(ix - cx), Math.abs(iz - cz)) !== r) continue;
        const list = sampleHash.get(`${ix},${iz}`);
        if (!list) continue;
        for (const i of list) {
          const p = centerlineSamples[i];
          const d = (x - p.x) ** 2 + (z - p.z) ** 2;
          if (d < bestSq) {
            bestSq = d;
            best = i;
          }
        }
      }
    }
    // Anything in a further ring is at least r * cell away.
    if (best >= 0 && Math.sqrt(bestSq) <= r * HASH_CELL) return best;
  }
  if (best >= 0) return best;
  // Far from the circuit: coarse scan, then refine.
  for (let i = 0; i < N_SAMPLES; i += 8) {
    const p = centerlineSamples[i];
    const d = (x - p.x) ** 2 + (z - p.z) ** 2;
    if (d < bestSq) {
      bestSq = d;
      best = i;
    }
  }
  const coarse = best;
  for (let k = -8; k <= 8; k++) {
    const i = (coarse + k + N_SAMPLES) % N_SAMPLES;
    const p = centerlineSamples[i];
    const d = (x - p.x) ** 2 + (z - p.z) ** 2;
    if (d < bestSq) {
      bestSq = d;
      best = i;
    }
  }
  return best;
}

/**
 * Projects an arbitrary 2D/3D world position (x, z) onto the circuit centerline.
 * Returns progress u [0, 1), lateral distance in meters (positive = left / +normal side),
 * centerline point, track tangent, and track normal.
 */
export function projectToTrack(x, z, hint = -1) {
  let minDistSq = Infinity;
  let bestIdx = 0;

  const scan = (from, to) => {
    for (let k = from; k <= to; k++) {
      const i = ((k % N_SAMPLES) + N_SAMPLES) % N_SAMPLES;
      const pt = centerlineSamples[i];
      const dx = x - pt.x;
      const dz = z - pt.z;
      const dSq = dx * dx + dz * dz;
      if (dSq < minDistSq) {
        minDistSq = dSq;
        bestIdx = i;
      }
    }
  };

  // Windowed search around the previous sample (~±37 m), global search as fallback.
  if (hint >= 0) {
    scan(hint - 30, hint + 30);
    const offset = Math.abs(((bestIdx - hint + N_SAMPLES * 1.5) % N_SAMPLES) - N_SAMPLES / 2);
    if (offset >= 29 || minDistSq > 30 * 30) bestIdx = nearestSampleGlobal(x, z);
  } else {
    bestIdx = nearestSampleGlobal(x, z);
  }

  const pt = centerlineSamples[bestIdx];
  const tan = tangents[bestIdx];
  const norm = normals[bestIdx];

  const rx = x - pt.x;
  const rz = z - pt.z;

  const lateralDist = rx * norm.x + rz * norm.z;
  const longitudinalDist = rx * tan.x + rz * tan.z;
  const tanH = Math.max(Math.hypot(tan.x, tan.z), 1e-6);
  const grade = GRADE[bestIdx];
  // Road height under (x, z): the cross-section is flat (no banking).
  const height = pt.y + (longitudinalDist / tanH) * grade;

  const rawU = bestIdx / N_SAMPLES + longitudinalDist / CIRCUIT_LENGTH;
  const uNorm = ((rawU % 1) + 1) % 1;

  const absDist = Math.abs(lateralDist);
  const onTrack = absDist <= HALF_WIDTH;
  const onKerb = !onTrack && absDist <= HALF_WIDTH + KERB_WIDTH && KERB_MASK[bestIdx] === 1;
  const onRunoff = !onTrack && !onKerb && absDist <= BARRIER_OFFSET;
  const barrierHit = absDist >= BARRIER_OFFSET;
  const surface = onTrack
    ? "asphalt"
    : onKerb
      ? "kerb"
      : runoffSurface(bestIdx, lateralDist >= 0 ? 0 : 1);

  return {
    index: bestIdx,
    u: uNorm,
    distance: lateralDist,
    absDistance: absDist,
    centerPoint: pt,
    tangent: tan,
    normal: norm,
    onTrack,
    onKerb,
    onRunoff,
    barrierHit,
    surface,
    height,
    grade,
    verticalCurvature: VERTICAL_CURVATURE[bestIdx],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// TRACK ANALYSIS: curvature, racing line, kerb zones and runoff surfaces.
// Shared by the renderer (what you see) and physics (what you drive on).
// ─────────────────────────────────────────────────────────────────────────────

export const SAMPLE_COUNT = N_SAMPLES;
export const SAMPLE_SPACING = CIRCUIT_LENGTH / N_SAMPLES;
const metersToSamples = (m) => Math.max(1, Math.round(m / SAMPLE_SPACING));
const wrapIndex = (i) => ((i % N_SAMPLES) + N_SAMPLES) % N_SAMPLES;

function boxSmooth(arr, meters, passes = 2) {
  const h = metersToSamples(meters);
  let src = Float32Array.from(arr);
  for (let p = 0; p < passes; p++) {
    const out = new Float32Array(N_SAMPLES);
    for (let i = 0; i < N_SAMPLES; i++) {
      let sum = 0;
      for (let k = -h; k <= h; k++) sum += src[wrapIndex(i + k)];
      out[i] = sum / (2 * h + 1);
    }
    src = out;
  }
  return src;
}

function dilate(mask, meters) {
  const h = metersToSamples(meters);
  const out = new Uint8Array(N_SAMPLES);
  for (let i = 0; i < N_SAMPLES; i++) {
    if (!mask[i]) continue;
    for (let k = -h; k <= h; k++) out[wrapIndex(i + k)] = 1;
  }
  return out;
}

// Signed curvature (1/m); positive = left-hander. "Left" is the +normal side.
const rawCurvature = new Float32Array(N_SAMPLES);
for (let i = 0; i < N_SAMPLES; i++) {
  const a = tangents[i];
  const b = tangents[wrapIndex(i + 1)];
  let d = Math.atan2(-b.x, -b.z) - Math.atan2(-a.x, -a.z);
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d < -Math.PI) d += 2 * Math.PI;
  rawCurvature[i] = d / SAMPLE_SPACING;
}
export const CURVATURE = boxSmooth(rawCurvature, 6);

// Rate of change of gradient (1/m): negative over crests, positive in dips.
export const VERTICAL_CURVATURE = boxSmooth(
  Float32Array.from(GRADE, (g, i) => (GRADE[(i + 1) % N_SAMPLES] - g) / SAMPLE_SPACING),
  10,
);
const CURVATURE_WIDE = boxSmooth(rawCurvature, 22);

// Racing line: inside at the apex, outside on entry and exit.
export const RACING_LINE = (() => {
  const t = (k) => Math.tanh(55 * k);
  const reach = metersToSamples(32);
  const line = new Float32Array(N_SAMPLES);
  for (let i = 0; i < N_SAMPLES; i++) {
    const here = t(CURVATURE_WIDE[i]);
    const around = t(CURVATURE_WIDE[wrapIndex(i + reach)]) + t(CURVATURE_WIDE[wrapIndex(i - reach)]);
    const v = 5.0 * here - 3.0 * around * (1 - Math.abs(here));
    line[i] = Math.max(-5.4, Math.min(5.4, v));
  }
  return boxSmooth(line, 10);
})();

// Kerbs only where the track actually turns.
export const KERB_MASK = dilate(
  Uint8Array.from(CURVATURE, (k) => (Math.abs(k) > 1 / 140 ? 1 : 0)),
  18,
);

// Runoff surface weights per side: [grass, asphalt, gravel]. Side 0 = left (+normal), 1 = right.
export const RUNOFF_WEIGHTS = [0, 1].map((sideIdx) => {
  const side = sideIdx === 0 ? 1 : -1;
  const grass = new Float32Array(N_SAMPLES);
  const asphalt = new Float32Array(N_SAMPLES);
  const gravel = new Float32Array(N_SAMPLES);
  for (let i = 0; i < N_SAMPLES; i++) {
    const k = CURVATURE_WIDE[i];
    const p = centerlineSamples[i];
    const radius = 1 / Math.max(Math.abs(k), 1e-6);
    let w = [1, 0, 0];
    if (side === 1 && p.z > 92 && p.z < 108 && p.x > -48 && p.x < 112) {
      w = [0, 1, 0]; // pit-lane apron along the main straight infield
    } else if (Math.abs(k) > 1 / 220 && KERB_MASK[i]) {
      const inside = Math.sign(k) === side;
      if (inside) w = radius < 80 ? [0, 1, 0] : [1, 0, 0];
      else w = radius < 75 ? [0, 0, 1] : [0, 1, 0];
    }
    grass[i] = w[0];
    asphalt[i] = w[1];
    gravel[i] = w[2];
  }
  return [boxSmooth(grass, 8), boxSmooth(asphalt, 8), boxSmooth(gravel, 8)];
});

// Debris fencing: outside of corners, and along the grandstand side of the main straight.
export const FENCE_MASK = [0, 1].map((sideIdx) => {
  const side = sideIdx === 0 ? 1 : -1;
  const mask = new Uint8Array(N_SAMPLES);
  for (let i = 0; i < N_SAMPLES; i++) {
    const p = centerlineSamples[i];
    const outsideCorner = KERB_MASK[i] && Math.sign(CURVATURE_WIDE[i]) === -side &&
      Math.abs(CURVATURE_WIDE[i]) > 1 / 200;
    const mainStraight = side === -1 && p.z > 92 && p.z < 108 && p.x > -60 && p.x < 140;
    mask[i] = outsideCorner || mainStraight ? 1 : 0;
  }
  return dilate(mask, 10);
});

/** Dominant runoff surface at a sample/side. */
function runoffSurface(idx, sideIdx) {
  const [g, a, v] = RUNOFF_WEIGHTS[sideIdx];
  if (v[idx] >= g[idx] && v[idx] >= a[idx]) return "gravel";
  if (a[idx] >= g[idx]) return "runoff";
  return "grass";
}

// ─────────────────────────────────────────────────────────────────────────────
// PROCEDURAL TRACK GEOMETRY
// ─────────────────────────────────────────────────────────────────────────────

export const BARRIER_HEIGHT = 1.1;
export const BARRIER_THICKNESS = 0.5;
export const FENCE_HEIGHT = 3.4;

// Texture tile length along the track, chosen so the lap is a whole number of tiles.
const roadTile = CIRCUIT_LENGTH / Math.round(CIRCUIT_LENGTH / 7);

/**
 * Build a ribbon that follows the centreline. `profile` is a list of
 * [lateral offset (m, +left), height (m)] pairs. Faces are flipped so their
 * normals agree with `facing(i)` (a THREE.Vector3-like {x,y,z}).
 */
function buildRibbon({ profile, facing, uv, attrs = {}, include = () => true }) {
  const cols = profile.length;
  const positions = [];
  const uvs = [];
  const extra = Object.fromEntries(Object.entries(attrs).map(([k, a]) => [k, { size: a.size, data: [] }]));

  for (let i = 0; i <= N_SAMPLES; i++) {
    const idx = i % N_SAMPLES;
    const p = centerlineSamples[idx];
    const n = normals[idx];
    const along = i * SAMPLE_SPACING;
    for (let c = 0; c < cols; c++) {
      const [lat, h] = profile[c];
      positions.push(p.x + n.x * lat, p.y + h, p.z + n.z * lat);
      uvs.push(...uv({ lat, h, along, col: c, x: p.x + n.x * lat, z: p.z + n.z * lat }));
      for (const [k, a] of Object.entries(attrs)) {
        const v = a.value({ idx, lat, h, col: c });
        if (a.size === 1) extra[k].data.push(v);
        else extra[k].data.push(...v);
      }
    }
  }

  const indices = [];
  const v = (i, c) => i * cols + c;
  for (let i = 0; i < N_SAMPLES; i++) {
    if (!include(i)) continue;
    for (let c = 0; c < cols - 1; c++) {
      indices.push(v(i, c), v(i + 1, c), v(i, c + 1));
      indices.push(v(i, c + 1), v(i + 1, c), v(i + 1, c + 1));
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  for (const [k, a] of Object.entries(extra)) {
    geom.setAttribute(k, new THREE.Float32BufferAttribute(a.data, a.size));
  }

  // Orient faces: test the first emitted triangle against the expected facing.
  if (indices.length) {
    const pa = new THREE.Vector3().fromArray(positions, indices[0] * 3);
    const pb = new THREE.Vector3().fromArray(positions, indices[1] * 3);
    const pc = new THREE.Vector3().fromArray(positions, indices[2] * 3);
    const fn = pb.sub(pa).cross(pc.sub(pa));
    const firstRow = Math.floor(indices[0] / cols);
    const want = facing(firstRow % N_SAMPLES);
    if (fn.x * want.x + fn.y * want.y + fn.z * want.z < 0) {
      for (let t = 0; t < indices.length; t += 3) {
        const tmp = indices[t + 1];
        indices[t + 1] = indices[t + 2];
        indices[t + 2] = tmp;
      }
    }
  }
  geom.setIndex(indices);
  geom.computeVertexNormals();
  geom.computeBoundingSphere();
  return geom;
}

const UP = () => ({ x: 0, y: 1, z: 0 });

/**
 * Builds all track-surface geometry: asphalt with racing-line data, kerbs
 * (corners only), runoff with surface weights, edge lines, barriers and fencing.
 */
export function createCircuitGeometries() {
  // Asphalt: 1 m lateral subdivisions so the racing line can be shaded per vertex.
  const roadProfile = [];
  for (let k = 0; k <= 14; k++) roadProfile.push([-HALF_WIDTH + k, 0.02]);
  const roadGeom = buildRibbon({
    profile: roadProfile,
    facing: UP,
    uv: ({ lat, along }) => [(lat + HALF_WIDTH) / roadTile, along / roadTile],
    attrs: { aLine: { size: 1, value: ({ idx, lat }) => lat - RACING_LINE[idx] } },
  });

  // Kerbs: raised, bevelled profile; geometry only where the kerb mask is set.
  const kerbProfile = [[0, 0.02], [0.14, 0.055], [0.3, 0.062], [1.0, 0.062], [1.14, 0.05], [1.2, 0.0]];
  const kerbs = [1, -1].map((side) =>
    buildRibbon({
      profile: kerbProfile.map(([o, h]) => [side * (HALF_WIDTH + o), h]),
      facing: UP,
      uv: ({ col, along }) => [col / (kerbProfile.length - 1), along],
      include: (i) => KERB_MASK[i] && KERB_MASK[(i + 1) % N_SAMPLES],
    }),
  );

  // Runoff: road edge to barrier, blended grass / asphalt / gravel.
  const runoffOffsets = [0, 1.2, 2.6, 4.0, BARRIER_OFFSET - HALF_WIDTH + 0.6];
  const runoffs = [1, -1].map((side, sideIdx) =>
    buildRibbon({
      profile: runoffOffsets.map((o) => [side * (HALF_WIDTH + o), 0.012]),
      facing: UP,
      uv: ({ x, z }) => [x / 6, z / 6],
      attrs: {
        aSurf: {
          size: 3,
          value: ({ idx }) => [
            RUNOFF_WEIGHTS[sideIdx][0][idx],
            RUNOFF_WEIGHTS[sideIdx][1][idx],
            RUNOFF_WEIGHTS[sideIdx][2][idx],
          ],
        },
      },
    }),
  );

  // White edge lines.
  const lines = [1, -1].map((side) =>
    buildRibbon({
      profile: [[side * (HALF_WIDTH - 0.3), 0.024], [side * (HALF_WIDTH - 0.1), 0.024]],
      facing: UP,
      uv: ({ col, along }) => [col, along / 4],
    }),
  );

  // Concrete barriers: inner face, top and back. Faces point toward the track.
  const barriers = [1, -1].map((side) => {
    const b = BARRIER_OFFSET;
    const t = BARRIER_THICKNESS;
    const H = BARRIER_HEIGHT;
    const make = (profile, facingFn) =>
      buildRibbon({
        profile,
        facing: facingFn,
        uv: ({ along, h, lat }) => [along / 2.4, (h + Math.abs(lat) - b) / 2.4],
      });
    const inward = (i) => ({ x: -side * normals[i].x, y: 0, z: -side * normals[i].z });
    const outward = (i) => ({ x: side * normals[i].x, y: 0, z: side * normals[i].z });
    return [
      // Faces reach 1.5 m below the road: a skirt that hides the terrain cut-out edge.
      make([[side * b, -1.5], [side * b, H * 0.5], [side * b, H]], inward),
      make([[side * b, H], [side * (b + t), H]], UP),
      make([[side * (b + t), H], [side * (b + t), -1.5]], outward),
    ];
  });

  // Debris fence panels above the barriers.
  const fences = [1, -1].map((side, sideIdx) =>
    buildRibbon({
      profile: [[side * (BARRIER_OFFSET + 0.2), BARRIER_HEIGHT], [side * (BARRIER_OFFSET + 0.2), BARRIER_HEIGHT + FENCE_HEIGHT]],
      facing: (i) => ({ x: -side * normals[i].x, y: 0, z: -side * normals[i].z }),
      uv: ({ along, h }) => [along, h],
      include: (i) => FENCE_MASK[sideIdx][i] && FENCE_MASK[sideIdx][(i + 1) % N_SAMPLES],
    }),
  );

  return { roadGeom, kerbs, runoffs, lines, barriers, fences };
}

/** Points along the track at a fixed spacing where `mask(sideIdx, idx)` holds. */
export function samplePlacements(spacingMeters, sideIdx, offset, mask = () => true) {
  const out = [];
  const step = metersToSamples(spacingMeters);
  const side = sideIdx === 0 ? 1 : -1;
  for (let i = 0; i < N_SAMPLES; i += step) {
    if (!mask(sideIdx, i)) continue;
    const p = centerlineSamples[i];
    const n = normals[i];
    out.push({
      idx: i,
      y: p.y,
      x: p.x + n.x * side * offset,
      z: p.z + n.z * side * offset,
      yaw: Math.atan2(-tangents[i].x, -tangents[i].z),
      side,
    });
  }
  return out;
}

/**
 * Returns an SVG path string in circuit coordinates normalized to a given SVG viewBox
 */
export function getCircuitSvgPath(samples = 120, viewBox = 100) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  const pts = [];

  for (let i = 0; i <= samples; i++) {
    const pt = CIRCUIT_CURVE.getPointAt((i / samples) % 1);
    pts.push(pt);
    if (pt.x < minX) minX = pt.x;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.z < minZ) minZ = pt.z;
    if (pt.z > maxZ) maxZ = pt.z;
  }

  const spanX = maxX - minX;
  const spanZ = maxZ - minZ;
  const pad = 10;
  const scale = (viewBox - pad * 2) / Math.max(spanX, spanZ);
  const offsetX = (viewBox - spanX * scale) / 2;
  const offsetZ = (viewBox - spanZ * scale) / 2;

  const toSvgX = (x) => (x - minX) * scale + offsetX;
  const toSvgZ = (z) => (z - minZ) * scale + offsetZ;

  let d = `M ${toSvgX(pts[0].x).toFixed(1)} ${toSvgZ(pts[0].z).toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    d += ` L ${toSvgX(pts[i].x).toFixed(1)} ${toSvgZ(pts[i].z).toFixed(1)}`;
  }
  d += " Z";

  return {
    d,
    transformCoord: (x, z) => ({
      svgX: toSvgX(x),
      svgZ: toSvgZ(z),
    }),
  };
}
