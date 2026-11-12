import { describe, it, expect } from "vitest";
import {
  CURVATURE,
  KERB_MASK,
  LINE_LIMIT,
  LINE_STEP,
  RACING_LINE,
  SAMPLE_COUNT as N,
  SAMPLE_SPACING,
} from "../circuitDefinition.js";
import { GUIDE, PLAN, createGuide, lateralGrip, stepGuide } from "./speedPlan.js";
import { createVehicle, stepVehicle } from "./vehicleSim.js";
import { autopilot } from "./autopilot.js";
import { BARRIER_OFFSET, CIRCUIT_LENGTH, GRID_START, projectToTrack } from "../circuitDefinition.js";

const at = (metres) => Math.round(metres / SAMPLE_SPACING) % N;
// The Eau Rouge / Raidillon-style section: bottom of the downhill run to past the crest.
const SECTION = [at(560), at(900)];

/** Fastest the car can take the centreline (no racing line) at sample i. */
function centrelineSpeed(i) {
  const k = Math.abs(CURVATURE[i]);
  let lo = 0, hi = PLAN.vMax;
  if (k * hi * hi <= lateralGrip(hi, i)) return hi;
  for (let it = 0; it < 32; it++) {
    const v = (lo + hi) / 2;
    if (v * v * k <= lateralGrip(v, i)) lo = v;
    else hi = v;
  }
  return lo;
}

describe("racing line", () => {
  it("stays inside the track, within its limits", () => {
    for (let i = 0; i < N; i++) {
      const lim = KERB_MASK[i] ? LINE_LIMIT.kerb : LINE_LIMIT.plain;
      expect(Math.abs(RACING_LINE[i])).toBeLessThanOrEqual(lim + 1e-4);
    }
  });

  it("uses the width of the track through corners", () => {
    // Outside-inside-outside: somewhere the line reaches each side.
    expect(Math.max(...RACING_LINE)).toBeGreaterThan(LINE_LIMIT.plain - 0.3);
    expect(Math.min(...RACING_LINE)).toBeLessThan(-LINE_LIMIT.plain + 0.3);
  });
});

describe("speed plan", () => {
  it("never asks for more than the corner allows", () => {
    for (let i = 0; i < N; i++) {
      expect(PLAN.envelope[i]).toBeLessThanOrEqual(PLAN.cornerSpeed[i] + 1e-4);
      expect(PLAN.speed[i]).toBeLessThanOrEqual(PLAN.envelope[i] + 1e-4);
    }
  });

  it("has a plausible top speed and lap", () => {
    expect(PLAN.vMax * 3.6).toBeGreaterThan(300);
    expect(PLAN.vMax * 3.6).toBeLessThan(370);
    let t = 0;
    for (let i = 0; i < N; i++) t += LINE_STEP[i] / PLAN.speed[i];
    expect(t).toBeGreaterThan(60);
    expect(t).toBeLessThan(90);
  });

  it("finds the slow corners: the hairpin is a brake, under 100 km/h", () => {
    const hairpin = PLAN.corners.find((c) => Math.abs(c.apex - at(300)) < at(40));
    expect(hairpin).toBeDefined();
    expect(hairpin.kind).toBe("brake");
    expect(hairpin.target * 3.6).toBeLessThan(100);
  });

  it("takes the compression, climb and crest flat out on the racing line", () => {
    for (let i = SECTION[0]; i < SECTION[1]; i++) {
      // No lift or brake: the plan's speed never drops through the section.
      expect(PLAN.speed[i + 1]).toBeGreaterThanOrEqual(PLAN.speed[i] - 0.05);
    }
    const inSection = PLAN.corners.filter((c) => c.apex >= SECTION[0] && c.apex <= SECTION[1]);
    expect(inSection.length).toBeGreaterThan(0);
    for (const c of inSection) expect(c.kind).toBe("flat");
  });

  it("but only just: the line's grip margin there is under 12%", () => {
    let margin = Infinity;
    for (let i = SECTION[0]; i < SECTION[1]; i++) margin = Math.min(margin, PLAN.cornerSpeed[i] / PLAN.speed[i]);
    expect(margin).toBeGreaterThan(1);
    expect(margin).toBeLessThan(1.12);
  });

  it("needs a big lift if you drive it down the middle", () => {
    let worst = Infinity;
    for (let i = SECTION[0]; i < SECTION[1]; i++) worst = Math.min(worst, centrelineSpeed(i) / PLAN.speed[i]);
    expect(worst).toBeLessThan(0.8);
  });
});

describe("guide", () => {
  const hairpin = () => PLAN.corners.find((c) => Math.abs(c.apex - at(300)) < at(40));

  it("moves your brake point earlier the faster you arrive", () => {
    const from = (hairpin().apex - at(260) + N) % N;
    const slow = stepGuide(createGuide(), { index: from, speed: 55 });
    const fast = stepGuide(createGuide(), { index: from, speed: 75 });
    expect(slow.brakeIn).toBeGreaterThan(0);
    expect(fast.brakeIn).toBeGreaterThanOrEqual(0);
    expect(fast.brakeIn).toBeLessThan(slow.brakeIn);
  });

  it("colours green, then yellow, then red into a braking corner", () => {
    const g = createGuide();
    const from = (hairpin().apex - at(260) + N) % N;
    stepGuide(g, { index: from, speed: 70, mode: "full" });
    const seen = [];
    for (let k = 0; k < at(260); k++) {
      const s = g.state[(from + k) % N];
      if (seen[seen.length - 1] !== s) seen.push(s);
    }
    expect(seen.slice(0, 3)).toEqual([GUIDE.GREEN, GUIDE.YELLOW, GUIDE.RED]);
  });

  it("calls out a car that is already too fast", () => {
    const c = hairpin();
    const near = (c.apex - at(40) + N) % N;
    const cue = stepGuide(createGuide(), { index: near, speed: PLAN.envelope[near] * 1.3 });
    expect(cue.status).toBe("over");
  });

  it("shows nothing when off, and only near corners in corners mode", () => {
    const straight = at(60); // the start straight, far from the hairpin's brake point
    const off = createGuide();
    stepGuide(off, { index: straight, speed: 40, mode: "off" });
    expect(Math.max(...off.alpha)).toBe(0);

    const corners = createGuide();
    stepGuide(corners, { index: straight, speed: 40, mode: "corners" });
    expect(corners.alpha[(straight + at(5)) % N]).toBe(0);

    const full = createGuide();
    stepGuide(full, { index: straight, speed: 40, mode: "full" });
    expect(full.alpha[(straight + at(5)) % N]).toBeGreaterThan(0.5);
  });

  it("clears the previous window when the car moves on", () => {
    const g = createGuide();
    stepGuide(g, { index: at(60), speed: 40, mode: "full" });
    stepGuide(g, { index: at(1500), speed: 40, mode: "full" });
    expect(g.alpha[at(100)]).toBe(0);
  });

  it("reports the apex speed once a corner is done", () => {
    const g = createGuide();
    const c = hairpin();
    for (let k = at(200); k >= -at(70); k--) {
      const i = (c.apex - k + N) % N;
      stepGuide(g, { index: i, speed: PLAN.speed[i] - 1 });
    }
    expect(g.result).not.toBeNull();
    expect(g.result.id).toBe(c.id);
    expect(g.result.speed).toBeCloseTo(c.target - 1, 0);
    expect(g.result.wide).toBe(false);
  });
});

describe("corner cue over a lap", () => {
  // Drive a lap on the autopilot (which follows the plan), stepping the guide at the
  // HUD rate like GameScene does, and record what the cue said for each corner
  // (one lap from the grid; the lap ends back on the run to the first corner, so
  // statuses are kept per visit as well as per corner).
  const statuses = new Map(); // corner id -> every status seen
  const visits = []; // [corner id, statuses in order] per visit
  const results = [];
  const s = createVehicle(GRID_START);
  const g = createGuide();
  const circuit = { barrier: BARRIER_OFFSET, project: projectToTrack };
  let seq = 0;
  for (let k = 0; k < 120 * 90 && s.distance < CIRCUIT_LENGTH; k++) {
    stepVehicle(s, autopilot(s), 1 / 120, circuit);
    if (k % 4 !== 0) continue;
    const cue = stepGuide(g, { index: s.trackIndex, speed: s.vx });
    if (cue && !cue.pastApex) {
      const all = statuses.get(cue.corner) ?? [];
      if (!all.includes(cue.status)) all.push(cue.status);
      statuses.set(cue.corner, all);
      if (visits[visits.length - 1]?.[0] !== cue.corner) visits.push([cue.corner, []]);
      const list = visits[visits.length - 1][1];
      if (list[list.length - 1] !== cue.status) list.push(cue.status);
    }
    if (g.resultSeq !== seq) {
      seq = g.resultSeq;
      results.push(g.result);
    }
  }
  const rank = { approach: 0, flat: 0, lift: 1, brake: 2 };

  it("never steps back within a corner (no flicker)", () => {
    expect(visits.length).toBeGreaterThan(5);
    for (const [, list] of visits) {
      const ranks = list.filter((x) => x !== "over").map((x) => rank[x]);
      for (let i = 1; i < ranks.length; i++) expect(ranks[i]).toBeGreaterThanOrEqual(ranks[i - 1]);
    }
  });

  it("tells you to brake for braking corners and calls the climb flat", () => {
    for (const c of PLAN.corners) {
      const list = statuses.get(c.id) ?? [];
      if (c.kind === "brake") expect(list).toContain("brake");
      if (c.kind === "flat" && c.apex >= SECTION[0] && c.apex <= SECTION[1]) expect(list).toEqual(["flat"]);
    }
  });

  it("reports every corner once, close to the plan when you follow it", () => {
    const ids = results.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThanOrEqual(PLAN.corners.length - 1); // the last may fall past the lap
    for (const r of results) {
      expect(Math.abs(r.speed - r.target) * 3.6).toBeLessThan(8);
      expect(r.wide).toBe(false);
    }
  });
});
