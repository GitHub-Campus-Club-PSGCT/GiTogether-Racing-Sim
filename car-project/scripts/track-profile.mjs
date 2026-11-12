// Prints the circuit's profile along a stretch of track: height, corner radius,
// racing-line offset, gradient, vertical curvature and the speed plan (corner
// limit, braking envelope and planned speed).
// Use it when editing CIRCUIT_POINTS.
//
//   node scripts/track-profile.mjs [fromMetres] [toMetres] [stepMetres]
import {
  CIRCUIT_CURVE,
  CIRCUIT_LENGTH,
  CURVATURE,
  GRADE,
  RACING_LINE,
  SAMPLE_COUNT,
  SAMPLE_SPACING,
  VERTICAL_CURVATURE,
} from "../src/racing/circuitDefinition.js";
import { PLAN } from "../src/racing/sim/speedPlan.js";

const [from = 0, to = CIRCUIT_LENGTH, step = 10] = process.argv.slice(2).map(Number);
const fmtR = (k) => (Math.abs(k) < 1 / 3000 ? "-" : (1 / k).toFixed(0));

console.log(`length ${CIRCUIT_LENGTH.toFixed(0)} m, ${SAMPLE_COUNT} samples`);
console.log("     s       y   R centre   R line   line   grade%    vcurv    limit envelope     plan  (km/h)");
for (let s = from; s <= to; s += step) {
  const i = Math.round(s / SAMPLE_SPACING) % SAMPLE_COUNT;
  const y = CIRCUIT_CURVE.getPointAt(i / SAMPLE_COUNT).y;
  console.log(
    [
      s.toFixed(0).padStart(6),
      y.toFixed(1).padStart(7),
      fmtR(CURVATURE[i]).padStart(10),
      fmtR(PLAN.curvature[i]).padStart(8),
      RACING_LINE[i].toFixed(1).padStart(6),
      (GRADE[i] * 100).toFixed(1).padStart(8),
      VERTICAL_CURVATURE[i].toFixed(4).padStart(8),
      (PLAN.cornerSpeed[i] * 3.6).toFixed(0).padStart(8),
      (PLAN.envelope[i] * 3.6).toFixed(0).padStart(8),
      (PLAN.speed[i] * 3.6).toFixed(0).padStart(8),
    ].join(" "),
  );
}
