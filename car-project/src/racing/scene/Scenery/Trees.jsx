// Impostor trees: camera-facing cards that pick one of 8 pre-rendered views
// (scripts/bake-impostors.mjs) and relight it with the baked normals.
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useTexture } from "@react-three/drei";
import { useLoader } from "@react-three/fiber";
import { useWorld } from "../world/worldResource";
import { TREE_STRIDE } from "../world/worldBuild";
import { SUN_DIR } from "../sun";

const TYPES = [
  { id: "island_tree_01", frameWorld: 5.0274 },
  { id: "tree_small_02", frameWorld: 4.5567 },
];

// Queue the impostor atlases at startup (they'd otherwise start only after the world is built).
useTexture.preload(TYPES.flatMap((t) => [`/assets/trees/${t.id}_albedo.webp`, `/assets/trees/${t.id}_normal.webp`]));

const vertexShader = /* glsl */ `
  attribute float aYaw;
  uniform float frameWorld;
  varying vec2 vUv;
  varying float vFrameAz;
  varying float vH;
  #include <fog_pars_vertex>
  void main() {
    vec3 base = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    float s = length(instanceMatrix[0].xyz);
    vec3 toCam = cameraPosition - base;
    toCam.y = 0.0;
    toCam = normalize(toCam + vec3(1e-4, 0.0, 0.0));
    vec3 right = vec3(toCam.z, 0.0, -toCam.x);
    float step = 6.28318530718 / 8.0;
    float az = atan(toCam.x, toCam.z) - aYaw;
    float k = mod(floor(az / step + 0.5), 8.0);
    vFrameAz = k * step + aYaw;
    float size = frameWorld * s;
    vec3 world = base + right * (position.x * size) + vec3(0.0, position.y * size, 0.0);
    vUv = vec2((k + position.x + 0.5) / 8.0, position.y);
    vH = position.y;
    vec4 mvPosition = viewMatrix * vec4(world, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`;

const fragmentShader = /* glsl */ `
  uniform sampler2D albedoMap;
  uniform sampler2D normalMap;
  uniform vec3 sunDir;
  varying vec2 vUv;
  varying float vFrameAz;
  varying float vH;
  #include <fog_pars_fragment>
  void main() {
    vec4 a = texture2D(albedoMap, vUv);
    if (a.a < 0.45) discard;
    vec3 n = texture2D(normalMap, vUv).xyz * 2.0 - 1.0;
    float c = cos(vFrameAz), s = sin(vFrameAz);
    vec3 N = normalize(n.x * vec3(c, 0.0, -s) + n.y * vec3(0.0, 1.0, 0.0) + n.z * vec3(s, 0.0, c));
    float wrap = clamp((dot(N, sunDir) + 0.35) / 1.35, 0.0, 1.0);
    vec3 sun = vec3(1.0, 0.95, 0.87) * 1.7 * wrap;
    vec3 amb = mix(vec3(0.10, 0.11, 0.07), vec3(0.34, 0.42, 0.55), N.y * 0.5 + 0.5) * 1.35;
    float ao = mix(0.6, 1.0, smoothstep(0.05, 0.75, vH));
    gl_FragColor = vec4(a.rgb * (sun + amb) * ao, 1.0);
    #include <fog_fragment>
  }`;

function TreeSet({ type, items }) {
  const ref = useRef();
  const [albedo, normal] = useLoader(THREE.TextureLoader, [
    `/assets/trees/${type.id}_albedo.webp`,
    `/assets/trees/${type.id}_normal.webp`,
  ]);
  const material = useMemo(() => {
    const al = albedo.clone();
    al.colorSpace = THREE.SRGBColorSpace;
    al.needsUpdate = true;
    const nm = normal.clone();
    nm.colorSpace = THREE.NoColorSpace;
    nm.needsUpdate = true;
    return new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        {
          albedoMap: { value: al },
          normalMap: { value: nm },
          sunDir: { value: SUN_DIR.clone() },
          frameWorld: { value: type.frameWorld },
        },
      ]),
      vertexShader,
      fragmentShader,
      fog: true,
      side: THREE.DoubleSide,
    });
  }, [albedo, normal, type]);
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
    g.setAttribute("aYaw", new THREE.InstancedBufferAttribute(Float32Array.from(items, (t) => t.yaw), 1));
    return g;
  }, [items]);

  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    items.forEach((t, i) => {
      m.makeScale(t.scale, t.scale, t.scale).setPosition(t.x, t.y, t.z);
      ref.current.setMatrixAt(i, m);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  }, [items]);

  return <instancedMesh ref={ref} args={[geometry, material, items.length]} frustumCulled={false} />;
}

export default function Trees() {
  const world = useWorld();
  const byType = useMemo(() => {
    const lists = TYPES.map(() => []);
    const d = world.trees;
    for (let k = 0; k < d.length; k += TREE_STRIDE) {
      lists[d[k + 5]].push({ x: d[k], y: d[k + 1], z: d[k + 2], scale: d[k + 3], yaw: d[k + 4] });
    }
    return lists;
  }, [world]);
  return (
    <group>
      {TYPES.map((type, i) => (
        <TreeSet key={type.id} type={type} items={byType[i]} />
      ))}
    </group>
  );
}
