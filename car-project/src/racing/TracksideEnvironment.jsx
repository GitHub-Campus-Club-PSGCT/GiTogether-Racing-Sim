// =============================================================================
// F1 RUSH — TRACKSIDE ENVIRONMENT & SCENERY COMPONENT (STAGE 2)
// =============================================================================
// Integrates verified 3D assets from the racing kit into the Formula 1 circuit:
// - Start / Finish overhead start-light gantry
// - Pit Lane Complex: Garages, pit wall, paddock hospitality tents & office
// - Spectator Grandstands: Covered main straight grandstands & Turn 1 stadium arena
// - Sponsor Billboards & Sector Banner Towers
// - Perimeter Floodlight Pylons & Forest Tree Clusters (using InstancedMesh)
// =============================================================================

import { useMemo, useRef, useLayoutEffect } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { BARRIER_OFFSET, CIRCUIT_CURVE } from "./circuitDefinition";

const KIT_PATH = "/assets/racing-kit/Models/GLTF format/";

// ─────────────────────────────────────────────────────────────────────────────
// REUSABLE CLONED MODEL HELPER
// ─────────────────────────────────────────────────────────────────────────────
function KitModel({ file, position, rotation = [0, 0, 0], scale = [1, 1, 1] }) {
  const { scene } = useGLTF(`${KIT_PATH}${file}`);
  const cloned = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return c;
  }, [scene]);

  return (
    <primitive
      object={cloned}
      position={position}
      rotation={rotation}
      scale={scale}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// START / FINISH OVERHEAD GANTRY & LIGHTS
// ─────────────────────────────────────────────────────────────────────────────
function StartFinishGantry() {
  // The straight runs along +X; the gantry beam spans across Z beyond the barriers.
  return (
    <group position={[0, 0, 100]}>
      <mesh position={[0, 2.65, -12.8]} castShadow>
        <boxGeometry args={[0.45, 5.3, 0.45]} />
        <meshStandardMaterial color="#aebdca" metalness={0.28} roughness={0.48} />
      </mesh>
      <mesh position={[0, 2.65, 12.8]} castShadow>
        <boxGeometry args={[0.45, 5.3, 0.45]} />
        <meshStandardMaterial color="#aebdca" metalness={0.28} roughness={0.48} />
      </mesh>
      <mesh position={[0, 5.15, 0]} castShadow>
        <boxGeometry args={[0.65, 0.55, 27.5]} />
        <meshStandardMaterial color="#263b51" metalness={0.24} roughness={0.4} />
      </mesh>

      {Array.from({ length: 5 }, (_, i) => (
        <mesh key={`start-light-${i}`} position={[-0.42, 5.18, (i - 2) * 0.9]}>
          <sphereGeometry args={[0.22, 10, 8]} />
          <meshStandardMaterial
            color="#ff453a"
            emissive="#ff160e"
            emissiveIntensity={1.4}
            roughness={0.26}
          />
        </mesh>
      ))}

      {/* Checkered flags flanking the gantry outer safety perimeter */}
      <KitModel
        file="flagCheckers.glb"
        position={[0, 0, -19]}
        rotation={[0, Math.PI / 2, 0]}
        scale={[3.2, 4.0, 3.2]}
      />
      <KitModel
        file="flagCheckers.glb"
        position={[0, 0, 19]}
        rotation={[0, -Math.PI / 2, 0]}
        scale={[3.2, 4.0, 3.2]}
      />
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PIT LANE COMPLEX (MAIN STRAIGHT INFIELD: z = 83m to 86m)
// ─────────────────────────────────────────────────────────────────────────────
function PitLaneComplex() {
  // Main straight runs from x = -40 to x = 110 at z = 100
  // Infield is at z < 100 (normal is (0, 0, -1))
  // Pit lane is situated at z = 83m to 90m
  // Pit garages face the pit lane at z = 81m, facing +Z
  const garagePositions = [8, 20, 32, 44, 56, 68, 80];

  return (
    <group>
      {/* Pit Garages (Open bays with sponsor branding) */}
      {garagePositions.map((xPos, idx) => {
        const isClosed = idx === 0 || idx === garagePositions.length - 1;
        const file = isClosed ? "pitsGarageClosed.glb" : "pitsGarage.glb";
        return (
          <KitModel
            key={`pg-${xPos}`}
            file={file}
            position={[xPos, 0, 67.5]}
            rotation={[0, Math.PI, 0]}
            scale={[9.5, 7.5, 8.5]}
          />
        );
      })}

      {/* Pit Office / Race Control Headquarters */}
      <KitModel
        file="pitsOffice.glb"
        position={[-38, 0, 76]}
        rotation={[0, Math.PI, 0]}
        scale={[10.5, 9.0, 10.0]}
      />
      <KitModel
        file="pitsOffice.glb"
        position={[79, 0, 76]}
        rotation={[0, Math.PI, 0]}
        scale={[10.5, 9.0, 10.0]}
      />

      {/* Paddock Hospitality & VIP Tents behind Pit Garages */}
      <KitModel
        file="tentLong.glb"
        position={[-8, 0, 64]}
        rotation={[0, 0, 0]}
        scale={[8.0, 7.0, 6.5]}
      />
      <KitModel
        file="tentLong.glb"
        position={[18, 0, 64]}
        rotation={[0, 0, 0]}
        scale={[8.0, 7.0, 6.5]}
      />
      <KitModel
        file="tentLong.glb"
        position={[44, 0, 64]}
        rotation={[0, 0, 0]}
        scale={[8.0, 7.0, 6.5]}
      />

      {/* Pit Wall Concrete Divider along main track edge */}
      {Array.from({ length: 12 }, (_, i) => {
        const xPos = -28 + i * 9.5;
        return (
          <KitModel
            key={`pw-${i}`}
            file="barrierWall.glb"
            position={[xPos, 0, 87.5]}
            rotation={[0, 0, 0]}
            scale={[9.8, 8.0, 6.0]}
          />
        );
      })}

      {/* Sector Banner Towers at Pit Entry and Pit Exit */}
      <KitModel
        file="bannerTowerRed.glb"
        position={[-42, 0, 89]}
        scale={[7.0, 9.0, 7.0]}
      />
      <KitModel
        file="bannerTowerGreen.glb"
        position={[85, 0, 89]}
        scale={[7.0, 9.0, 7.0]}
      />
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SPECTATOR GRANDSTANDS (MAIN STRAIGHT & TURN 1)
// ─────────────────────────────────────────────────────────────────────────────
function SpectatorGrandstands() {
  // Keep the main straight clear while leaving the stands visible beyond the runoff.
  const mainGrandstands = [-50, -10, 30, 70, 110];

  return (
    <group>
      {/* Covered Grandstands along Main Pit Straight */}
      {mainGrandstands.map((xPos) => (
        <KitModel
          key={`mgs-${xPos}`}
          file="grandStandCovered.glb"
          position={[xPos, 0, 137]}
          rotation={[0, 0, 0]}
          scale={[12.0, 6.5, 8.5]}
        />
      ))}

      {/* Turn 1 Stadium Arena Grandstands (Curved entry around x = 175, z = 85) */}
      <KitModel
        file="grandStandCoveredRound.glb"
        position={[182, 0, 94]}
        rotation={[0, -Math.PI / 4, 0]}
        scale={[13.0, 7.0, 13.0]}
      />
      <KitModel
        file="grandStandCovered.glb"
        position={[208, 0, 52]}
        rotation={[0, -Math.PI / 2, 0]}
        scale={[13.0, 6.5, 9.5]}
      />
      <KitModel
        file="grandStand.glb"
        position={[204, 0, 10]}
        rotation={[0, -Math.PI / 2, 0]}
        scale={[12.0, 6.0, 9.0]}
      />

      {/* Back Straight DRS Zone Spectator Seating */}
      <KitModel
        file="grandStand.glb"
        position={[-50, 0, -132]}
        rotation={[0, Math.PI, 0]}
        scale={[12.0, 6.0, 9.0]}
      />
      <KitModel
        file="grandStandCovered.glb"
        position={[-95, 0, -132]}
        rotation={[0, Math.PI, 0]}
        scale={[12.0, 6.5, 8.5]}
      />
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TRACKSIDE BILLBOARDS & SIGNAGE
// ─────────────────────────────────────────────────────────────────────────────
function TracksideSignage() {
  return (
    <group>
      {/* Turn 1 Braking Marker Billboards */}
      <KitModel
        file="billboard.glb"
        position={[115, 0, 117]}
        rotation={[0, 0, 0]}
        scale={[10.0, 7.5, 6.0]}
      />
      <KitModel
        file="billboard.glb"
        position={[145, 0, 112]}
        rotation={[0, -0.2, 0]}
        scale={[10.0, 7.5, 6.0]}
      />

      {/* Back Straight High-Speed Sponsor Billboards */}
      <KitModel
        file="billboard.glb"
        position={[-20, 0, -104]}
        rotation={[0, Math.PI, 0]}
        scale={[11.0, 7.5, 6.0]}
      />
      <KitModel
        file="billboard.glb"
        position={[-125, 0, -100]}
        rotation={[0, Math.PI * 0.95, 0]}
        scale={[11.0, 7.5, 6.0]}
      />

      {/* Turn 6 Hairpin Approach Billboard */}
      <KitModel
        file="billboard.glb"
        position={[-165, 0, -96]}
        rotation={[0, Math.PI * 0.9, 0]}
        scale={[11.0, 7.5, 6.0]}
      />

      {/* Infield Chicane Banner Towers */}
      <KitModel
        file="bannerTowerGreen.glb"
        position={[-100, 0, 52]}
        scale={[6.5, 8.5, 6.5]}
      />
      <KitModel
        file="bannerTowerRed.glb"
        position={[-60, 0, 68]}
        scale={[6.5, 8.5, 6.5]}
      />
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INSTANCED FLOODLIGHT PYLONS & TREE CLUSTERS (HIGH PERFORMANCE)
// ─────────────────────────────────────────────────────────────────────────────
function InstancedPerimeterLighting() {
  const { scene } = useGLTF(`${KIT_PATH}lightPostLarge.glb`);

  // Extract primary mesh geometry and material for InstancedMesh
  const { geom, mat } = useMemo(() => {
    let meshFound = null;
    scene.traverse((child) => {
      if (child.isMesh && !meshFound) {
        meshFound = child;
      }
    });
    return {
      geom: meshFound ? meshFound.geometry : new THREE.BoxGeometry(1, 8, 1),
      mat: meshFound
        ? meshFound.material
        : new THREE.MeshStandardMaterial({ color: "#888888" }),
    };
  }, [scene]);

  // Compute 28 floodlight towers spaced along outer perimeter at 16m lateral offset
  const poleData = useMemo(() => {
    const data = [];
    const count = 28;
    for (let i = 0; i < count; i++) {
      const u = i / count;
      const pt = CIRCUIT_CURVE.getPointAt(u);
      const tan = CIRCUIT_CURVE.getTangentAt(u).normalize();
      const norm = new THREE.Vector3(tan.z, 0, -tan.x).normalize();

      // Outer side of the circuit (16.5m offset from centerline)
      const pos = new THREE.Vector3().copy(pt).addScaledVector(norm, -16.5);
      const angle = Math.atan2(norm.x, norm.z);

      data.push({
        position: [pos.x, 0, pos.z],
        rotation: [0, angle, 0],
        scale: [9.0, 10.0, 9.0],
      });
    }
    return data;
  }, []);

  const instRef = useRef();

  useLayoutEffect(() => {
    if (!instRef.current) return;
    const dummy = new THREE.Object3D();

    poleData.forEach((d, i) => {
      dummy.position.set(d.position[0], d.position[1], d.position[2]);
      dummy.rotation.set(d.rotation[0], d.rotation[1], d.rotation[2]);
      dummy.scale.set(d.scale[0], d.scale[1], d.scale[2]);
      dummy.updateMatrix();
      instRef.current.setMatrixAt(i, dummy.matrix);
    });

    instRef.current.instanceMatrix.needsUpdate = true;
  }, [poleData]);

  return (
    <instancedMesh
      ref={instRef}
      args={[geom, mat, poleData.length]}
      castShadow
      receiveShadow
    />
  );
}

function InstancedForestScenery() {
  const { scene } = useGLTF(`${KIT_PATH}treeLarge.glb`);

  const { geom, mat } = useMemo(() => {
    let meshFound = null;
    scene.traverse((child) => {
      if (child.isMesh && !meshFound) {
        meshFound = child;
      }
    });
    return {
      geom: meshFound ? meshFound.geometry : new THREE.CylinderGeometry(1, 2, 8, 8),
      mat: meshFound
        ? meshFound.material
        : new THREE.MeshStandardMaterial({ color: "#194a20" }),
    };
  }, [scene]);

  // Generate 90 tree positions in natural clusters outside runoff zones
  const treeData = useMemo(() => {
    const trees = [];
    const count = 90;
    for (let i = 0; i < count; i++) {
      const u = (i / count);
      const pt = CIRCUIT_CURVE.getPointAt(u);
      const tan = CIRCUIT_CURVE.getTangentAt(u).normalize();
      const norm = new THREE.Vector3(tan.z, 0, -tan.x).normalize();

      // Pseudo-random offset based on index
      const seed = Math.sin(i * 997.3) * 10000;
      const frac = seed - Math.floor(seed);
      const side = (i % 2 === 0 ? 1 : -1);
      const dist = 24.0 + frac * 48.0; // Between 24m and 72m from track center

      const pos = new THREE.Vector3().copy(pt).addScaledVector(norm, side * dist);
      const scaleBase = 7.0 + frac * 4.5;

      trees.push({
        position: [pos.x, 0, pos.z],
        rotation: [0, frac * Math.PI * 2, 0],
        scale: [scaleBase, scaleBase * (0.9 + frac * 0.3), scaleBase],
      });
    }
    return trees;
  }, []);

  const instRef = useRef();

  useLayoutEffect(() => {
    if (!instRef.current) return;
    const dummy = new THREE.Object3D();

    treeData.forEach((d, i) => {
      dummy.position.set(d.position[0], d.position[1], d.position[2]);
      dummy.rotation.set(d.rotation[0], d.rotation[1], d.rotation[2]);
      dummy.scale.set(d.scale[0], d.scale[1], d.scale[2]);
      dummy.updateMatrix();
      instRef.current.setMatrixAt(i, dummy.matrix);
    });

    instRef.current.instanceMatrix.needsUpdate = true;
  }, [treeData]);

  return (
    <instancedMesh
      ref={instRef}
      args={[geom, mat, treeData.length]}
      castShadow
      receiveShadow
    />
  );
}

function SponsorBoards() {
  const brands = useMemo(() => [
    { name: "APEX", subline: "RACING SYSTEMS", color: "#07599d" },
    { name: "VELOCITY", subline: "PERFORMANCE", color: "#d43d27" },
    { name: "NOVA", subline: "ENERGY LABS", color: "#532b9c" },
    { name: "PULSE", subline: "MOTORSPORT", color: "#00816d" },
  ], []);

  const textures = useMemo(() => brands.map(({ name, subline, color }) => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 160;
    const context = canvas.getContext("2d");
    const gradient = context.createLinearGradient(0, 0, 512, 160);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, "#10223b");
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#ffffff";
    context.font = "900 italic 68px Arial";
    context.fillText(name, 26, 88);
    context.font = "700 20px Arial";
    context.fillStyle = "#c9e8ff";
    context.fillText(subline, 30, 128);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }), [brands]);

  const boardPositions = useMemo(() => brands.map((_, i) => {
    const u = (0.035 + i * 0.12) % 1;
    const point = CIRCUIT_CURVE.getPointAt(u);
    const tangent = CIRCUIT_CURVE.getTangentAt(u).normalize();
    const normal = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
    const side = i % 2 === 0 ? 1 : -1;
    const inward = normal.clone().multiplyScalar(-side);
    point.addScaledVector(normal, side * (BARRIER_OFFSET + 5.5));

    return {
      position: [point.x, 0, point.z],
      rotation: Math.atan2(inward.x, inward.z),
    };
  }), [brands]);

  return (
    <group>
      {boardPositions.map((board, i) => (
        <group
          key={brands[i].name}
          position={board.position}
          rotation={[0, board.rotation, 0]}
        >
          <mesh position={[-3.15, 1.15, 0]} castShadow>
            <boxGeometry args={[0.16, 2.3, 0.22]} />
            <meshStandardMaterial color="#c6d0d5" roughness={0.78} />
          </mesh>
          <mesh position={[3.15, 1.15, 0]} castShadow>
            <boxGeometry args={[0.16, 2.3, 0.22]} />
            <meshStandardMaterial color="#c6d0d5" roughness={0.78} />
          </mesh>
          <mesh position={[0, 2.3, 0]} castShadow>
            <boxGeometry args={[6.5, 2.1, 0.25]} />
            <meshStandardMaterial color="#eff5f5" roughness={0.68} />
          </mesh>
          <mesh position={[0, 2.3, 0.14]}>
            <planeGeometry args={[6.22, 1.82]} />
            <meshBasicMaterial map={textures[i % textures.length]} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPOSITE TRACKSIDE ENVIRONMENT COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function TracksideEnvironment() {
  return (
    <group>
      <StartFinishGantry />
      <PitLaneComplex />
      <SpectatorGrandstands />
      <TracksideSignage />
      <SponsorBoards />
      <InstancedPerimeterLighting />
      <InstancedForestScenery />
    </group>
  );
}

// Preload critical models so they render immediately without pop-in
useGLTF.preload(`${KIT_PATH}pitsGarage.glb`);
useGLTF.preload(`${KIT_PATH}pitsGarageClosed.glb`);
useGLTF.preload(`${KIT_PATH}pitsOffice.glb`);
useGLTF.preload(`${KIT_PATH}grandStandCovered.glb`);
useGLTF.preload(`${KIT_PATH}grandStandCoveredRound.glb`);
useGLTF.preload(`${KIT_PATH}grandStand.glb`);
useGLTF.preload(`${KIT_PATH}billboard.glb`);
useGLTF.preload(`${KIT_PATH}bannerTowerRed.glb`);
useGLTF.preload(`${KIT_PATH}bannerTowerGreen.glb`);
useGLTF.preload(`${KIT_PATH}lightPostLarge.glb`);
useGLTF.preload(`${KIT_PATH}treeLarge.glb`);
useGLTF.preload(`${KIT_PATH}tentLong.glb`);
useGLTF.preload(`${KIT_PATH}flagCheckers.glb`);
useGLTF.preload(`${KIT_PATH}barrierWall.glb`);
