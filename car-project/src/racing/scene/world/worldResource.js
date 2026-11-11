// Starts building the world in a Web Worker as early as possible and exposes it
// to components through React's `use()`, so they suspend until it's ready while
// the main thread stays free (the loading screen keeps animating).
import { use } from "react";

let promise = null;
let progress = 0;
const listeners = new Set();
function setProgress(p) {
  progress = p;
  for (const fn of listeners) fn(p);
}

/** World-build progress, 0..1. */
export function getWorldProgress() {
  return progress;
}
export function onWorldProgress(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

async function buildOnMainThread() {
  const { buildWorld } = await import("./worldBuild");
  return buildWorld(setProgress);
}

export function loadWorld() {
  if (promise) return promise;
  promise = new Promise((resolve, reject) => {
    if (typeof Worker === "undefined") {
      buildOnMainThread().then(resolve, reject);
      return;
    }
    const worker = new Worker(new URL("./world.worker.js", import.meta.url), { type: "module" });
    worker.onmessage = (e) => {
      if (e.data.type === "progress") {
        setProgress(e.data.value);
        return;
      }
      setProgress(1);
      resolve(e.data.world);
      worker.terminate();
    };
    worker.onerror = (e) => {
      // If the worker can't start, fall back to building here.
      e.preventDefault?.();
      worker.terminate();
      buildOnMainThread().then(resolve, reject);
    };
    worker.postMessage("build");
  });
  return promise;
}

/** Suspends until the world data exists. */
export function useWorld() {
  return use(loadWorld());
}
