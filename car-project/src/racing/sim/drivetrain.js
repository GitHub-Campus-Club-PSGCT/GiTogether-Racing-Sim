// Engine torque curve, 8-speed gearbox and automatic shifting.

export const ENGINE = {
  maxTorque: 700, // N·m
  idleRpm: 4000,
  redline: 12000,
  limiter: 12400,
  upshiftRpm: 11800,
  downshiftRpm: 10900,
  shiftTime: 0.06, // torque cut during a shift, seconds
  efficiency: 0.93,
  engineBraking: 1500, // N at redline, scales with rpm
  reverseForce: 8000,
  reverseMaxSpeed: 12,
};

const WHEEL_RADIUS = 0.36;
const RAD_PER_RPM = (2 * Math.PI) / 60;

// Top speed of each gear at the redline, km/h.
const GEAR_TOP_KMH = [105, 140, 175, 210, 245, 280, 315, 350];
export const GEAR_RATIOS = GEAR_TOP_KMH.map(
  (kmh) => (ENGINE.redline * RAD_PER_RPM * WHEEL_RADIUS) / (kmh / 3.6),
);
export const GEAR_COUNT = GEAR_RATIOS.length;

const smoothstep = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function torqueAt(rpm) {
  if (rpm >= ENGINE.limiter) return 0;
  const rise = 0.72 + 0.28 * smoothstep(4000, 8500, rpm);
  const fall = 1 - 0.12 * smoothstep(10800, 12500, rpm);
  return ENGINE.maxTorque * rise * fall;
}

export function wheelRpm(speed, gear) {
  return (Math.abs(speed) / WHEEL_RADIUS) * GEAR_RATIOS[gear - 1] / RAD_PER_RPM;
}

export function createDrivetrain() {
  return { gear: 1, rpm: ENGINE.idleRpm, shiftTimer: 0, shifted: 0 };
}

/**
 * Advance the gearbox and return the drive force at the rear axle (N).
 * `dt.shifted` is set to +1 / -1 on the step a shift starts, for audio.
 */
export function stepDrivetrain(d, speed, throttle, dt) {
  d.shifted = 0;
  if (d.shiftTimer > 0) d.shiftTimer -= dt;

  const coupled = wheelRpm(speed, d.gear);
  if (d.shiftTimer <= 0) {
    if (d.gear < GEAR_COUNT && coupled > ENGINE.upshiftRpm) {
      d.gear += 1;
      d.shiftTimer = ENGINE.shiftTime;
      d.shifted = 1;
    } else if (d.gear > 1 && wheelRpm(speed, d.gear - 1) < ENGINE.downshiftRpm) {
      d.gear -= 1;
      d.shiftTimer = ENGINE.shiftTime * 0.6;
      d.shifted = -1;
    }
  }

  // Below the launch rpm the clutch slips, so the engine holds revs.
  const launchRpm = ENGINE.idleRpm + 3600 * throttle;
  const targetRpm = Math.max(wheelRpm(speed, d.gear), d.gear === 1 ? launchRpm : ENGINE.idleRpm);
  d.rpm += (targetRpm - d.rpm) * Math.min(1, dt * 22);

  const ratio = GEAR_RATIOS[d.gear - 1];
  const cut = d.shiftTimer > 0 ? 0 : 1;
  const drive = (throttle * cut * torqueAt(d.rpm) * ratio * ENGINE.efficiency) / WHEEL_RADIUS;
  const braking = throttle > 0.02 ? 0 : ENGINE.engineBraking * (d.rpm / ENGINE.redline);
  return drive - braking;
}

/** Neutral / clutch-in revving on the grid, with a limiter bounce. */
export function freeRev(d, throttle, dt) {
  d.shifted = 0;
  d.gear = 1;
  const target = ENGINE.idleRpm + (ENGINE.limiter - 300 - ENGINE.idleRpm) * throttle;
  const rate = target > d.rpm ? 9 : 4; // revs rise faster than they fall
  d.rpm += (target - d.rpm) * Math.min(1, dt * rate);
  if (d.rpm > ENGINE.limiter - 350) d.rpm -= 600 * Math.random(); // limiter bounce
}

/** Best full-throttle drive force (N) at `speed` in any gear, ignoring shift cuts. */
export function maxDriveForce(speed) {
  let best = 0;
  for (let g = 1; g <= GEAR_COUNT; g++) {
    const rpm = Math.max(wheelRpm(speed, g), g === 1 ? ENGINE.idleRpm + 3600 : ENGINE.idleRpm);
    if (rpm > ENGINE.upshiftRpm && g < GEAR_COUNT) continue;
    best = Math.max(best, (torqueAt(rpm) * GEAR_RATIOS[g - 1] * ENGINE.efficiency) / WHEEL_RADIUS);
  }
  return best;
}
