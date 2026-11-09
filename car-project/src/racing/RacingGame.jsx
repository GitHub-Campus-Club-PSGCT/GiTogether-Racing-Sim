import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import { audioEngine } from "./audio";
import "./RacingGame.css";

// ─────────────────────────────────────────────────────────────────────────────
// TRACK GEOMETRY CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const TRACK = {
  INNER: 29.5,       // inner asphalt boundary
  OUTER: 41.5,       // outer asphalt boundary
  CENTRE: 35.5,      // track centerline radius
  BARRIER_INNER: 27.5,
  BARRIER_OUTER: 44.5,
};

// ─────────────────────────────────────────────────────────────────────────────
// F1 CAR 3D MODEL
// ─────────────────────────────────────────────────────────────────────────────

function F1Car({ wheelsRef, frontSteerRef, brakeLightRef }) {
  return (
    <group>
      {/* Main chassis */}
      <mesh position={[0, 0.65, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.15, 0.42, 3.2]} />
        <meshStandardMaterial color="#e10600" metalness={0.65} roughness={0.25} />
      </mesh>

      {/* Front nose */}
      <mesh position={[0, 0.58, -2.1]} castShadow receiveShadow>
        <boxGeometry args={[0.46, 0.18, 1.5]} />
        <meshStandardMaterial color="#e10600" metalness={0.6} roughness={0.3} />
      </mesh>

      {/* Cockpit */}
      <mesh position={[0, 0.99, 0.25]} castShadow>
        <boxGeometry args={[0.78, 0.3, 1.0]} />
        <meshStandardMaterial color="#171923" roughness={0.2} />
      </mesh>

      {/* Driver helmet */}
      <mesh position={[0, 1.18, 0.15]} castShadow>
        <sphereGeometry args={[0.25, 20, 20]} />
        <meshStandardMaterial color="#f5d442" metalness={0.4} roughness={0.3} />
      </mesh>

      {/* Halo */}
      <mesh position={[0, 1.36, 0.12]} castShadow>
        <torusGeometry args={[0.34, 0.045, 8, 24, Math.PI]} />
        <meshStandardMaterial color="#cccccc" metalness={0.85} roughness={0.3} />
      </mesh>

      {/* Rear wing main plane */}
      <mesh position={[0, 1.08, 1.85]} castShadow>
        <boxGeometry args={[2.0, 0.1, 0.44]} />
        <meshStandardMaterial color="#161616" metalness={0.7} roughness={0.4} />
      </mesh>

      {/* Rear wing lower flap */}
      <mesh position={[0, 0.91, 1.78]} castShadow>
        <boxGeometry args={[1.9, 0.08, 0.35]} />
        <meshStandardMaterial color="#e10600" metalness={0.6} roughness={0.4} />
      </mesh>

      {/* Rear wing endplates */}
      {[-1, 1].map((s) => (
        <mesh key={`rwe${s}`} position={[s * 1.0, 0.98, 1.84]} castShadow>
          <boxGeometry args={[0.055, 0.44, 0.52]} />
          <meshStandardMaterial color="#e10600" metalness={0.6} />
        </mesh>
      ))}

      {/* Front wing */}
      <mesh position={[0, 0.36, -2.72]} castShadow>
        <boxGeometry args={[2.3, 0.08, 0.5]} />
        <meshStandardMaterial color="#171717" metalness={0.6} roughness={0.4} />
      </mesh>

      {/* Side pods */}
      {[-1, 1].map((s) => (
        <mesh key={`pod${s}`} position={[s * 0.72, 0.55, 0.3]} castShadow receiveShadow>
          <boxGeometry args={[0.48, 0.3, 1.6]} />
          <meshStandardMaterial color="#c50000" metalness={0.6} roughness={0.3} />
        </mesh>
      ))}

      {/* Rear safety / brake LED */}
      <mesh ref={brakeLightRef} position={[0, 0.68, 1.77]} castShadow>
        <boxGeometry args={[0.24, 0.13, 0.07]} />
        <meshStandardMaterial
          color="#330000"
          emissive="#220000"
          emissiveIntensity={0.2}
          roughness={0.1}
        />
      </mesh>

      {/* Front Left Wheel with Steering Pivot */}
      <group
        ref={(el) => (frontSteerRef.current[0] = el)}
        position={[-0.95, 0.38, -1.18]}
      >
        <group
          ref={(el) => (wheelsRef.current[0] = el)}
          rotation={[0, 0, Math.PI / 2]}
        >
          <mesh castShadow>
            <cylinderGeometry args={[0.42, 0.42, 0.33, 24]} />
            <meshStandardMaterial color="#101010" roughness={0.9} />
          </mesh>
          <mesh castShadow>
            <cylinderGeometry args={[0.21, 0.21, 0.335, 20]} />
            <meshStandardMaterial color="#888" metalness={0.9} roughness={0.2} />
          </mesh>
        </group>
      </group>

      {/* Front Right Wheel with Steering Pivot */}
      <group
        ref={(el) => (frontSteerRef.current[1] = el)}
        position={[0.95, 0.38, -1.18]}
      >
        <group
          ref={(el) => (wheelsRef.current[1] = el)}
          rotation={[0, 0, Math.PI / 2]}
        >
          <mesh castShadow>
            <cylinderGeometry args={[0.42, 0.42, 0.33, 24]} />
            <meshStandardMaterial color="#101010" roughness={0.9} />
          </mesh>
          <mesh castShadow>
            <cylinderGeometry args={[0.21, 0.21, 0.335, 20]} />
            <meshStandardMaterial color="#888" metalness={0.9} roughness={0.2} />
          </mesh>
        </group>
      </group>

      {/* Rear Left Wheel */}
      <group position={[-0.95, 0.38, 1.18]}>
        <group
          ref={(el) => (wheelsRef.current[2] = el)}
          rotation={[0, 0, Math.PI / 2]}
        >
          <mesh castShadow>
            <cylinderGeometry args={[0.44, 0.44, 0.38, 24]} />
            <meshStandardMaterial color="#101010" roughness={0.9} />
          </mesh>
          <mesh castShadow>
            <cylinderGeometry args={[0.22, 0.22, 0.385, 20]} />
            <meshStandardMaterial color="#888" metalness={0.9} roughness={0.2} />
          </mesh>
        </group>
      </group>

      {/* Rear Right Wheel */}
      <group position={[0.95, 0.38, 1.18]}>
        <group
          ref={(el) => (wheelsRef.current[3] = el)}
          rotation={[0, 0, Math.PI / 2]}
        >
          <mesh castShadow>
            <cylinderGeometry args={[0.44, 0.44, 0.38, 24]} />
            <meshStandardMaterial color="#101010" roughness={0.9} />
          </mesh>
          <mesh castShadow>
            <cylinderGeometry args={[0.22, 0.22, 0.385, 20]} />
            <meshStandardMaterial color="#888" metalness={0.9} roughness={0.2} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RACE TRACK
// ─────────────────────────────────────────────────────────────────────────────

function RaceTrack() {
  return (
    <group>
      {/* Outer grass */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.12, 0]} receiveShadow>
        <planeGeometry args={[500, 500]} />
        <meshStandardMaterial color="#1f4a24" roughness={0.9} />
      </mesh>

      {/* Asphalt circuit ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <ringGeometry args={[29, 42, 180]} />
        <meshStandardMaterial color="#2d3137" roughness={0.88} />
      </mesh>

      {/* Inner grass island */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
        <circleGeometry args={[28.9, 128]} />
        <meshStandardMaterial color="#2b5930" roughness={0.9} />
      </mesh>

      {/* White track boundary rings */}
      {[29.4, 41.6].map((r) => (
        <mesh key={r} rotation={[Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
          <torusGeometry args={[r, 0.14, 6, 180]} />
          <meshStandardMaterial color="#ebebeb" roughness={0.4} />
        </mesh>
      ))}

      {/* Inner kerbs (alternating red / white) */}
      {Array.from({ length: 80 }, (_, i) => {
        const angle = (i / 80) * Math.PI * 2;
        return (
          <mesh
            key={`ik${i}`}
            position={[Math.sin(angle) * 29.1, 0.015, Math.cos(angle) * 29.1]}
            rotation={[-Math.PI / 2, 0, -angle]}
            receiveShadow
          >
            <planeGeometry args={[1.2, 0.5]} />
            <meshStandardMaterial color={i % 2 === 0 ? "#e10600" : "#f2f2f2"} roughness={0.5} />
          </mesh>
        );
      })}

      {/* Outer kerbs (alternating red / white) */}
      {Array.from({ length: 108 }, (_, i) => {
        const angle = (i / 108) * Math.PI * 2;
        return (
          <mesh
            key={`ok${i}`}
            position={[Math.sin(angle) * 41.9, 0.015, Math.cos(angle) * 41.9]}
            rotation={[-Math.PI / 2, 0, -angle]}
            receiveShadow
          >
            <planeGeometry args={[1.3, 0.5]} />
            <meshStandardMaterial color={i % 2 === 0 ? "#e10600" : "#f2f2f2"} roughness={0.5} />
          </mesh>
        );
      })}

      {/* Checkered start / finish line at z = 35.5 */}
      {Array.from({ length: 15 }, (_, i) => {
        const isEven = i % 2 === 0;
        const xPos = -6.3 + i * 0.9;
        return (
          <group key={`cf${i}`} position={[xPos, 0.018, TRACK.CENTRE]}>
            <mesh position={[0, 0, -0.45]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[0.84, 0.86]} />
              <meshStandardMaterial color={isEven ? "#ffffff" : "#111111"} roughness={0.4} />
            </mesh>
            <mesh position={[0, 0, 0.45]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[0.84, 0.86]} />
              <meshStandardMaterial color={isEven ? "#111111" : "#ffffff"} roughness={0.4} />
            </mesh>
          </group>
        );
      })}

      {/* Outer safety barrier blocks */}
      {Array.from({ length: 54 }, (_, i) => {
        const angle = (i / 54) * Math.PI * 2;
        const r = 45;
        return (
          <mesh
            key={`ob${i}`}
            position={[Math.sin(angle) * r, 0.9, Math.cos(angle) * r]}
            rotation={[0, -angle, 0]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[3.0, 1.6, 0.65]} />
            <meshStandardMaterial color={i % 2 === 0 ? "#e10600" : "#f0f0f0"} roughness={0.35} />
          </mesh>
        );
      })}

      {/* Inner safety barrier blocks */}
      {Array.from({ length: 40 }, (_, i) => {
        const angle = (i / 40) * Math.PI * 2;
        const r = 26.8;
        return (
          <mesh
            key={`ib${i}`}
            position={[Math.sin(angle) * r, 0.9, Math.cos(angle) * r]}
            rotation={[0, -angle, 0]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[3.0, 1.6, 0.65]} />
            <meshStandardMaterial color={i % 2 === 0 ? "#e10600" : "#f0f0f0"} roughness={0.35} />
          </mesh>
        );
      })}
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GAME SCENE: ARCADE DRIVING SIMULATION + CAMERA + SOUND
// ─────────────────────────────────────────────────────────────────────────────

function GameScene({ onTelemetry, gameState, onFinishRace, resetSignal }) {
  const car = useRef();
  const cameraTarget = useRef(new THREE.Vector3());
  const wheelsRef = useRef([]);
  const frontSteerRef = useRef([]);
  const brakeLightRef = useRef();

  const physics = useRef({
    speed: 0,
    yaw: -Math.PI / 2, // Facing counter-clockwise (+X direction at (0, 35.5))
    x: 0,
    z: TRACK.CENTRE,

    steering: 0,
    lateralVelocity: 0,
    wheelRoll: 0,

    lap: 1,
    time: 0,
    currentLapTime: 0,
    bestLapTime: null,
    lastLapTime: null,
    lastAngle: 0,
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
    const currentAngle = Math.atan2(p.x, p.z);
    p.x = Math.sin(currentAngle) * TRACK.CENTRE;
    p.z = Math.cos(currentAngle) * TRACK.CENTRE;
    p.yaw = currentAngle - Math.PI / 2; // Facing tangent in racing direction
    p.speed = 0;
    p.lateralVelocity = 0;
    p.steering = 0;
  }, [resetSignal]);

  useFrame((state, delta) => {
    if (!car.current) return;

    const dt = Math.min(delta, 0.04);
    const p = physics.current;
    const isRacing = gameState === "racing";

    let brake = false;
    let onTrack = true;

    if (isRacing) {
      p.time += dt;
      p.currentLapTime += dt;

      // Inputs
      const throttle = !!(keys.current["w"] || keys.current["arrowup"]);
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
      const radius = Math.hypot(p.x, p.z);
      onTrack = radius >= TRACK.INNER && radius <= TRACK.OUTER;

      // Steering response: 0 when stopped, scales up smoothly by ~15 m/s (~54 km/h)
      const speedFactor = THREE.MathUtils.clamp(p.speed / 15, 0, 1);
      const grip = onTrack ? 1.0 : 0.6;

      // Turn rate: responsive, predictable arcade steering
      const turnRate = p.steering * speedFactor * 1.55 * grip;
      p.yaw += turnRate * dt;

      // Forward direction: In Three.js, car nose points in local -Z
      // When rotated by yaw around Y:
      // forwardX = -sin(yaw), forwardZ = -cos(yaw)
      const forwardX = -Math.sin(p.yaw);
      const forwardZ = -Math.cos(p.yaw);

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

      // Soft barrier collision & off-track penalties
      const newRadius = Math.hypot(p.x, p.z);

      if (!onTrack) {
        p.speed = Math.max(0, p.speed - 22 * dt);
        p.lateralVelocity *= 0.96;
      }

      // Outer barrier at radius 44.5: bounce gently, bleed speed, prevent escaping
      if (newRadius > TRACK.BARRIER_OUTER) {
        p.x = (p.x / newRadius) * TRACK.BARRIER_OUTER;
        p.z = (p.z / newRadius) * TRACK.BARRIER_OUTER;
        p.speed = Math.max(0, p.speed - 30 * dt);
        p.lateralVelocity = 0;
        audioEngine.playImpact();
      }

      // Inner barrier at radius 27.5: prevent escaping inward
      if (newRadius < TRACK.BARRIER_INNER) {
        p.x = (p.x / newRadius) * TRACK.BARRIER_INNER;
        p.z = (p.z / newRadius) * TRACK.BARRIER_INNER;
        p.speed = Math.max(0, p.speed - 30 * dt);
        p.lateralVelocity = 0;
        audioEngine.playImpact();
      }

      // Gear calculation
      p.gear = THREE.MathUtils.clamp(Math.floor(p.speed / 10) + 1, 1, 8);

      // Lap detection via polar angle:
      // At (0, 35.5), angle is 0. Driving counter-clockwise, angle increases from 0 to 2*PI.
      // Crossing finish line: angle transitions from > 5.5 to < 0.8 rad.
      let angle = Math.atan2(p.x, p.z);
      if (angle < 0) {
        angle += Math.PI * 2;
      }

      if (p.lastAngle > 5.5 && angle < 0.8 && p.speed > 5 && p.currentLapTime > 4.0) {
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
        }
      }

      p.lastAngle = angle;
    }

    // Apply car position and yaw
    car.current.position.set(p.x, 0, p.z);
    car.current.rotation.y = p.yaw;

    // Visual Wheel Spin (based on speed)
    const rollDelta = (p.speed * dt) / 0.42;
    p.wheelRoll -= rollDelta;

    for (let i = 0; i < 4; i++) {
      if (wheelsRef.current[i]) {
        wheelsRef.current[i].rotation.x = p.wheelRoll;
      }
    }

    // Front wheel visual steering pivot
    for (let i = 0; i < 2; i++) {
      if (frontSteerRef.current[i]) {
        frontSteerRef.current[i].rotation.y = p.steering * 0.38;
      }
    }

    // Rear brake LED light
    if (brakeLightRef.current) {
      const isBrakingActive = brake && isRacing;
      brakeLightRef.current.material.emissiveIntensity = isBrakingActive ? 2.8 : 0.2;
      brakeLightRef.current.material.color.set(isBrakingActive ? "#ff1a1a" : "#330000");
      brakeLightRef.current.material.emissive.set(isBrakingActive ? "#ff0000" : "#220000");
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
        offTrack: !onTrack,
        isDrifting: Math.abs(p.lateralVelocity) > 3.0,
      });
    }
  });

  return (
    <>
      <ambientLight intensity={0.65} />

      <directionalLight
        position={[35, 45, 25]}
        intensity={1.8}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={1}
        shadow-camera-far={140}
        shadow-camera-left={-55}
        shadow-camera-right={55}
        shadow-camera-top={55}
        shadow-camera-bottom={-55}
        shadow-bias={-0.0003}
      />

      <directionalLight position={[-25, 20, -25]} intensity={0.4} />

      <RaceTrack />

      <group ref={car}>
        <F1Car
          wheelsRef={wheelsRef}
          frontSteerRef={frontSteerRef}
          brakeLightRef={brakeLightRef}
        />
      </group>

      <Stars radius={180} depth={40} count={700} factor={3} fade />
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
  const [results, setResults] = useState(null);

  const [telemetry, setTelemetry] = useState({
    speed: 0,
    lap: 1,
    gear: 1,
    time: 0,
    raceTime: 0,
    currentLapTime: 0,
    bestLapTime: null,
    lastLapTime: null,
    posX: 0,
    posZ: TRACK.CENTRE,
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
      posX: 0,
      posZ: TRACK.CENTRE,
      offTrack: false,
      isDrifting: false,
    });
    setResetCounter((c) => c + 1);
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
        camera={{ position: [0, 7, 48], fov: 65 }}
        gl={{ antialias: true }}
      >
        <color attach="background" args={["#101923"]} />

        <GameScene
          onTelemetry={setTelemetry}
          gameState={gameState}
          onFinishRace={handleFinishRace}
          resetSignal={resetCounter}
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
          <svg viewBox="0 0 100 100" width="82" height="82" className="f1-minimap-svg">
            {/* Outer Track Ring */}
            <circle cx="50" cy="50" r="40" fill="none" stroke="#252c38" strokeWidth="8" />
            {/* Guide line */}
            <circle cx="50" cy="50" r="40" fill="none" stroke="#3b4657" strokeWidth="1" strokeDasharray="2.5 3" />
            {/* Start / Finish line marker at bottom (z = 35.5) */}
            <line x1="50" y1="76" x2="50" y2="86" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
            {/* Player Car Marker */}
            <circle
              cx={50 + (telemetry.posX / 46) * 38}
              cy={50 + (telemetry.posZ / 46) * 38}
              r="4"
              fill="#e10600"
              stroke="#ffffff"
              strokeWidth="1.5"
            />
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
