import { Suspense, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import { audioEngine } from "./audio";
import { useGame } from "./store";
import GameScene from "./scene/GameScene";
import PostFX from "./scene/PostFX";
import Warmup from "./scene/Warmup";
import Hud from "./hud/Hud";
import Menus from "./hud/Menus";
import Loader from "./hud/Loader";
import Curtain from "./hud/Curtain";
import { loadWorld } from "./scene/world/worldResource";

// Start building terrain and trees in a worker right away, in parallel with downloads.
loadWorld();
import "@fontsource/titillium-web/400.css";
import "@fontsource/titillium-web/600.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "./hud/hud.css";

const SHOW_UI = new URLSearchParams(window.location.search).get("ui") !== "0";

const DPR = { high: [1, 2], medium: [1, 1.25], low: [0.75, 1] };

export default function RacingGame() {
  const quality = useGame((s) => s.quality);
  const paused = useGame((s) => s.gameState === "paused");
  const compiled = useGame((s) => s.compiled);

  // The HUD scales with the window width (base design is 1350 px wide). Menu cards
  // scale with the window height so the tallest one (pause, ~760 px) fills about 90%
  // of it, and never get wider than ~45% of the window.
  useEffect(() => {
    const apply = () => {
      const scale = Math.min(1.45, Math.max(0.8, window.innerWidth / 1350));
      const h = window.innerHeight;
      const fit = Math.min((h - Math.max(48, h * 0.1)) / 760, window.innerWidth / 1150);
      const menuScale = Math.min(1.8, Math.max(0.6, fit));
      const root = document.documentElement.style;
      root.setProperty("--hud-scale", scale.toFixed(3));
      root.setProperty("--menu-scale", menuScale.toFixed(3));
    };
    apply();
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, []);

  // Keyboard shortcuts: pause (Esc / P) and reset (R).
  useEffect(() => {
    const onKey = (e) => {
      const key = e.key.toLowerCase();
      const { togglePause, resetCar, cycleCamera, gameState } = useGame.getState();
      if (key === "escape" || key === "p") togglePause();
      else if (key === "r") {
        resetCar();
        // Resetting from the pause menu drops you straight back into the session.
        if (gameState === "paused") togglePause();
      }
      else if (key === "c") cycleCamera();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Pause/resume the audio context alongside the race.
  useEffect(
    () =>
      useGame.subscribe((s, prev) => {
        if (s.gameState === "racing" && prev.gameState === "paused") audioEngine.resume();
      }),
    [],
  );

  useEffect(() => () => audioEngine.dispose(), []);

  return (
    <div className="f1-game">
      {/* The scene eases in a touch while paused, behind the frosted pause card. */}
      <div className="scene-layer" data-zoom={paused}>
      <Canvas
        frameloop={!compiled ? "never" : paused ? "demand" : "always"}
        shadows="soft"
        flat
        dpr={DPR[quality]}
        camera={{ position: [0, 7, 48], fov: 65, near: 0.2, far: 3200 }}
        gl={{ antialias: false, stencil: false, powerPreference: "high-performance" }}
      >
        <color attach="background" args={["#a8b2c0"]} />
        <PerformanceMonitor flipflops={2} onDecline={() => useGame.getState().lowerQuality()} />
        <Suspense fallback={null}>
          <GameScene />
          <PostFX />
          <Warmup />
        </Suspense>
      </Canvas>
      </div>
      {SHOW_UI && <Hud />}
      {SHOW_UI && <Menus />}
      {SHOW_UI && <Curtain />}
      {SHOW_UI && <Loader />}
    </div>
  );
}
