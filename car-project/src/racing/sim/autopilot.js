// Simple autopilot: follows the centreline with a curvature-based speed plan.
// Used by the tests (proves the circuit is drivable) and by ?debug=1 screenshots.
import { CIRCUIT_CURVE, CIRCUIT_LENGTH, projectToTrack } from "../circuitDefinition.js";

// ---------------------------------------------------------------------------
const STEP_M = 2;
const path = [];
for (let d = 0; d < CIRCUIT_LENGTH; d += STEP_M) path.push(CIRCUIT_CURVE.getPointAt(d / CIRCUIT_LENGTH));
const n = path.length;
const curvature = path.map((_, i) => {
  const a = path[(i - 3 + n) % n], b = path[i], c = path[(i + 3) % n];
  const ab = Math.hypot(b.x - a.x, b.z - a.z), bc = Math.hypot(c.x - b.x, c.z - b.z), ca = Math.hypot(a.x - c.x, a.z - c.z);
  const area = Math.abs((b.x - a.x) * (c.z - a.z) - (c.x - a.x) * (b.z - a.z)) / 2;
  return (4 * area) / (ab * bc * ca);
});
const vCorner = curvature.map((k) => Math.min(95, Math.sqrt((14 + 0) / Math.max(k, 1e-4))));
// Backward pass so the target speed respects braking distance.
const vTarget = vCorner.slice();
for (let pass = 0; pass < 2; pass++) {
  for (let i = n - 1; i >= 0; i--) {
    const next = vTarget[(i + 1) % n];
    vTarget[i] = Math.min(vTarget[i], Math.sqrt(next * next + 2 * 22 * STEP_M));
  }
}

export function autopilot(s) {
  const p = s.track ?? projectToTrack(s.x, s.z);
  const i = Math.floor((p.u * CIRCUIT_LENGTH) / STEP_M) % n;
  const ahead = path[(i + Math.round((8 + s.vx * 0.45) / STEP_M)) % n];
  const dx = ahead.x - s.x, dz = ahead.z - s.z;
  const fwd = dx * -Math.sin(s.yaw) + dz * -Math.cos(s.yaw);
  const left = dx * -Math.cos(s.yaw) + dz * Math.sin(s.yaw);
  const steer = Math.max(-1, Math.min(1, Math.atan2(left, fwd) * 3));
  const target = vTarget[(i + 2) % n];
  const err = target - s.vx;
  return {
    throttle: err > 0 ? Math.min(1, err * 0.4) : 0,
    brake: err < -1 ? Math.min(1, -err * 0.25) : 0,
    steer,
    boost: err > 6 && Math.abs(steer) < 0.2,
  };
}

