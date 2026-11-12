import { describe, it, expect } from "vitest";
import { createVehicle, stepVehicle, speedOf, DEFAULT_ASSISTS, PROBES, probeWorld } from "./vehicleSim.js";
import { createLapTracker, stepLapTracker } from "./lapTracker.js";
import {
  projectToTrack,
  BARRIER_OFFSET,
  START_CONFIG,
  GRID_START,
  CHECKPOINTS,
  CIRCUIT_CURVE,
  HALF_WIDTH,
} from "../circuitDefinition.js";

const DT = 1 / 120;
const KMH = 1 / 3.6;

// An endless flat runway: always on asphalt, no walls.
const runway = {
  barrier: 1e9,
  project: () => ({
    index: 0, u: 0, distance: 0, absDistance: 0,
    centerPoint: { x: 0, z: 0 }, normal: { x: 1, z: 0 }, tangent: { x: 0, z: -1 },
    onTrack: true, onKerb: false, onRunoff: false,
  }),
};
const circuit = { barrier: BARRIER_OFFSET, project: projectToTrack };

function run(s, input, seconds, track = runway, assists = DEFAULT_ASSISTS) {
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps; i++) stepVehicle(s, input, DT, track, assists);
  return s;
}

describe("straight-line performance", () => {
  it("does 0-100 km/h in a believable time", () => {
    const s = createVehicle({ x: 0, z: 0, yaw: 0 });
    let t = 0;
    while (s.vx < 100 * KMH && t < 10) {
      stepVehicle(s, { throttle: 1, brake: 0, steer: 0 }, DT, runway);
      t += DT;
    }
    expect(t).toBeGreaterThan(1.7);
    expect(t).toBeLessThan(3.6);
  });

  it("reaches a top speed set by drag, not a clamp", () => {
    const s = createVehicle({ x: 0, z: 0, yaw: 0 });
    run(s, { throttle: 1, brake: 0, steer: 0 }, 60);
    const kmh = s.vx * 3.6;
    expect(kmh).toBeGreaterThan(300);
    expect(kmh).toBeLessThan(365);
    expect(s.drivetrain.gear).toBe(8);
  });

  it("stops from 300 km/h in a short distance with ABS", () => {
    const s = createVehicle({ x: 0, z: 0, yaw: 0 });
    s.vx = 300 * KMH;
    const z0 = s.z;
    let t = 0;
    while (s.vx > 0 && t < 10) {
      stepVehicle(s, { throttle: 0, brake: 1, steer: 0 }, DT, runway);
      t += DT;
    }
    expect(s.vx).toBe(0);
    console.log(`300-0 km/h: ${Math.abs(s.z - z0).toFixed(1)} m in ${t.toFixed(2)} s`);
    const dist = Math.abs(s.z - z0);
    expect(dist).toBeGreaterThan(60);
    expect(dist).toBeLessThan(140);
  });

  it("locks the fronts under full braking without ABS", () => {
    const s = createVehicle({ x: 0, z: 0, yaw: 0 });
    s.vx = 40;
    stepVehicle(s, { throttle: 0, brake: 1, steer: 0 }, DT, runway, { ...DEFAULT_ASSISTS, abs: false });
    expect(s.saturationFront).toBeGreaterThan(1);
  });

  it("does not creep backwards at rest", () => {
    const s = createVehicle({ x: 0, z: 0, yaw: 0 });
    run(s, { throttle: 0, brake: 0, steer: 0 }, 3);
    expect(s.vx).toBe(0);
    expect(s.z).toBe(0);
  });

  it("engages reverse when brake is held at a standstill", () => {
    const s = createVehicle({ x: 0, z: 0, yaw: 0 });
    run(s, { throttle: 0, brake: 1, steer: 0 }, 2);
    expect(s.reverse).toBe(true);
    expect(s.vx).toBeLessThan(-1);
  });
});

describe("overtake boost", () => {
  it("accelerates harder and reaches a higher top speed", () => {
    const plain = createVehicle({ x: 0, z: 0, yaw: 0 });
    const boosted = createVehicle({ x: 0, z: 0, yaw: 0 });
    plain.vx = boosted.vx = 40;
    run(plain, { throttle: 1, brake: 0, steer: 0 }, 3);
    run(boosted, { throttle: 1, brake: 0, steer: 0, boost: true }, 3);
    expect(boosted.vx).toBeGreaterThan(plain.vx + 2);
  });

  it("drains in about 8 s and recharges under braking", () => {
    const s = createVehicle({ x: 0, z: 0, yaw: 0 });
    s.vx = 40;
    run(s, { throttle: 1, brake: 0, steer: 0, boost: true }, 4);
    expect(s.battery).toBeGreaterThan(0.4);
    expect(s.battery).toBeLessThan(0.6);
    run(s, { throttle: 1, brake: 0, steer: 0, boost: true }, 6);
    expect(s.battery).toBeLessThan(0.05);
    expect(s.boosting).toBe(false);
    run(s, { throttle: 0, brake: 1, steer: 0 }, 2.5);
    expect(s.battery).toBeGreaterThan(0.05);
  });

  it("does nothing below 60 km/h", () => {
    const s = createVehicle({ x: 0, z: 0, yaw: 0 });
    stepVehicle(s, { throttle: 1, brake: 0, steer: 0, boost: true }, DT, runway);
    expect(s.boosting).toBe(false);
    expect(s.battery).toBe(1);
  });
});

describe("cornering", () => {
  function steadyLateralG(speed) {
    const s = createVehicle({ x: 0, z: 0, yaw: 0 });
    s.vx = speed;
    let peak = 0;
    for (let i = 0; i < 6 / DT; i++) {
      const err = speed - s.vx;
      const input = { throttle: Math.max(0, Math.min(1, err * 0.6)), brake: 0, steer: 1 };
      stepVehicle(s, input, DT, runway);
      if (i > 3 / DT) peak = Math.max(peak, Math.abs(s.yawRate * speedOf(s)));
    }
    return peak / 9.81;
  }

  it("holds plausible lateral g, more with downforce at speed", () => {
    const slow = steadyLateralG(25);
    const fast = steadyLateralG(65);
    expect(slow).toBeGreaterThan(1.3);
    expect(slow).toBeLessThan(3.2);
    expect(fast).toBeGreaterThan(slow);
    expect(fast).toBeLessThan(6.5);
  });

  it("turns left for positive steer (yaw increases)", () => {
    const s = createVehicle({ x: 0, z: 0, yaw: 0 });
    s.vx = 20;
    run(s, { throttle: 0.3, brake: 0, steer: 1 }, 0.5);
    expect(s.yaw).toBeGreaterThan(0);
    expect(s.x).toBeLessThan(0); // left of -Z is -X
  });
});

describe("walls", () => {
  it("never lets any part of the car through a barrier", () => {
    const cases = [];
    for (const u of [0.02, 0.18, 0.33, 0.5, 0.7, 0.86]) {
      for (const side of [1, -1]) {
        for (const angle of [0.25, 0.6, 1.2]) {
          for (const speed of [15, 45, 80]) cases.push({ u, side, angle, speed });
        }
      }
    }
    let worst = 0;
    for (const c of cases) {
      const p = CIRCUIT_CURVE.getPointAt(c.u);
      const t = CIRCUIT_CURVE.getTangentAt(c.u).normalize();
      const yaw = Math.atan2(-t.x, -t.z) + c.side * c.angle; // aim toward one wall
      const s = createVehicle({ x: p.x, z: p.z, yaw });
      s.vx = c.speed;
      for (let i = 0; i < 2.5 / DT; i++) {
        stepVehicle(s, { throttle: 0.6, brake: 0, steer: 0 }, DT, circuit);
        for (const probe of PROBES) {
          const w = probeWorld(s, probe);
          worst = Math.max(worst, projectToTrack(w.x, w.z).absDistance - BARRIER_OFFSET);
        }
      }
    }
    expect(worst).toBeLessThan(0.02);
  });

  it("keeps the car inside the barrier and reports one impact", () => {
    const s = createVehicle({ x: START_CONFIG.x + 40, z: START_CONFIG.z, yaw: START_CONFIG.yaw });
    // Aim 35° toward the outside of the main straight (+Z side).
    s.yaw = START_CONFIG.yaw - 0.6;
    s.vx = 35;
    let impacts = 0;
    for (let i = 0; i < 3 / DT; i++) {
      stepVehicle(s, { throttle: 0.5, brake: 0, steer: 0 }, DT, circuit);
      if (s.impact > 0) impacts++;
      expect(s.track.absDistance).toBeLessThanOrEqual(BARRIER_OFFSET);
    }
    expect(impacts).toBeGreaterThanOrEqual(1);
    expect(impacts).toBeLessThanOrEqual(3);
    expect(speedOf(s)).toBeLessThan(35);
  });
});

import { autopilot } from "./autopilot.js";

function driveLap(maxSeconds = 300) {
  const s = createVehicle(GRID_START); // the real start: grid box behind the line
  const laps = createLapTracker();
  let lapTime = null, wallHits = 0;
  for (let i = 0; i < maxSeconds / DT && lapTime == null; i++) {
    stepVehicle(s, autopilot(s), DT, circuit);
    if (s.impact > 0) wallHits++;
    const r = stepLapTracker(laps, {
      u: s.track.u,
      speed: s.vx,
      dt: DT,
      checkpoints: CHECKPOINTS,
      offset: s.track.absDistance,
      halfWidth: HALF_WIDTH,
    });
    if (r.lapCompleted) lapTime = laps.lastLapTime;
  }
  return { s, lapTime, wallHits, strikes: laps.limitEvents };
}

describe("full lap", () => {
  // The autopilot drives the racing-line assist's plan, so this also proves the plan
  // the player is shown can be driven: no walls, and no track-limit strikes.
  it("an autopilot completes a valid lap of the real circuit", () => {
    const { lapTime, wallHits, strikes } = driveLap();
    console.log(`autopilot lap: ${lapTime?.toFixed(2)} s, wall hits: ${wallHits}`);
    expect(lapTime).not.toBeNull();
    expect(lapTime).toBeGreaterThan(60);
    expect(lapTime).toBeLessThan(200);
    expect(wallHits).toBe(0);
    expect(strikes).toBe(0);
  });

  it("is deterministic: same inputs give the same lap", () => {
    const a = driveLap();
    const b = driveLap();
    expect(a.lapTime).toBe(b.lapTime);
    expect(a.s.x).toBe(b.s.x);
    expect(a.s.z).toBe(b.s.z);
  });
});

describe("lap tracker", () => {
  const tick = (t, u) => stepLapTracker(t, { u, speed: 30, dt: 0.05, checkpoints: CHECKPOINTS });

  it("counts a lap only after passing the checkpoints", () => {
    const t = createLapTracker();
    let done = false;
    for (let k = 0; k <= 400 && !done; k++) done = tick(t, (k / 400) % 1).lapCompleted;
    expect(done).toBe(true);
    expect(t.lap).toBe(2);
    expect(t.sectorTimes.every((x) => x != null)).toBe(true);
  });

  it("rejects a lap that skips most of the circuit", () => {
    const t = createLapTracker();
    for (let k = 0; k < 200; k++) tick(t, 0.9 + (k % 10) * 0.009);
    const r = tick(t, 0.01);
    expect(r.lapCompleted).toBe(false);
    expect(t.lap).toBe(1);
  });
});

describe("live delta", () => {
  it("is zero-ish on a lap identical to the best and negative when faster", () => {
    const t = createLapTracker();
    const lap = (dt) => {
      for (let k = 0; k <= 400; k++) {
        const r = stepLapTracker(t, { u: (k / 400) % 1, speed: 30, dt, checkpoints: CHECKPOINTS });
        if (r.lapCompleted) return;
      }
    };
    lap(0.05);
    expect(t.bestTrace).not.toBeNull();
    for (let k = 1; k <= 200; k++) stepLapTracker(t, { u: k / 400, speed: 30, dt: 0.04, checkpoints: CHECKPOINTS });
    expect(t.delta).toBeLessThan(-0.5);
  });
});

describe("track limits", () => {
  const HALF = 7;
  // Drive one lap along u, going `wide` metres off-centre during the given u windows.
  function lap(t, wideAt = [], { dt = 0.05, steps = 400, warnings } = {}) {
    let r;
    for (let k = 0; k <= steps; k++) {
      const u = (k / steps) % 1;
      const offset = wideAt.some(([a, b]) => u >= a && u <= b) ? 8.2 : 2;
      r = stepLapTracker(t, { u, speed: 30, dt, checkpoints: CHECKPOINTS, offset, halfWidth: HALF, warnings: warnings === undefined ? 2 : warnings });
      if (r.lapCompleted || r.finished) return r;
    }
    return r;
  }

  it("counts one strike per excursion, not per frame", () => {
    const t = createLapTracker();
    lap(t, [[0.2, 0.3]]);
    expect(t.lapValid).toEqual([true]);
    expect(t.limitEvents).toBe(1);
  });

  it("does not count the kerb with two wheels (car centre just past the line)", () => {
    const t = createLapTracker();
    for (let k = 0; k < 50; k++) stepLapTracker(t, { u: 0.3, speed: 30, dt: 0.05, checkpoints: CHECKPOINTS, offset: 7.4, halfWidth: HALF });
    expect(t.limitEvents).toBe(0);
  });

  it("deletes the lap on the third strike and keeps it out of the bests", () => {
    const t = createLapTracker();
    lap(t, [[0.2, 0.22], [0.4, 0.42], [0.6, 0.62]], { dt: 0.04 }); // faster lap, but deleted
    expect(t.lapValid).toEqual([false]);
    expect(t.bestLapTime).toBeNull();
    expect(t.bestSectors.every((s) => s == null)).toBe(true);
    lap(t, [], { dt: 0.05 }); // slower but clean
    expect(t.lapValid).toEqual([false, true]);
    expect(t.bestLapTime).toBeCloseTo(t.lapTimes[1], 6);
    expect(t.strikes).toBe(0); // fresh slate each lap
  });

  it("two strikes are only warnings", () => {
    const t = createLapTracker();
    lap(t, [[0.2, 0.22], [0.5, 0.52]]);
    expect(t.lapValid).toEqual([true]);
    expect(t.bestLapTime).not.toBeNull();
  });

  it("follows the configured number of warnings", () => {
    const strict = createLapTracker();
    lap(strict, [[0.2, 0.22]], { warnings: 0 }); // first strike deletes
    expect(strict.lapValid).toEqual([false]);

    const lenient = createLapTracker();
    lap(lenient, [[0.2, 0.22], [0.4, 0.42], [0.6, 0.62]], { warnings: 3 });
    expect(lenient.lapValid).toEqual([true]);

    const off = createLapTracker();
    lap(off, [[0.1, 0.12], [0.3, 0.32], [0.5, 0.52], [0.7, 0.72]], { warnings: null });
    expect(off.lapValid).toEqual([true]);
    expect(off.limitEvents).toBe(0);
  });
});

describe("grid start", () => {
  it("puts the whole car behind the start line", () => {
    const s = createVehicle(GRID_START);
    for (const probe of PROBES) {
      const w = probeWorld(s, probe);
      expect(w.x).toBeLessThan(START_CONFIG.x - 0.8); // line is 1.6 m deep, centred on x
    }
  });

  it("crossing the line from the grid starts lap 1 cleanly", () => {
    const t = createLapTracker();
    for (let k = 0; k < 20; k++) stepLapTracker(t, { u: 0.997 + k * 0.0001, speed: 10, dt: 0.05, checkpoints: CHECKPOINTS });
    for (let k = 0; k < 20; k++) stepLapTracker(t, { u: k * 0.001, speed: 20, dt: 0.05, checkpoints: CHECKPOINTS });
    expect(t.lap).toBe(1);
    expect(t.lapTimes).toEqual([]);
    expect(t.sector).toBe(0);
    expect(t.trace[199]).toBe(-1); // nothing recorded at the end of the lap from the grid
  });
});
