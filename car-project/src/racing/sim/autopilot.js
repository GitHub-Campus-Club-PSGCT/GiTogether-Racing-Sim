// Autopilot: follows the racing line at the speed plan's speeds (sim/speedPlan.js).
// Used by the tests (proves the circuit is drivable and that the plan the
// racing-line assist shows can really be driven) and by ?debug=1 screenshots.
import { LINE_POINTS, SAMPLE_COUNT, SAMPLE_SPACING, projectToTrack } from "../circuitDefinition.js";
import { PLAN } from "./speedPlan.js";

const N = SAMPLE_COUNT;

export function autopilot(s) {
  const p = s.track ?? projectToTrack(s.x, s.z);
  const i = p.index;
  // Steer for a point on the line ahead (further at speed).
  const j = (i + Math.round((8 + s.vx * 0.45) / SAMPLE_SPACING)) % N;
  const dx = LINE_POINTS[j * 2] - s.x, dz = LINE_POINTS[j * 2 + 1] - s.z;
  const fwd = dx * -Math.sin(s.yaw) + dz * -Math.cos(s.yaw);
  const left = dx * -Math.cos(s.yaw) + dz * Math.sin(s.yaw);
  const steer = Math.max(-1, Math.min(1, Math.atan2(left, fwd) * 3));
  // Speed: the plan a moment ahead, to cover the brakes' response.
  const target = PLAN.envelope[(i + Math.round((2 + s.vx * 0.08) / SAMPLE_SPACING)) % N];
  const err = target - s.vx;
  return {
    throttle: err > 0 ? Math.min(1, err * 0.4) : 0,
    brake: err < -0.5 ? Math.min(1, -err * 0.3) : 0,
    steer,
    boost: err > 6 && Math.abs(steer) < 0.2,
  };
}
