// PBR surface materials: the standard three.js material with small shader patches
// for anti-tiling, macro variation and per-surface detail.
import { useMemo } from "react";
import * as THREE from "three";
import { useTexture } from "@react-three/drei";
import { useLoader } from "@react-three/fiber";
import { BARRIER_HEIGHT } from "../circuitDefinition";

const SETS = ["asphalt", "grass", "gravel", "concrete", "paddock"];
const MAPS = ["color", "normal", "arm"];
const PATHS = SETS.flatMap((set) => MAPS.map((m) => `/assets/textures/${set}/${m}.webp`));

function configureTextures(list, anisotropy) {
  const out = {};
  list.forEach((tex, i) => {
    const set = SETS[Math.floor(i / MAPS.length)];
    const map = MAPS[i % MAPS.length];
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = anisotropy;
    tex.colorSpace = map === "color" ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    tex.needsUpdate = true;
    (out[set] ??= {})[map] = tex;
  });
  return out;
}

useTexture.preload(PATHS);

export function useSurfaceTextures(anisotropy = 8) {
  // useLoader rather than drei's useTexture: drei uploads every texture to the GPU at
  // once, which froze the page; scene/Warmup.jsx uploads them one per frame instead.
  const list = useLoader(THREE.TextureLoader, PATHS);
  return useMemo(() => configureTextures(list, anisotropy), [list, anisotropy]);
}

// ---------------------------------------------------------------------------
// Shader helpers
// ---------------------------------------------------------------------------
const GLSL_COMMON = /* glsl */ `
varying vec3 vWPos;
float h12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h12(i), h12(i + vec2(1.0, 0.0)), u.x), mix(h12(i + vec2(0.0, 1.0)), h12(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
const mat2 AT_ROT = mat2(0.8, -0.6, 0.6, 0.8);
vec2 atUv(vec2 uv) { return AT_ROT * uv * 0.53 + vec2(0.37, 0.11); }
vec4 sampleAT(sampler2D t, vec2 uv, float m) { return mix(texture2D(t, uv), texture2D(t, atUv(uv)), m); }
vec3 sampleATn(sampler2D t, vec2 uv, float m) {
  vec3 a = texture2D(t, uv).xyz * 2.0 - 1.0;
  vec3 b = texture2D(t, atUv(uv)).xyz * 2.0 - 1.0;
  b.xy = transpose(AT_ROT) * b.xy;
  return normalize(mix(a, b, m));
}
float antiTileMix(float scale) { return smoothstep(0.35, 0.65, fbm(vWPos.xz * scale)); }
vec3 gradeGrass(vec3 c, float mow) {
  float lum = dot(c, vec3(0.299, 0.587, 0.114));
  float patchy = fbm(vWPos.xz * 0.008);
  vec3 lush = mix(vec3(0.045, 0.11, 0.024), vec3(0.09, 0.13, 0.035), patchy);
  vec3 g = lush * (0.55 + lum * 2.4);
  float stripe = step(0.5, fract(dot(vWPos.xz, vec2(0.7071)) / 9.0));
  g *= 1.0 + mow * (stripe * 0.14 - 0.05);
  return mix(c, g, 0.85);
}
`;

const NORMAL_FROM = (expr) => /* glsl */ `
#ifdef USE_NORMALMAP_TANGENTSPACE
  vec3 mapN = ${expr};
  mapN.xy *= normalScale;
  normal = normalize(tbn * mapN);
#endif
`;

function patch(material, { key, uniforms = {}, vertDecl = "", vertBody = "", fragDecl = "", replace = {} }) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\nvarying vec3 vWPos;\n${vertDecl}`)
      .replace(
        "#include <project_vertex>",
        `#include <project_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\n${vertBody}`,
      );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <common>",
      `#include <common>\n${GLSL_COMMON}\n${fragDecl}`,
    );
    for (const [chunk, code] of Object.entries(replace)) {
      shader.fragmentShader = shader.fragmentShader.replace(`#include <${chunk}>`, code);
    }
  };
  material.customProgramCacheKey = () => key;
  return material;
}

// ---------------------------------------------------------------------------
// Materials
// ---------------------------------------------------------------------------
export function createAsphaltMaterial(t) {
  const m = new THREE.MeshStandardMaterial({
    color: "#b4b4b4",
    map: t.asphalt.color,
    normalMap: t.asphalt.normal,
    normalScale: new THREE.Vector2(0.9, 0.9),
    roughnessMap: t.asphalt.arm,
    aoMap: t.asphalt.arm,
    roughness: 1,
    metalness: 0,
  });
  return patch(m, {
    key: "asphalt",
    vertDecl: "attribute float aLine; varying float vLine;",
    vertBody: "vLine = aLine;",
    fragDecl: "varying float vLine;",
    replace: {
      map_fragment: /* glsl */ `
        float atMix = antiTileMix(0.045);
        vec4 texC = sampleAT(map, vMapUv, atMix);
        texC.rgb *= 0.84 + 0.3 * fbm(vWPos.xz * 0.012);
        float rubber = exp(-vLine * vLine / 3.0);
        float rubberGrain = rubber * (0.65 + 0.35 * smoothstep(0.3, 0.7, vnoise(vWPos.xz * 0.7)));
        texC.rgb *= mix(1.0, 0.42, rubberGrain);
        diffuseColor *= texC;
      `,
      roughnessmap_fragment: /* glsl */ `
        float roughnessFactor = roughness * sampleAT(roughnessMap, vRoughnessMapUv, atMix).g;
        roughnessFactor = mix(roughnessFactor, roughnessFactor * 0.78, rubber);
      `,
      normal_fragment_maps: NORMAL_FROM("sampleATn(normalMap, vNormalMapUv, atMix)"),
    },
  });
}

export function createKerbMaterial(t) {
  const m = new THREE.MeshStandardMaterial({
    map: t.concrete.color,
    normalMap: t.concrete.normal,
    roughnessMap: t.concrete.arm,
    roughness: 0.55,
    metalness: 0,
  });
  // uv.x = 0..1 across the kerb, uv.y = metres along the track.
  return patch(m, {
    key: "kerb",
    replace: {
      map_fragment: /* glsl */ `
        float stripe = step(0.5, fract(vMapUv.y / 3.2));
        vec3 paint = mix(vec3(0.72, 0.03, 0.025), vec3(0.9, 0.9, 0.88), stripe);
        vec3 grime = texture2D(map, vWPos.xz / 2.5).rgb;
        float dirt = fbm(vWPos.xz * 0.35);
        paint *= mix(vec3(1.0), grime * 1.25, 0.3) * (0.88 + 0.16 * dirt);
        paint *= mix(1.0, 0.62, (1.0 - smoothstep(0.0, 0.3, vMapUv.x)) * smoothstep(0.35, 0.8, dirt));
        diffuseColor.rgb *= paint;
      `,
      roughnessmap_fragment: /* glsl */ `
        float roughnessFactor = roughness * (0.8 + 0.4 * texture2D(roughnessMap, vWPos.xz / 2.5).g);
      `,
      normal_fragment_maps: NORMAL_FROM(/* glsl */ `normalize(
        vec3((texture2D(normalMap, vWPos.xz / 2.5).xy * 2.0 - 1.0) * 0.5, 1.0) +
        vec3(0.0, -(fract(vNormalMapUv.y / 0.45) < 0.8 ? 0.22 : -0.9) *
          smoothstep(0.12, 0.2, vNormalMapUv.x) * (1.0 - smoothstep(0.8, 0.9, vNormalMapUv.x)), 0.0))`),
    },
  });
}

export function createRunoffMaterial(t) {
  const m = new THREE.MeshStandardMaterial({
    map: t.grass.color,
    normalMap: t.grass.normal,
    roughnessMap: t.grass.arm,
    roughness: 1,
    metalness: 0,
  });
  return patch(m, {
    key: "runoff",
    uniforms: {
      tAsC: { value: t.asphalt.color },
      tAsN: { value: t.asphalt.normal },
      tAsR: { value: t.asphalt.arm },
      tGrC: { value: t.gravel.color },
      tGrN: { value: t.gravel.normal },
      tGrR: { value: t.gravel.arm },
    },
    vertDecl: "attribute vec3 aSurf; varying vec3 vSurf;",
    vertBody: "vSurf = aSurf;",
    fragDecl: /* glsl */ `
      varying vec3 vSurf;
      uniform sampler2D tAsC; uniform sampler2D tAsN; uniform sampler2D tAsR;
      uniform sampler2D tGrC; uniform sampler2D tGrN; uniform sampler2D tGrR;
    `,
    replace: {
      map_fragment: /* glsl */ `
        float atMix = antiTileMix(0.05);
        vec3 w = vSurf;
        // Ragged transitions between surfaces.
        float edgeNoise = fbm(vWPos.xz * 0.6) - 0.5;
        w.z = clamp(w.z + edgeNoise * 0.6 * w.z * (1.0 - w.z) * 4.0, 0.0, 1.0);
        w /= max(w.x + w.y + w.z, 1e-3);
        vec2 uvA = vMapUv * 0.9;
        vec2 uvG = vMapUv * 2.4;
        vec3 cG = gradeGrass(sampleAT(map, vMapUv * 1.6, atMix).rgb, 0.0);
        vec3 cA = sampleAT(tAsC, uvA, atMix).rgb * 0.62 * (0.9 + 0.2 * fbm(vWPos.xz * 0.02));
        vec3 cV = sampleAT(tGrC, uvG, atMix).rgb * vec3(1.02, 0.97, 0.88);
        diffuseColor.rgb *= cG * w.x + cA * w.y + cV * w.z;
      `,
      roughnessmap_fragment: /* glsl */ `
        float roughnessFactor = roughness * (
          sampleAT(roughnessMap, vMapUv * 1.6, atMix).g * w.x +
          sampleAT(tAsR, uvA, atMix).g * w.y +
          sampleAT(tGrR, uvG, atMix).g * w.z);
      `,
      normal_fragment_maps: NORMAL_FROM(/* glsl */ `normalize(
        sampleATn(normalMap, vMapUv * 1.6, atMix) * w.x +
        sampleATn(tAsN, uvA, atMix) * w.y +
        sampleATn(tGrN, uvG, atMix) * w.z)`),
    },
  });
}

/**
 * Terrain material. `mask` is a top-down texture of the track corridor; ground
 * inside it is discarded so it can never poke through the road (the terrain grid
 * is too coarse to follow the road exactly through dips and crests).
 */
export function createTerrainMaterial(t, mask) {
  const m = new THREE.MeshStandardMaterial({
    map: t.grass.color,
    normalMap: t.grass.normal,
    normalScale: new THREE.Vector2(0.7, 0.7),
    roughnessMap: t.grass.arm,
    roughness: 1,
    metalness: 0,
  });
  return patch(m, {
    key: "terrain",
    uniforms: {
      tTrackMask: { value: mask.texture },
      uMaskOrigin: { value: new THREE.Vector2(mask.x0, mask.z0) },
      uMaskSize: { value: mask.size },
    },
    vertDecl: "attribute float aMow; varying float vMow;",
    vertBody: "vMow = aMow;",
    fragDecl: "varying float vMow; uniform sampler2D tTrackMask; uniform vec2 uMaskOrigin; uniform float uMaskSize;",
    replace: {
      map_fragment: /* glsl */ `
        if (texture2D(tTrackMask, (vWPos.xz - uMaskOrigin) / uMaskSize).r > 0.5) discard;
        float atMix = antiTileMix(0.03);
        vec3 c = gradeGrass(sampleAT(map, vMapUv, atMix).rgb, vMow);
        // Fade texture detail into broad colour far away to avoid shimmer.
        float far = smoothstep(80.0, 400.0, length(vWPos.xz - cameraPosition.xz));
        c = mix(c, gradeGrass(vec3(0.33, 0.33, 0.24), vMow) * (0.9 + 0.2 * fbm(vWPos.xz * 0.01)), far * 0.6);
        diffuseColor.rgb *= c;
      `,
      roughnessmap_fragment: /* glsl */ `
        float roughnessFactor = roughness * mix(0.85, sampleAT(roughnessMap, vRoughnessMapUv, atMix).g, 0.7);
      `,
      normal_fragment_maps: NORMAL_FROM("sampleATn(normalMap, vNormalMapUv, atMix)"),
    },
  });
}

export function createBarrierMaterial(t) {
  const m = new THREE.MeshStandardMaterial({
    map: t.concrete.color,
    normalMap: t.concrete.normal,
    roughnessMap: t.concrete.arm,
    aoMap: t.concrete.arm,
    roughness: 1,
    metalness: 0,
  });
  return patch(m, {
    key: "barrier",
    replace: {
      map_fragment: /* glsl */ `
        float atMix = antiTileMix(0.08);
        vec4 c = sampleAT(map, vMapUv, atMix);
        c.rgb = mix(c.rgb, vec3(dot(c.rgb, vec3(0.3333))), 0.75);
        c.rgb = mix(vec3(0.75), c.rgb, 0.45);
        float band = smoothstep(${(BARRIER_HEIGHT - 0.24).toFixed(3)}, ${(BARRIER_HEIGHT - 0.22).toFixed(3)}, vWPos.y);
        float stripe = step(0.5, fract(vMapUv.x * 2.4 / 4.0));
        vec3 paint = mix(vec3(0.95), mix(vec3(0.75, 0.04, 0.03), vec3(0.95), stripe), band);
        float grime = smoothstep(0.3, 0.0, vWPos.y) * 0.25;
        diffuseColor.rgb *= c.rgb * paint * (1.0 - grime);
      `,
      roughnessmap_fragment: /* glsl */ `
        float roughnessFactor = roughness * sampleAT(roughnessMap, vRoughnessMapUv, atMix).g;
      `,
      normal_fragment_maps: NORMAL_FROM("sampleATn(normalMap, vNormalMapUv, atMix)"),
    },
  });
}

function fenceTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  g.strokeStyle = "#fff";
  g.lineWidth = 3;
  for (const [a, b, d, e] of [[0, 0, 64, 64], [64, 0, 0, 64], [-32, 0, 32, 64], [32, 0, 96, 64], [32, 0, -32, 64], [96, 0, 32, 64]]) {
    g.beginPath();
    g.moveTo(a, b);
    g.lineTo(d, e);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1 / 0.16, 1 / 0.16);
  tex.anisotropy = 8;
  return tex;
}

export function createFenceMaterial() {
  return new THREE.MeshStandardMaterial({
    color: "#9aa3ab",
    alphaMap: fenceTexture(),
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    metalness: 0.7,
    roughness: 0.4,
  });
}

export function createPaintMaterial(color = "#f2f2ee") {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.55,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
}
