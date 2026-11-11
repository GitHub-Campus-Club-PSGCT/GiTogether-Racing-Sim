// The live race: fixed-step simulation, lap timing, car pose, camera and audio.
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { audioEngine } from "../audio";
import { GRID_START, BARRIER_OFFSET, CHECKPOINTS, CIRCUIT_CURVE, HALF_WIDTH, projectToTrack } from "../circuitDefinition";
import { createVehicle, resetVehicle, stepVehicle, speedOf } from "../sim/vehicleSim";
import { createLapTracker, stepLapTracker } from "../sim/lapTracker";
import { createInput } from "../sim/input";
import { autopilot } from "../sim/autopilot";
import { useGame } from "../store";
import RaceTrack from "./RaceTrack";
import Lighting from "./Lighting";
import { updateSun } from "./sun";
import Terrain from "./Terrain";
import Scenery from "./Scenery";
import HeroCar from "./HeroCar";
import { updateCamera } from "./camera";
import Effects from "./Effects";

const SIM_DT = 1 / 120;
const MAX_STEPS_PER_FRAME = 12;
const HUD_INTERVAL = 1 / 30;
const TRACK = { barrier: BARRIER_OFFSET, project: projectToTrack };
const IDLE_CONTROLS = { throttle: 0, brake: 0, steer: 0 };
const G = 9.81;

const damp = THREE.MathUtils.damp;
const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;

function createSim() {
  const vehicle = createVehicle(GRID_START);
  return {
    vehicle,
    laps: createLapTracker(),
    acc: 0,
    prev: { x: vehicle.x, z: vehicle.z, yaw: vehicle.yaw },
    hudTimer: 0,
    roll: 0,
    pitch: 0,
    clock: 0,
    frames: 0,
    cameraOverride: null,
  };
}

function syncPrev(sim) {
  sim.prev.x = sim.vehicle.x;
  sim.prev.z = sim.vehicle.z;
  sim.prev.yaw = sim.vehicle.yaw;
  sim.acc = 0;
}

export default function GameScene() {
  const gameState = useGame((s) => s.gameState);
  const assists = useGame((s) => s.assists);
  const resetSignal = useGame((s) => s.resetSignal);
  // While paused the canvas renders on demand, so moves made then need an explicit redraw.
  const invalidate = useThree((s) => s.invalidate);
  const restartSignal = useGame((s) => s.restartSignal);

  const carRef = useRef();
  const sunRef = useRef();
  const heroRef = useRef();
  const fxRef = useRef();
  const cameraRig = useRef({});
  const inputRef = useRef(null);
  const simRef = useRef(null);
  if (simRef.current === null) simRef.current = createSim();

  useEffect(() => {
    const input = createInput();
    inputRef.current = input;
    return () => input.dispose();
  }, []);

  // Debug hooks for automated screenshots (?debug=1).
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has("debug")) return undefined;
    window.__f1 = {
      ready: () => simRef.current.frames > 90,
      placeAt(u, lateral = 0, speed = 0) {
        const sim = simRef.current;
        const p = CIRCUIT_CURVE.getPointAt(((u % 1) + 1) % 1);
        const t = CIRCUIT_CURVE.getTangentAt(((u % 1) + 1) % 1).normalize();
        resetVehicle(sim.vehicle, {
          x: p.x + t.z * lateral,
          z: p.z - t.x * lateral,
          yaw: Math.atan2(-t.x, -t.z),
        });
        sim.vehicle.vx = speed;
        syncPrev(sim);
        sim.cameraOverride = null;
      },
      // Jump to a screen: "start" | "countdown" | "racing" | "paused" | "finished".
      screen(name, results) {
        if (name === "finished") useGame.getState().finishRace(results ?? null);
        else useGame.getState().setGameState(name);
      },
      // Set how far the car has rolled (turns the wheels while parked).
      roll(meters) {
        simRef.current.vehicle.distance = meters;
      },
      // Paint materials whose name starts with a prefix a flat colour (debugging).
      paint(prefix, hex) {
        simRef.current.scene?.traverse((o) => {
          const mats = o.isMesh ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
          for (const m of mats) {
            if (!m.name?.startsWith(prefix)) continue;
            m.color?.set(hex);
            m.map = null;
            m.metalness = 0;
            m.roughness = 1;
            m.clearcoat = 0;
            m.envMapIntensity = 0;
            m.emissive?.set(hex);
            m.emissiveIntensity = 0.6;
            m.needsUpdate = true;
          }
        });
      },
      // Override material properties by name prefix (debugging look-dev).
      tweak(prefix, props) {
        simRef.current.scene?.traverse((o) => {
          if (o.isMesh && o.material?.name?.startsWith(prefix)) Object.assign(o.material, props);
        });
      },
      scene: () => simRef.current.scene,
      materials() {
        const names = new Set();
        simRef.current.scene?.traverse((o) => o.isMesh && o.parent && names.add(`${o.material?.name}`));
        return [...names];
      },
      pose() {
        const v = simRef.current.vehicle;
        const p = projectToTrack(v.x, v.z);
        return { x: v.x, z: v.z, yaw: v.yaw, speed: Math.hypot(v.vx, v.vy), fromCentre: p.distance, state: useGame.getState().gameState };
      },
      steer(angle) {
        simRef.current.vehicle.steerAngle = angle;
      },
      race(auto = true) {
        simRef.current.autopilot = auto;
        useGame.getState().setGameState("racing");
      },
      view(position, target) {
        simRef.current.cameraOverride = position ? { position, target } : null;
      },
      // Draw calls / triangles for one whole frame (all passes).
      stats: () =>
        new Promise((resolve) => {
          const gl = simRef.current.gl;
          if (!gl) return resolve(null);
          gl.info.autoReset = false;
          requestAnimationFrame(() => {
            gl.info.reset();
            requestAnimationFrame(() => {
              const { calls, triangles, points } = gl.info.render;
              gl.info.autoReset = true;
              resolve({ calls, triangles, points });
            });
          });
        }),
      measureFps: (ms) =>
        new Promise((resolve) => {
          let n = 0;
          const t0 = performance.now();
          const tick = () => {
            n++;
            if (performance.now() - t0 < ms) requestAnimationFrame(tick);
            else resolve(Math.round((n * 1000) / (performance.now() - t0)));
          };
          requestAnimationFrame(tick);
        }),
    };
    return () => {
      delete window.__f1;
    };
  }, []);

  // R / reset button: put the car back on the centreline facing along the track.
  useEffect(() => {
    if (!resetSignal) return;
    const sim = simRef.current;
    const v = sim.vehicle;
    const p = projectToTrack(v.x, v.z);
    resetVehicle(v, {
      x: p.centerPoint.x,
      z: p.centerPoint.z,
      yaw: Math.atan2(-p.tangent.x, -p.tangent.z),
    });
    syncPrev(sim);
    invalidate();
  }, [resetSignal, invalidate]);

  // Full restart: new car state and lap timing.
  useEffect(() => {
    if (!restartSignal) return;
    simRef.current = createSim();
    fxRef.current?.clearSkids();
  }, [restartSignal]);

  useFrame((state, delta) => {
    const car = carRef.current;
    if (!car) return;
    const sim = simRef.current;
    const v = sim.vehicle;
    const dt = Math.min(delta, 0.1);
    const isRacing = gameState === "racing";
    const onGrid = gameState === "countdown"; // engine running, car held by the clutch
    const live = isRacing || onGrid;
    sim.clock += dt;
    sim.frames++;
    if (sim.frames === 12) useGame.getState().setSceneReady();
    sim.gl = state.gl;
    sim.scene = state.scene;

    let controls =
      live && inputRef.current
        ? inputRef.current.update(dt, { speed: speedOf(v), speedSensitive: assists.speedSteer })
        : IDLE_CONTROLS;
    if (isRacing && sim.autopilot) controls = autopilot(v);

    // Reaction time: from lights out to the first real throttle input.
    if (isRacing && sim.lightsOutAt == null) sim.lightsOutAt = sim.clock;
    if (isRacing && sim.reaction == null && controls.throttle > 0.3) {
      sim.reaction = sim.clock - sim.lightsOutAt;
    }

    // ---- Fixed-step simulation -------------------------------------------
    if (onGrid) {
      for (sim.acc += dt; sim.acc >= SIM_DT; sim.acc -= SIM_DT) {
        stepVehicle(v, controls, SIM_DT, TRACK, assists, { hold: true });
      }
      syncPrev(sim);
    } else if (isRacing) {
      sim.acc += dt;
      let steps = 0;
      while (sim.acc >= SIM_DT && steps < MAX_STEPS_PER_FRAME) {
        sim.prev.x = v.x;
        sim.prev.z = v.z;
        sim.prev.yaw = v.yaw;
        stepVehicle(v, controls, SIM_DT, TRACK, assists);
        if (v.drivetrain.shifted) sim.shifted = true;
        if (v.impact > 0) {
          audioEngine.playImpact(Math.min(1, v.impact / 20));
          sim.impact = Math.max(sim.impact ?? 0, v.impact);
          sim.impactSide = Math.sign(v.track.distance) > 0 ? -1 : 1;
        }
        const lap = stepLapTracker(sim.laps, {
          u: v.track.u,
          speed: speedOf(v),
          dt: SIM_DT,
          checkpoints: CHECKPOINTS,
          offset: v.track.absDistance,
          halfWidth: HALF_WIDTH,
        });
        if (lap.finished) useGame.getState().finishRace(lap.results);
        sim.acc -= SIM_DT;
        steps++;
      }
      if (steps === MAX_STEPS_PER_FRAME) sim.acc = 0;
    } else {
      syncPrev(sim);
    }

    // ---- Interpolated pose -----------------------------------------------
    const alpha = sim.acc / SIM_DT;
    const x = lerp(sim.prev.x, v.x, alpha);
    const z = lerp(sim.prev.z, v.z, alpha);
    const yaw = lerp(sim.prev.yaw, v.yaw, alpha);
    const speed = speedOf(v);

    sim.roll = damp(sim.roll, clamp((-v.ay / G) * 0.014, -0.05, 0.05), 6, dt);
    sim.pitch = damp(sim.pitch, clamp((v.ax / G) * 0.008, -0.035, 0.02), 8, dt);
    const rough = v.surface !== "asphalt" && speed > 8;
    const suspY = rough ? Math.sin(sim.clock * 36) * 0.016 * Math.min(1, speed / 78) : 0;

    // Ground height and slope under the (interpolated) car position.
    const under = projectToTrack(x, z, v.trackIndex);
    const ground = under.height;
    const tan = under.tangent;
    const along = (-Math.sin(yaw) * tan.x - Math.cos(yaw) * tan.z) / (Math.hypot(tan.x, tan.z) || 1);
    sim.groundPitch = damp(sim.groundPitch ?? 0, Math.atan(under.grade * along), 12, dt);
    car.position.set(x, ground, z);
    car.rotation.order = "YXZ";
    car.rotation.set(sim.groundPitch, yaw, 0);

    const braking = isRacing && controls.brake > 0.1;
    sim.discHeat = clamp(
      (sim.discHeat ?? 0) + (braking ? controls.brake * speed * 0.0016 : 0) - (sim.discHeat ?? 0) * 0.35 * dt,
      0,
      1,
    );
    const hero = heroRef.current;
    if (hero) {
      hero.setWheels(-v.distance / hero.wheelRadius, v.steerAngle);
      hero.setBody(sim.pitch, sim.roll, suspY);
      hero.setBrake(braking);
      hero.setDiscHeat(sim.discHeat);
    }

    // ---- Chase camera ----------------------------------------------------
    if (sim.cameraOverride) {
      state.camera.position.set(...sim.cameraOverride.position);
      state.camera.lookAt(...sim.cameraOverride.target);
    } else {
      updateCamera(state.camera, cameraRig.current, {
        x,
        y: ground,
        z,
        yaw,
        speed,
        rough,
        dt,
        time: sim.clock,
        mode: useGame.getState().cameraMode,
        boost: v.boosting,
        orbit: gameState === "start",
      });
    }

    if (sunRef.current) updateSun(sunRef.current, x, ground, z);

    // ---- Effects -----------------------------------------------------------
    fxRef.current?.update({
      x,
      y: ground,
      z,
      yaw,
      speed,
      dt,
      slipRear: isRacing ? v.slipRear : 0,
      slipFront: isRacing ? v.slipFront : 0,
      satRear: isRacing ? v.saturationRear : 0,
      satFront: isRacing ? v.saturationFront : 0,
      surface: v.surface,
      impact: sim.impact ?? 0,
      impactSide: sim.impactSide ?? 1,
    });
    sim.impact = 0;

    // ---- Audio -------------------------------------------------------------
    const drifting = Math.abs(v.slipRear) > 0.12 && speed > 10;
    const slip =
      Math.max(0, Math.abs(v.slipRear) - 0.1) * 5 +
      Math.max(0, v.saturationFront - 1) * 2 +
      Math.max(0, v.saturationRear - 1) * 2;
    audioEngine.update({
      rpm: v.drivetrain.rpm,
      throttle: controls.throttle,
      speed,
      slip: v.surface === "grass" || v.surface === "gravel" ? 0 : slip,
      kerb: v.surface === "kerb",
      offroad: v.surface === "grass" || v.surface === "gravel",
      shifted: sim.shifted,
      boost: v.boosting,
      isRunning: live,
    });
    sim.shifted = false;

    // ---- HUD telemetry (~15 Hz) -----------------------------------------
    sim.hudTimer += dt;
    if (sim.hudTimer >= HUD_INTERVAL) {
      sim.hudTimer = 0;
      const t = sim.laps;
      useGame.getState().setTelemetry({
        speed: Math.round(speed * 3.6),
        lap: t.lap,
        gear: v.reverse ? "R" : v.drivetrain.gear,
        rpm: Math.round(v.drivetrain.rpm),
        throttle: controls.throttle,
        brake: controls.brake,
        time: t.time,
        currentLapTime: t.currentLapTime,
        bestLapTime: t.bestLapTime,
        lastLapTime: t.lastLapTime,
        sector: t.sector,
        sectorTimes: [...t.sectorTimes],
        bestSectors: [...t.bestSectors],
        posX: x,
        posZ: z,
        forwardX: -Math.sin(yaw),
        forwardZ: -Math.cos(yaw),
        offTrack: v.surface === "grass" || v.surface === "gravel",
        isDrifting: drifting,
        reverse: v.reverse,
        delta: t.delta,
        lapEvents: t.lapEvents,
        lastLapWasBest: t.lastLapWasBest,
        surface: v.surface,
        reaction: sim.reaction ?? null,
        sectorElapsed: t.currentLapTime - t.sectorStart,
        lastSector: t.lastSector,
        battery: v.battery,
        boosting: v.boosting,
        lapTimes: [...t.lapTimes],
        lapValid: [...t.lapValid],
        strikes: t.strikes,
        lapDeleted: t.lapDeleted,
        limitEvents: t.limitEvents,
        lastLapDeleted: t.lastLapDeleted,
      });
    }
  });

  return (
    <>
      <Lighting ref={sunRef} />
      <Terrain />
      <RaceTrack />
      <Scenery />
      <Effects ref={fxRef} />
      <group ref={carRef}>
        <HeroCar ref={heroRef} />
      </group>
    </>
  );
}
