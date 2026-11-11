// Pit lane, pit building with garages and glazed upper floor, race control, paddock.
// The main straight runs along +X at z = 100; the pit complex is on its -Z side.
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { PIT, MOTORHOMES } from "./layout";
import { TEAMS, teamTexture, circuitSignTexture } from "./textures";
import { createAsphaltMaterial, createPaintMaterial } from "../materials";

const GROUND_H = 5.6;
const UPPER_H = 4.6;
const BAY = 12;

function PitLane({ textures }) {
  const { geometry, paint } = useMemo(() => {
    const w = PIT.xEnd - PIT.xStart;
    const d = PIT.laneFront - PIT.laneBack;
    const g = new THREE.PlaneGeometry(w, d, 1, 1).rotateX(-Math.PI / 2);
    g.translate((PIT.xStart + PIT.xEnd) / 2, 0.015, (PIT.laneFront + PIT.laneBack) / 2);
    const uv = g.attributes.uv;
    const pos = g.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / 7, pos.getZ(i) / 7);
    g.setAttribute("aLine", new THREE.Float32BufferAttribute(new Array(pos.count).fill(50), 1));

    // Fast-lane line and a pit box in front of each garage.
    const parts = [];
    const lineZ = PIT.laneBack + 5.2;
    parts.push(new THREE.PlaneGeometry(w - 4, 0.15).rotateX(-Math.PI / 2).translate((PIT.xStart + PIT.xEnd) / 2, 0.03, lineZ));
    const b = PIT.building;
    const bays = Math.floor(b.length / BAY);
    for (let i = 0; i < bays; i++) {
      const x = b.x - b.length / 2 + (i + 0.5) * BAY;
      for (const dx of [-2.8, 2.8]) {
        parts.push(new THREE.PlaneGeometry(0.12, 4.2).rotateX(-Math.PI / 2).translate(x + dx, 0.03, PIT.laneBack + 2.4));
      }
      parts.push(new THREE.PlaneGeometry(5.7, 0.12).rotateX(-Math.PI / 2).translate(x, 0.03, PIT.laneBack + 4.5));
    }
    return { geometry: g, paint: mergeGeometries(parts) };
  }, []);
  const mats = useMemo(() => ({ asphalt: createAsphaltMaterial(textures), paint: createPaintMaterial("#f2f2ee") }), [textures]);
  return (
    <group>
      <mesh geometry={geometry} material={mats.asphalt} receiveShadow />
      <mesh geometry={paint} material={mats.paint} receiveShadow />
    </group>
  );
}

function PitBuilding({ materials }) {
  const b = PIT.building;
  const bays = Math.floor(b.length / BAY);
  const teamTex = useMemo(() => Array.from({ length: bays }, (_, i) => teamTexture(TEAMS[i % TEAMS.length], i)), [bays]);
  const sign = useMemo(() => circuitSignTexture("GiTogether Qualifying"), []);

  const geo = useMemo(() => {
    const front = b.depth / 2;
    const pillars = [];
    const interior = [];
    const lights = [];
    for (let i = 0; i <= bays; i++) {
      const x = -b.length / 2 + i * BAY;
      pillars.push(new THREE.BoxGeometry(1.0, GROUND_H, 0.8).translate(x, GROUND_H / 2, front - 0.4));
    }
    for (let i = 0; i < bays; i++) {
      const x = -b.length / 2 + (i + 0.5) * BAY;
      interior.push(new THREE.BoxGeometry(BAY - 1, GROUND_H - 0.2, 0.2).translate(x, GROUND_H / 2, -b.depth / 2 + 2));
      for (let k = 0; k < 3; k++) {
        lights.push(new THREE.BoxGeometry(BAY - 3, 0.08, 0.35).translate(x, GROUND_H - 0.5, front - 3 - k * 3.5));
      }
    }
    // Garage dividing walls.
    for (let i = 1; i < bays; i++) {
      const x = -b.length / 2 + i * BAY;
      interior.push(new THREE.BoxGeometry(0.25, GROUND_H, b.depth - 3).translate(x, GROUND_H / 2, 0.5));
    }
    const ceiling = new THREE.BoxGeometry(b.length, 0.3, b.depth).translate(0, GROUND_H - 0.15, 0);
    const slab = new THREE.BoxGeometry(b.length + 1.2, 0.45, b.depth + 2.2).translate(0, GROUND_H + 0.2, 0.9);
    const roof = new THREE.BoxGeometry(b.length + 2.4, 0.55, b.depth + 4).translate(0, GROUND_H + UPPER_H + 0.7, 1.2);
    const backWall = new THREE.BoxGeometry(b.length, GROUND_H + UPPER_H + 0.5, 0.4).translate(0, (GROUND_H + UPPER_H) / 2, -b.depth / 2);
    const ends = [-1, 1].map((sx) =>
      new THREE.BoxGeometry(0.5, GROUND_H + UPPER_H + 0.5, b.depth).translate(sx * (b.length / 2), (GROUND_H + UPPER_H) / 2, 0));
    const mullions = [];
    for (let x = -b.length / 2; x <= b.length / 2; x += 2.4) {
      mullions.push(new THREE.BoxGeometry(0.08, UPPER_H, 0.12).translate(x, GROUND_H + 0.4 + UPPER_H / 2, front - 1.0));
    }
    const rail = new THREE.BoxGeometry(b.length, 0.05, 0.05).translate(0, GROUND_H + 1.5, front + 1.9);
    return {
      shell: mergeGeometries([ceiling, slab, roof, backWall, ...ends, ...pillars]),
      interior: mergeGeometries(interior),
      lights: mergeGeometries(lights),
      mullions: mergeGeometries([...mullions, rail]),
      glassZ: front - 1.05,
    };
  }, [b, bays]);

  return (
    <group position={[b.x, 0, b.z]}>
      <mesh geometry={geo.shell} material={materials.painted} castShadow receiveShadow />
      <mesh geometry={geo.interior} material={materials.garageInterior} receiveShadow />
      <mesh geometry={geo.lights} material={materials.lightStrip} />
      <mesh position={[0, GROUND_H + 0.4 + UPPER_H / 2, geo.glassZ - 0.2]} material={materials.glass}>
        <boxGeometry args={[b.length - 0.6, UPPER_H, 0.3]} />
      </mesh>
      <mesh geometry={geo.mullions} material={materials.darkSteel} castShadow />
      {/* Glass balustrade on the balcony */}
      <mesh position={[0, GROUND_H + 0.95, b.depth / 2 + 1.9]}>
        <boxGeometry args={[b.length, 1.0, 0.04]} />
        <meshPhysicalMaterial color="#a8c4d6" transparent opacity={0.28} roughness={0.05} metalness={0.1} depthWrite={false} />
      </mesh>
      {/* Team fascia above each garage */}
      {Array.from({ length: bays }, (_, i) => (
        <mesh
          key={i}
          position={[-b.length / 2 + (i + 0.5) * BAY, GROUND_H - 0.75, b.depth / 2 + 0.02]}
        >
          <planeGeometry args={[BAY - 1.2, 1.2]} />
          <meshStandardMaterial map={teamTex[i]} roughness={0.4} />
        </mesh>
      ))}
      {/* Rooftop circuit sign facing the main straight */}
      <mesh position={[0, GROUND_H + UPPER_H + 2.2, b.depth / 2 + 1.4]}>
        <planeGeometry args={[32, 4]} />
        <meshStandardMaterial map={sign} emissive="#ffffff" emissiveMap={sign} emissiveIntensity={0.4} roughness={0.3} />
      </mesh>
      <mesh position={[0, GROUND_H + UPPER_H + 2.2, b.depth / 2 + 1.3]} material={materials.darkSteel}>
        <boxGeometry args={[32.4, 4.4, 0.15]} />
      </mesh>
    </group>
  );
}

function RaceControl({ materials }) {
  const c = PIT.control;
  const floors = 4;
  const fh = 3.6;
  return (
    <group position={[c.x, 0, c.z]}>
      <mesh position={[0, (floors * fh) / 2, -1]} material={materials.painted} castShadow receiveShadow>
        <boxGeometry args={[c.length * 0.55, floors * fh + 1, c.depth * 0.6]} />
      </mesh>
      {Array.from({ length: floors }, (_, f) => (
        <group key={f}>
          <mesh position={[0, f * fh + fh / 2 + 0.3, 0.6]} material={materials.glass}>
            <boxGeometry args={[c.length, fh - 0.5, c.depth - 1.5]} />
          </mesh>
          <mesh position={[0, f * fh + 0.2, 0.6]} material={materials.painted} castShadow receiveShadow>
            <boxGeometry args={[c.length + 0.8, 0.4, c.depth - 0.5]} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, floors * fh + 0.4, 0.6]} material={materials.painted} castShadow>
        <boxGeometry args={[c.length + 1.6, 0.6, c.depth + 0.6]} />
      </mesh>
      <mesh position={[3, floors * fh + 5, -1]} material={materials.steel}>
        <cylinderGeometry args={[0.08, 0.12, 9, 8]} />
      </mesh>
    </group>
  );
}

function Motorhomes({ materials }) {
  const bodyRef = useRef();
  const glassRef = useRef();
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const col = new THREE.Color();
    MOTORHOMES.forEach((h, i) => {
      m.makeTranslation(h.x, 2.3, h.z);
      bodyRef.current.setMatrixAt(i, m);
      bodyRef.current.setColorAt(i, col.set(TEAMS[h.team].color));
      m.makeTranslation(h.x, 3.0, h.z + 0.02);
      glassRef.current.setMatrixAt(i, m);
    });
    bodyRef.current.instanceMatrix.needsUpdate = true;
    bodyRef.current.instanceColor.needsUpdate = true;
    glassRef.current.instanceMatrix.needsUpdate = true;
  }, []);
  return (
    <group>
      <instancedMesh ref={bodyRef} args={[undefined, undefined, MOTORHOMES.length]} castShadow receiveShadow>
        <boxGeometry args={[15, 4.6, 5]} />
        <meshStandardMaterial roughness={0.35} metalness={0.2} />
      </instancedMesh>
      <instancedMesh ref={glassRef} args={[undefined, materials.glass, MOTORHOMES.length]}>
        <boxGeometry args={[14.2, 1.6, 5.06]} />
      </instancedMesh>
    </group>
  );
}

function Paddock({ materials }) {
  const p = PIT.paddock;
  const zMax = PIT.laneBack + 0.5; // run under the building to the pit lane
  return (
    <mesh
      position={[(p.xMin + p.xMax) / 2, 0.006, (p.zMin + zMax) / 2]}
      rotation={[-Math.PI / 2, 0, 0]}
      material={materials.concrete}
      receiveShadow
    >
      <planeGeometry args={[p.xMax - p.xMin, zMax - p.zMin]} />
    </mesh>
  );
}

export default function PitComplex({ textures, materials }) {
  return (
    <group>
      <PitLane textures={textures} />
      <PitBuilding materials={materials} />
      <RaceControl materials={materials} />
      <Paddock materials={materials} />
      <Motorhomes materials={materials} />
    </group>
  );
}
