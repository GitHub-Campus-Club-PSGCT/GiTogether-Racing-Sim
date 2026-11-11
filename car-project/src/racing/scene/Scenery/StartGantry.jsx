// Start/finish gantry spanning the main straight, with five pairs of start lights
// driven by the countdown (store.startLights).
import { useMemo } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { START_CONFIG, BARRIER_OFFSET } from "../../circuitDefinition";
import { useGame } from "../../store";
import { circuitSignTexture, eventSignTexture } from "./textures";

const SPAN = BARRIER_OFFSET + 1.6;
const BEAM_Y = 7.4;

export default function StartGantry({ materials }) {
  const frame = useMemo(() => {
    const parts = [];
    for (const s of [-1, 1]) {
      // Lattice tower: four legs with cross bracing.
      for (const [dx, dz] of [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]]) {
        parts.push(new THREE.BoxGeometry(0.14, BEAM_Y + 0.8, 0.14).translate(dx, (BEAM_Y + 0.8) / 2, s * SPAN + dz));
      }
      for (let y = 0.8; y < BEAM_Y; y += 1.2) {
        const brace = new THREE.BoxGeometry(0.08, 1.35, 0.08).rotateX(0.75).translate(-0.45, y + 0.6, s * SPAN);
        parts.push(brace, brace.clone().translate(0.9, 0, 0));
      }
    }
    // Truss beam across the track.
    for (const [dy, dx] of [[0, -0.4], [0, 0.4], [1.0, -0.4], [1.0, 0.4]]) {
      parts.push(new THREE.BoxGeometry(0.12, 0.12, SPAN * 2 + 1).translate(dx, BEAM_Y + dy, 0));
    }
    for (let z = -SPAN; z <= SPAN; z += 1.0) {
      parts.push(new THREE.BoxGeometry(0.06, 1.4, 0.06).rotateX(0.8).translate(-0.4, BEAM_Y + 0.5, z));
      parts.push(new THREE.BoxGeometry(0.06, 1.4, 0.06).rotateX(0.8).translate(0.4, BEAM_Y + 0.5, z));
    }
    return mergeGeometries(parts);
  }, []);

  const lightMats = useMemo(
    () => Array.from({ length: 5 }, () =>
      new THREE.MeshStandardMaterial({ color: "#2a0606", emissive: "#ff1a0a", emissiveIntensity: 0, roughness: 0.2 })),
    [],
  );
  const signs = useMemo(() => ({ [-1]: eventSignTexture(), 1: circuitSignTexture("GiTogether Qualifying") }), []);

  useFrame(() => {
    const on = useGame.getState().startLights;
    lightMats.forEach((m, i) => {
      m.emissiveIntensity = i < on ? 14 : 0;
    });
  });

  return (
    <group position={[START_CONFIG.x, 0, START_CONFIG.z]}>
      <mesh geometry={frame} material={materials.steel} castShadow />
      {/* Light housing facing approaching cars (they travel along +X). */}
      <mesh position={[-0.55, BEAM_Y - 0.9, 0]} material={materials.darkPanel} castShadow>
        <boxGeometry args={[0.4, 1.7, 6.6]} />
      </mesh>
      {lightMats.map((m, i) =>
        [0.38, -0.38].map((dy) => (
          <mesh key={`${i}${dy}`} position={[-0.78, BEAM_Y - 0.9 + dy, (i - 2) * 1.25]} material={m}>
            <sphereGeometry args={[0.22, 16, 12]} />
          </mesh>
        )),
      )}
      {/* Event sign faces approaching cars; circuit sign on the far side */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.62, BEAM_Y + 1.9, 0]} rotation={[0, s * Math.PI / 2, 0]}>
          <planeGeometry args={[18, 2.2]} />
          <meshStandardMaterial map={signs[s]} emissive="#ffffff" emissiveMap={signs[s]} emissiveIntensity={0.35} roughness={0.35} />
        </mesh>
      ))}
      <mesh position={[0, BEAM_Y + 1.9, 0]} material={materials.darkSteel}>
        <boxGeometry args={[1.1, 2.4, 18.4]} />
      </mesh>
    </group>
  );
}
