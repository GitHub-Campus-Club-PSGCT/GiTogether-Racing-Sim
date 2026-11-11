import { describe, it, expect } from "vitest";
import { steeringSensitivity, stepKeyboardSteer, STEER_FEEL } from "./input.js";

const kmh = (v) => v / 3.6;

describe("speed-sensitive steering", () => {
  it("does nothing at low speed or when switched off", () => {
    expect(steeringSensitivity(kmh(40))).toEqual({ scale: 1, rate: STEER_FEEL.turnIn });
    expect(steeringSensitivity(kmh(300), false)).toEqual({ scale: 1, rate: STEER_FEEL.turnIn });
  });

  it("trims input and slows turn-in progressively with speed", () => {
    const mid = steeringSensitivity(kmh(160));
    const top = steeringSensitivity(kmh(300));
    expect(mid.scale).toBeLessThan(1);
    expect(top.scale).toBeLessThan(mid.scale);
    expect(top.scale).toBeCloseTo(STEER_FEEL.minScale, 5);
    expect(top.rate).toBeLessThan(mid.rate);
  });

  it("takes longer to reach full lock at speed, but releases just as quickly", () => {
    const timeTo = (speed) => {
      const { scale, rate } = steeringSensitivity(speed);
      let s = 0, t = 0;
      while (s < scale * 0.999 && t < 5) { s = stepKeyboardSteer(s, scale, 1 / 120, rate); t += 1 / 120; }
      return t;
    };
    expect(timeTo(kmh(300))).toBeGreaterThan(timeTo(kmh(40)) * 1.1);

    const releaseTime = (speed) => {
      const { scale, rate } = steeringSensitivity(speed);
      let s = scale, t = 0;
      while (s > 0.001 && t < 5) { s = stepKeyboardSteer(s, 0, 1 / 120, rate); t += 1 / 120; }
      return t / scale; // per unit of lock
    };
    expect(releaseTime(kmh(300))).toBeCloseTo(releaseTime(kmh(40)), 1);
  });

  it("switching direction counts as a release first (no slow crawl through centre)", () => {
    const { rate } = steeringSensitivity(kmh(300));
    const next = stepKeyboardSteer(0.4, -0.4, 0.05, rate);
    expect(0.4 - next).toBeCloseTo(STEER_FEEL.release * 0.05, 5);
  });
});
