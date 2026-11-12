// Loading screen in the game's glass language: controls card, rotating tips,
// progress. When everything is ready the backdrop dissolves into frosted glass
// over the live circuit and waits for a key press, then collapses into its centre.
import { useEffect, useRef, useState } from "react";
import { useProgress } from "@react-three/drei";
import { useGame } from "../store";
import { audioEngine } from "../audio";
import { usePresence } from "./motion";
import { getWorldProgress } from "../scene/world/worldResource";

// Share of the bar for each stage. Downloads and the world build run in parallel.
const WEIGHTS = { assets: 0.35, world: 0.35, scene: 0.3 };
const MAX_SPEED = 0.45; // the bar never moves faster than 45% per second

/**
 * Drives the bar and label directly from requestAnimationFrame: it eases toward the
 * combined progress of every stage and never moves backwards.
 */
function ProgressBar() {
  const barRef = useRef(null);
  const textRef = useRef(null);
  useEffect(() => {
    let raf;
    let shown = 0;
    let last = performance.now();
    let finalStageStart = null;
    const tick = (now) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const { loaded, total } = useProgress.getState();
      const assets = total > 0 ? loaded / total : 0;
      const world = getWorldProgress();
      // Last stage: GPU warm-up (textures uploaded one per frame, then shaders),
      // with a small time-based creep while the scene graph mounts.
      const { sceneReady, warmup } = useGame.getState();
      if (assets >= 1 && world >= 1 && finalStageStart == null) finalStageStart = now;
      const creep = finalStageStart == null ? 0 : 0.3 * (1 - Math.exp(-(now - finalStageStart) / 1500));
      const scene = sceneReady ? 1 : Math.max(creep, 0.95 * warmup);
      const target = WEIGHTS.assets * assets + WEIGHTS.world * world + WEIGHTS.scene * scene;
      const eased = shown + (target - shown) * (1 - Math.exp(-dt * 5));
      shown = Math.max(shown, Math.min(eased, shown + MAX_SPEED * dt));
      if (barRef.current) barRef.current.style.transform = `scaleX(${shown.toFixed(4)})`;
      if (textRef.current) {
        const stage = assets < 1 ? "Loading the circuit" : world < 1 ? "Building the circuit" : "Warming up";
        textRef.current.textContent = `${stage} · ${Math.floor(shown * 100)}%`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <>
      <div className="loader-bar">
        <i ref={barRef} />
      </div>
      <div className="loader-text" ref={textRef}>
        Loading the circuit · 0%
      </div>
    </>
  );
}

const TIPS = [
  "Brake in a straight line, then turn in. Trail off the brake as you reach the apex.",
  "Save boost for the long uphill straight after the climb out of the compression.",
  "Hard braking recharges the boost battery. So does a slow trickle over time.",
  "The car goes light over crests. Ease off the steering when you feel it.",
  "Purple means your best ever. Yellow means slower than your best.",
  "Kerbs are fine to use. Grass and gravel will cost you a lot of time.",
  "Rev it on the grid. The race starts the moment the lights go out.",
  "The delta next to your lap time compares you with your best lap at this exact spot.",
  "Assists keep the car stable. Switch them off in the menu if you want a challenge.",
];

function Key({ children, wide }) {
  return <kbd className={`ld-key ${wide ? "wide" : ""}`}>{children}</kbd>;
}

function ControlRow({ keys, label }) {
  return (
    <div className="ld-row">
      <span className="ld-keys">{keys}</span>
      <span className="ld-label">{label}</span>
    </div>
  );
}

function Tips() {
  const [i, setI] = useState(() => Math.floor(Math.random() * TIPS.length));
  useEffect(() => {
    const id = setInterval(() => setI((n) => (n + 1) % TIPS.length), 4200);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="ld-tip">
      <span className="ld-tip-tag">Tip</span>
      {/* Keyed so each tip fades/rises in on its own. */}
      <p key={i}>{TIPS[i]}</p>
    </div>
  );
}

export default function Loader() {
  const { progress, active } = useProgress();
  const sceneReady = useGame((s) => s.sceneReady);
  const loaderDone = useGame((s) => s.loaderDone);
  const muted = useGame((s) => s.muted);
  const ready = sceneReady && !active && progress >= 100;
  const { mounted, state } = usePresence(!loaderDone, 420);

  // Any key or click continues once everything is ready; that gesture also unlocks audio.
  useEffect(() => {
    if (!ready || loaderDone) return undefined;
    const go = (e) => {
      if (e.repeat) return;
      audioEngine.init();
      audioEngine.resume();
      audioEngine.setMuted(muted);
      useGame.getState().setLoaderDone();
    };
    window.addEventListener("keydown", go);
    window.addEventListener("pointerdown", go);
    return () => {
      window.removeEventListener("keydown", go);
      window.removeEventListener("pointerdown", go);
    };
  }, [ready, loaderDone, muted]);

  if (!mounted) return null;
  return (
    <div className="loader lens-layer" data-state={state} data-ready={ready}>
      <div className="loader-bg" />
      <div className="lens-scrim loader-scrim" />
      <div className="lens-card loader-card">
        <div className="ld-head">
          <h1 className="ld-title">
            GiTogether
            <br />
            Qualifying
          </h1>
        </div>

        <div className="ld-controls">
          <div className="ld-col">
            <div className="ld-col-title">Drive</div>
            <ControlRow keys={<><Key>W</Key><Key>↑</Key></>} label="Throttle" />
            <ControlRow keys={<><Key>S</Key><Key>↓</Key></>} label="Brake · hold to reverse" />
            <ControlRow keys={<><Key>A</Key><Key>D</Key></>} label="Steer" />
            <ControlRow keys={<Key wide>Shift</Key>} label="Overtake boost" />
          </div>
          <div className="ld-col">
            <div className="ld-col-title">Session</div>
            <ControlRow keys={<Key>C</Key>} label="Change camera" />
            <ControlRow keys={<Key>R</Key>} label="Back to the track" />
            <ControlRow keys={<Key wide>Esc</Key>} label="Menu" />
            <ControlRow keys={<><Key>RT</Key><Key>LT</Key></>} label="Gamepad works too" />
          </div>
        </div>

        <Tips />

        <div className="ld-foot">
          {ready ? (
            <div className="ld-continue">
              Press <Key wide>any key</Key> to continue
            </div>
          ) : (
            <ProgressBar />
          )}
        </div>
      </div>
    </div>
  );
}
