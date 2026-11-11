// Procedural Web Audio sound engine. No audio files.
// Engine: three oscillators at the V6 firing frequency through soft-clip
// distortion and a throttle-driven filter. Plus tyre squeal, wind, kerb rumble,
// overrun crackle, gearshift cuts, impacts and start beeps, into a compressor.

function noiseBuffer(ctx, seconds = 2) {
  const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

function softClipCurve(amount = 2.2) {
  const n = 1024;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * amount) / Math.tanh(amount);
  }
  return curve;
}

class F1AudioEngine {
  constructor() {
    this.ctx = null;
    this.initialized = false;
    this.muted = false;
    this.lastCrackle = 0;
  }

  init() {
    if (this.initialized) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    try {
      const ctx = (this.ctx = new AudioContextClass());
      this.noise = noiseBuffer(ctx);

      this.master = ctx.createGain();
      this.master.gain.value = 0.9;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.ratio.value = 4;
      this.master.connect(comp).connect(ctx.destination);

      // Engine
      this.engineGain = ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineFilter = ctx.createBiquadFilter();
      this.engineFilter.type = "lowpass";
      this.engineFilter.Q.value = 2.5;
      const shaper = ctx.createWaveShaper();
      shaper.curve = softClipCurve(2.4);
      shaper.oversample = "2x";
      const mix = ctx.createGain();
      mix.gain.value = 0.55;
      this.oscs = [
        { type: "sawtooth", mult: 1, gain: 0.55 },
        { type: "square", mult: 0.5, gain: 0.3 },
        { type: "sawtooth", mult: 2, gain: 0.2, detune: 7 },
      ].map((o) => {
        const osc = ctx.createOscillator();
        osc.type = o.type;
        osc.detune.value = o.detune ?? 0;
        const g = ctx.createGain();
        g.gain.value = o.gain;
        osc.connect(g).connect(mix);
        osc.start();
        return { osc, mult: o.mult };
      });
      mix.connect(shaper).connect(this.engineFilter).connect(this.engineGain).connect(this.master);

      // Looped noise sources: squeal, wind
      const loop = (filterType, freq, q) => {
        const src = ctx.createBufferSource();
        src.buffer = this.noise;
        src.loop = true;
        const f = ctx.createBiquadFilter();
        f.type = filterType;
        f.frequency.value = freq;
        f.Q.value = q;
        const g = ctx.createGain();
        g.gain.value = 0;
        src.connect(f).connect(g).connect(this.master);
        src.start();
        return { filter: f, gain: g };
      };
      this.squeal = loop("bandpass", 1100, 9);
      this.wind = loop("lowpass", 420, 0.7);

      // Electric deploy whine for the overtake boost
      this.whineOsc = ctx.createOscillator();
      this.whineOsc.type = "triangle";
      this.whineGain = ctx.createGain();
      this.whineGain.gain.value = 0;
      this.whineOsc.connect(this.whineGain).connect(this.master);
      this.whineOsc.start();

      // Kerb rumble
      this.rumbleOsc = ctx.createOscillator();
      this.rumbleOsc.type = "square";
      this.rumbleOsc.frequency.value = 32;
      const rf = ctx.createBiquadFilter();
      rf.type = "lowpass";
      rf.frequency.value = 140;
      this.rumbleGain = ctx.createGain();
      this.rumbleGain.gain.value = 0;
      this.rumbleOsc.connect(rf).connect(this.rumbleGain).connect(this.master);
      this.rumbleOsc.start();

      this.initialized = true;
    } catch {
      this.initialized = false;
    }
  }

  resume() {
    if (this.ctx?.state === "suspended") this.ctx.resume().catch(() => {});
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(muted ? 0 : 0.9, this.ctx.currentTime, 0.05);
  }

  playBeep(isHigh = false) {
    if (!this.initialized || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = isHigh ? 880 : 440;
    gain.gain.setValueAtTime(0.16, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + (isHigh ? 0.5 : 0.22));
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.55);
  }

  /** intensity 0..1 */
  playImpact(intensity = 0.5) {
    if (!this.initialized || this.muted) return;
    const t = this.ctx.currentTime;
    const thump = this.ctx.createOscillator();
    const tg = this.ctx.createGain();
    thump.type = "triangle";
    thump.frequency.setValueAtTime(140, t);
    thump.frequency.exponentialRampToValueAtTime(30, t + 0.25);
    tg.gain.setValueAtTime(0.25 + intensity * 0.45, t);
    tg.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    thump.connect(tg).connect(this.master);
    thump.start(t);
    thump.stop(t + 0.32);

    const crunch = this.ctx.createBufferSource();
    crunch.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = 1800;
    f.Q.value = 0.8;
    const cg = this.ctx.createGain();
    cg.gain.setValueAtTime(0.12 + intensity * 0.35, t);
    cg.gain.exponentialRampToValueAtTime(0.001, t + 0.18 + intensity * 0.2);
    crunch.connect(f).connect(cg).connect(this.master);
    crunch.start(t, Math.random());
    crunch.stop(t + 0.45);
  }

  crackle() {
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = 900;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.18 + Math.random() * 0.15, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.04 + Math.random() * 0.03);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random() * 1.5);
    src.stop(t + 0.1);
  }

  /**
   * { rpm, throttle, speed, slip (0..1+), kerb, offroad, shifted, isRunning }
   */
  update({ rpm, throttle, speed, slip, kerb, offroad, shifted, boost, isRunning }) {
    if (!this.initialized || this.ctx.state !== "running") return;
    const t = this.ctx.currentTime;
    if (!isRunning) {
      this.engineGain.gain.setTargetAtTime(0, t, 0.08);
      this.squeal.gain.gain.setTargetAtTime(0, t, 0.05);
      this.wind.gain.gain.setTargetAtTime(0, t, 0.2);
      this.rumbleGain.gain.setTargetAtTime(0, t, 0.05);
      this.whineGain.gain.setTargetAtTime(0, t, 0.05);
      return;
    }
    const r = Math.min(1, rpm / 12000);
    const f = (rpm / 60) * 3; // V6 firing frequency
    for (const o of this.oscs) o.osc.frequency.setTargetAtTime(f * o.mult, t, 0.012);
    this.engineFilter.frequency.setTargetAtTime(500 + throttle * 2600 + r * 1600, t, 0.03);

    const vol = 0.05 + throttle * 0.11 + r * 0.06;
    if (shifted) {
      this.engineGain.gain.cancelScheduledValues(t);
      this.engineGain.gain.setValueAtTime(vol * 0.25, t);
      this.engineGain.gain.setTargetAtTime(vol, t + 0.05, 0.03);
    } else {
      this.engineGain.gain.setTargetAtTime(vol, t, 0.04);
    }

    // Overrun crackle when lifting at high revs.
    if (throttle < 0.08 && rpm > 8500 && t - this.lastCrackle > 0.05 && Math.random() < 0.18) {
      this.lastCrackle = t;
      this.crackle();
    }

    const s = Math.min(1, Math.max(0, slip));
    this.squeal.gain.gain.setTargetAtTime(s * 0.09 * Math.min(1, speed / 15), t, 0.04);
    this.squeal.filter.frequency.setTargetAtTime(950 + s * 500 + Math.sin(t * 23) * 60, t, 0.03);

    const w = Math.min(1, speed / 90);
    this.wind.gain.gain.setTargetAtTime(w * w * 0.08, t, 0.15);
    this.wind.filter.frequency.setTargetAtTime(300 + w * 900, t, 0.15);

    this.whineGain.gain.setTargetAtTime(boost ? 0.035 : 0, t, boost ? 0.08 : 0.15);
    this.whineOsc.frequency.setTargetAtTime(900 + speed * 22, t, 0.05);

    const rumble = kerb ? 0.14 * Math.min(1, speed / 25) : offroad ? 0.06 * Math.min(1, speed / 20) : 0;
    this.rumbleGain.gain.setTargetAtTime(rumble, t, 0.03);
    this.rumbleOsc.frequency.setTargetAtTime(18 + speed * 0.5, t, 0.05);
  }

  dispose() {
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
      this.initialized = false;
    }
  }
}

export const audioEngine = new F1AudioEngine();
