// =============================================================================
// F1 RUSH ? RACING-KIT CAR MODEL COMPONENT
// =============================================================================
// Uses the included GLB car model from public/assets/racing-kit/Models/GLTF format.
// This is a low-poly racing car designed to look cinematic while staying fast and
// lightweight for a browser game. We keep the original mesh and only improve the
// presentation through larger scale, stronger material properties, and a fictional
// team livery.
// =============================================================================

import { useMemo, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";

const CAR_GLB_PATH = "/assets/racing-kit/Models/GLTF format/raceCarRed.glb";

function applyFictionalLivery(root) {
  root.traverse((child) => {
    if (!child.isMesh) return;

    const mats = Array.isArray(child.material) ? child.material : [child.material];
    mats.forEach((mat) => {
      if (!mat || !mat.name) return;

      const name = mat.name.toLowerCase();

      if (name.includes("red") || name.includes("body")) {
        mat.color.set("#1687df");
        mat.metalness = 0.08;
        mat.roughness = 0.42;
        mat.emissive.set("#07345c");
        mat.emissiveIntensity = 0.32;
      } else if (name.includes("glass")) {
        mat.color.set("#b9e8ff");
        mat.transparent = false;
        mat.opacity = 1;
        mat.metalness = 0.04;
        mat.roughness = 0.24;
      } else if (name.includes("tire")) {
        mat.color.set("#303943");
        mat.metalness = 0;
        mat.roughness = 0.92;
      } else if (name.includes("grey")) {
        mat.color.set("#aebdcb");
        mat.metalness = 0.28;
        mat.roughness = 0.48;
      } else if (name.includes("car") && !name.includes("tire")) {
        mat.color.set("#1687df");
        mat.metalness = 0.08;
        mat.roughness = 0.42;
      }
    });
  });
}

const AuthenticF1Car = forwardRef(function AuthenticF1Car({ brakeLightRef }, ref) {
  const { scene } = useGLTF(CAR_GLB_PATH);
  const wheelMeshesRef = useRef([]);

  const carObject = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((child) => {
      if (child.isMesh) {
        child.material = Array.isArray(child.material)
          ? child.material.map((material) => material.clone())
          : child.material.clone();
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    applyFictionalLivery(clone);
    clone.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(clone);
    const center = bounds.getCenter(new THREE.Vector3());
    clone.position.set(-center.x, -bounds.min.y, -center.z);
    return clone;
  }, [scene]);

  useImperativeHandle(ref, () => ({
    get wheelMeshes() {
      return wheelMeshesRef.current;
    },
  }));

  const brakeMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: "#54100d",
    emissive: "#c51a12",
    emissiveIntensity: 0.35,
    roughness: 0.35,
    metalness: 0.05,
  }), []);

  useEffect(() => {
    const wheels = [];

    carObject.traverse((child) => {
      const lowerName = child.name?.toLowerCase() ?? "";
      if (lowerName.includes("wheel") && !child.isMesh &&
          child.children.some((part) => part.isMesh)) {
        wheels.push(child);
      }
    });

    if (wheels.length === 0) {
      carObject.traverse((child) => {
        if (child.isMesh && child.name?.toLowerCase().includes("wheel")) {
          wheels.push(child);
        }
      });
    }

    wheelMeshesRef.current = wheels;
  }, [carObject]);

  useEffect(() => {
    if (!brakeLightRef) return undefined;
    brakeLightRef.current = brakeMaterial;
    return () => {
      if (brakeLightRef.current === brakeMaterial) {
        brakeLightRef.current = null;
      }
    };
  }, [brakeLightRef, brakeMaterial]);

  const bounds = useMemo(() => {
    carObject.updateMatrixWorld(true);
    return new THREE.Box3().setFromObject(carObject);
  }, [carObject]);
  const rearZ = bounds.min.z + 0.04;

  return (
    <group position={[0, 0.025, 0]} rotation={[0, Math.PI, 0]} scale={[2.2, 2.2, 2.2]}>
      <primitive object={carObject} />
      <mesh position={[-0.12, 0.16, rearZ]} material={brakeMaterial} castShadow={false}>
        <boxGeometry args={[0.11, 0.045, 0.025]} />
      </mesh>
      <mesh position={[0.12, 0.16, rearZ]} material={brakeMaterial} castShadow={false}>
        <boxGeometry args={[0.11, 0.045, 0.025]} />
      </mesh>
    </group>
  );
});

useGLTF.preload(CAR_GLB_PATH);

export default AuthenticF1Car;
