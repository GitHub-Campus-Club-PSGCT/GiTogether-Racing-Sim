// Keyboard + Gamepad input with smoothing. Produces analog controls.

const KEY = {
  throttle: ["w", "arrowup"],
  brake: ["s", "arrowdown", " "],
  left: ["a", "arrowleft"],
  right: ["d", "arrowright"],
  boost: ["shift", "e"],
};

// Steering feel for keyboard and pad. Speed-sensitive steering (an assist) eases
// turn-in and trims the maximum input as speed rises, so a digital key press at
// 300 km/h isn't an instant full-lock flick. Releasing always re-centres quickly.
export const STEER_FEEL = {
  turnIn: 3.2, // keyboard input per second at low speed
  turnInFast: 1.4, // ... at top of the range
  release: 6, // back toward centre, at any speed
  minScale: 0.5, // fraction of full input left at the top of the range
  from: 15, // m/s (~54 km/h): sensitivity starts dropping
  to: 75, // m/s (~270 km/h): fully reduced
};

/** { scale, rate } for a speed in m/s; scale 1 / normal rate when the assist is off. */
export function steeringSensitivity(speed, enabled = true) {
  if (!enabled) return { scale: 1, rate: STEER_FEEL.turnIn };
  const r = Math.min(1, Math.max(0, (speed - STEER_FEEL.from) / (STEER_FEEL.to - STEER_FEEL.from)));
  return {
    scale: 1 - (1 - STEER_FEEL.minScale) * r * r,
    rate: STEER_FEEL.turnIn + (STEER_FEEL.turnInFast - STEER_FEEL.turnIn) * r,
  };
}

/** Move the keyboard steering value toward a target: slow turn-in, quick release. */
export function stepKeyboardSteer(current, target, dt, rate) {
  const turningIn = Math.abs(target) > Math.abs(current) && Math.sign(target) === Math.sign(current || target);
  const r = turningIn ? rate : STEER_FEEL.release;
  const diff = target - current;
  return current + Math.sign(diff) * Math.min(Math.abs(diff), r * dt);
}

export function createInput() {
  const keys = Object.create(null);
  const state = { throttle: 0, brake: 0, steer: 0, boost: false, usingPad: false };

  const down = (e) => {
    const key = e.key.toLowerCase();
    if (key.startsWith("arrow") || key === " ") e.preventDefault();
    keys[key] = true;
  };
  const up = (e) => {
    keys[e.key.toLowerCase()] = false;
  };
  const clear = () => {
    for (const k of Object.keys(keys)) keys[k] = false;
  };

  window.addEventListener("keydown", down);
  window.addEventListener("keyup", up);
  window.addEventListener("blur", clear);
  document.addEventListener("visibilitychange", clear);

  const held = (list) => list.some((k) => keys[k]);

  function readPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const pad of pads) {
      if (!pad || !pad.connected) continue;
      const deadzone = (v) => (Math.abs(v) < 0.08 ? 0 : (v - Math.sign(v) * 0.08) / 0.92);
      const steer = -deadzone(pad.axes[0] ?? 0);
      const throttle = pad.buttons[7]?.value ?? 0;
      const brake = pad.buttons[6]?.value ?? 0;
      const boost = !!(pad.buttons[0]?.pressed || pad.buttons[5]?.pressed);
      if (Math.abs(steer) > 0 || throttle > 0.02 || brake > 0.02 || boost) {
        return { steer, throttle, brake, boost };
      }
    }
    return null;
  }

  return {
    state,
    /** Update the analog state; call once per rendered frame. */
    /**
     * Update the analog state once per rendered frame.
     * opts: { speed (m/s), speedSensitive (assist on/off) }
     */
    update(dt, opts = {}) {
      const feel = steeringSensitivity(opts.speed ?? 0, opts.speedSensitive ?? false);
      const pad = readPad();
      if (pad) {
        state.usingPad = true;
        // Gentle curve so small stick movements are precise.
        state.steer = Math.sign(pad.steer) * Math.pow(Math.abs(pad.steer), 1.6) * feel.scale;
        state.throttle = pad.throttle;
        state.brake = pad.brake;
        state.boost = pad.boost;
        return state;
      }
      state.usingPad = false;
      const target = ((held(KEY.left) ? 1 : 0) - (held(KEY.right) ? 1 : 0)) * feel.scale;
      state.steer = stepKeyboardSteer(state.steer, target, dt, feel.rate);
      const ramp = (cur, on, up, downRate) =>
        on ? Math.min(1, cur + up * dt) : Math.max(0, cur - downRate * dt);
      state.throttle = ramp(state.throttle, held(KEY.throttle), 6, 10);
      state.brake = ramp(state.brake, held(KEY.brake), 8, 12);
      state.boost = held(KEY.boost);
      return state;
    },
    dispose() {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", clear);
      document.removeEventListener("visibilitychange", clear);
    },
  };
}
