// Builds the heavy world data off the main thread (see worldBuild.js),
// posting progress so the loading bar can move smoothly.
import { buildWorld, worldTransferables } from "./worldBuild";

self.onmessage = () => {
  let last = -1;
  const world = buildWorld((p) => {
    if (p - last >= 0.01 || p === 1) {
      last = p;
      self.postMessage({ type: "progress", value: p });
    }
  });
  self.postMessage({ type: "done", world }, worldTransferables(world));
};
