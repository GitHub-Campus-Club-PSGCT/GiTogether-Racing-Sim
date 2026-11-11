// Shared materials for buildings and trackside furniture.
import * as THREE from "three";

// World-space triplanar concrete so long boxes are never stretched.
function triplanar(material, set, scale, tint, amount = 0.5) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.tTri = { value: set.color };
    shader.uniforms.tTriR = { value: set.arm };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vTriPos; varying vec3 vTriN;")
      .replace(
        "#include <project_vertex>",
        `#include <project_vertex>
        vTriPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        #ifdef USE_INSTANCING
          vTriPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
        #endif
        vTriN = normalize(mat3(modelMatrix) * objectNormal);`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        uniform sampler2D tTri; uniform sampler2D tTriR; varying vec3 vTriPos; varying vec3 vTriN;
        vec4 tri(sampler2D t) {
          vec3 w = pow(abs(normalize(vTriN)), vec3(4.0)); w /= (w.x + w.y + w.z);
          vec3 p = vTriPos * ${scale.toFixed(3)};
          return texture2D(t, p.zy) * w.x + texture2D(t, p.xz) * w.y + texture2D(t, p.xy) * w.z;
        }`,
      )
      .replace("#include <map_fragment>", `vec3 triC = tri(tTri).rgb; triC = mix(triC, vec3(dot(triC, vec3(0.333))), 0.8);
         diffuseColor.rgb *= mix(vec3(1.0), triC * ${tint}, ${amount.toFixed(2)});`)
      .replace(
        "#include <roughnessmap_fragment>",
        "float roughnessFactor = roughness * (0.75 + 0.35 * tri(tTriR).g);",
      );
  };
  material.customProgramCacheKey = () => `tri-${scale}-${tint}-${amount}`;
  return material;
}

export function createSceneryMaterials(textures) {
  return {
    concrete: triplanar(
      new THREE.MeshStandardMaterial({ color: "#d6d4ce", roughness: 0.9 }),
      textures.paddock,
      0.35,
      "1.3",
      0.55,
    ),
    painted: triplanar(
      new THREE.MeshStandardMaterial({ color: "#eeece6", roughness: 0.6 }),
      textures.concrete,
      0.25,
      "1.15",
      0.22,
    ),
    darkPanel: new THREE.MeshStandardMaterial({ color: "#2b3036", roughness: 0.5, metalness: 0.3 }),
    steel: new THREE.MeshStandardMaterial({ color: "#b9c1c8", roughness: 0.32, metalness: 0.9 }),
    darkSteel: new THREE.MeshStandardMaterial({ color: "#3b4148", roughness: 0.4, metalness: 0.85 }),
    glass: new THREE.MeshPhysicalMaterial({
      color: "#4a6478",
      roughness: 0.03,
      metalness: 0.75,
      clearcoat: 1,
      clearcoatRoughness: 0.03,
      envMapIntensity: 2.2,
    }),
    garageInterior: new THREE.MeshStandardMaterial({ color: "#3a3f45", roughness: 0.7 }),
    lightStrip: new THREE.MeshStandardMaterial({ color: "#ffffff", emissive: "#fff6e8", emissiveIntensity: 2.5 }),
    seat: new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.55 }),
    person: new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.8 }),
  };
}
