// Procedural covered grandstand: stepped tiers, seats, crowd, cantilever roof.
// Local frame: length along X, front face at z = +depth/2 facing the track (+Z).
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { mulberry32 } from "./layout";

const TIER_DEPTH = 0.85;
const TIER_RISE = 0.5;
const BASE_H = 1.6;
const SEAT_PITCH = 0.55;

const SCHEMES = [
  ["#1d4fa3", "#e9edf2"],
  ["#b8161d", "#eeeeee"],
  ["#0f6f6a", "#c9ced3"],
];
const SHIRTS = ["#d23a2f", "#f2f2f2", "#1e4fa0", "#121212", "#f5c400", "#2f8f4e", "#e57a1f", "#7a3fa0", "#9aa3ad", "#ff5fa2"];
const SKIN = ["#f1c7a5", "#d9a37c", "#a8714d", "#6e4630", "#e8b896"];

function buildShell(length, tiers) {
  const parts = [];
  const top = BASE_H + (tiers - 1) * TIER_RISE;
  const back = tiers * TIER_DEPTH;
  for (let t = 0; t < tiers; t++) {
    const h = BASE_H + t * TIER_RISE;
    parts.push(new THREE.BoxGeometry(length, h, TIER_DEPTH).translate(0, h / 2, -(t + 0.5) * TIER_DEPTH));
  }
  // Side walls, back wall.
  for (const sx of [-1, 1]) {
    parts.push(new THREE.BoxGeometry(0.35, top + 1.2, back + 0.4).translate(sx * (length / 2 + 0.17), (top + 1.2) / 2, -back / 2));
  }
  parts.push(new THREE.BoxGeometry(length + 0.7, top + 1.4, 0.35).translate(0, (top + 1.4) / 2, -back - 0.17));
  // Plinth under the whole stand so it sits cleanly on sloping ground.
  parts.push(new THREE.BoxGeometry(length + 0.7, 3, back + 0.6).translate(0, -1.5, -back / 2));
  return { geometry: mergeGeometries(parts), top, back };
}

function buildRoof(length, top, back) {
  const roofY = top + 4.4;
  const steel = [];
  const n = Math.max(2, Math.round(length / 9));
  for (let i = 0; i <= n; i++) {
    const x = -length / 2 + (i / n) * length;
    steel.push(new THREE.CylinderGeometry(0.2, 0.26, roofY, 10).translate(x, roofY / 2, -back - 0.6));
    // Cantilever arm, sloping down slightly to the front.
    const arm = new THREE.BoxGeometry(0.3, 0.5, back + 3.4);
    arm.rotateX(-0.06).translate(x, roofY + 0.05, -back / 2 + 1.0);
    steel.push(arm);
  }
  const deck = new THREE.BoxGeometry(length + 1.2, 0.22, back + 3.6).rotateX(-0.06).translate(0, roofY + 0.4, -back / 2 + 1.0);
  const fasciaZ = 2.8;
  return { steel: mergeGeometries(steel), deck, roofY, fasciaZ };
}

function InstancedCrowd({ length, tiers, scheme, seed }) {
  const seatRef = useRef();
  const torsoRef = useRef();
  const headRef = useRef();
  const headGeom = useMemo(() => new THREE.SphereGeometry(0.115, 7, 5).translate(0, 0.4, 0), []);
  const data = useMemo(() => {
    const rand = mulberry32(seed);
    const seats = [];
    const people = [];
    const cols = Math.floor((length - 1) / SEAT_PITCH);
    const [c1, c2] = SCHEMES[scheme % SCHEMES.length];
    for (let t = 0; t < tiers; t++) {
      const y = BASE_H + t * TIER_RISE;
      const z = -(t + 0.55) * TIER_DEPTH;
      for (let c = 0; c < cols; c++) {
        const x = -length / 2 + 0.5 + c * SEAT_PITCH + SEAT_PITCH / 2;
        if (Math.abs(((x + length / 2) % 12) - 6) < 0.6) continue; // aisles
        const block = (Math.floor((x + length) / 6) + Math.floor(t / 4)) % 2;
        seats.push({ x, y, z, color: block ? c1 : c2 });
        if (rand() < 0.72) {
          people.push({
            x: x + (rand() - 0.5) * 0.08,
            y,
            z: z + 0.05,
            s: 0.92 + rand() * 0.16,
            shirt: SHIRTS[Math.floor(rand() * SHIRTS.length)],
            skin: SKIN[Math.floor(rand() * SKIN.length)],
            lean: (rand() - 0.5) * 0.25,
          });
        }
      }
    }
    return { seats, people };
  }, [length, tiers, scheme, seed]);

  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const col = new THREE.Color();
    data.seats.forEach((s, i) => {
      m.makeTranslation(s.x, s.y + 0.2, s.z);
      seatRef.current.setMatrixAt(i, m);
      seatRef.current.setColorAt(i, col.set(s.color));
    });
    data.people.forEach((p, i) => {
      q.setFromEuler(e.set(0, p.lean, 0));
      m.compose(new THREE.Vector3(p.x, p.y + 0.4, p.z), q, new THREE.Vector3(p.s, p.s, p.s));
      torsoRef.current.setMatrixAt(i, m);
      torsoRef.current.setColorAt(i, col.set(p.shirt));
      headRef.current.setMatrixAt(i, m);
      headRef.current.setColorAt(i, col.set(p.skin));
    });
    for (const r of [seatRef, torsoRef, headRef]) {
      r.current.instanceMatrix.needsUpdate = true;
      if (r.current.instanceColor) r.current.instanceColor.needsUpdate = true;
    }
  }, [data]);

  return (
    <group>
      <instancedMesh ref={seatRef} args={[undefined, undefined, data.seats.length]} receiveShadow>
        <boxGeometry args={[0.46, 0.4, 0.42]} />
        <meshStandardMaterial roughness={0.5} />
      </instancedMesh>
      <instancedMesh ref={torsoRef} args={[undefined, undefined, data.people.length]} castShadow receiveShadow>
        <boxGeometry args={[0.4, 0.55, 0.26]} />
        <meshStandardMaterial roughness={0.85} />
      </instancedMesh>
      <instancedMesh ref={headRef} args={[headGeom, undefined, data.people.length]} receiveShadow>
        <meshStandardMaterial roughness={0.7} />
      </instancedMesh>
    </group>
  );
}

export default function Grandstand({ stand, materials, fascia, seed = 1 }) {
  const { length, tiers, scheme, x, y = 0, z, rotY, depth } = stand;
  const shell = useMemo(() => buildShell(length, tiers), [length, tiers]);
  const roof = useMemo(() => buildRoof(length, shell.top, shell.back), [length, shell]);
  const fasciaTex = useMemo(() => {
    const t = fascia.clone();
    t.repeat.set(length / 36, 1);
    t.needsUpdate = true;
    return t;
  }, [fascia, length]);

  return (
    <group position={[x, y, z]} rotation={[0, rotY, 0]}>
      {/* Front face of the stand is at +depth/2 in this group. */}
      <group position={[0, 0, depth / 2]}>
        <mesh geometry={shell.geometry} material={materials.concrete} castShadow receiveShadow />
        {/* Front parapet with sponsor strip */}
        <mesh position={[0, 0.7, 0.12]} material={materials.painted} castShadow receiveShadow>
          <boxGeometry args={[length + 0.7, 1.4, 0.24]} />
        </mesh>
        <mesh position={[0, 0.75, 0.245]}>
          <planeGeometry args={[length, 0.85]} />
          <meshStandardMaterial map={fasciaTex} roughness={0.45} />
        </mesh>
        <mesh geometry={roof.steel} material={materials.steel} castShadow />
        <mesh geometry={roof.deck} material={materials.painted} castShadow receiveShadow />
        <mesh position={[0, roof.roofY + 0.25, roof.fasciaZ]} rotation={[-0.06, 0, 0]}>
          <boxGeometry args={[length + 1.25, 1.1, 0.2]} />
          <meshStandardMaterial color="#1a1f26" roughness={0.4} metalness={0.4} />
        </mesh>
        <mesh position={[0, roof.roofY + 0.25, roof.fasciaZ + 0.11]} rotation={[-0.06, 0, 0]}>
          <planeGeometry args={[length + 1.1, 0.9]} />
          <meshStandardMaterial map={fasciaTex} roughness={0.4} emissive="#ffffff" emissiveMap={fasciaTex} emissiveIntensity={0.25} />
        </mesh>
        <InstancedCrowd length={length} tiers={tiers} scheme={scheme} seed={seed} />
      </group>
    </group>
  );
}
