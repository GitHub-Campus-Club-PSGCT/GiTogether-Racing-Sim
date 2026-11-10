import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { audioEngine } from "./audio";
import {
  START_CONFIG,
  BARRIER_OFFSET,
  CIRCUIT_CURVE,
  CHECKPOINTS,
  HALF_WIDTH,
  projectToTrack,
  createCircuitGeometries,
  getCircuitSvgPath,
} from "./circuitDefinition";
import TracksideEnvironment from "./TracksideEnvironment";
import AuthenticF1Car from "./AuthenticF1Car";
import "./RacingGame.css";

// ─────────────────────────────────────────────────────────────────────────────
// RACE TRACK
// ─────────────────────────────────────────────────────────────────────────────

function createBoundaryGeometry(side, steps = 800) {
  const positions = [];
  const indices = [];

  for (let i = 0; i <= steps; i++) {
    const u = (i / steps) % 1;
    const point = CIRCUIT_CURVE.getPointAt(u);
    const tangent = CIRCUIT_CURVE.getTangentAt(u).normalize();
    const normal = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
    const edgeX = point.x + normal.x * side * (HALF_WIDTH - 0.16);
    const edgeZ = point.z + normal.z * side * (HALF_WIDTH - 0.16);
    const halfStripeWidth = 0.055;

    positions.push(
      edgeX - normal.x * halfStripeWidth, 0.043, edgeZ - normal.z * halfStripeWidth,
      edgeX + normal.x * halfStripeWidth, 0.043, edgeZ + normal.z * halfStripeWidth,
    );
  }

  for (let i = 0; i < steps; i++) {
    const row = i * 2;
    const next = row + 2;
    indices.push(row, row + 1, next, row + 1, next + 1, next);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function RaceTrack() {
  const {
    roadGeom,
    lKerbGeom,
    rKerbGeom,
    runoffGeom,
    barrierGeom,
    leftBoundaryGeom,
    rightBoundaryGeom,
  } = useMemo(() => ({
    ...createCircuitGeometries(800),
    leftBoundaryGeom: createBoundaryGeometry(-1),
    rightBoundaryGeom: createBoundaryGeometry(1),
  }), []);

  return (
    <group>
      {/* Expansive terrain grass */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
        <planeGeometry args={[1200, 1200]} />
        <meshStandardMaterial color="#4d9147" roughness={0.96} />
      </mesh>

      {/* Smooth continuous asphalt road ribbon */}
      <mesh geometry={roadGeom} receiveShadow castShadow>
        <meshStandardMaterial
          color="#59636c"
          emissive="#111922"
          emissiveIntensity={0.22}
          roughness={0.94}
          metalness={0}
        />
      </mesh>

      {/* White edge paint follows the same centerline as the road and collision system */}
      <mesh geometry={leftBoundaryGeom} receiveShadow>
        <meshStandardMaterial color="#f4f4ec" roughness={0.9} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={rightBoundaryGeom} receiveShadow>
        <meshStandardMaterial color="#f4f4ec" roughness={0.9} side={THREE.DoubleSide} />
      </mesh>

      {/* Left 3D kerb (alternating red / white) */}
      <mesh geometry={lKerbGeom} receiveShadow castShadow>
        <meshStandardMaterial vertexColors roughness={0.5} />
      </mesh>

      {/* Right 3D kerb (alternating red / white) */}
      <mesh geometry={rKerbGeom} receiveShadow castShadow>
        <meshStandardMaterial vertexColors roughness={0.5} />
      </mesh>

      {/* Runoff apron (gravel & asphalt transitions) */}
      <mesh geometry={runoffGeom} receiveShadow>
        <meshStandardMaterial color="#858b80" roughness={0.96} />
      </mesh>

      {/* Concrete & Tyre perimeter barrier walls */}
      <mesh geometry={barrierGeom} castShadow receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.4} />
      </mesh>

      {/* Checkered Start / Finish Line at (0, 0, 100) across 14m track */}
      {Array.from({ length: 16 }, (_, i) => {
        const isEven = i % 2 === 0;
        const zPos = 100 - 6.6 + i * 0.88;
        return (
          <group key={`cf${i}`} position={[0, 0.025, zPos]}>
            <mesh position={[-0.45, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[0.88, 0.88]} />
              <meshStandardMaterial color={isEven ? "#ffffff" : "#111111"} roughness={0.35} />
            </mesh>
            <mesh position={[0.45, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[0.88, 0.88]} />
              <meshStandardMaterial color={isEven ? "#111111" : "#ffffff"} roughness={0.35} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function MorningSky() {
  const skyRef = useRef();

  useFrame(({ camera }) => {
    if (skyRef.current) {
      skyRef.current.position.copy(camera.position);
    }
  });

  return (
    <mesh ref={skyRef} renderOrder={-1000} frustumCulled={false}>
      <sphereGeometry args={[1200, 32, 20]} />
      <shaderMaterial
        side={THREE.BackSide}
        depthWrite={false}
        toneMapped={false}
        vertexShader={`
          varying vec3 vDirection;
          void main() {
            vDirection = normalize(mat3(modelMatrix) * position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          varying vec3 vDirection;
          void main() {
            float height = clamp(normalize(vDirection).y * 0.5 + 0.5, 0.0, 1.0);
            float horizon = smoothstep(0.32, 0.56, height);
            float zenith = smoothstep(0.58, 0.98, height);
            vec3 warmHorizon = vec3(0.96, 0.84, 0.67);
            vec3 morningBlue = vec3(0.37, 0.70, 0.94);
            vec3 deepBlue = vec3(0.10, 0.39, 0.73);
            vec3 color = mix(warmHorizon, morningBlue, horizon);
            color = mix(color, deepBlue, zenith * 0.78);
            float sunAlignment = dot(
              normalize(vDirection),
              normalize(vec3(0.78, 0.38, 0.50))
            );
            float sunHalo = pow(max(sunAlignment, 0.0), 72.0) * 0.22;
            float sunDisk = smoothstep(0.99925, 0.9997, sunAlignment);
            color = mix(color, vec3(1.0, 0.96, 0.82), clamp(sunHalo + sunDisk, 0.0, 1.0));
            gl_FragColor = vec4(color, 1.0);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }
        `}
      />
    </mesh>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GAME SCENE: ARCADE DRIVING SIMULATION + CAMERA + SOUND
// ─────────────────────────────────────────────────────────────────────────────

function GameScene({
  onTelemetry,
  gameState,
  onFinishRace,
  resetSignal,
  restartSignal,
}) {
  const car = useRef();
  const sunRef = useRef();
  const cameraTarget = useRef(new THREE.Vector3());
  const authenticCarRef = useRef();
  const wheelsRef = useRef([]);
  const frontSteerRef = useRef([]);
  const brakeLightRef = useRef();

  const handleCarRef = useCallback((node) => {
    authenticCarRef.current = node;
  }, []);

  const physics = useRef({
    speed: 0,
    yaw: START_CONFIG.yaw,
    x: START_CONFIG.x,
    z: START_CONFIG.z,

    steering: 0,
    lateralVelocity: 0,
    wheelRoll: 0,

    lap: 1,
    time: 0,
    currentLapTime: 0,
    bestLapTime: null,
    lastLapTime: null,
    lastU: 0,
    checkpointsPassed: new Set([0]),
    gear: 1,
    topSpeed: 0,
  });

  const keys = useRef({});
  const elapsed = useRef(0);

  // Handle keyboard inputs
  useEffect(() => {
    const down = (e) => {
      const key = e.key.toLowerCase();
      if (key.startsWith("arrow") || key === " ") {
        e.preventDefault();
      }
      keys.current[key] = true;
    };

    const up = (e) => {
      keys.current[e.key.toLowerCase()] = false;
    };

    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);

    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // Handle Car Reset signal (R key or Reset button)
  useEffect(() => {
    if (!resetSignal) return;
    const p = physics.current;
    const proj = projectToTrack(p.x, p.z);
    p.x = proj.centerPoint.x;
    p.z = proj.centerPoint.z;
    p.yaw = Math.atan2(-proj.tangent.x, -proj.tangent.z);
    p.speed = 0;
    p.lateralVelocity = 0;
    p.steering = 0;
  }, [resetSignal]);

  // Handle Full Race Restart signal (from Restart Race or Race Again buttons)
  useEffect(() => {
    if (!restartSignal) return;
    const p = physics.current;
    p.speed = 0;
    p.yaw = START_CONFIG.yaw;
    p.x = START_CONFIG.x;
    p.z = START_CONFIG.z;
    p.steering = 0;
    p.lateralVelocity = 0;
    p.wheelRoll = 0;
    p.lap = 1;
    p.time = 0;
    p.currentLapTime = 0;
    p.bestLapTime = null;
    p.lastLapTime = null;
    p.lastU = 0;
    p.checkpointsPassed = new Set([0]);
    p.gear = 1;
    p.topSpeed = 0;
  }, [restartSignal]);

  useFrame((state, delta) => {
    if (!car.current) return;

    const dt = Math.min(delta, 0.04);
    const p = physics.current;
    const isRacing = gameState === "racing";
    const wheelMeshes = authenticCarRef.current?.wheelMeshes ?? [];
    if (wheelMeshes.length && wheelMeshes !== wheelsRef.current) {
      wheelsRef.current = wheelMeshes;
      const namedFrontWheels = wheelMeshes.filter((wheel) =>
        wheel.name.toLowerCase().includes("front"),
      );
      frontSteerRef.current = namedFrontWheels.length
        ? namedFrontWheels
        : wheelMeshes.filter((wheel) => wheel.position.z > 0).slice(0, 2);
    }

    let throttle = false;
    let brake = false;
    let onTrack = true;
    let forwardX = -Math.sin(p.yaw);
    let forwardZ = -Math.cos(p.yaw);

    if (isRacing) {
      p.time += dt;
      p.currentLapTime += dt;

      // Inputs
      throttle = !!(keys.current["w"] || keys.current["arrowup"]);
      brake = !!(keys.current["s"] || keys.current["arrowdown"] || keys.current[" "]);
      const left = !!(keys.current["a"] || keys.current["arrowleft"]);
      const right = !!(keys.current["d"] || keys.current["arrowright"]);

      const steeringInput = (left ? 1 : 0) - (right ? 1 : 0);

      // Smooth steering response
      p.steering = THREE.MathUtils.damp(p.steering, steeringInput, 8, dt);

      // Acceleration and braking
      const maxSpeed = 78; // ~280 km/h

      if (throttle) {
        p.speed += 32 * dt;
      } else {
        // Engine drag
        p.speed -= 5.0 * dt;
      }

      if (brake) {
        p.speed -= 48 * dt;
      }

      p.speed = THREE.MathUtils.clamp(p.speed, 0, maxSpeed);

      if (p.speed > p.topSpeed) {
        p.topSpeed = p.speed;
      }

      // Check track surface
      const proj = projectToTrack(p.x, p.z);
      onTrack = proj.onTrack;

      // Steering response: 0 when stopped, scales up smoothly by ~15 m/s (~54 km/h)
      const speedFactor = THREE.MathUtils.clamp(p.speed / 15, 0, 1);
      const speedRatio = p.speed / maxSpeed;
      // High-speed challenge: smooth 18% reduction at top speed so corners require braking or drifting
      const highSpeedFactor = 1.0 - speedRatio * 0.18;
      const grip = onTrack ? 1.0 : (proj.onKerb ? 0.85 : 0.6);

      // Turn rate: responsive, predictable arcade steering
      const turnRate = p.steering * speedFactor * 1.55 * highSpeedFactor * grip;
      p.yaw += turnRate * dt;

      // Forward direction: In Three.js, car nose points in local -Z
      // When rotated by yaw around Y:
      // forwardX = -sin(yaw), forwardZ = -cos(yaw)
      forwardX = -Math.sin(p.yaw);
      forwardZ = -Math.cos(p.yaw);

      // Right vector (perpendicular to forward)
      const rightX = Math.cos(p.yaw);
      const rightZ = -Math.sin(p.yaw);

      // Controlled arcade drift: subtle, stable slip that never spins out
      const driftTarget = p.steering * p.speed * 0.05;
      p.lateralVelocity = THREE.MathUtils.damp(
        p.lateralVelocity,
        driftTarget,
        onTrack ? 4.5 : 1.8,
        dt,
      );

      // Position update
      p.x += (forwardX * p.speed + rightX * p.lateralVelocity) * dt;
      p.z += (forwardZ * p.speed + rightZ * p.lateralVelocity) * dt;

      // Track surface and barrier collision
      const newProj = projectToTrack(p.x, p.z);

      if (!newProj.onTrack) {
        const penalty = newProj.onKerb ? 10 : 24;
        p.speed = Math.max(0, p.speed - penalty * dt);
        p.lateralVelocity *= 0.95;
      }

      // Soft barrier collision: bounce gently, bleed speed, prevent escaping
      if (newProj.absDistance >= BARRIER_OFFSET) {
        const clampedDist = Math.sign(newProj.distance) * (BARRIER_OFFSET - 0.15);
        p.x = newProj.centerPoint.x + newProj.normal.x * clampedDist;
        p.z = newProj.centerPoint.z + newProj.normal.z * clampedDist;
        p.speed = Math.max(0, p.speed - 32 * dt);
        p.lateralVelocity = 0;
        audioEngine.playImpact();
      }

      // Gear calculation
      p.gear = THREE.MathUtils.clamp(Math.floor(p.speed / 10) + 1, 1, 8);

      // Checkpoint and lap detection:
      for (const cp of CHECKPOINTS) {
        const diff = Math.abs(newProj.u - cp.u);
        if (diff < 0.06 || diff > 0.94) {
          p.checkpointsPassed.add(cp.id);
        }
      }

      // Crossing finish line from final sector into main straight
      const crossedLine = p.lastU > 0.85 && newProj.u < 0.15;
      if (crossedLine && p.checkpointsPassed.size >= 6 && p.currentLapTime > 8.0 && p.speed > 5) {
        if (p.lap >= 5) {
          onFinishRace({
            totalTime: p.time,
            bestLap: p.bestLapTime ? Math.min(p.bestLapTime, p.currentLapTime) : p.currentLapTime,
            topSpeed: Math.round(p.topSpeed * 3.6),
          });
        } else {
          p.lastLapTime = p.currentLapTime;
          if (!p.bestLapTime || p.currentLapTime < p.bestLapTime) {
            p.bestLapTime = p.currentLapTime;
          }
          p.currentLapTime = 0;
          p.lap += 1;
          p.checkpointsPassed.clear();
          p.checkpointsPassed.add(0);
        }
      }

      p.lastU = newProj.u;
    }

    // Apply car position, pitch, yaw and roll
    const isBrakingActive = brake && isRacing;
    const currentSpeedFactor = THREE.MathUtils.clamp(p.speed / 15, 0, 1);
    const rollTarget = -p.steering * currentSpeedFactor * 0.04;
    const pitchTarget = isBrakingActive ? -0.02 : (throttle && isRacing ? 0.012 : 0);

    p.bodyRoll = THREE.MathUtils.damp(p.bodyRoll || 0, rollTarget, 6, dt);
    p.bodyPitch = THREE.MathUtils.damp(p.bodyPitch || 0, pitchTarget, 8, dt);

    // Subtle suspension vibration when off-track or over kerbs
    const suspY = (!onTrack && p.speed > 8)
      ? Math.sin(p.time * 36) * 0.016 * (p.speed / 78)
      : 0;

    car.current.position.set(p.x, suspY, p.z);
    car.current.rotation.order = "YXZ";
    car.current.rotation.x = p.bodyPitch;
    car.current.rotation.y = p.yaw;
    car.current.rotation.z = p.bodyRoll;

    // Visual Wheel Spin (based on speed)
    const rollDelta = (p.speed * dt) / 0.42;
    p.wheelRoll -= rollDelta;

    for (const wheel of wheelsRef.current) {
      wheel.rotation.x = p.wheelRoll;
    }

    // Front wheel visual steering pivot
    for (const wheel of frontSteerRef.current) {
      wheel.rotation.y = p.steering * 0.38;
    }

    // Rear brake LED light
    if (brakeLightRef.current) {
      brakeLightRef.current.emissiveIntensity = isBrakingActive ? 3.5 : 0.25;
      brakeLightRef.current.emissive.set(isBrakingActive ? "#ff0000" : "#220000");
    }

    // Chase camera
    const behind = new THREE.Vector3(0, 5.2, 9.8);
    behind.applyAxisAngle(new THREE.Vector3(0, 1, 0), p.yaw);

    const desiredCamera = new THREE.Vector3(
      p.x + behind.x,
      behind.y,
      p.z + behind.z,
    );

    state.camera.position.lerp(desiredCamera, 1 - Math.pow(0.001, dt));
    cameraTarget.current.set(p.x, 1, p.z);
    state.camera.lookAt(cameraTarget.current);

    // Directional sunlight follows car to maintain crisp 2K shadows anywhere on the 1km circuit
    if (sunRef.current) {
      sunRef.current.position.set(p.x + 35, 50, p.z + 25);
      sunRef.current.target.position.set(p.x, 0, p.z);
      sunRef.current.target.updateMatrixWorld();
    }

    // Audio update
    audioEngine.update({
      speed: p.speed,
      maxSpeed: 78,
      isBraking: brake,
      lateralVelocity: p.lateralVelocity,
      isRunning: isRacing,
    });

    // Update HUD telemetry at ~12Hz
    elapsed.current += dt;
    if (elapsed.current > 0.08) {
      elapsed.current = 0;

      onTelemetry({
        speed: Math.round(p.speed * 3.6),
        lap: p.lap,
        gear: p.gear,
        time: p.time,
        raceTime: p.time,
        currentLapTime: p.currentLapTime,
        bestLapTime: p.bestLapTime,
        lastLapTime: p.lastLapTime,
        posX: p.x,
        posZ: p.z,
        forwardX,
        forwardZ,
        offTrack: !onTrack,
        isDrifting: Math.abs(p.lateralVelocity) > 3.0,
      });
    }
  });

  return (
    <>
      <MorningSky />
      <fog attach="fog" args={["#b9d8eb", 180, 600]} />
      <ambientLight intensity={0.72} />
      <hemisphereLight args={["#e4f5ff", "#58754a", 1.05]} />

      <directionalLight
        ref={sunRef}
        position={[35, 50, 25]}
        color="#fff1d2"
        intensity={2.2}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={1}
        shadow-camera-far={120}
        shadow-camera-left={-45}
        shadow-camera-right={45}
        shadow-camera-top={45}
        shadow-camera-bottom={-45}
        shadow-bias={-0.0003}
      />

      <directionalLight position={[-25, 20, -25]} color="#d5ebff" intensity={0.65} />

      <RaceTrack />

      <TracksideEnvironment />

      <group ref={car}>
        <AuthenticF1Car ref={handleCarRef} brakeLightRef={brakeLightRef} />
      </group>

    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COUNTDOWN OVERLAY
// ─────────────────────────────────────────────────────────────────────────────

function Countdown({ onComplete }) {
  const [count, setCount] = useState(3);

  useEffect(() => {
    if (count > 0) {
      audioEngine.playBeep(false);
      const timer = setTimeout(() => {
        setCount((prev) => prev - 1);
      }, 900);
      return () => clearTimeout(timer);
    } else {
      audioEngine.playBeep(true);
      const timer = setTimeout(() => {
        onComplete();
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [count, onComplete]);

  return (
    <div className="f1-countdown-overlay">
      <div className={`f1-countdown-number ${count === 0 ? "go" : ""}`}>
        {count === 0 ? "GO!" : count}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN GAME COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function RacingGame() {
  const [gameState, setGameState] = useState("start"); // "start" | "countdown" | "racing" | "paused" | "finished"
  const [soundMuted, setSoundMuted] = useState(false);
  const [resetCounter, setResetCounter] = useState(0);
  const [restartCounter, setRestartCounter] = useState(0);
  const [results, setResults] = useState(null);

  const circuitMap = useMemo(() => getCircuitSvgPath(120, 100), []);

  const [telemetry, setTelemetry] = useState({
    speed: 0,
    lap: 1,
    gear: 1,
    time: 0,
    raceTime: 0,
    currentLapTime: 0,
    bestLapTime: null,
    lastLapTime: null,
    posX: START_CONFIG.x,
    posZ: START_CONFIG.z,
    forwardX: START_CONFIG.forwardX,
    forwardZ: START_CONFIG.forwardZ,
    offTrack: false,
    isDrifting: false,
  });

  const formatTime = useCallback((seconds) => {
    if (seconds == null || isNaN(seconds)) return "--:--.--";
    const minutes = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(2);
    return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(5, "0")}`;
  }, []);

  const handleStartGame = () => {
    audioEngine.init();
    audioEngine.resume();
    audioEngine.setMuted(soundMuted);
    setGameState("countdown");
  };

  const handleCountdownComplete = useCallback(() => {
    setGameState("racing");
  }, []);

  const handleTogglePause = useCallback(() => {
    setGameState((prev) => {
      if (prev === "racing") {
        return "paused";
      }
      if (prev === "paused") {
        audioEngine.resume();
        return "racing";
      }
      return prev;
    });
  }, []);

  const handleResetCar = useCallback(() => {
    setResetCounter((c) => c + 1);
  }, []);

  const handleFinishRace = useCallback((finalResults) => {
    setResults(finalResults);
    setGameState("finished");
  }, []);

  const handleRestart = () => {
    setResults(null);
    setTelemetry({
      speed: 0,
      lap: 1,
      gear: 1,
      time: 0,
      raceTime: 0,
      currentLapTime: 0,
      bestLapTime: null,
      lastLapTime: null,
      posX: START_CONFIG.x,
      posZ: START_CONFIG.z,
      forwardX: START_CONFIG.forwardX,
      forwardZ: START_CONFIG.forwardZ,
      offTrack: false,
      isDrifting: false,
    });
    setRestartCounter((c) => c + 1);
    setGameState("countdown");
  };

  const toggleSound = () => {
    const nextMuted = !soundMuted;
    setSoundMuted(nextMuted);
    audioEngine.setMuted(nextMuted);
  };

  // Keyboard shortcuts: Pause (Esc / P) and Reset (R)
  useEffect(() => {
    const handleKeyDown = (e) => {
      const key = e.key.toLowerCase();
      if (key === "escape" || key === "p") {
        handleTogglePause();
      } else if (key === "r") {
        handleResetCar();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleTogglePause, handleResetCar]);

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      audioEngine.dispose();
    };
  }, []);

  const isRacingLive = gameState === "racing" || gameState === "countdown";

  return (
    <div className="f1-game">
      <Canvas
        shadows
        camera={{ position: [0, 7, 48], fov: 65, far: 2000 }}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.1,
        }}
      >
        <color attach="background" args={["#a9d8f4"]} />

        <GameScene
          onTelemetry={setTelemetry}
          gameState={gameState}
          onFinishRace={handleFinishRace}
          resetSignal={resetCounter}
          restartSignal={restartCounter}
        />
      </Canvas>

      {/* Top Bar Navigation & Info */}
      <div className="f1-topbar">
        <div className="f1-brand-area">
          <div className="f1-logo">
            F1 <span>RUSH</span>
          </div>
          <div className="f1-race-info">LAP {telemetry.lap} / 5</div>
        </div>

        <div className="f1-top-actions">
          <button
            type="button"
            className="f1-btn-subtle"
            onClick={toggleSound}
            title={soundMuted ? "Unmute Audio" : "Mute Audio"}
          >
            {soundMuted ? "🔇 SOUND OFF" : "🔊 SOUND ON"}
          </button>

          {(gameState === "racing" || gameState === "paused") && (
            <>
              <button
                type="button"
                className="f1-btn-subtle"
                onClick={handleResetCar}
                title="Reset car to track (Key: R)"
              >
                ↺ RESET CAR [R]
              </button>
              <button
                type="button"
                className="f1-btn-subtle"
                onClick={handleTogglePause}
                title="Pause Race (Key: ESC / P)"
              >
                {gameState === "paused" ? "▶ RESUME [ESC]" : "⏸ PAUSE [ESC]"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Status Banners */}
      {telemetry.offTrack && gameState === "racing" && (
        <div className="f1-status-banner warn">
          ⚠ OFF TRACK — SLOW DOWN
        </div>
      )}
      {telemetry.isDrifting && !telemetry.offTrack && gameState === "racing" && (
        <div className="f1-status-banner drift">
          ◈ DRIFTING
        </div>
      )}

      {/* Speedometer & Gear Display */}
      {isRacingLive && (
        <div className="f1-speed">
          <div className="speed-number">{telemetry.speed}</div>
          <div className="speed-unit">KM/H</div>
          <div className="gear-number">GEAR {telemetry.gear}</div>
        </div>
      )}

      {/* Lap Times & Race Timer Card */}
      {isRacingLive && (
        <div className="f1-timer-card">
          <div className="timer-row">
            <span className="timer-label">RACE TIME</span>
            <span className="timer-val primary">{formatTime(telemetry.time)}</span>
          </div>
          <div className="timer-row">
            <span className="timer-label">CURRENT LAP</span>
            <span className="timer-val">{formatTime(telemetry.currentLapTime)}</span>
          </div>
          <div className="timer-row">
            <span className="timer-label">LAST LAP</span>
            <span className="timer-val dim">{formatTime(telemetry.lastLapTime)}</span>
          </div>
          <div className="timer-row">
            <span className="timer-label">BEST LAP</span>
            <span className="timer-val highlight">{formatTime(telemetry.bestLapTime)}</span>
          </div>
        </div>
      )}

      {/* Minimap Radar */}
      {isRacingLive && (
        <div className="f1-minimap-container">
          <svg viewBox="0 0 100 100" width="88" height="88" className="f1-minimap-svg">
            {/* Outer Track Ribbon Background */}
            <path
              d={circuitMap.d}
              fill="none"
              stroke="#252c38"
              strokeWidth="9"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Center Guide Line */}
            <path
              d={circuitMap.d}
              fill="none"
              stroke="#e10600"
              strokeWidth="1.2"
              opacity="0.65"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Start / Finish line dot */}
            {(() => {
              const startCoord = circuitMap.transformCoord(START_CONFIG.x, START_CONFIG.z);
              return (
                <circle
                  cx={startCoord.svgX}
                  cy={startCoord.svgZ}
                  r="2.8"
                  fill="#ffffff"
                />
              );
            })()}
            {/* Player Car Marker with Directional Heading Arrow */}
            {(() => {
              const carCoord = circuitMap.transformCoord(
                telemetry.posX ?? START_CONFIG.x,
                telemetry.posZ ?? START_CONFIG.z
              );
              const headingDeg =
                (Math.atan2(telemetry.forwardZ || 0, telemetry.forwardX || 1) * 180) /
                Math.PI;
              return (
                <g transform={`translate(${carCoord.svgX}, ${carCoord.svgZ}) rotate(${headingDeg})`}>
                  <circle r="4.2" fill="#e10600" stroke="#ffffff" strokeWidth="1.2" />
                  <polygon points="5.5,0 1,-2.2 2,0 1,2.2" fill="#ffffff" />
                </g>
              );
            })()}
          </svg>
          <div className="minimap-title">CIRCUIT RADAR</div>
        </div>
      )}

      {/* Countdown Overlay */}
      {gameState === "countdown" && (
        <Countdown onComplete={handleCountdownComplete} />
      )}

      {/* Start Screen Overlay */}
      {gameState === "start" && (
        <div className="f1-modal-overlay">
          <div className="f1-modal-card">
            <div className="f1-eyebrow">GRAND PRIX SIMULATION</div>
            <h1>
              F1 <span>RUSH</span>
            </h1>
            <p>Feel the speed. Master the circuit. Beat the lap record.</p>

            <button
              type="button"
              className="f1-btn-primary"
              onClick={handleStartGame}
            >
              START RACE →
            </button>

            <div className="f1-instructions">
              <strong>W / ↑</strong> ACCELERATE &nbsp;•&nbsp; <strong>S / ↓ / SPACE</strong> BRAKE
              <br />
              <strong>A / ←</strong> STEER LEFT &nbsp;•&nbsp; <strong>D / →</strong> STEER RIGHT
              <br />
              <strong>R</strong> RESET CAR &nbsp;•&nbsp; <strong>ESC / P</strong> PAUSE
            </div>
          </div>
        </div>
      )}

      {/* Pause Screen Overlay */}
      {gameState === "paused" && (
        <div className="f1-modal-overlay">
          <div className="f1-modal-card">
            <div className="f1-eyebrow">SESSION SUSPENDED</div>
            <h2>RACE PAUSED</h2>
            <p>Ready to jump back into the cockpit?</p>

            <div className="f1-modal-buttons">
              <button
                type="button"
                className="f1-btn-primary"
                onClick={handleTogglePause}
              >
                RESUME RACE
              </button>
              <button
                type="button"
                className="f1-btn-secondary"
                onClick={handleRestart}
              >
                RESTART RACE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Race Finish Victory Screen Overlay */}
      {gameState === "finished" && (
        <div className="f1-modal-overlay">
          <div className="f1-modal-card">
            <div className="f1-eyebrow">CHEQUERED FLAG</div>
            <h2>RACE FINISHED!</h2>
            <p>Phenomenal driving. Here is your final telemetry:</p>

            <div className="f1-results-grid">
              <div className="result-card">
                <span className="card-label">TOTAL TIME</span>
                <span className="card-val">{formatTime(results?.totalTime)}</span>
              </div>
              <div className="result-card">
                <span className="card-label">BEST LAP</span>
                <span className="card-val highlight">{formatTime(results?.bestLap)}</span>
              </div>
              <div className="result-card">
                <span className="card-label">TOP SPEED</span>
                <span className="card-val">{results?.topSpeed || 0} KM/H</span>
              </div>
              <div className="result-card">
                <span className="card-label">LAPS COMPLETED</span>
                <span className="card-val">5 / 5</span>
              </div>
            </div>

            <button
              type="button"
              className="f1-btn-primary"
              onClick={handleRestart}
            >
              RACE AGAIN ↺
            </button>
          </div>
        </div>
      )}

      <div className="f1-controls-hint">WASD / ARROW KEYS TO DRIVE • R TO RESET • ESC TO PAUSE</div>
    </div>
  );
}
