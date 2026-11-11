// Small motion helpers for the HUD and menus.
import { useEffect, useState } from "react";

/**
 * Keeps an element mounted long enough to animate out.
 * Returns { mounted, state } where state is "open" or "closed"; CSS transitions
 * keyed on data-state do the animation. Interruptible: toggling mid-transition
 * just retargets the transition from wherever it is.
 */
export function usePresence(open, exitMs = 260) {
  const [mounted, setMounted] = useState(open);
  const [state, setState] = useState(open ? "open" : "closed");
  useEffect(() => {
    let raf1;
    let raf2;
    let timer;
    if (open) {
      // Mount closed, then flip to open on the next frame so the transition runs.
      raf1 = requestAnimationFrame(() => {
        setMounted(true);
        raf2 = requestAnimationFrame(() => setState("open"));
      });
    } else {
      raf1 = requestAnimationFrame(() => setState("closed"));
      timer = setTimeout(() => setMounted(false), exitMs);
    }
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      clearTimeout(timer);
    };
  }, [open, exitMs]);
  return { mounted, state };
}

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Counts a number up from 0 to `target` (ease-out), for celebratory moments. */
export function useCountUp(target, ms = 700, delay = 0) {
  const [value, setValue] = useState(reducedMotion() ? target : 0);
  useEffect(() => {
    if (target == null || reducedMotion()) {
      const t = setTimeout(() => setValue(target), 0);
      return () => clearTimeout(t);
    }
    let raf;
    let start = null;
    const tick = (now) => {
      if (start == null) start = now + delay;
      const k = Math.min(1, Math.max(0, (now - start) / ms));
      const eased = 1 - Math.pow(1 - k, 4);
      setValue(target * eased);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms, delay]);
  return value;
}
