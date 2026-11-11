import { describe, it, expect } from "vitest";
import {
  CIRCUIT_CURVE,
  CIRCUIT_LENGTH,
  GRADE,
  START_CONFIG,
  projectToTrack,
} from "./circuitDefinition.js";

const N = 2400;
const pts = Array.from({ length: N }, (_, i) => CIRCUIT_CURVE.getPointAt(i / N));
const spacing = CIRCUIT_LENGTH / N;

describe("circuit layout", () => {
  it("is about 4.5 km long", () => {
    expect(CIRCUIT_LENGTH).toBeGreaterThan(4300);
    expect(CIRCUIT_LENGTH).toBeLessThan(4800);
  });

  it("has no corner tighter than 18 m radius", () => {
    const k = Math.max(1, Math.round(4 / spacing));
    let minR = Infinity;
    for (let i = 0; i < N; i++) {
      const a = pts[(i - k + N) % N], b = pts[i], c = pts[(i + k) % N];
      const ab = Math.hypot(b.x - a.x, b.z - a.z), bc = Math.hypot(c.x - b.x, c.z - b.z), ca = Math.hypot(a.x - c.x, a.z - c.z);
      const area = Math.abs((b.x - a.x) * (c.z - a.z) - (c.x - a.x) * (b.z - a.z)) / 2;
      if (area > 1e-9) minR = Math.min(minR, (ab * bc * ca) / (4 * area));
    }
    expect(minR).toBeGreaterThan(18);
  });

  it("keeps separate sections at least 70 m apart", () => {
    let minD = Infinity;
    for (let i = 0; i < N; i += 3) {
      for (let j = i + 3; j < N; j += 3) {
        let du = Math.abs(i - j);
        du = Math.min(du, N - du) * spacing;
        if (du < 150) continue;
        minD = Math.min(minD, Math.hypot(pts[i].x - pts[j].x, pts[i].z - pts[j].z));
      }
    }
    expect(minD).toBeGreaterThan(70);
  });

  it("has real elevation with gradients no steeper than 12%", () => {
    const ys = pts.map((p) => p.y);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(25);
    expect(Math.max(...Array.from(GRADE, Math.abs))).toBeLessThan(0.12);
  });

  it("keeps the start straight flat and straight for the pits and grid", () => {
    for (let x = -140; x <= 160; x += 20) {
      const p = projectToTrack(x, START_CONFIG.z);
      expect(Math.abs(p.distance)).toBeLessThan(0.6);
      expect(Math.abs(p.height)).toBeLessThan(0.05);
    }
  });

  it("returns the road height under any point on the road", () => {
    for (let i = 0; i < N; i += 37) {
      const p = projectToTrack(pts[i].x, pts[i].z);
      expect(Math.abs(p.height - pts[i].y)).toBeLessThan(0.05);
    }
  });
});
