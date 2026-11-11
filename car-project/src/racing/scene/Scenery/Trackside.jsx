// Floodlight masts, marshal posts, brake boards and barrier hoardings.
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { FLOODLIGHTS, MARSHAL_POSTS, BRAKE_BOARDS, placeAlongTrack } from "./layout";
import { BRANDS, brandTexture, numberBoardTexture } from "./textures";
import {
  BARRIER_OFFSET,
  BARRIER_HEIGHT,
  FENCE_MASK,
  KERB_MASK,
  SAMPLE_COUNT,
  SAMPLE_SPACING,
} from "../../circuitDefinition";

const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpS = new THREE.Vector3(1, 1, 1);
const tmpP = new THREE.Vector3();
const Y = new THREE.Vector3(0, 1, 0);

function useInstances(ref, items, localOffset = [0, 0, 0]) {
  useLayoutEffect(() => {
    const off = new THREE.Vector3(...localOffset);
    items.forEach((it, i) => {
      tmpQ.setFromAxisAngle(Y, it.rotY);
      tmpP.copy(off).applyQuaternion(tmpQ).add(new THREE.Vector3(it.x, it.y ?? 0, it.z));
      tmpM.compose(tmpP, tmpQ, tmpS);
      ref.current.setMatrixAt(i, tmpM);
    });
    ref.current.instanceMatrix.needsUpdate = true;
    ref.current.computeBoundingSphere();
  }, [ref, items, localOffset]);
}

const POLE_OFFSET = [0, 13, 0];
const HEAD_OFFSET = [0, 26.2, 0.3];
const LAMP_OFFSET = [0, 26.2, 0.58];

function Floodlights({ materials }) {
  const pole = useRef();
  const head = useRef();
  const lamps = useRef();
  useInstances(pole, FLOODLIGHTS, POLE_OFFSET);
  useInstances(head, FLOODLIGHTS, HEAD_OFFSET);
  useInstances(lamps, FLOODLIGHTS, LAMP_OFFSET);
  return (
    <group>
      <instancedMesh ref={pole} args={[undefined, materials.steel, FLOODLIGHTS.length]} castShadow>
        <cylinderGeometry args={[0.2, 0.42, 26, 10]} />
      </instancedMesh>
      <instancedMesh ref={head} args={[undefined, materials.darkSteel, FLOODLIGHTS.length]} castShadow>
        <boxGeometry args={[5, 3, 0.5]} />
      </instancedMesh>
      <instancedMesh ref={lamps} args={[undefined, undefined, FLOODLIGHTS.length]}>
        <boxGeometry args={[4.6, 2.6, 0.08]} />
        <meshStandardMaterial color="#dfe6ea" emissive="#fff7e6" emissiveIntensity={0.6} roughness={0.15} metalness={0.2} />
      </instancedMesh>
    </group>
  );
}

const BODY_OFFSET = [0, 1.2, 0];
const ROOF_OFFSET = [0, 2.5, 0.2];

function MarshalPosts({ materials }) {
  const body = useRef();
  const roof = useRef();
  useInstances(body, MARSHAL_POSTS, BODY_OFFSET);
  useInstances(roof, MARSHAL_POSTS, ROOF_OFFSET);
  return (
    <group>
      <instancedMesh ref={body} args={[undefined, materials.painted, MARSHAL_POSTS.length]} castShadow receiveShadow>
        <boxGeometry args={[2.2, 2.4, 2]} />
      </instancedMesh>
      <instancedMesh ref={roof} args={[undefined, undefined, MARSHAL_POSTS.length]} castShadow>
        <boxGeometry args={[2.8, 0.22, 2.8]} />
        <meshStandardMaterial color="#f07d00" roughness={0.5} />
      </instancedMesh>
    </group>
  );
}

function BrakeBoards({ materials }) {
  const textures = useMemo(() => ({ 150: numberBoardTexture(150), 100: numberBoardTexture(100), 50: numberBoardTexture(50) }), []);
  return (
    <group>
      {BRAKE_BOARDS.map((b, i) => (
        <group key={i} position={[b.x, b.y ?? 0, b.z]} rotation={[0, b.upstreamRotY + (b.rotY - b.upstreamRotY) * 0.15, 0]}>
          {[-0.55, 0.55].map((dx) => (
            <mesh key={dx} position={[dx, 0.9, -0.05]} material={materials.steel} castShadow>
              <boxGeometry args={[0.08, 1.8, 0.08]} />
            </mesh>
          ))}
          <mesh position={[0, 1.75, 0]} castShadow>
            <boxGeometry args={[1.6, 1.2, 0.06]} />
            <meshStandardMaterial color="#d8d8d4" roughness={0.6} />
          </mesh>
          <mesh position={[0, 1.75, 0.035]}>
            <planeGeometry args={[1.56, 1.16]} />
            <meshStandardMaterial map={textures[b.distance]} roughness={0.5} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// Advertising hoardings on top of the barrier wherever there is no debris fence.
function Hoardings({ materials }) {
  const groups = useMemo(() => {
    const byBrand = BRANDS.map(() => []);
    let n = 0;
    const step = Math.round(22 / SAMPLE_SPACING);
    for (const sideIdx of [0, 1]) {
      const side = sideIdx === 0 ? 1 : -1;
      for (let i = 0; i < SAMPLE_COUNT; i += step) {
        if (FENCE_MASK[sideIdx][i] || KERB_MASK[i]) continue;
        const p = placeAlongTrack(i / SAMPLE_COUNT, side * (BARRIER_OFFSET + 0.28));
        byBrand[n++ % BRANDS.length].push({ ...p, y: p.y + BARRIER_HEIGHT });
      }
    }
    return byBrand;
  }, []);
  const textures = useMemo(() => BRANDS.map((b) => brandTexture(b)), []);
  return (
    <group>
      {groups.map((items, i) => (
        <HoardingSet key={i} items={items} texture={textures[i]} materials={materials} />
      ))}
    </group>
  );
}

const PANEL_OFFSET = [0, 0.6, 0.03];
const FRAME_OFFSET = [0, 0.6, -0.04];

function HoardingSet({ items, texture, materials }) {
  const panel = useRef();
  const frame = useRef();
  useInstances(panel, items, PANEL_OFFSET);
  useInstances(frame, items, FRAME_OFFSET);
  return (
    <group>
      <instancedMesh ref={panel} args={[undefined, undefined, items.length]}>
        <planeGeometry args={[6, 1.1]} />
        <meshStandardMaterial map={texture} roughness={0.45} />
      </instancedMesh>
      <instancedMesh ref={frame} args={[undefined, materials.darkSteel, items.length]} castShadow>
        <boxGeometry args={[6.1, 1.2, 0.1]} />
      </instancedMesh>
    </group>
  );
}

export default function Trackside({ materials }) {
  return (
    <group>
      <Floodlights materials={materials} />
      <MarshalPosts materials={materials} />
      <BrakeBoards materials={materials} />
      <Hoardings materials={materials} />
    </group>
  );
}
