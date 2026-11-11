// Camera rigs: chase (near/far), T-cam onboard, and a slow orbit for the title screen.
import * as THREE from "three";

export const CAMERA_MODES = ["chase", "far", "tcam"];

const RIGS = {
  chase: { distance: 7.4, height: 2.15, look: 4.5, lookHeight: 1.05, fov: [58, 74], lag: 5.5 },
  far: { distance: 11.5, height: 3.6, look: 6, lookHeight: 1.0, fov: [55, 68], lag: 4.2 },
};
const TCAM = { pos: new THREE.Vector3(0, 1.32, 0.28), fov: [68, 84] };

const desired = new THREE.Vector3();
const target = new THREE.Vector3();
const local = new THREE.Vector3();
const Y = new THREE.Vector3(0, 1, 0);

function wrapAngle(a) {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

/**
 * ctx: { x, z, yaw, speed, rough, dt, mode, orbit, time }
 * rig: persistent state object owned by the caller.
 */
export function updateCamera(camera, rig, ctx) {
  const { x, z, yaw, speed, rough, dt, mode, orbit, time } = ctx;
  const y = ctx.y ?? 0;
  rig.yaw ??= yaw;
  rig.shake ??= 0;
  const speedRatio = Math.min(1, speed / 85);

  if (orbit) {
    const a = time * 0.12 + 0.6;
    desired.set(x + Math.sin(a) * 9, y + 2.4 + Math.sin(time * 0.21) * 0.5, z + Math.cos(a) * 9);
    camera.position.lerp(desired, 1 - Math.pow(0.02, dt));
    camera.lookAt(target.set(x, y + 0.8, z));
    setFov(camera, 46, dt);
    rig.yaw = yaw;
    return;
  }

  if (mode === "tcam") {
    local.copy(TCAM.pos).applyAxisAngle(Y, yaw);
    camera.position.set(x + local.x, y + local.y, z + local.z);
    camera.lookAt(target.set(x - Math.sin(yaw) * 30, y + 0.9, z - Math.cos(yaw) * 30));
    camera.position.y += rough ? Math.sin(time * 61) * 0.012 * speedRatio : 0;
    setFov(camera, THREE.MathUtils.lerp(TCAM.fov[0], TCAM.fov[1], speedRatio), dt);
    rig.yaw = yaw;
    return;
  }

  const r = RIGS[mode] ?? RIGS.chase;
  // The camera trails the car's heading slightly so rotation in corners reads clearly.
  rig.yaw += wrapAngle(yaw - rig.yaw) * (1 - Math.exp(-r.lag * dt));
  const dist = r.distance + speedRatio * 1.2;
  desired.set(x + Math.sin(rig.yaw) * dist, y + r.height + speedRatio * 0.25, z + Math.cos(rig.yaw) * dist);
  camera.position.lerp(desired, 1 - Math.pow(0.0005, dt));

  // Shake over kerbs/grass and a faint buzz at top speed.
  rig.shake = THREE.MathUtils.damp(rig.shake, (rough ? 1 : 0) * speedRatio + speedRatio * 0.08, 10, dt);
  const s = rig.shake;
  camera.position.x += (Math.sin(time * 47.1) + Math.sin(time * 31.7)) * 0.02 * s;
  camera.position.y += (Math.sin(time * 53.3) + Math.sin(time * 23.9)) * 0.025 * s;

  target.set(x - Math.sin(yaw) * r.look, y + r.lookHeight, z - Math.cos(yaw) * r.look);
  camera.lookAt(target);
  // Boost: a small field-of-view kick sells the extra shove.
  const kick = ctx.boost ? 5 : 0;
  setFov(camera, THREE.MathUtils.lerp(r.fov[0], r.fov[1], speedRatio * speedRatio) + kick, dt);
}

function setFov(camera, fov, dt) {
  const next = THREE.MathUtils.damp(camera.fov, fov, 3, dt);
  if (Math.abs(next - camera.fov) > 0.01) {
    camera.fov = next;
    camera.updateProjectionMatrix();
  }
}
