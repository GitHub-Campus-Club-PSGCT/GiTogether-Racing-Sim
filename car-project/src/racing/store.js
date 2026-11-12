// Global UI / game state. The 3D scene only subscribes to the slices it needs,
// so frequent telemetry updates re-render the HUD and nothing else.
import { create } from "zustand";
import { START_CONFIG } from "./circuitDefinition";
import { DEFAULT_ASSISTS } from "./sim/vehicleSim";

export const INITIAL_TELEMETRY = {
  speed: 0,
  lap: 1,
  gear: 1,
  rpm: 4000,
  throttle: 0,
  brake: 0,
  time: 0,
  currentLapTime: 0,
  bestLapTime: null,
  lastLapTime: null,
  sector: 0,
  sectorTimes: [null, null, null],
  bestSectors: [null, null, null],
  posX: START_CONFIG.x,
  posZ: START_CONFIG.z,
  forwardX: START_CONFIG.forwardX,
  forwardZ: START_CONFIG.forwardZ,
  offTrack: false,
  isDrifting: false,
  reverse: false,
  strikes: 0,
  lapDeleted: false,
  limitEvents: 0,
  lapValid: [],
  lastLapDeleted: false,
  delta: null,
  lapEvents: 0,
  lastLapWasBest: false,
  surface: "asphalt",
  reaction: null,
  sectorElapsed: 0,
  lastSector: null,
  battery: 1,
  boosting: false,
  lapTimes: [],
  cue: null, // next corner for the corner speed cue (sim/speedPlan.js stepGuide)
  cornerResult: null, // { seq, target, speed, wide } for the last corner done
};

export const useGame = create((set) => ({
  // "start" | "countdown" | "racing" | "paused" | "finished"
  gameState: "start",
  results: null,
  muted: false,
  quality: ["high", "medium", "low"].includes(new URLSearchParams(window.location.search).get("q"))
    ? new URLSearchParams(window.location.search).get("q")
    : "high", // "high" | "medium" | "low"
  assists: { ...DEFAULT_ASSISTS },
  cameraMode: "chase", // "chase" | "far" | "tcam"
  startLights: 0, // 0-5 red lights lit on the start gantry
  warmup: 0, // 0..1: textures uploaded to the GPU before the first frame
  compiled: false, // shaders compiled in the background (rendering waits for this)
  sceneReady: false, // the 3D scene has rendered its first frames
  loaderDone: false, // the player has dismissed the loading screen
  showLoader: new URLSearchParams(window.location.search).get("ui") !== "0",
  resetSignal: 0,
  restartSignal: 0,
  telemetry: INITIAL_TELEMETRY,

  setGameState: (gameState) => set({ gameState }),
  setStartLights: (startLights) => set({ startLights }),
  setSceneReady: () => set({ sceneReady: true }),
  setCompiled: () => set({ compiled: true }),
  setWarmup: (warmup) => set({ warmup }),
  setLoaderDone: () => set({ loaderDone: true }),
  cycleCamera: () =>
    set((s) => {
      const modes = ["chase", "far", "tcam"];
      return { cameraMode: modes[(modes.indexOf(s.cameraMode) + 1) % modes.length] };
    }),
  setTelemetry: (telemetry) => set({ telemetry }),
  setMuted: (muted) => set({ muted }),
  setQuality: (quality) => set({ quality }),
  lowerQuality: () =>
    set((s) => ({ quality: s.quality === "high" ? "medium" : "low" })),
  toggleAssist: (key) => set((s) => ({ assists: { ...s.assists, [key]: !s.assists[key] } })),
  setAssist: (key, value) => set((s) => ({ assists: { ...s.assists, [key]: value } })),

  togglePause: () =>
    set((s) => {
      if (s.gameState === "racing") return { gameState: "paused" };
      if (s.gameState === "paused") return { gameState: "racing" };
      return {};
    }),
  resetCar: () =>
    set((s) =>
      s.gameState === "racing" || s.gameState === "paused" ? { resetSignal: s.resetSignal + 1 } : {},
    ),
  finishRace: (results) => set({ results, gameState: "finished" }),
  restartRace: () =>
    set((s) => ({
      results: null,
      telemetry: INITIAL_TELEMETRY,
      restartSignal: s.restartSignal + 1,
      gameState: "countdown",
    })),
}));
