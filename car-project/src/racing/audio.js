// Web Audio API procedural sound engine for F1 Rush
// Zero external audio files, 100% royalty-free and license-safe.

class F1AudioEngine {
  constructor() {
    this.ctx = null;
    this.engineOsc = null;
    this.engineFilter = null;
    this.engineGain = null;
    this.screechOsc = null;
    this.screechGain = null;
    this.initialized = false;
    this.muted = false;
  }

  init() {
    if (this.initialized) return;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      this.ctx = new AudioContextClass();

      // Engine tone (sawtooth oscillator passed through lowpass filter)
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = "sawtooth";

      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineFilter.type = "lowpass";
      this.engineFilter.frequency.value = 450;

      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0.0;

      this.engineOsc.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.ctx.destination);
      this.engineOsc.start();

      // Tire screech tone (triangle oscillator)
      this.screechOsc = this.ctx.createOscillator();
      this.screechOsc.type = "triangle";
      this.screechOsc.frequency.value = 850;

      this.screechGain = this.ctx.createGain();
      this.screechGain.gain.value = 0.0;

      this.screechOsc.connect(this.screechGain);
      this.screechGain.connect(this.ctx.destination);
      this.screechOsc.start();

      this.initialized = true;
    } catch {
      // AudioContext not supported or blocked
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.muted && this.engineGain && this.ctx) {
      this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
      if (this.screechGain) {
        this.screechGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
      }
    }
  }

  playBeep(isHigh = false) {
    if (!this.initialized || !this.ctx || this.muted) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = isHigh ? 880 : 440;
      gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.22);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.22);
    } catch {
      // Ignore
    }
  }

  playImpact() {
    if (!this.initialized || !this.ctx || this.muted) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(130, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(28, this.ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.2);
    } catch {
      // Ignore
    }
  }

  update({ speed, maxSpeed, isBraking, lateralVelocity, isRunning }) {
    if (!this.initialized || !this.ctx || this.ctx.state !== "running") return;

    if (!isRunning || this.muted) {
      this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
      if (this.screechGain) {
        this.screechGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
      }
      return;
    }

    const t = this.ctx.currentTime;
    const ratio = Math.min(1, Math.max(0, speed / (maxSpeed || 75)));

    // Gear simulated oscillation
    const gearFraction = (ratio * 7) % 1;
    const pitch = 65 + ratio * 180 + gearFraction * 55;

    this.engineOsc.frequency.setTargetAtTime(pitch, t, 0.05);
    this.engineFilter.frequency.setTargetAtTime(320 + ratio * 1250, t, 0.05);

    // Volume level
    const engineVol = 0.06 + ratio * 0.09;
    this.engineGain.gain.setTargetAtTime(engineVol, t, 0.05);

    // Tire screech when drifting laterally or hard braking at speed
    const isDrifting = Math.abs(lateralVelocity) > 4.5;
    const isHardBraking = isBraking && speed > 20;
    const screechVol = isDrifting || isHardBraking ? 0.045 : 0.0;

    this.screechOsc.frequency.setTargetAtTime(780 + Math.random() * 160, t, 0.04);
    this.screechGain.gain.setTargetAtTime(screechVol, t, 0.05);
  }

  dispose() {
    if (this.ctx) {
      try {
        this.ctx.close();
      } catch {
        // Ignore
      }
      this.ctx = null;
      this.initialized = false;
    }
  }
}

export const audioEngine = new F1AudioEngine();
