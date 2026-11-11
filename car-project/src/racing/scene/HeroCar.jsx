// Hero car: the prepared W17-based model (scripts/prepare-car.mjs) with an
// original livery, upgraded materials, and wheels detached from the body so the
// chassis can pitch and roll on its suspension while the wheels stay planted.
import { forwardRef, useImperativeHandle, useMemo } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";

const CAR_PATH = "/assets/car/hero.glb";
const WHEELS = ["FL", "FR", "RL", "RR"];
const GROUND_OFFSET = 0.035;

// Livery: drawn from the car's own 3D shape (car space: nose toward -Z, +X right,
// +Y up, ground at 0), so it's original artwork, sharp at any distance and easy to
// recolour. Colours match the UI: satin graphite, race red, white pinstripes.
const LIVERY = {
  base: "#1d1f23",
  accent: "#e10600",
  pin: "#f2f2f2",
};

function applyLivery(m) {
  m.map = null;
  m.color.set("#ffffff");
  Object.assign(m, { roughness: 0.34, metalness: 0.35, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.1 });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uBase = { value: new THREE.Color(LIVERY.base) };
    shader.uniforms.uAccent = { value: new THREE.Color(LIVERY.accent) };
    shader.uniforms.uPin = { value: new THREE.Color(LIVERY.pin) };
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nattribute vec3 aCarPos;\nattribute vec3 aCarNormal;\nvarying vec3 vCarPos;\nvarying vec3 vCarNormal;",
      )
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvCarPos = aCarPos;\nvCarNormal = aCarNormal;");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform vec3 uBase; uniform vec3 uAccent; uniform vec3 uPin;\nvarying vec3 vCarPos; varying vec3 vCarNormal;",
      )
      .replace(
        "#include <map_fragment>",
        /* glsl */ `
        vec3 cp = vCarPos;
        vec3 cn = normalize(vCarNormal);
        float ax = abs(cp.x);
        float aa = 0.004; // edge softness in metres
        // 1. Centre stripe on upward-facing surfaces, narrowing toward the nose.
        float top = smoothstep(0.2, 0.5, cn.y);
        float w = mix(0.06, 0.15, smoothstep(-2.5, 0.2, cp.z));
        float stripe = (1.0 - smoothstep(w - aa, w + aa, ax)) * top;
        float pinTop = (smoothstep(w + 0.012 - aa, w + 0.012 + aa, ax) - smoothstep(w + 0.026 - aa, w + 0.026 + aa, ax)) * top;
        // 2. A rising flash along each sidepod, from the front of the pod to the rear.
        float side = smoothstep(0.35, 0.65, abs(cn.x));
        float along = smoothstep(-1.15, -0.9, cp.z) * (1.0 - smoothstep(1.55, 1.8, cp.z));
        float line = cp.y - (0.34 + 0.085 * (cp.z + 1.0));
        float flash = (1.0 - smoothstep(0.05 - aa, 0.05 + aa, abs(line))) * side * along;
        float pinSide = (smoothstep(0.064 - aa, 0.064 + aa, abs(line)) - smoothstep(0.078 - aa, 0.078 + aa, abs(line))) * side * along;
        // 3. Red nose tip.
        float nose = 1.0 - smoothstep(-2.42, -2.36, cp.z);
        vec3 liv = uBase;
        liv = mix(liv, uPin, max(pinTop, pinSide));
        liv = mix(liv, uAccent, clamp(max(max(stripe, flash), nose), 0.0, 1.0));
        diffuseColor.rgb = liv;
        `,
      );
  };
  m.customProgramCacheKey = () => "livery";
}

/** Bake each paint vertex's position and normal in car space (stays locked to the body). */
function bakeCarSpace(mesh, toCar) {
  const g = mesh.geometry;
  if (g.userData.carSpace) return;
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  const m = new THREE.Matrix4().multiplyMatrices(toCar, mesh.matrixWorld);
  const nm = new THREE.Matrix3().getNormalMatrix(m);
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  const outP = new Float32Array(pos.count * 3);
  const outN = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i).applyMatrix4(m).toArray(outP, i * 3);
    if (nor) n.fromBufferAttribute(nor, i).applyMatrix3(nm).normalize().toArray(outN, i * 3);
  }
  g.setAttribute("aCarPos", new THREE.BufferAttribute(outP, 3));
  g.setAttribute("aCarNormal", new THREE.BufferAttribute(outN, 3));
  g.userData.carSpace = true;
}

function upgradeMaterial(mat) {
  const m = mat.clone();
  const name = m.name.toLowerCase();
  if (name.startsWith("paint")) {
    applyLivery(m);
  } else if (name.includes("carbon")) {
    Object.assign(m, { roughness: 0.36, metalness: 0.1, clearcoat: 0.85, clearcoatRoughness: 0.08 });
  } else if (name.startsWith("tread") || name.startsWith("sidewall")) {
    Object.assign(m, { roughness: 0.88, metalness: 0, clearcoat: 0, specularIntensity: 0.3 });
  } else if (name.startsWith("wheel_hub")) {
    // Dark satin rims, like real F1 wheels. A glossy metal rim mirrors the sky at one
    // angle, and that bright arc made the tyre look unseated as it rotated.
    Object.assign(m, { roughness: 0.6, metalness: 0.25, envMapIntensity: 0.6 });
  } else if (name.startsWith("chrome")) {
    Object.assign(m, { roughness: 0.12, metalness: 1 });
  } else if (name.startsWith("mirror")) {
    Object.assign(m, { roughness: 0.02, metalness: 1 });
  } else if (name.startsWith("rear_light")) {
    m.emissive = new THREE.Color("#ff1208");
    m.emissiveMap = m.map;
    m.emissiveIntensity = 0.4;
  } else if (name.startsWith("discs")) {
    m.emissive = new THREE.Color("#ff4a0a");
    m.emissiveIntensity = 0;
  }
  return m;
}

const HeroCar = forwardRef(function HeroCar(_, ref) {
  const gltf = useGLTF(CAR_PATH);

  const rig = useMemo(() => {
    const root = new THREE.Group();
    const body = gltf.scene.clone(true);
    root.add(body);
    const materials = {};
    body.traverse((o) => {
      if (!o.isMesh) return;
      o.material = materials[o.material.uuid] ??= upgradeMaterial(o.material);
      o.castShadow = true;
      o.receiveShadow = true;
    });
    body.updateMatrixWorld(true);
    const toCar = new THREE.Matrix4().copy(body.matrixWorld).invert();
    body.traverse((o) => {
      if (o.isMesh && o.material.name?.toLowerCase().startsWith("paint")) bakeCarSpace(o, toCar);
    });

    // Detach wheel pivots from the body so suspension motion only moves the chassis.
    const wheels = {};
    const spins = {};
    for (const w of WHEELS) {
      const pivot = body.getObjectByName(`wheel_${w}`);
      root.attach(pivot);
      wheels[w] = pivot; // steers (yaw)
      spins[w] = pivot.getObjectByName(`wheel_${w}_spin`) ?? pivot; // rolls (pitch)
    }
    const carNode = body.getObjectByName("hero_car") ?? body;
    const radius = carNode.userData?.wheelRadius ?? 0.354;
    const all = Object.values(materials);
    return {
      root,
      body,
      wheels,
      spins,
      radius,
      brakeLights: all.filter((m) => m.name.startsWith("rear_light")),
      discs: all.filter((m) => m.name.startsWith("discs")),
    };
  }, [gltf]);

  useImperativeHandle(
    ref,
    () => ({
      wheels: rig.wheels,
      wheelRadius: rig.radius,
      /** Wheel spin (rad) and front steer (rad). */
      setWheels(spin, steer) {
        for (const w of WHEELS) {
          rig.spins[w].rotation.x = spin;
          rig.wheels[w].rotation.y = w[0] === "F" ? steer : 0;
        }
      },
      /** Chassis pose relative to the wheels. */
      setBody(pitch, roll, heave) {
        rig.body.rotation.set(pitch, 0, roll);
        rig.body.position.y = heave;
      },
      setBrake(on) {
        for (const m of rig.brakeLights) m.emissiveIntensity = on ? 9 : 0.4;
      },
      setDiscHeat(heat) {
        for (const m of rig.discs) m.emissiveIntensity = Math.max(0, heat - 0.15) * 6;
      },
    }),
    [rig],
  );

  return (
    <group position={[0, GROUND_OFFSET, 0]}>
      <primitive object={rig.root} />
    </group>
  );
});

useGLTF.preload(CAR_PATH);

export default HeroCar;
