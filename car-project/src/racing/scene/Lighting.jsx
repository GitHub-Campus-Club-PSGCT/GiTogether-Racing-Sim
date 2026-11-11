// HDRI image-based lighting, matching sun, textured sky dome and fog.
import { useMemo, useRef, forwardRef } from "react";
import * as THREE from "three";
import { useFrame, useLoader } from "@react-three/fiber";
import { Environment, useEnvironment, useTexture } from "@react-three/drei";
import { useGame } from "../store";

import { FOG_COLOR, SHADOW_EXTENT, SHADOW_SIZE } from "./sun";

useTexture.preload("/assets/env/sky_upper.webp");
useEnvironment.preload({ files: "/assets/env/sky_1k.hdr" });

function SkyDome() {
  const ref = useRef();
  const tex = useLoader(THREE.TextureLoader, "/assets/env/sky_upper.webp");
  const material = useMemo(() => {
    const t = tex.clone();
    t.colorSpace = THREE.SRGBColorSpace;
    t.generateMipmaps = false;
    t.minFilter = THREE.LinearFilter;
    t.wrapS = THREE.RepeatWrapping;
    t.needsUpdate = true;
    return new THREE.ShaderMaterial({
      uniforms: {
        tSky: { value: t },
        fogColor: { value: new THREE.Color(FOG_COLOR) },
        intensity: { value: 1.15 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize((modelMatrix * vec4(position, 0.0)).xyz);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D tSky;
        uniform vec3 fogColor;
        uniform float intensity;
        varying vec3 vDir;
        void main() {
          vec3 d = normalize(vDir);
          float u = atan(d.z, d.x) / 6.28318530718 + 0.5;
          float v = asin(clamp(d.y, -1.0, 1.0)) / 3.14159265359 + 0.5;
          float tv = (v - 0.45) / 0.55;
          vec3 c = texture2D(tSky, vec2(u, clamp(tv, 0.002, 0.998))).rgb * intensity;
          c = mix(fogColor, c, smoothstep(0.5, 0.535, v));
          gl_FragColor = vec4(c, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
  }, [tex]);

  useFrame(({ camera }) => ref.current?.position.copy(camera.position));

  return (
    <mesh ref={ref} material={material} renderOrder={-1000} frustumCulled={false}>
      <sphereGeometry args={[1500, 64, 32]} />
    </mesh>
  );
}

const Lighting = forwardRef(function Lighting(_, sunRef) {
  const quality = useGame((s) => s.quality);
  const size = SHADOW_SIZE[quality];
  return (
    <>
      <Environment files="/assets/env/sky_1k.hdr" environmentIntensity={0.8} />
      <SkyDome />
      <fog attach="fog" args={[FOG_COLOR, 380, 2600]} />
      <directionalLight
        key={size}
        ref={sunRef}
        color="#fff3df"
        intensity={3.4}
        castShadow
        shadow-mapSize={[size, size]}
        shadow-camera-near={1}
        shadow-camera-far={340}
        shadow-camera-left={-SHADOW_EXTENT}
        shadow-camera-right={SHADOW_EXTENT}
        shadow-camera-top={SHADOW_EXTENT}
        shadow-camera-bottom={-SHADOW_EXTENT}
        shadow-bias={-0.00015}
        shadow-normalBias={0.035}
      />
    </>
  );
});

export default Lighting;
