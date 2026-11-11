// Simplified Pacejka "magic formula" tyre, normalised so the peak is 1.
// B controls how quickly grip builds with slip, C the shape past the peak.

export const TYRE = {
  B: 14,
  C: 1.3, // gentler fall-off past the peak: slides are catchable
  muPeak: 2.0,
  // Grip coefficient falls slightly as load rises (load sensitivity).
  loadSensitivity: 0.06,
};

/** Slip angle (rad) at which lateral force peaks. */
export const PEAK_SLIP = Math.tan(Math.PI / (2 * TYRE.C)) / TYRE.B;

/** Normalised force (-1..1) for a slip angle in radians. */
export function magic(slip) {
  return Math.sin(TYRE.C * Math.atan(TYRE.B * slip));
}

/** Peak friction coefficient for an axle carrying `load`, relative to its static load. */
export function frictionCoefficient(load, staticLoad, surfaceGrip) {
  const ratio = load / staticLoad - 1;
  const sens = Math.max(0.72, 1 - TYRE.loadSensitivity * ratio);
  return TYRE.muPeak * surfaceGrip * Math.min(sens, 1.04);
}

/**
 * Combine requested longitudinal force and raw lateral force inside the
 * friction circle of radius `fmax`.
 *
 * With `assisted` (ABS / traction control) both are scaled back together so
 * the tyre never saturates. Without it, asking for more longitudinal force
 * than the tyre has locks or spins the wheel, and lateral grip collapses.
 */
export function combine(fxRequest, fyRaw, fmax, assisted) {
  if (fmax <= 0) return { fx: 0, fy: 0, saturation: 0 };
  const ux = fxRequest / fmax;
  const uy = fyRaw / fmax;
  const demand = Math.abs(ux);

  if (assisted) {
    const uxc = Math.max(-1, Math.min(1, ux));
    const mag = Math.hypot(uxc, uy);
    const k = mag > 1 ? 1 / mag : 1;
    return { fx: uxc * k * fmax, fy: uy * k * fmax, saturation: Math.min(demand, 1) };
  }

  if (demand >= 1) {
    // Locked or spinning: sliding friction, almost no lateral bite.
    return { fx: Math.sign(ux) * 0.9 * fmax, fy: uy * 0.22 * fmax, saturation: demand };
  }
  const lateralRoom = Math.sqrt(1 - ux * ux);
  const uyc = Math.max(-lateralRoom, Math.min(lateralRoom, uy));
  return { fx: ux * fmax, fy: uyc * fmax, saturation: demand };
}
