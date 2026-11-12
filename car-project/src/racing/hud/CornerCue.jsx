// Corner speed cue: the next corner's target apex speed and what to do about it
// (Brake in 120 m, Brake, Lift, Flat, Too fast), then how the apex went.
// Data comes from the speed plan (sim/speedPlan.js stepGuide) via telemetry.
import { useEffect, useState } from "react";
import { formatSigned } from "./format";
import { usePresence } from "./motion";

const RESULT_MS = 1800;
const WORDS = { brake: "Brake", lift: "Lift", flat: "Flat", over: "Too fast" };

/** The cue worth showing now, or null. */
function cueView(cue) {
  if (!cue) return null;
  if (cue.pastApex) return null; // the result takes over once past the apex
  const urgent = cue.status === "brake" || cue.status === "lift" || cue.status === "over";
  const nearBrake = cue.brakeIn >= 0 && cue.brakeIn <= 160;
  const nearFast = cue.kind !== "brake" && cue.toApex <= 220;
  if (!urgent && !nearBrake && !nearFast) return null;
  return {
    type: "cue",
    status: cue.status,
    target: cue.target,
    // Rounded to 10 m so the number ticks down calmly.
    brakeIn: cue.status === "approach" && cue.brakeIn >= 0 ? Math.max(10, Math.round(cue.brakeIn / 10) * 10) : null,
  };
}

export default function CornerCue({ t }) {
  // The last corner's result, shown for a moment after its apex.
  const [result, setResult] = useState(null);
  const seq = t.cornerResult?.seq ?? 0;
  useEffect(() => {
    if (!seq) return undefined;
    const r = t.cornerResult;
    const show = setTimeout(() => setResult({ type: "result", seq, speed: r.speed, target: r.target, wide: r.wide }), 0);
    const hide = setTimeout(() => setResult(null), RESULT_MS);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
    // Fire only when a new result arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seq]);

  const cue = cueView(t.cue);
  // An urgent cue for the next corner wins over the last corner's result.
  const view = cue && (cue.status !== "approach" || !result) ? cue : (result ?? cue);

  // Keep the last content while the lens closes.
  const key = view ? JSON.stringify(view) : null;
  const [kept, setKept] = useState(key);
  if (key && key !== kept) setKept(key);
  const { mounted, state } = usePresence(!!view, 180);
  if (!mounted || !kept) return null;
  const v = JSON.parse(kept);

  if (v.type === "result") {
    const diff = v.speed - v.target;
    return (
      <div className="hud-cue result" data-state={state} aria-live="polite">
        <span className="hud-cue-word">Apex</span>
        <b className="hud-cue-speed">
          {v.speed}
          <small>km/h</small>
        </b>
        {v.wide ? (
          <span className="hud-delta-pill slower">Wide</span>
        ) : (
          <span className={`hud-delta-pill ${diff >= 0 ? "faster" : "slower"}`}>{formatSigned(diff)}</span>
        )}
      </div>
    );
  }
  return (
    <div className="hud-cue" data-state={state} data-status={v.status}>
      <span className="hud-cue-word">
        {v.status === "approach" ? (
          <>
            Brake in <b>{v.brakeIn} m</b>
          </>
        ) : (
          WORDS[v.status]
        )}
      </span>
      <b className="hud-cue-speed">
        {v.target}
        <small>km/h</small>
      </b>
    </div>
  );
}
