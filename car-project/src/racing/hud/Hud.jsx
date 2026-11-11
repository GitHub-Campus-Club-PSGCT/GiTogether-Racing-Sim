// In-race HUD, laid out after modern F1 game broadcasts: lap panel (top left),
// sector bar (top right), dial cluster with battery/boost (bottom right), map.
import { useEffect, useMemo, useState } from "react";
import { START_CONFIG, getCircuitSvgPath } from "../circuitDefinition";
import { TOTAL_LAPS } from "../sim/lapTracker";
import { RULES } from "../rules";
import { useGame } from "../store";
import { formatTime, formatGap } from "./format";
import { usePresence } from "./motion";

/** Small state flags (track limits, reverse) that pop in and out as glass lenses. */
function Flag({ show, className, children }) {
  const { mounted, state } = usePresence(show, 200);
  if (!mounted) return null;
  return (
    <div className={`hud-flag ${className}`} data-state={state}>
      {children}
    </div>
  );
}

const REV_START = 9200;
const REV_END = 11900;
const LEDS = 15;
const MAX_KMH = 360;

const formatDelta = formatGap;

/** SVG arc path, angles in degrees clockwise from 12 o'clock. */
function arc(cx, cy, r, from, to) {
  const p = (a) => {
    const rad = ((a - 90) * Math.PI) / 180;
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
  };
  const [x0, y0] = p(from);
  const [x1, y1] = p(to);
  const large = to - from > 180 ? 1 : 0;
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

const ARC_FROM = -135;
const ARC_TO = 135;

function Dial({ value, className, children }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className={`hud-dial ${className ?? ""}`}>
      <svg viewBox="0 0 120 120">
        <path d={arc(60, 60, 50, ARC_FROM, ARC_TO)} className="hud-dial-track" />
        {v > 0.002 && <path d={arc(60, 60, 50, ARC_FROM, ARC_FROM + (ARC_TO - ARC_FROM) * v)} className="hud-dial-fill" />}
      </svg>
      <div className="hud-dial-body">{children}</div>
    </div>
  );
}

function Delta({ value, big }) {
  if (value == null) return <span className={`hud-delta-pill none ${big ? "big" : ""}`}>–</span>;
  return (
    <span className={`hud-delta-pill ${value < 0 ? "faster" : "slower"} ${big ? "big" : ""}`}>{formatGap(value)}</span>
  );
}

/** Timing tower: session + lap header, the current lap, best/last, lap history. */
function TimingTower({ t }) {
  const best = t.bestLapTime;
  const currentLap = Math.min(t.lap, TOTAL_LAPS);
  const last = t.lapTimes.length ? t.lapTimes[t.lapTimes.length - 1] : null;
  return (
    <div className="hud-tower hud-enter-left">
      <div className="hud-tower-head">
        <span className="hud-session-tag">Qualifying</span>
        <span className="hud-lapcount">
          <small>Lap</small>
          <b>
            {currentLap}/{TOTAL_LAPS}
          </b>
        </span>
      </div>
      <div className="hud-tower-current">
        <span className={`hud-current-time ${t.lapDeleted ? "deleted" : ""}`}>
          {formatTime(t.currentLapTime, { live: true })}
        </span>
        {t.lapDeleted ? <span className="hud-delta-pill big deleted">Deleted</span> : <Delta value={t.delta} big />}
      </div>
      <div className="hud-tower-grid">
        <span className="hud-k">Best</span>
        <span className="hud-v purple">{formatTime(best)}</span>
        <span />
        <span className="hud-k">Last</span>
        <span className="hud-v">{formatTime(last)}</span>
        <span className={`hud-v-delta ${last == null || last === best ? "" : "slower"}`}>
          {last == null || best == null || last === best ? "" : formatDelta(last - best)}
        </span>
        {t.strikes > 0 && RULES.trackLimitWarnings != null && (
          <>
            <span className="hud-k">Limits</span>
            <span className={`hud-v hud-strikes ${t.lapDeleted ? "out" : ""}`}>
              {t.lapDeleted ? "Lap deleted" : `${t.strikes} of ${RULES.trackLimitWarnings} warnings`}
            </span>
            <span />
          </>
        )}
      </div>
      {t.lapTimes.length > 0 && (
        <div className="hud-history">
          {t.lapTimes.map((time, i) => {
            const deleted = t.lapValid[i] === false;
            const isBest = !deleted && time === best;
            return (
              <div key={i} className={`hud-history-row ${isBest ? "best" : ""} ${deleted ? "deleted" : ""}`}>
                <span>L{i + 1}</span>
                <span>{formatTime(time)}</span>
                <span>{deleted ? "Deleted" : isBest ? "Best" : best == null ? "" : formatDelta(time - best)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Sector panel: three blocks coloured purple / green / yellow, live time in the current one. */
function SectorPanel({ t }) {
  const blocks = [0, 1, 2].map((i) => {
    if (i === t.sector) return { cls: "live", time: t.sectorElapsed };
    if (i > t.sector) return { cls: "", time: null };
    const time = t.sectorTimes[i];
    if (time == null) return { cls: "", time: null };
    const isBest = time <= (t.bestSectors[i] ?? Infinity) + 1e-6;
    return { cls: isBest ? "purple" : "yellow", time };
  });
  const ls = t.lastSector;
  return (
    <div className="hud-sectors hud-enter-right">
      <div className="hud-sector-blocks">
        {blocks.map((b, i) => (
          <div key={i} className={`hud-sector-block ${b.cls}`}>
            <span>S{i + 1}</span>
            <b>{b.time != null ? b.time.toFixed(b.cls === "live" ? 1 : 3) : "–"}</b>
          </div>
        ))}
      </div>
      <div className="hud-sectors-foot">
        <span>
          <small>Best lap</small> <b className="purple">{formatTime(t.bestLapTime)}</b>
        </span>
        {ls && ls.delta != null && (
          <span className="hud-last-sector">
            <small>S{ls.index + 1}</small> <Delta value={ls.delta} />
          </span>
        )}
      </div>
    </div>
  );
}

function Cluster({ t }) {
  const assists = useGame((s) => s.assists);
  const lit = Math.max(0, Math.min(LEDS, Math.round(((t.rpm - REV_START) / (REV_END - REV_START)) * LEDS)));
  const flash = t.rpm > REV_END - 150;
  const battery = t.battery ?? 1;
  const boostState = t.boosting ? "active" : battery > 0.05 ? "ready" : "charging";
  return (
    <div className="hud-cluster hud-enter-right">
      <div className="hud-pedals">
        <i className="brake" style={{ "--v": t.brake }} />
        <i className="throttle" style={{ "--v": t.throttle }} />
      </div>
      <Dial value={battery} className={`battery ${boostState}`}>
        <small>Battery</small>
        <b>{Math.round(battery * 100)}%</b>
      </Dial>
      <div className="hud-gearblock">
        <div className={`hud-leds ${flash ? "flash" : ""}`}>
          {Array.from({ length: LEDS }, (_, i) => (
            <i key={i} className={`${i < lit ? "on" : ""} ${i < 5 ? "g" : i < 10 ? "r" : "b"}`} />
          ))}
        </div>
        <div className="hud-gear">{t.gear}</div>
        <div className={`hud-boost ${boostState}`}>
          {boostState === "active" ? (
            "Overtake active"
          ) : boostState === "ready" ? (
            <>
              Overtake <kbd>Shift</kbd>
            </>
          ) : (
            "Charging"
          )}
        </div>
      </div>
      <Dial value={t.speed / MAX_KMH} className="speed">
        <small>km/h</small>
        <b>{t.speed}</b>
        <small className="rpm">{(t.rpm / 1000).toFixed(1)}k rpm</small>
      </Dial>
      <div className="hud-assists">
        {[["traction", "TC"], ["abs", "ABS"], ["stability", "ESC"], ["steering", "STR"], ["speedSteer", "SPD"]].map(([k, label]) => (
          <span key={k} className={assists[k] ? "on" : ""}>{label}</span>
        ))}
      </div>
    </div>
  );
}

function Minimap({ t }) {
  const circuitMap = useMemo(() => getCircuitSvgPath(240, 100), []);
  const car = circuitMap.transformCoord(t.posX ?? START_CONFIG.x, t.posZ ?? START_CONFIG.z);
  const start = circuitMap.transformCoord(START_CONFIG.x, START_CONFIG.z);
  const heading = (Math.atan2(t.forwardZ || 0, t.forwardX || 1) * 180) / Math.PI;
  return (
    <div className="hud-map hud-enter-left">
      <svg viewBox="0 0 100 100">
        <path d={circuitMap.d} className="hud-map-edge" />
        <path d={circuitMap.d} className="hud-map-track" />
        <rect x={start.svgX - 0.6} y={start.svgZ - 3.2} width="1.2" height="6.4" fill="#fff" />
        <g transform={`translate(${car.svgX} ${car.svgZ}) rotate(${heading})`}>
          <circle r="3.4" className="hud-map-car" />
          <polygon points="5.2,0 1.6,-2 1.6,2" fill="#fff" />
        </g>
      </svg>
    </div>
  );
}

/**
 * Shows a short-lived toast whenever `trigger` changes to a new non-null value.
 * The toast is marked `leaving` 160ms before it unmounts so it can fade out.
 */
function useToast(trigger, build, ms = 3200) {
  const [toast, setToast] = useState(null);
  useEffect(() => {
    if (trigger == null || trigger === 0) return undefined;
    const show = setTimeout(() => setToast({ value: build(), leaving: false }), 0);
    const leave = setTimeout(() => setToast((t) => (t ? { ...t, leaving: true } : t)), ms - 160);
    const hide = setTimeout(() => setToast(null), ms);
    return () => {
      clearTimeout(show);
      clearTimeout(leave);
      clearTimeout(hide);
    };
    // Fire only when the trigger changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);
  return toast;
}

/**
 * Track-limit flags. A warning pops up briefly for each strike; once the lap is
 * deleted, "lap deleted" stays up until the car starts the next lap.
 */
function LimitsFlag({ t }) {
  const toast = useToast(t.limitEvents, () => ({ strikes: t.strikes, deleted: t.lapDeleted }), 2400);
  const v = toast?.value;
  const warnings = RULES.trackLimitWarnings;
  const warning = !!toast && !toast.leaving && !v.deleted;
  // While closing after a new lap starts, keep showing the deleted message.
  const deletedMsg = t.lapDeleted || !v || v.deleted;
  const lastWarning = v && !v.deleted && v.strikes === warnings;
  return (
    <Flag show={t.lapDeleted || warning} className={deletedMsg ? "bad" : "warn"}>
      {deletedMsg
        ? "Track limits · lap deleted"
        : `Track limits · warning ${v?.strikes ?? 0} of ${warnings}${lastWarning ? ", next one deletes the lap" : ""}`}
    </Flag>
  );
}

/** Broadcast-style banners: wipe in from the left, leave faster than they arrive. */
function Banners({ t }) {
  const lap = useToast(t.lapEvents, () => ({
    lap: t.lapEvents,
    time: t.lastLapTime,
    best: t.lastLapWasBest,
    deleted: t.lastLapDeleted,
    delta: t.lastLapWasBest || t.bestLapTime == null ? null : t.lastLapTime - t.bestLapTime,
  }));
  const reaction = useToast(t.reaction, () => t.reaction, 2600);
  const show = lap ?? (reaction ? { reaction: reaction.value, leaving: reaction.leaving } : null);
  if (!show) return null;
  if (show.reaction != null) {
    return (
      <div className="hud-banner" data-state={show.leaving ? "closed" : "open"}>
        <span className="hud-banner-tag">Reaction</span>
        <b className="hud-banner-time">{show.reaction.toFixed(3)} s</b>
      </div>
    );
  }
  const v = show.value;
  return (
    <div
      className={`hud-banner ${v.best ? "best" : ""} ${v.deleted ? "deleted" : ""}`}
      data-state={show.leaving ? "closed" : "open"}
    >
      <span className="hud-banner-tag">Lap {v.lap}</span>
      <b className="hud-banner-time">{formatTime(v.time)}</b>
      {v.deleted ? <em>Deleted · track limits</em> : v.best ? <em>Personal best</em> : <Delta value={v.delta} />}
    </div>
  );
}

export default function Hud() {
  const t = useGame((s) => s.telemetry);
  const gameState = useGame((s) => s.gameState);
  const live = gameState === "racing" || gameState === "countdown";

  if (gameState === "start" || gameState === "finished") return null;

  return (
    <div className="hud">
      <div className={`hud-boost-glow ${t.boosting && gameState === "racing" ? "on" : ""}`} />
      <div className="hud-hint">
        <kbd>Esc</kbd> Menu
      </div>
      {live && <TimingTower t={t} />}
      {live && <SectorPanel t={t} />}
      {live && <Cluster t={t} />}
      {live && <Minimap t={t} />}
      {live && <Banners t={t} />}
      {gameState === "racing" && <LimitsFlag t={t} />}
      <Flag show={t.reverse && gameState === "racing"} className="info">
        Reverse
      </Flag>
    </div>
  );
}
