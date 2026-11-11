// Skid marks, tyre smoke and sparks. Driven imperatively from GameScene each frame.
import { forwardRef, useImperativeHandle, useMemo } from "react";
import * as THREE from "three";
import { projectToTrack } from "../circuitDefinition";

const MAX_SKIDS = 2400;
const SKID_WIDTH = 0.36;
const SKID_STEP = 0.3;
const MAX_SMOKE = 420;
const MAX_SPARKS = 360;
// Rear / front wheel contact points in car space (nose toward -Z).
const WHEELS = {
  RL: [-0.74, 1.78],
  RR: [0.74, 1.78],
  FL: [-0.78, -1.62],
  FR: [0.78, -1.62],
};

function softDot() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.45, "rgba(255,255,255,0.55)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

function createSkids() {
  const positions = new Float32Array(MAX_SKIDS * 4 * 3);
  const alpha = new Float32Array(MAX_SKIDS * 4);
  const index = new Uint32Array(MAX_SKIDS * 6);
  for (let i = 0; i < MAX_SKIDS; i++) {
    const v = i * 4;
    index.set([v, v + 2, v + 1, v + 1, v + 2, v + 3], i * 6);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute("aAlpha", new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage));
  geometry.setIndex(new THREE.BufferAttribute(index, 1));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
  const material = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog]),
    vertexShader: /* glsl */ `
      attribute float aAlpha; varying float vA;
      #include <fog_pars_vertex>
      void main() { vA = aAlpha; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      varying float vA;
      #include <fog_pars_fragment>
      void main() { gl_FragColor = vec4(0.012, 0.012, 0.014, vA * 0.75);
      #include <fog_fragment>
      }`,
    transparent: true,
    depthWrite: false,
    fog: true,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  });
  return { mesh: new THREE.Mesh(geometry, material), positions, alpha, head: 0, last: {} };
}

function createParticles(max, { additive, color }) {
  const positions = new Float32Array(max * 3);
  const size = new Float32Array(max);
  const alpha = new Float32Array(max);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute("aAlpha", new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
  const material = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      { map: { value: softDot() }, color: { value: new THREE.Color(color) }, scale: { value: 600 } },
    ]),
    vertexShader: /* glsl */ `
      attribute float aSize; attribute float aAlpha; uniform float scale; varying float vA;
      #include <fog_pars_vertex>
      void main() {
        vA = aAlpha;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * scale / -mvPosition.z;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D map; uniform vec3 color; varying float vA;
      #include <fog_pars_fragment>
      void main() {
        float m = texture2D(map, gl_PointCoord).a;
        gl_FragColor = vec4(color, m * vA);
        #include <fog_fragment>
      }`,
    transparent: true,
    depthWrite: false,
    fog: !additive,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  const pool = Array.from({ length: max }, () => ({ life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, s0: 1, s1: 1, a0: 1 }));
  return { points, positions, size, alpha, pool, next: 0 };
}

function spawn(sys, p) {
  const slot = sys.pool[sys.next];
  sys.next = (sys.next + 1) % sys.pool.length;
  Object.assign(slot, { floor: -1e9 }, p, { life: p.max });
}

function stepParticles(sys, dt, drag, gravity, grow) {
  const { pool, positions, size, alpha } = sys;
  for (let i = 0; i < pool.length; i++) {
    const p = pool[i];
    if (p.life <= 0) {
      alpha[i] = 0;
      continue;
    }
    p.life -= dt;
    const t = 1 - Math.max(p.life, 0) / p.max;
    p.vx *= 1 - drag * dt;
    p.vz *= 1 - drag * dt;
    p.vy = p.vy * (1 - drag * dt) + gravity * dt;
    p.x += p.vx * dt;
    p.y = Math.max(p.floor ?? -1e9, p.y + p.vy * dt);
    p.z += p.vz * dt;
    positions[i * 3] = p.x;
    positions[i * 3 + 1] = p.y;
    positions[i * 3 + 2] = p.z;
    size[i] = grow ? p.s0 + (p.s1 - p.s0) * Math.sqrt(t) : p.s0 * (1 - t * 0.6);
    alpha[i] = p.a0 * (grow ? Math.sin(Math.min(1, t * 4) * Math.PI * 0.5) * (1 - t) : 1 - t);
  }
  const g = sys.points.geometry;
  g.attributes.position.needsUpdate = true;
  g.attributes.aSize.needsUpdate = true;
  g.attributes.aAlpha.needsUpdate = true;
}

const Effects = forwardRef(function Effects(_, ref) {
  const systems = useMemo(
    () => ({
      skids: createSkids(),
      smoke: createParticles(MAX_SMOKE, { additive: false, color: "#d9dcdf" }),
      sparks: createParticles(MAX_SPARKS, { additive: true, color: "#ffb347" }),
    }),
    [],
  );

  useImperativeHandle(ref, () => {
    const { skids, smoke, sparks } = systems;

    function wheelWorld(c, key) {
      const [lx, lz] = WHEELS[key];
      const cos = Math.cos(c.yaw), sin = Math.sin(c.yaw);
      return { x: c.x + lx * cos + lz * sin, z: c.z - lx * sin + lz * cos };
    }

    function addSkid(key, w, intensity, c) {
      const last = skids.last[key];
      if (!last || intensity <= 0) {
        skids.last[key] = intensity > 0 ? w : null;
        return;
      }
      const dx = w.x - last.x, dz = w.z - last.z;
      const len = Math.hypot(dx, dz);
      if (len < SKID_STEP) return;
      if (len > 3) {
        skids.last[key] = w;
        return;
      }
      // Width runs across the car, not across the direction of the slide.
      const px = Math.cos(c.yaw) * SKID_WIDTH / 2, pz = -Math.sin(c.yaw) * SKID_WIDTH / 2;
      const i = skids.head;
      skids.head = (skids.head + 1) % MAX_SKIDS;
      const y = projectToTrack(w.x, w.z, c.trackIndex ?? -1).height + 0.03;
      const yl = last.y ?? y;
      skids.positions.set(
        [last.x - px, yl, last.z - pz, last.x + px, yl, last.z + pz, w.x - px, y, w.z - pz, w.x + px, y, w.z + pz],
        i * 12,
      );
      const a = Math.min(1, intensity);
      skids.alpha.set([a, a, a, a], i * 4);
      const g = skids.mesh.geometry;
      g.attributes.position.needsUpdate = true;
      g.attributes.aAlpha.needsUpdate = true;
      skids.last[key] = { ...w, y };
    }

    return {
      /**
       * c: { x, z, yaw, speed, slipRear, slipFront, satRear, satFront, surface, impact, impactSide, dt }
       */
      update(c) {
        const dt = c.dt;
        const onTarmac = c.surface === "asphalt" || c.surface === "kerb" || c.surface === "runoff";
        const rearSlide = Math.max(0, Math.abs(c.slipRear) - 0.17) * 6 + Math.max(0, c.satRear - 1.0) * 3;
        const frontLock = Math.max(0, c.satFront - 1.0) * 3 + Math.max(0, Math.abs(c.slipFront) - 0.2) * 4;
        const moving = c.speed > 3;
        for (const key of ["RL", "RR", "FL", "FR"]) {
          const intensity = !moving || !onTarmac ? 0 : key[0] === "R" ? rearSlide : frontLock;
          addSkid(key, wheelWorld(c, key), intensity, c);
          const smokeRate = (key[0] === "R" ? rearSlide : frontLock) * Math.min(1, c.speed / 20);
          const dirt = !onTarmac && c.speed > 8;
          if ((smokeRate > 0.15 && onTarmac) || dirt) {
            const n = dirt ? 0.6 : Math.min(3, smokeRate * 2.5);
            for (let k = 0; k < n * dt * 60; k++) {
              const w = wheelWorld(c, key);
              spawn(smoke, {
                x: w.x + (Math.random() - 0.5) * 0.4,
                y: (c.y ?? 0) + 0.25,
                z: w.z + (Math.random() - 0.5) * 0.4,
                vx: (Math.random() - 0.5) * 2 + Math.sin(c.yaw) * c.speed * 0.15,
                vy: 0.6 + Math.random() * 0.8,
                vz: (Math.random() - 0.5) * 2 + Math.cos(c.yaw) * c.speed * 0.15,
                s0: 0.5,
                s1: dirt ? 2.2 : 3.2 + Math.random() * 1.6,
                a0: dirt ? 0.25 : 0.32,
                max: dirt ? 0.9 : 1.6 + Math.random() * 1.2,
              });
            }
          }
        }
        // Wall impact sparks.
        if (c.impact > 0) {
          const n = Math.min(80, 12 + c.impact * 4);
          const ox = Math.cos(c.yaw) * c.impactSide * 0.9, oz = -Math.sin(c.yaw) * c.impactSide * 0.9;
          for (let k = 0; k < n; k++) {
            spawn(sparks, {
              x: c.x + ox, y: (c.y ?? 0) + 0.4 + Math.random() * 0.4, z: c.z + oz,
              vx: (Math.random() - 0.5) * 8 - Math.sin(c.yaw) * c.speed * 0.6,
              vy: 1 + Math.random() * 4,
              vz: (Math.random() - 0.5) * 8 - Math.cos(c.yaw) * c.speed * 0.6,
              s0: 0.09 + Math.random() * 0.08, s1: 0, a0: 1, max: 0.3 + Math.random() * 0.45,
            });
          }
        }
        // Floor scraping over kerbs at speed.
        if (c.surface === "kerb" && c.speed > 45 && Math.random() < dt * 25) {
          for (let k = 0; k < 6; k++) {
            spawn(sparks, {
              x: c.x + Math.sin(c.yaw) * 1.2, y: (c.y ?? 0) + 0.05, z: c.z + Math.cos(c.yaw) * 1.2,
              vx: -Math.sin(c.yaw) * c.speed * 0.7 + (Math.random() - 0.5) * 3,
              vy: Math.random() * 1.5,
              vz: -Math.cos(c.yaw) * c.speed * 0.7 + (Math.random() - 0.5) * 3,
              s0: 0.07, s1: 0, a0: 1, max: 0.15 + Math.random() * 0.2,
            });
          }
        }
        stepParticles(smoke, dt, 1.4, 0.35, true);
        stepParticles(sparks, dt, 0.8, -9.81, false);
      },
      clearSkids() {
        skids.alpha.fill(0);
        skids.mesh.geometry.attributes.aAlpha.needsUpdate = true;
        skids.last = {};
      },
    };
  }, [systems]);

  return (
    <group>
      <primitive object={systems.skids.mesh} />
      <primitive object={systems.smoke.points} />
      <primitive object={systems.sparks.points} />
    </group>
  );
});

export default Effects;
