// =============================================================================
// Vehicle simulation: bicycle model with Pacejka-style tyres, load transfer,
// aero, drivetrain and wall collisions. No React and no three.js; the track
// is passed in as a `project(x, z, hint)` function so this stays testable.
//
// Heading convention (shared with the renderer):
//   forward = (-sin yaw, -cos yaw), left = (-cos yaw, sin yaw)
//   yaw increases when turning left. vx is forward speed, vy is speed to the left.
// =============================================================================

import { TYRE, PEAK_SLIP, magic, frictionCoefficient, combine } from "./tyre.js";
import { ENGINE, createDrivetrain, stepDrivetrain, freeRev } from "./drivetrain.js";

export const CAR = {
  mass: 800, // kg, car + driver
  wheelbase: 3.4, // matches the hero car model
  cgToFront: 1.87, // 45% front static weight
  cgHeight: 0.3,
  yawInertia: 1150,
  maxSteer: 0.3, // rad at the front wheels
  halfWidth: 0.95,
  dragArea: 1.45, // Cd·A
  liftArea: 3.4, // Cl·A (downforce)
  aeroFront: 0.44, // share of downforce on the front axle
  rolling: 0.015,
  brakeForce: 46000, // N, both axles
  brakeBias: 0.58, // front share
  rearGripBias: 1.07, // slight understeer balance: the rear lets go after the front
};
CAR.cgToRear = CAR.wheelbase - CAR.cgToFront;

export const G = 9.81;
export const AIR = 0.5 * 1.225; // half the air density, kg/m³

// Surface resistance, m/s²: `drag` + `dragPerSpeed` × speed. Grass and gravel slow the
// car mostly in proportion to speed (ploughing), so they punish a fast arrival but let
// a stopped car drive out. The constant part must stay below what the rear tyres can
// transmit on that surface, or a car at rest can never accelerate (tested).
export const SURFACE = {
  asphalt: { grip: 1.0, drag: 0, dragPerSpeed: 0 },
  kerb: { grip: 0.92, drag: 1.2, dragPerSpeed: 0 },
  runoff: { grip: 0.9, drag: 0.6, dragPerSpeed: 0 }, // painted asphalt runoff
  grass: { grip: 0.65, drag: 0.8, dragPerSpeed: 0.08 },
  gravel: { grip: 0.5, drag: 1.5, dragPerSpeed: 0.2 },
};

// Overtake boost: an electric deployment on top of the engine.
export const BOOST = {
  power: 120000, // W at the wheels while deploying
  capacity: 0.96e6, // J: 8 s of full deployment
  minSpeed: 60 / 3.6, // m/s
  harvestEfficiency: 0.09, // share of braking energy recovered
  trickle: 1 / 75, // battery fraction per second when not deploying
};

// speedSteer is applied to the controls (sim/input.js); racingLine ("off" | "corners" |
// "full") and cornerCue are display-only (sim/speedPlan.js); the rest act inside the sim.
export const DEFAULT_ASSISTS = {
  steering: true,
  speedSteer: true,
  traction: true,
  abs: true,
  stability: true,
  racingLine: "corners",
  cornerCue: true,
};

export const WALL = { restitution: 0.25, friction: 0.35, minImpact: 1.5 };

// Collision probes on the car outline: [metres forward of the CG, metres to the left].
export const PROBES = [
  [2.86, 0], // nose
  [2.55, 0.9],
  [2.55, -0.9],
  [0.6, 1.0],
  [0.6, -1.0],
  [-1.8, 1.0],
  [-1.8, -1.0],
  [-2.45, 0.6],
  [-2.45, -0.6],
];

/** World position of a probe for the car's current pose. */
export function probeWorld(s, [a, b]) {
  const fx = -Math.sin(s.yaw), fz = -Math.cos(s.yaw);
  const lx = -Math.cos(s.yaw), lz = Math.sin(s.yaw);
  return { x: s.x + fx * a + lx * b, z: s.z + fz * a + lz * b };
}

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

export function createVehicle({ x, z, yaw }) {
  return {
    x,
    z,
    yaw,
    vx: 0,
    vy: 0,
    yawRate: 0,
    steerAngle: 0,
    ax: 0,
    ay: 0,
    reverse: false,
    reverseTimer: 0,
    drivetrain: createDrivetrain(),
    loadFront: 0,
    loadRear: 0,
    slipFront: 0,
    slipRear: 0,
    saturationFront: 0,
    saturationRear: 0,
    surface: "asphalt",
    trackIndex: -1,
    track: null, // last projection result
    impact: 0, // impact speed (m/s) on the step a wall hit starts, else 0
    wallContact: false,
    distance: 0, // metres travelled, for wheel rotation
    battery: 1, // 0..1 overtake boost energy
    boosting: false,
  };
}

export function resetVehicle(s, { x, z, yaw }) {
  const fresh = createVehicle({ x, z, yaw });
  Object.assign(s, fresh);
}

export function speedOf(s) {
  return Math.hypot(s.vx, s.vy);
}

function surfaceFor(p) {
  if (p.surface) return p.surface;
  if (p.onTrack) return "asphalt";
  if (p.onKerb) return "kerb";
  return "runoff";
}

/** Highest lateral acceleration the car can hold at speed v, m/s². */
export function lateralLimit(v, gripScale) {
  const down = AIR * CAR.liftArea * v * v;
  return TYRE.muPeak * gripScale * G * (1 + down / (CAR.mass * G)) * 0.94;
}

/**
 * Advance the vehicle by `dt` seconds.
 * input: { throttle 0..1, brake 0..1, steer -1..1 (positive = left) }
 * track: { project(x, z, hint), barrier }
 */
export function stepVehicle(s, input, dt, track, assists = DEFAULT_ASSISTS, options = {}) {
  s.impact = 0;

  // ---- Held on the grid (start lights): engine free-revs, car stays put --
  if (options.hold) {
    freeRev(s.drivetrain, clamp(input.throttle, 0, 1), dt);
    s.vx = s.vy = s.yawRate = 0;
    s.steerAngle += clamp(clamp(input.steer, -1, 1) * CAR.maxSteer - s.steerAngle, -2.6 * dt, 2.6 * dt);
    s.track = track.project(s.x, s.z, s.trackIndex);
    s.trackIndex = s.track.index ?? -1;
    return s;
  }

  // ---- Surface ----------------------------------------------------------
  const proj = track.project(s.x, s.z, s.trackIndex);
  s.trackIndex = proj.index ?? -1;
  s.surface = surfaceFor(proj);
  const surface = SURFACE[s.surface];

  // ---- Reverse gear: hold brake at a standstill -------------------------
  let throttle = clamp(input.throttle, 0, 1);
  let brake = clamp(input.brake, 0, 1);
  if (!s.reverse) {
    if (brake > 0.5 && throttle < 0.05 && Math.abs(s.vx) < 0.05) {
      s.reverseTimer += dt;
      if (s.reverseTimer > 0.35) s.reverse = true;
    } else {
      s.reverseTimer = 0;
    }
  } else if (throttle > 0.05 && s.vx > -0.5) {
    s.reverse = false;
    s.reverseTimer = 0;
  }
  if (s.reverse) {
    const back = brake;
    brake = throttle;
    throttle = 0;
    input = { ...input, reverseThrottle: back };
  }

  const vx = s.vx;
  const speed = Math.abs(vx);

  // ---- Steering ----------------------------------------------------------
  let steerLimit = CAR.maxSteer;
  if (assists.steering && speed > 5) {
    // Enough lock for the tightest corner the tyres can hold, plus peak slip.
    const needed = (CAR.wheelbase * lateralLimit(speed, surface.grip)) / (speed * speed);
    steerLimit = clamp(needed + PEAK_SLIP * 0.55, 0.05, CAR.maxSteer);
  }
  const targetSteer = clamp(input.steer, -1, 1) * steerLimit;
  s.steerAngle += clamp(targetSteer - s.steerAngle, -2.6 * dt, 2.6 * dt);
  const delta = s.steerAngle;

  // ---- Hills: gravity along the slope, load change over crests and dips ----
  const grade = proj.grade ?? 0;
  const tLen = proj.tangent ? Math.hypot(proj.tangent.x, proj.tangent.z) || 1 : 1;
  // How much of the track's gradient lies along the car's heading.
  const along = proj.tangent
    ? (-Math.sin(s.yaw) * proj.tangent.x - Math.cos(s.yaw) * proj.tangent.z) / tLen
    : 0;
  const slopeForce = (-CAR.mass * G * grade * along) / Math.sqrt(1 + grade * grade);
  const vertical = clamp(1 + (vx * vx * (proj.verticalCurvature ?? 0)) / G, 0.55, 1.6);
  s.vertical = vertical;

  // ---- Loads -------------------------------------------------------------
  const down = AIR * CAR.liftArea * vx * vx;
  const transfer = (CAR.mass * s.ax * CAR.cgHeight) / CAR.wheelbase;
  const staticFront = (CAR.mass * G * CAR.cgToRear) / CAR.wheelbase;
  const staticRear = (CAR.mass * G * CAR.cgToFront) / CAR.wheelbase;
  const loadFront = Math.max(400, staticFront * vertical - transfer + down * CAR.aeroFront);
  const loadRear = Math.max(400, staticRear * vertical + transfer + down * (1 - CAR.aeroFront));
  s.loadFront = loadFront;
  s.loadRear = loadRear;

  const fmaxFront = frictionCoefficient(loadFront, staticFront, surface.grip) * loadFront;
  const fmaxRear = frictionCoefficient(loadRear, staticRear, surface.grip) * loadRear * CAR.rearGripBias;

  // ---- Longitudinal requests --------------------------------------------
  let driveForce = s.reverse ? 0 : stepDrivetrain(s.drivetrain, vx, throttle, dt);
  // Engine braking fades out near a standstill so the car never creeps backwards.
  if (driveForce < 0) driveForce *= clamp(vx / 2, 0, 1);
  // Traction control also cuts drive when the rear starts to slide sideways.
  if (assists.traction && driveForce > 0 && speed > 5) {
    const over = Math.abs(s.slipRear) - PEAK_SLIP * 0.75;
    if (over > 0) driveForce *= clamp(1 - over / (PEAK_SLIP * 0.35), 0, 1);
  }
  const dir = vx >= 0 ? 1 : -1;
  const brakeTotal = brake * CAR.brakeForce;
  let fxFrontReq = -dir * brakeTotal * CAR.brakeBias;
  // Overtake boost: extra electric drive while the button is held.
  // Hysteresis: once empty, boost re-arms only after a little charge comes back.
  const charged = s.boosting ? s.battery > 0 : s.battery > 0.05;
  s.boosting = !!input.boost && !s.reverse && throttle > 0.5 && charged && vx > BOOST.minSpeed;
  if (s.boosting) {
    driveForce += (BOOST.power * throttle) / Math.max(vx, 10);
    s.battery = Math.max(0, s.battery - (BOOST.power * throttle * dt) / BOOST.capacity);
  } else {
    const harvest = brakeTotal * Math.max(vx, 0) * BOOST.harvestEfficiency;
    s.battery = Math.min(1, s.battery + (harvest * dt) / BOOST.capacity + BOOST.trickle * dt);
  }
  let fxRearReq = driveForce - dir * brakeTotal * (1 - CAR.brakeBias);
  if (s.reverse) {
    const rev = input.reverseThrottle * ENGINE.reverseForce;
    fxRearReq += vx > -ENGINE.reverseMaxSpeed ? -rev : 0;
  }

  // ---- Slip angles and lateral forces -----------------------------------
  // Full dynamics above ~5 m/s, kinematic steering below (slip is ill-defined at rest).
  const dyn = vx > 0 ? smoothstep(2, 5, vx) : 0;
  const vxSafe = Math.max(Math.abs(vx), 0.5);
  const slipFront = delta - Math.atan2(s.vy + CAR.cgToFront * s.yawRate, vxSafe);
  const slipRear = -Math.atan2(s.vy - CAR.cgToRear * s.yawRate, vxSafe);
  s.slipFront = slipFront;
  s.slipRear = slipRear;

  const fyFrontRaw = fmaxFront * magic(slipFront);
  const fyRearRaw = fmaxRear * magic(slipRear);

  const tc = assists.traction;
  const abs = assists.abs;
  const front = combine(fxFrontReq, fyFrontRaw, fmaxFront, abs);
  const rear = combine(fxRearReq, fyRearRaw, fmaxRear, fxRearReq >= 0 ? tc : abs);
  s.saturationFront = front.saturation;
  s.saturationRear = rear.saturation;

  // ---- Resistances -------------------------------------------------------
  const drag = AIR * CAR.dragArea * vx * Math.abs(vx);
  const surfaceDecel = surface.drag + surface.dragPerSpeed * Math.abs(vx);
  const roll = (CAR.rolling * CAR.mass * G + surfaceDecel * CAR.mass) * Math.sign(vx) *
    Math.min(1, Math.abs(vx) / 0.5);

  // ---- Dynamic model -----------------------------------------------------
  const cosD = Math.cos(delta);
  const sinD = Math.sin(delta);
  const fxBody = rear.fx + front.fx * cosD - front.fy * sinD - drag - roll + slopeForce;
  const fyBody = rear.fy + front.fy * cosD + front.fx * sinD;
  const mz = CAR.cgToFront * (front.fy * cosD + front.fx * sinD) - CAR.cgToRear * rear.fy;

  let ax = fxBody / CAR.mass;
  let dvy = fyBody / CAR.mass - s.yawRate * vx;
  let dr = mz / CAR.yawInertia;

  // Stability control: damp yaw rate beyond what the steering asks for.
  if (assists.stability && dyn > 0) {
    const rTarget = clamp(
      (vx * Math.tan(delta)) / CAR.wheelbase,
      -lateralLimit(speed, surface.grip) / Math.max(speed, 1),
      lateralLimit(speed, surface.grip) / Math.max(speed, 1),
    );
    const excess = s.yawRate - rTarget;
    if (Math.sign(excess) === Math.sign(s.yawRate) && Math.abs(s.yawRate) > Math.abs(rTarget)) {
      dr -= excess * 9;
    }
    // Catch the rear before it passes the peak of the tyre curve.
    const rearOver = Math.abs(s.slipRear) - PEAK_SLIP * 0.8;
    if (rearOver > 0) dr -= Math.sign(s.slipRear) * rearOver * 60;
    dvy -= s.vy * 0.8;
  }

  // Kinematic blend at low speed.
  const rKin = (vx * Math.tan(delta)) / CAR.wheelbase;
  const vyKin = rKin * CAR.cgToRear;

  let newVx = vx + (ax + s.yawRate * s.vy * dyn) * dt;
  // Brakes and rolling resistance can stop the car but never push it backwards.
  if (vx >= 0 && newVx < 0 && !(s.reverse && input.reverseThrottle > 0)) newVx = 0;
  if (vx < 0 && newVx > 0 && throttle === 0) newVx = 0;
  if (s.reverse) {
    newVx = Math.max(newVx, -ENGINE.reverseMaxSpeed);
  }

  const dynVy = s.vy + dvy * dt;
  const dynR = s.yawRate + dr * dt;
  s.vy = dyn * dynVy + (1 - dyn) * vyKin;
  s.yawRate = dyn * dynR + (1 - dyn) * rKin;
  s.vx = newVx;
  s.ax = (s.vx - vx) / dt;
  s.ay = fyBody / CAR.mass * dyn + s.yawRate * s.vx * (1 - dyn);

  // ---- Integrate pose ----------------------------------------------------
  s.yaw += s.yawRate * dt;
  const fwdX = -Math.sin(s.yaw);
  const fwdZ = -Math.cos(s.yaw);
  const leftX = -Math.cos(s.yaw);
  const leftZ = Math.sin(s.yaw);
  s.x += (fwdX * s.vx + leftX * s.vy) * dt;
  s.z += (fwdZ * s.vx + leftZ * s.vy) * dt;
  s.distance += s.vx * dt;

  // ---- Walls: test points around the car outline ------------------------
  const after = track.project(s.x, s.z, s.trackIndex);
  s.trackIndex = after.index ?? s.trackIndex;
  s.track = after;
  let touching = false;
  for (let pass = 0; pass < 3; pass++) {
    let worst = null;
    for (const probe of PROBES) {
      const w = probeWorld(s, probe);
      const p = track.project(w.x, w.z, s.trackIndex);
      const pen = p.absDistance - track.barrier;
      if (pen > 0 && (!worst || pen > worst.pen)) worst = { pen, p, w };
    }
    if (!worst) break;
    touching = true;
    const side = Math.sign(worst.p.distance) || 1;
    // Unit normal pointing from the wall back toward the centreline.
    const nx = -side * worst.p.normal.x;
    const nz = -side * worst.p.normal.z;
    s.x += nx * (worst.pen + 0.005);
    s.z += nz * (worst.pen + 0.005);

    // Rigid-body impulse at the contact point (2D, yaw about +Y).
    const fx = -Math.sin(s.yaw), fz = -Math.cos(s.yaw);
    const lx = -Math.cos(s.yaw), lz = Math.sin(s.yaw);
    let vxw = fx * s.vx + lx * s.vy;
    let vzw = fz * s.vx + lz * s.vy;
    const rx = worst.w.x - s.x, rz = worst.w.z - s.z;
    const w = s.yawRate;
    const pvx = vxw + w * rz, pvz = vzw - w * rx;
    const vn = pvx * nx + pvz * nz;
    if (vn < 0) {
      const rn = rz * nx - rx * nz;
      const jn = (-(1 + WALL.restitution) * vn) / (1 / CAR.mass + (rn * rn) / CAR.yawInertia);
      // Friction along the wall, capped by Coulomb and by stopping the slide.
      const tx = -nz, tz = nx;
      const vt = pvx * tx + pvz * tz;
      const rt = rz * tx - rx * tz;
      const jtStop = -vt / (1 / CAR.mass + (rt * rt) / CAR.yawInertia);
      const jt = clamp(jtStop, -WALL.friction * jn, WALL.friction * jn);
      vxw += (jn * nx + jt * tx) / CAR.mass;
      vzw += (jn * nz + jt * tz) / CAR.mass;
      s.yawRate += (jn * rn + jt * rt) / CAR.yawInertia;
      s.vx = vxw * fx + vzw * fz;
      s.vy = vxw * lx + vzw * lz;
      if (!s.wallContact && -vn > WALL.minImpact) s.impact = Math.max(s.impact, -vn);
    }
  }
  s.track = track.project(s.x, s.z, s.trackIndex);
  s.wallContact = touching;

  return s;
}
