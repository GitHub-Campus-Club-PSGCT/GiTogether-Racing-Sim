import * as THREE from "three";

// Sun direction measured from the HDRI by scripts/fetch-assets.mjs (public/assets/env/sun.json).
export const SUN_DIR = new THREE.Vector3(0.553, 0.743, 0.377).normalize();
export const FOG_COLOR = "#a8b2c0";
export const SHADOW_EXTENT = 70;
export const SHADOW_SIZE = { high: 4096, medium: 2048, low: 1024 };

const LIGHT_DIR = SUN_DIR.clone().negate();
const BASIS_R = new THREE.Vector3().crossVectors(LIGHT_DIR, new THREE.Vector3(0, 1, 0)).normalize();
const BASIS_U = new THREE.Vector3().crossVectors(BASIS_R, LIGHT_DIR).normalize();
const snapped = new THREE.Vector3();

/** Centre the sun's shadow frustum on (x, z), snapped to whole shadow-map texels to stop shimmer. */
export function updateSun(light, x, y, z) {
  const texel = (2 * SHADOW_EXTENT) / light.shadow.mapSize.x;
  const a = Math.round((x * BASIS_R.x + y * BASIS_R.y + z * BASIS_R.z) / texel) * texel;
  const b = Math.round((x * BASIS_U.x + y * BASIS_U.y + z * BASIS_U.z) / texel) * texel;
  const c = x * LIGHT_DIR.x + y * LIGHT_DIR.y + z * LIGHT_DIR.z;
  snapped.set(0, 0, 0).addScaledVector(BASIS_R, a).addScaledVector(BASIS_U, b).addScaledVector(LIGHT_DIR, c);
  light.target.position.copy(snapped);
  light.position.copy(snapped).addScaledVector(SUN_DIR, 160);
  light.target.updateMatrixWorld();
}
