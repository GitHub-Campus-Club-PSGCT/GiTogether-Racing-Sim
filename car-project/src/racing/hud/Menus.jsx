import { useCallback, useEffect, useState } from "react";
import { audioEngine } from "../audio";
import { useGame } from "../store";
import { TOTAL_LAPS } from "../sim/lapTracker";
import { CIRCUIT_LENGTH } from "../circuitDefinition";
import { formatTime, formatGap } from "./format";
import GlassLayer from "./GlassLayer";
import { useCountUp, usePresence } from "./motion";

// F1-style start: five red lights come on one per second, hold for a random
// moment, then all go out together. The race starts the instant they go out.
function StartLightsLayer({ open, onComplete }) {
  const { mounted, state } = usePresence(open, 240);
  if (!mounted) return null;
  return (
    <div className="lights-layer" data-state={state}>
      <StartLights onComplete={onComplete} active={open} />
    </div>
  );
}

function StartLights({ onComplete, active }) {
  const [lit, setLit] = useState(0);

  useEffect(() => {
    if (!active) return undefined;
    const setLights = useGame.getState().setStartLights;
    const timers = [];
    for (let i = 1; i <= 5; i++) {
      timers.push(
        setTimeout(() => {
          setLit(i);
          setLights(i);
          audioEngine.playBeep(false);
        }, i * 1000),
      );
    }
    const hold = 5000 + 400 + Math.random() * 1200;
    timers.push(
      setTimeout(() => {
        setLit(0);
        setLights(0);
        audioEngine.playBeep(true);
        onComplete();
      }, hold),
    );
    return () => {
      timers.forEach(clearTimeout);
      setLights(0);
    };
  }, [onComplete, active]);

  return (
    <div className="f1-countdown-overlay">
      <div className="f1-start-lights lights-card">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="f1-start-pod">
            <span className={i < lit ? "on" : ""} />
            <span className={i < lit ? "on" : ""} />
          </div>
        ))}
      </div>
    </div>
  );
}

const ASSISTS = [
  ["steering", "Steering assist"],
  ["speedSteer", "Speed-sensitive steering"],
  ["traction", "Traction control"],
  ["abs", "ABS"],
  ["stability", "Stability control"],
];

function Segmented({ value, options, onChange }) {
  const index = Math.max(0, options.findIndex(([v]) => v === value));
  return (
    <div className="menu-seg" style={{ "--n": options.length, "--i": index }}>
      <span className="menu-seg-thumb" aria-hidden="true" />
      {options.map(([v, label]) => (
        <button key={v} type="button" className={value === v ? "on" : ""} onClick={() => onChange(v)}>
          {label}
        </button>
      ))}
    </div>
  );
}

function Settings({ inSession = false }) {
  const quality = useGame((s) => s.quality);
  const setQuality = useGame((s) => s.setQuality);
  const assists = useGame((s) => s.assists);
  const toggleAssist = useGame((s) => s.toggleAssist);
  const cameraMode = useGame((s) => s.cameraMode);
  const muted = useGame((s) => s.muted);
  const setMuted = useGame((s) => s.setMuted);
  const setCamera = (mode) => useGame.setState({ cameraMode: mode });
  const setSound = (on) => {
    setMuted(!on);
    audioEngine.setMuted(!on);
  };
  return (
    <div className="menu-settings">
      <div className="menu-setting">
        <span>Graphics</span>
        <Segmented value={quality} onChange={setQuality} options={[["low", "Low"], ["medium", "Medium"], ["high", "High"]]} />
      </div>
      {inSession && (
        <div className="menu-setting">
          <span>Camera</span>
          <Segmented value={cameraMode} onChange={setCamera} options={[["chase", "Chase"], ["far", "Far"], ["tcam", "T-cam"]]} />
        </div>
      )}
      <div className="menu-setting">
        <span>Sound</span>
        <Segmented value={muted ? "off" : "on"} onChange={(v) => setSound(v === "on")} options={[["on", "On"], ["off", "Off"]]} />
      </div>
      <div className="menu-assists" role="group" aria-labelledby="menu-assists-label">
        <span id="menu-assists-label" className="menu-assists-label">
          Assists
        </span>
        {ASSISTS.map(([key, label]) => (
          <label key={key} className={`menu-toggle ${assists[key] ? "on" : ""}`}>
            <span>{label}</span>
            <input type="checkbox" role="switch" checked={assists[key]} onChange={() => toggleAssist(key)} />
            <i aria-hidden="true" />
          </label>
        ))}
      </div>
    </div>
  );
}

function Controls() {
  return (
    <div className="menu-controls">
      <span><kbd>W</kbd><kbd>↑</kbd> Throttle</span>
      <span><kbd>S</kbd><kbd>↓</kbd> Brake / reverse</span>
      <span><kbd>A</kbd><kbd>D</kbd> Steer</span>
      <span><kbd>Shift</kbd> Boost</span>
      <span><kbd>C</kbd> Camera</span>
      <span><kbd>R</kbd> Reset</span>
      <span><kbd>Esc</kbd> Pause</span>
      <span className="menu-pad">Gamepad supported</span>
    </div>
  );
}

function SessionSummary() {
  const t = useGame((s) => s.telemetry);
  const last = t.lapTimes.length ? t.lapTimes[t.lapTimes.length - 1] : null;
  return (
    <div className="menu-summary">
      <div>
        <span>Lap</span>
        <b>
          {Math.min(t.lap, TOTAL_LAPS)}/{TOTAL_LAPS}
        </b>
      </div>
      <div>
        <span>Best</span>
        <b className="purple">{formatTime(t.bestLapTime)}</b>
      </div>
      <div>
        <span>Last</span>
        <b>{formatTime(last)}</b>
      </div>
    </div>
  );
}

function Results() {
  const results = useGame((s) => s.results);
  const t = useGame((s) => s.telemetry);
  const total = useCountUp(results?.totalTime ?? null, 800, 260);
  const bestLap = useCountUp(results?.bestLap ?? null, 800, 340);
  const best = results?.bestLap ?? t.bestLapTime;
  return (
    <>
      <div className="menu-eyebrow">Chequered flag</div>
      <h2>Session complete</h2>
      <div className="menu-results">
        <div>
          <span>Best lap</span>
          <b className="purple">{formatTime(bestLap)}</b>
        </div>
        <div>
          <span>Total time</span>
          <b>{formatTime(total)}</b>
        </div>
        <div>
          <span>Top speed</span>
          <b>{results?.topSpeed ?? 0} km/h</b>
        </div>
      </div>
      {t.lapTimes.length > 0 && (
        <div className="menu-laps">
          {t.lapTimes.map((time, i) => {
            const deleted = t.lapValid[i] === false;
            const isBest = !deleted && time === best;
            return (
              <div
                key={i}
                className={`menu-lap ${isBest ? "best" : ""} ${deleted ? "deleted" : ""}`}
                style={{ "--i": i }}
              >
                <span>Lap {i + 1}</span>
                <b>{formatTime(time)}</b>
                <em>{deleted ? "Deleted" : isBest ? "Best" : best == null ? "" : formatGap(time - best)}</em>
              </div>
            );
          })}
        </div>
      )}
      <div className="menu-sectors">
        {t.bestSectors.map((s, i) => (
          <span key={i}>
            S{i + 1} <b>{s != null ? s.toFixed(3) : "–"}</b>
          </span>
        ))}
      </div>
    </>
  );
}

export default function Menus() {
  const gameState = useGame((s) => s.gameState);
  const loaderDone = useGame((s) => s.loaderDone || !s.showLoader);
  const muted = useGame((s) => s.muted);
  const setGameState = useGame((s) => s.setGameState);
  const togglePause = useGame((s) => s.togglePause);
  const restart = useGame((s) => s.restartRace);
  const resetCar = useGame((s) => s.resetCar);

  const start = () => {
    audioEngine.init();
    audioEngine.resume();
    audioEngine.setMuted(muted);
    setGameState("countdown");
  };
  const handleCountdownComplete = useCallback(() => setGameState("racing"), [setGameState]);
  const resetAndResume = () => {
    resetCar();
    togglePause();
  };

  return (
    <>
      <StartLightsLayer open={gameState === "countdown"} onComplete={handleCountdownComplete} />

      <GlassLayer
        open={gameState === "start" && loaderDone}
        scrim={false}
        align="left"
        className="menu-title"
        cardClassName="menu-panel"
      >
        <h1>
          GiTogether
          <br />
          Qualifying
        </h1>
        <p className="menu-sub">
          {TOTAL_LAPS} laps · {(CIRCUIT_LENGTH / 1000).toFixed(2)} km lap
        </p>
        <button type="button" className="menu-primary" onClick={start}>
          Start session
        </button>
        <Settings />
        <Controls />
      </GlassLayer>

      <GlassLayer open={gameState === "paused"} cardClassName="menu-panel">
        <h2>Paused</h2>
        <SessionSummary />
        <div className="menu-buttons">
          <button type="button" className="menu-primary" onClick={togglePause}>
            Resume
          </button>
          <button type="button" className="menu-secondary" onClick={restart}>
            Restart
          </button>
        </div>
        <Settings inSession />
        <div className="menu-footer">
          <button type="button" className="menu-link" onClick={resetAndResume}>
            Reset car to track <kbd>R</kbd>
          </button>
          <span>
            <kbd>Esc</kbd> to resume
          </span>
        </div>
      </GlassLayer>

      <GlassLayer open={gameState === "finished"} cardClassName="menu-panel wide">
        <Results />
        <button type="button" className="menu-primary" onClick={restart}>
          New session
        </button>
      </GlassLayer>
    </>
  );
}
