// A quick glass "refocus" that hides camera cuts: restart and reset-to-track
// teleport the car, so the screen snaps to frosted glass and clears again.
import { useEffect, useRef, useState } from "react";
import { useGame } from "../store";

export default function Curtain() {
  const [pulse, setPulse] = useState(null);
  const first = useRef(true);
  const resetSignal = useGame((s) => s.resetSignal);
  const restartSignal = useGame((s) => s.restartSignal);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return undefined;
    }
    const kind = { key: `${resetSignal}-${restartSignal}`, long: true };
    const show = setTimeout(() => setPulse(kind), 0);
    const hide = setTimeout(() => setPulse(null), 700);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, [resetSignal, restartSignal]);

  if (!pulse) return null;
  return <div key={pulse.key} className="curtain" />;
}
