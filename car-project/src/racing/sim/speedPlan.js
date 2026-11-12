// =============================================================================
// Speed plan for the racing line, and the per-frame guide built on it.
//
// PLAN (computed once):
//   cornerSpeed  fastest speed the car can hold at each sample of the racing line,
//                from the same grip model as the sim (front-axle limited, downforce,
//                load sensitivity, and the load change over crests and dips).
//   envelope     the fastest you can be going at each sample and still make every
//                corner after it (a backward braking pass).
//   speed        the full plan: accelerate out of each corner until the envelope
//                says brake (a forward pass under the envelope).
//   corners      one entry per corner: apex, target speed, and whether it is flat,
//                a lift or a brake.
//
// stepGuide() is the "entry speed detector": from the car's current speed it
// predicts where *you* need to brake, colours the line ahead (green / yellow /
// red) and returns the cue for the next corner.
//
// Pure JS: no React or three.js. Deterministic.
// =============================================================================

import {
  GRADE,
  LINE_CURVATURE,
  LINE_STEP,
  SAMPLE_COUNT as N,
  SAMPLE_SPACING,
  VERTICAL_CURVATURE,
} from "../circuitDefinition.js";
import { AIR, CAR, G, SURFACE } from "./vehicleSim.js";
import { TYRE } from "./tyre.js";
import { maxDriveForce } from "./drivetrain.js";

/** Share of the car's limits the plan uses, so a real driver can follow it. */
export const PLAN_MARGIN = { lateral: 0.93, braking: 0.8, traction: 0.9 };
/** Below this deceleration (m/s²) slowing down is a lift, not a brake. */
export const LIFT_DECEL = 7;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrap = (i) => ((i % N) + N) % N;
const DOWN = (AIR * CAR.liftArea) / CAR.mass; // downforce acceleration per (m/s)²
const DRAG = (AIR * CAR.dragArea) / CAR.mass;
const ROLL = CAR.rolling * G;
const FRONT = CAR.cgToRear / CAR.wheelbase; // static front weight share
const REAR = 1 - FRONT;

function loadSens(ratio) {
  return clamp(1 - TYRE.loadSensitivity * (ratio - 1), 0.72, 1.04);
}
function verticalLoad(v, kv) {
  return clamp(1 + (v * v * kv) / G, 0.55, 1.6);
}

/** Lateral acceleration (m/s²) the car can hold at speed v at sample i. */
export function lateralGrip(v, i) {
  const vert = verticalLoad(v, VERTICAL_CURVATURE[i]);
  const down = DOWN * v * v;
  const front = FRONT * G * vert + CAR.aeroFront * down; // per kg of car
  const rear = REAR * G * vert + (1 - CAR.aeroFront) * down;
  const aFront = (TYRE.muPeak * loadSens(front / (FRONT * G)) * front) / FRONT;
  const aRear = (TYRE.muPeak * CAR.rearGripBias * loadSens(rear / (REAR * G)) * rear) / REAR;
  return Math.min(aFront, aRear) * SURFACE.asphalt.grip * PLAN_MARGIN.lateral;
}

/** Share of the tyre left for braking or driving while cornering (friction circle). */
function longitudinalShare(v, i) {
  const used = (v * v * Math.abs(LINE_CURVATURE[i])) / Math.max(lateralGrip(v, i), 1e-6);
  return Math.sqrt(Math.max(0.12, 1 - used * used));
}

/** Deceleration (m/s², positive) with the brakes on at speed v at sample i. */
export function brakingDecel(v, i) {
  const vert = verticalLoad(v, VERTICAL_CURVATURE[i]);
  const tyre = TYRE.muPeak * loadSens(1 + (DOWN * v * v) / G) * (G * vert + DOWN * v * v);
  const brakes = Math.min(CAR.brakeForce / CAR.mass, tyre) * PLAN_MARGIN.braking * longitudinalShare(v, i);
  return brakes + DRAG * v * v + ROLL + G * GRADE[i];
}

/** Acceleration (m/s²) at full throttle at speed v at sample i. */
export function throttleAccel(v, i) {
  const vert = verticalLoad(v, VERTICAL_CURVATURE[i]);
  const rear = REAR * G * vert + (1 - CAR.aeroFront) * DOWN * v * v;
  const traction = TYRE.muPeak * CAR.rearGripBias * rear * PLAN_MARGIN.traction;
  const drive = Math.min(maxDriveForce(v) / CAR.mass, traction * longitudinalShare(v, i));
  return drive - DRAG * v * v - ROLL - G * GRADE[i];
}

// Top speed on the flat (drive force = drag + rolling resistance).
const V_MAX = (() => {
  let lo = 20, hi = 120;
  for (let k = 0; k < 50; k++) {
    const v = (lo + hi) / 2;
    if (maxDriveForce(v) / CAR.mass - DRAG * v * v - ROLL > 0) lo = v;
    else hi = v;
  }
  return lo;
})();

function buildPlan() {
  // Corner speed: the largest v with v²·|k| within the grip at v.
  const cornerSpeed = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const k = Math.abs(LINE_CURVATURE[i]);
    if (k * V_MAX * V_MAX <= lateralGrip(V_MAX, i)) {
      cornerSpeed[i] = V_MAX;
      continue;
    }
    let lo = 0, hi = V_MAX;
    for (let it = 0; it < 32; it++) {
      const v = (lo + hi) / 2;
      if (v * v * k <= lateralGrip(v, i)) lo = v;
      else hi = v;
    }
    cornerSpeed[i] = lo;
  }

  // Backward pass: braking envelope. Two laps so it settles across the line.
  const envelope = Float32Array.from(cornerSpeed);
  for (let lap = 0; lap < 2; lap++) {
    for (let i = N - 1; i >= 0; i--) {
      const next = envelope[wrap(i + 1)];
      const reach = Math.sqrt(next * next + 2 * LINE_STEP[i] * Math.max(brakingDecel(next, i), 0.5));
      envelope[i] = Math.min(cornerSpeed[i], reach);
    }
  }

  // Forward pass: accelerate under the envelope. Two laps for the same reason.
  const speed = Float32Array.from(envelope);
  for (let lap = 0; lap < 2; lap++) {
    for (let i = 0; i < N; i++) {
      const prev = speed[wrap(i - 1)];
      const reach = Math.sqrt(Math.max(0, prev * prev + 2 * LINE_STEP[wrap(i - 1)] * throttleAccel(prev, wrap(i - 1))));
      speed[i] = Math.min(envelope[i], reach);
    }
  }

  // Corners: stretches of the line tighter than R 350 m, merged across short gaps.
  const corners = [];
  const tight = (i) => Math.abs(LINE_CURVATURE[i]) > 1 / 350;
  const gap = Math.round(30 / SAMPLE_SPACING);
  let start = 0;
  while (start < N && tight(start)) start++; // begin on a straight
  let run = null;
  let quiet = 0;
  for (let k = 1; k <= N; k++) {
    const i = wrap(start + k);
    if (tight(i)) {
      if (!run) run = { from: i, to: i };
      run.to = i;
      quiet = 0;
    } else if (run && ++quiet > gap) {
      corners.push(run);
      run = null;
    }
  }
  if (run) corners.push(run);

  const span = (a, b) => wrap(b - a);
  const list = corners
    .filter((c) => span(c.from, c.to) * SAMPLE_SPACING > 12)
    .map((c) => {
      // Apex: the slowest point of the plan (the tightest point if it's flat).
      let apex = c.from;
      for (let k = 0; k <= span(c.from, c.to); k++) {
        const i = wrap(c.from + k);
        const better = speed[i] < speed[apex] - 0.01 ||
          (Math.abs(speed[i] - speed[apex]) <= 0.01 && Math.abs(LINE_CURVATURE[i]) > Math.abs(LINE_CURVATURE[apex]));
        if (better) apex = i;
      }
      // Walk back over the slowing-down run into the apex.
      let entry = apex;
      let dist = 0;
      while (speed[wrap(entry - 1)] > speed[entry] + 1e-3 && dist < 600) {
        entry = wrap(entry - 1);
        dist += LINE_STEP[entry];
      }
      const drop = speed[entry] - speed[apex];
      const decel = dist > 0 ? (speed[entry] ** 2 - speed[apex] ** 2) / (2 * dist) : 0;
      const kind = drop < 0.5 ? "flat" : decel < LIFT_DECEL ? "lift" : "brake";
      return {
        from: c.from,
        to: c.to,
        apex,
        entry,
        target: speed[apex],
        entrySpeed: speed[entry],
        kind,
        direction: Math.sign(LINE_CURVATURE[apex]) >= 0 ? "left" : "right",
      };
    });
  list.forEach((c, id) => (c.id = id));

  // For every sample, the corner it belongs to or approaches: each corner owns the
  // track from the end of the previous corner to the end of its own stretch.
  const activeCorner = new Int16Array(N).fill(-1);
  const inOrder = [...list].sort((a, b) => a.from - b.from);
  inOrder.forEach((c, j) => {
    const prev = inOrder[(j - 1 + inOrder.length) % inOrder.length];
    for (let i = inOrder.length > 1 ? wrap(prev.to + 1) : wrap(c.to + 1); ; i = wrap(i + 1)) {
      activeCorner[i] = c.id;
      if (i === c.to) break;
    }
  });

  return { cornerSpeed, envelope, speed, corners: list, activeCorner, vMax: V_MAX, curvature: LINE_CURVATURE };
}

export const PLAN = buildPlan();

// ---------------------------------------------------------------------------
// Guide: what the line and the HUD cue show, from the car's current speed.
// ---------------------------------------------------------------------------

export const GUIDE = { GREEN: 0, YELLOW: 1, RED: 2 };
export const GUIDE_AHEAD = 300; // metres of line coloured ahead of the car
const AHEAD = Math.round(GUIDE_AHEAD / SAMPLE_SPACING);
const BEHIND = Math.round(10 / SAMPLE_SPACING);
const LIFT_TIME = 0.45; // seconds of yellow before a brake point
const CORNER_PAD = 50; // metres of line shown either side of a corner in "corners" mode
const REPORT_AFTER = 60; // metres past the apex when the corner's result is reported

export function createGuide() {
  return {
    state: new Float32Array(N), // GUIDE colour per sample
    alpha: new Float32Array(N), // 0..1 visibility per sample
    from: 0,
    count: 0,
    corner: -1, // corner the cue is about
    reported: false, // its result has been reported
    level: 0, // cue escalation for this corner: 0 approach, 1 lift, 2 brake
    apexSpeed: Infinity,
    wide: false,
    result: null, // { id, target, speed, wide } once a corner is done
    resultSeq: 0,
    // Scratch for one step.
    walkState: new Uint8Array(AHEAD + 1),
    walkDist: new Float32Array(AHEAD + 1),
    walkSpeed: new Float32Array(AHEAD + 1),
    walkNear: new Float32Array(AHEAD + 1),
  };
}

/**
 * Predict the car's speed along the line ahead, assuming full throttle until
 * the envelope says otherwise, and colour each sample:
 *   green  accelerating or flat out
 *   yellow lifting, or holding speed through a corner at its limit
 *   red    braking
 * `mode` is "full", "corners" or "off".
 */
export function stepGuide(g, { index, speed, offTrack = false, mode = "corners" }) {
  const { envelope, cornerSpeed, corners, activeCorner, vMax } = PLAN;
  const st = g.walkState, dist = g.walkDist, vs = g.walkSpeed;
  const i0 = wrap(index);
  const v0 = Math.max(0, speed);

  // ---- Walk forward --------------------------------------------------------
  let v = v0;
  let d = 0;
  for (let k = 0; k <= AHEAD; k++) {
    const i = wrap(i0 + k);
    const e = envelope[i];
    let state;
    if (v >= e - 0.05) {
      // On the envelope: follow it.
      const next = envelope[wrap(i + 1)];
      v = Math.min(v, e);
      if (next < e - 1e-3) {
        const decel = (e * e - next * next) / (2 * LINE_STEP[i]);
        state = decel > LIFT_DECEL ? GUIDE.RED : GUIDE.YELLOW;
      } else if (e < cornerSpeed[i] + 0.05 && e < vMax * 0.97 && next <= e + 0.02) {
        state = GUIDE.YELLOW; // at the corner's limit
      } else {
        state = GUIDE.GREEN;
      }
    } else {
      state = GUIDE.GREEN;
    }
    st[k] = state;
    dist[k] = d;
    vs[k] = v;
    // Advance to the next sample at full throttle (capped by the envelope next step).
    if (state === GUIDE.GREEN || v < e - 0.05) {
      v = Math.sqrt(Math.max(0, v * v + 2 * LINE_STEP[i] * throttleAccel(v, i)));
    } else {
      v = envelope[wrap(i + 1)];
    }
    d += LINE_STEP[i];
  }

  // A short yellow "get ready" stretch before each brake point.
  for (let k = 1; k <= AHEAD; k++) {
    if (st[k] !== GUIDE.RED || st[k - 1] === GUIDE.RED) continue;
    const lead = Math.max(12, vs[k] * LIFT_TIME);
    for (let j = k - 1; j >= 0 && dist[k] - dist[j] <= lead; j--) {
      if (st[j] === GUIDE.GREEN) st[j] = GUIDE.YELLOW;
    }
  }

  // ---- Write colours and visibility ---------------------------------------
  for (let k = 0; k < g.count; k++) g.alpha[wrap(g.from + k)] = 0;
  g.from = wrap(i0 - BEHIND);
  g.count = BEHIND + AHEAD + 1;
  if (mode !== "off") {
    // Distance to the nearest non-green sample, for "corners" mode.
    let lastBusy = -Infinity;
    const nearBusy = g.walkNear;
    for (let k = 0; k <= AHEAD; k++) {
      if (st[k] !== GUIDE.GREEN) lastBusy = dist[k];
      nearBusy[k] = dist[k] - lastBusy;
    }
    let nextBusy = Infinity;
    for (let k = AHEAD; k >= 0; k--) {
      if (st[k] !== GUIDE.GREEN) nextBusy = dist[k];
      nearBusy[k] = Math.min(nearBusy[k], nextBusy - dist[k]);
    }
    for (let k = -BEHIND; k <= AHEAD; k++) {
      const i = wrap(i0 + k);
      const kk = Math.max(k, 0);
      const along = k < 0 ? k * SAMPLE_SPACING : dist[kk];
      let a = smoothstep(-10, 2, along) * (1 - smoothstep(GUIDE_AHEAD - 90, GUIDE_AHEAD, along));
      if (mode === "corners") a *= 1 - smoothstep(CORNER_PAD * 0.5, CORNER_PAD, nearBusy[kk]);
      g.alpha[i] = a;
      g.state[i] = st[kk];
    }
  }

  // ---- Cue for the next corner ----------------------------------------------
  const id = activeCorner[i0];
  const report = () => {
    if (g.corner >= 0 && !g.reported && Number.isFinite(g.apexSpeed)) {
      g.result = { id: g.corner, target: corners[g.corner].target, speed: g.apexSpeed, wide: g.wide };
      g.resultSeq++;
    }
    g.reported = true;
  };
  if (id !== g.corner) {
    report(); // a corner shorter than the reporting distance
    g.corner = id;
    g.apexSpeed = Infinity;
    g.wide = false;
    g.reported = false;
    g.level = 0;
  }
  if (id < 0) return null;
  const c = corners[id];
  // Past the apex (still inside the corner's stretch)?
  const sinceApex = wrap(i0 - c.apex);
  const pastApex = sinceApex <= wrap(c.to - c.apex) && sinceApex < N / 2;
  let toApex = 0;
  if (pastApex) {
    // Running wide on the exit counts too; report once clear of the apex.
    if (offTrack) g.wide = true;
    if (sinceApex * SAMPLE_SPACING >= REPORT_AFTER) report();
  } else {
    for (let i = i0; i !== c.apex; i = wrap(i + 1)) toApex += LINE_STEP[i];
    // The apex speed: slowest over the last 40 m of the run-in.
    if (toApex < 40) {
      g.apexSpeed = Math.min(g.apexSpeed, v0);
      if (offTrack) g.wide = true;
    }
  }

  // Your brake point: the first red ahead.
  let brakeAt = -1;
  let brakeSpeed = v0;
  for (let k = 0; k <= AHEAD; k++) {
    if (st[k] === GUIDE.RED) {
      brakeAt = dist[k];
      brakeSpeed = vs[k];
      break;
    }
  }
  // Brake when the red is a reaction time away. Yellow just before a brake point
  // means "get ready" (the cue counts down); other yellow means lift or hold.
  const lead = Math.max(12, brakeSpeed * LIFT_TIME) + 1; // as the yellow stretch above
  const brakeNow = st[0] === GUIDE.RED || (brakeAt >= 0 && brakeAt <= Math.max(8, v0 * 0.15));
  const liftNow = st[0] === GUIDE.YELLOW && !(brakeAt >= 0 && brakeAt <= lead);
  // The cue only escalates through a corner (approach, lift, brake) so it doesn't
  // flicker while the car rides the edge of the envelope; "over" is always live.
  const level = brakeNow ? 2 : liftNow ? 1 : 0;
  if (!pastApex) g.level = Math.max(g.level, level);
  const over = v0 > envelope[i0] * 1.03 + 0.5;
  let status;
  if (over) status = "over";
  else if (g.level === 2) status = "brake";
  else if (c.kind === "flat") status = "flat";
  else if (g.level === 1) status = "lift";
  else status = "approach";
  return {
    corner: id,
    kind: c.kind,
    direction: c.direction,
    status,
    target: c.target,
    pastApex,
    toApex,
    brakeIn: brakeAt, // metres to your brake point, -1 if none in range
  };
}

function smoothstep(a, b, x) {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}
