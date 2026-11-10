// =============================================================================
// F1 RUSH — CIRCUIT ARCHITECTURE & DEFINITION (SINGLE SOURCE OF TRUTH)
// =============================================================================
// All track geometry, kerbs, runoff areas, collision boundaries, and lap
// checkpoints derive from this single underlying circuit curve.
// =============================================================================

import * as THREE from "three";

// 1. Control points defining an authentic Formula 1 Grand Prix circuit layout
export const CIRCUIT_POINTS = [
  new THREE.Vector3(0, 0, 100),       // 0: Start / Finish Line (Main Straight)
  new THREE.Vector3(80, 0, 100),      // 1: Main Straight high-speed DRS zone
  new THREE.Vector3(150, 0, 95),      // 2: Turn 1 heavy braking zone
  new THREE.Vector3(195, 0, 60),      // 3: Turn 1 Sweeper
  new THREE.Vector3(190, 0, 5),       // 4: Turn 2 Entry
  new THREE.Vector3(155, 0, -35),     // 5: Turn 3 Apex (Technical medium-speed)
  new THREE.Vector3(100, 0, -25),     // 6: Turn 4 High-speed Esses switch
  new THREE.Vector3(45, 0, -55),      // 7: Turn 5 Esses exit
  new THREE.Vector3(-15, 0, -85),     // 8: Back Straight entry
  new THREE.Vector3(-85, 0, -95),     // 9: Back Straight DRS speed trap
  new THREE.Vector3(-155, 0, -80),    // 10: Turn 6 Hairpin braking zone
  new THREE.Vector3(-195, 0, -30),    // 11: Turn 6 Hairpin outer banking (180 deg)
  new THREE.Vector3(-185, 0, 30),     // 12: Turn 7 Exit
  new THREE.Vector3(-140, 0, 60),     // 13: Technical Infield entry
  new THREE.Vector3(-95, 0, 70),      // 14: Infield sweeping S
  new THREE.Vector3(-65, 0, 85),      // 15: Final turn apex leading onto pit straight
  new THREE.Vector3(-45, 0, 100),     // 16: Main Straight approach
];

// Closed 3D Catmull-Rom spline with centripetal parameterization for smooth curvature
export const CIRCUIT_CURVE = new THREE.CatmullRomCurve3(
  CIRCUIT_POINTS,
  true,
  "centripetal"
);

export const CIRCUIT_LENGTH = CIRCUIT_CURVE.getLength(); // ~983m

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
// FAST PRECOMPUTED TRACK SAMPLING FOR O(1) PROJECTION & COLLISION
// ─────────────────────────────────────────────────────────────────────────────

const N_SAMPLES = 800;
const centerlineSamples = [];
const tangents = [];
const normals = [];

for (let i = 0; i <= N_SAMPLES; i++) {
  const u = (i / N_SAMPLES) % 1;
  const pt = CIRCUIT_CURVE.getPointAt(u);
  const tan = CIRCUIT_CURVE.getTangentAt(u).normalize();
  // Normal is perpendicular in the XZ plane: (tan.z, 0, -tan.x)
  const norm = new THREE.Vector3(tan.z, 0, -tan.x).normalize();

  centerlineSamples.push(pt);
  tangents.push(tan);
  normals.push(norm);
}

/**
 * Projects an arbitrary 2D/3D world position (x, z) onto the circuit centerline.
 * Returns progress u [0, 1), lateral distance in meters (negative = left, positive = right),
 * centerline point, track tangent, and track normal.
 */
export function projectToTrack(x, z) {
  let minDistSq = Infinity;
  let bestIdx = 0;

  for (let i = 0; i < N_SAMPLES; i++) {
    const pt = centerlineSamples[i];
    const dx = x - pt.x;
    const dz = z - pt.z;
    const dSq = dx * dx + dz * dz;
    if (dSq < minDistSq) {
      minDistSq = dSq;
      bestIdx = i;
    }
  }

  const pt = centerlineSamples[bestIdx];
  const tan = tangents[bestIdx];
  const norm = normals[bestIdx];

  const rx = x - pt.x;
  const rz = z - pt.z;

  const lateralDist = rx * norm.x + rz * norm.z;
  const longitudinalDist = rx * tan.x + rz * tan.z;

  const rawU = bestIdx / N_SAMPLES + longitudinalDist / CIRCUIT_LENGTH;
  const uNorm = ((rawU % 1) + 1) % 1;

  const absDist = Math.abs(lateralDist);
  const onTrack = absDist <= HALF_WIDTH;
  const onKerb = absDist > HALF_WIDTH && absDist <= HALF_WIDTH + KERB_WIDTH;
  const onRunoff = absDist > HALF_WIDTH + KERB_WIDTH && absDist <= BARRIER_OFFSET;
  const barrierHit = absDist >= BARRIER_OFFSET;

  return {
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
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PROCEDURAL TRACK RIBBON GEOMETRIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds continuous procedural geometries for:
 * - Asphalt road surface
 * - Red & white alternating kerbs
 * - Runoff aprons
 * - Outer & inner barrier walls
 */
export function createCircuitGeometries(steps = 800) {
  // 1. Asphalt Road Geometry
  const roadPositions = [];
  const roadUvs = [];
  const roadIndices = [];

  // 2. Left Kerb Geometry
  const lKerbPositions = [];
  const lKerbColors = [];
  const lKerbIndices = [];

  // 3. Right Kerb Geometry
  const rKerbPositions = [];
  const rKerbColors = [];
  const rKerbIndices = [];

  // 4. Runoff Geometry (Left & Right)
  const runoffPositions = [];
  const runoffIndices = [];

  // 5. Barrier Wall Geometry (Left & Right)
  const barrierPositions = [];
  const barrierColors = [];
  const barrierIndices = [];

  const red = new THREE.Color("#e10600");
  const white = new THREE.Color("#f0f0f0");
  const barrierGrey = new THREE.Color("#d0d4dc");

  for (let i = 0; i <= steps; i++) {
    const u = (i / steps) % 1;
    const pt = CIRCUIT_CURVE.getPointAt(u);
    const tan = CIRCUIT_CURVE.getTangentAt(u).normalize();
    const norm = new THREE.Vector3(tan.z, 0, -tan.x).normalize();

    const distAlong = u * CIRCUIT_LENGTH;
    const isKerbRed = Math.floor(distAlong / 1.6) % 2 === 0;
    const kerbColor = isKerbRed ? red : white;

    // Asphalt vertices (-7.0m to +7.0m)
    const lRoadX = pt.x - norm.x * HALF_WIDTH;
    const lRoadZ = pt.z - norm.z * HALF_WIDTH;
    const rRoadX = pt.x + norm.x * HALF_WIDTH;
    const rRoadZ = pt.z + norm.z * HALF_WIDTH;

    roadPositions.push(lRoadX, 0.02, lRoadZ);
    roadUvs.push(0, u * 60);

    roadPositions.push(rRoadX, 0.02, rRoadZ);
    roadUvs.push(1, u * 60);

    // Left Kerb vertices (-7.0m to -8.2m, slightly raised)
    const lKerbOuterX = pt.x - norm.x * (HALF_WIDTH + KERB_WIDTH);
    const lKerbOuterZ = pt.z - norm.z * (HALF_WIDTH + KERB_WIDTH);

    lKerbPositions.push(lRoadX, 0.025, lRoadZ);
    lKerbColors.push(kerbColor.r, kerbColor.g, kerbColor.b);

    lKerbPositions.push(lKerbOuterX, 0.045, lKerbOuterZ);
    lKerbColors.push(kerbColor.r, kerbColor.g, kerbColor.b);

    // Right Kerb vertices (+7.0m to +8.2m, slightly raised)
    const rKerbOuterX = pt.x + norm.x * (HALF_WIDTH + KERB_WIDTH);
    const rKerbOuterZ = pt.z + norm.z * (HALF_WIDTH + KERB_WIDTH);

    rKerbPositions.push(rRoadX, 0.025, rRoadZ);
    rKerbColors.push(kerbColor.r, kerbColor.g, kerbColor.b);

    rKerbPositions.push(rKerbOuterX, 0.045, rKerbOuterZ);
    rKerbColors.push(kerbColor.r, kerbColor.g, kerbColor.b);

    // Runoff aprons (from kerb outer to barrier base)
    const lBarrierX = pt.x - norm.x * BARRIER_OFFSET;
    const lBarrierZ = pt.z - norm.z * BARRIER_OFFSET;
    const rBarrierX = pt.x + norm.x * BARRIER_OFFSET;
    const rBarrierZ = pt.z + norm.z * BARRIER_OFFSET;

    // Left runoff
    runoffPositions.push(lKerbOuterX, 0.015, lKerbOuterZ);
    runoffPositions.push(lBarrierX, 0.01, lBarrierZ);

    // Right runoff
    runoffPositions.push(rKerbOuterX, 0.015, rKerbOuterZ);
    runoffPositions.push(rBarrierX, 0.01, rBarrierZ);

    // Concrete Barriers (vertical walls at +/- 12.2m from center)
    // Left barrier base & top (height 1.4m)
    barrierPositions.push(lBarrierX, 0.0, lBarrierZ);
    barrierColors.push(barrierGrey.r, barrierGrey.g, barrierGrey.b);
    barrierPositions.push(lBarrierX, 1.4, lBarrierZ);
    barrierColors.push(isKerbRed ? red.r : white.r, isKerbRed ? red.g : white.g, isKerbRed ? red.b : white.b);

    // Right barrier base & top (height 1.4m)
    barrierPositions.push(rBarrierX, 0.0, rBarrierZ);
    barrierColors.push(barrierGrey.r, barrierGrey.g, barrierGrey.b);
    barrierPositions.push(rBarrierX, 1.4, rBarrierZ);
    barrierColors.push(isKerbRed ? red.r : white.r, isKerbRed ? red.g : white.g, isKerbRed ? red.b : white.b);
  }

  // Triangulate ribbons
  for (let i = 0; i < steps; i++) {
    const row1 = i * 2;
    const row2 = (i + 1) * 2;

    // Road surface normals must point upward so the asphalt is visible and lit from above.
    roadIndices.push(row1, row2, row1 + 1);
    roadIndices.push(row1 + 1, row2, row2 + 1);

    // Left kerb triangles face upward with this centerline winding.
    lKerbIndices.push(row1, row1 + 1, row2);
    lKerbIndices.push(row1 + 1, row2 + 1, row2);

    // Right kerb triangles use the opposite lateral direction.
    rKerbIndices.push(row1, row2, row1 + 1);
    rKerbIndices.push(row1 + 1, row2, row2 + 1);

    // Runoff triangles (4 vertices per segment: 2 left, 2 right)
    const ro1 = i * 4;
    const ro2 = (i + 1) * 4;
    // Left runoff
    runoffIndices.push(ro1, ro1 + 1, ro2);
    runoffIndices.push(ro1 + 1, ro2 + 1, ro2);
    // Right runoff
    runoffIndices.push(ro1 + 2, ro2 + 2, ro1 + 3);
    runoffIndices.push(ro1 + 3, ro2 + 2, ro2 + 3);

    // Barrier wall faces point inward toward the racing surface.
    const b1 = i * 4;
    const b2 = (i + 1) * 4;
    barrierIndices.push(b1, b1 + 1, b2);
    barrierIndices.push(b1 + 1, b2 + 1, b2);
    barrierIndices.push(b1 + 2, b2 + 2, b1 + 3);
    barrierIndices.push(b1 + 3, b2 + 2, b2 + 3);
  }

  // Build BufferGeometries
  const roadGeom = new THREE.BufferGeometry();
  roadGeom.setAttribute("position", new THREE.Float32BufferAttribute(roadPositions, 3));
  roadGeom.setAttribute("uv", new THREE.Float32BufferAttribute(roadUvs, 2));
  roadGeom.setIndex(roadIndices);
  roadGeom.computeVertexNormals();

  const lKerbGeom = new THREE.BufferGeometry();
  lKerbGeom.setAttribute("position", new THREE.Float32BufferAttribute(lKerbPositions, 3));
  lKerbGeom.setAttribute("color", new THREE.Float32BufferAttribute(lKerbColors, 3));
  lKerbGeom.setIndex(lKerbIndices);
  lKerbGeom.computeVertexNormals();

  const rKerbGeom = new THREE.BufferGeometry();
  rKerbGeom.setAttribute("position", new THREE.Float32BufferAttribute(rKerbPositions, 3));
  rKerbGeom.setAttribute("color", new THREE.Float32BufferAttribute(rKerbColors, 3));
  rKerbGeom.setIndex(rKerbIndices);
  rKerbGeom.computeVertexNormals();

  const runoffGeom = new THREE.BufferGeometry();
  runoffGeom.setAttribute("position", new THREE.Float32BufferAttribute(runoffPositions, 3));
  runoffGeom.setIndex(runoffIndices);
  runoffGeom.computeVertexNormals();

  const barrierGeom = new THREE.BufferGeometry();
  barrierGeom.setAttribute("position", new THREE.Float32BufferAttribute(barrierPositions, 3));
  barrierGeom.setAttribute("color", new THREE.Float32BufferAttribute(barrierColors, 3));
  barrierGeom.setIndex(barrierIndices);
  barrierGeom.computeVertexNormals();

  return {
    roadGeom,
    lKerbGeom,
    rKerbGeom,
    runoffGeom,
    barrierGeom,
  };
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
