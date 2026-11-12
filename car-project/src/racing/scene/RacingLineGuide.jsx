// Racing-line assist: a strip along the racing line coloured from the speed plan
// (sim/speedPlan.js): green to accelerate, yellow to lift or hold, red to brake.
// Driven imperatively from GameScene, like Effects.
import { forwardRef, useEffect, useImperativeHandle, useMemo } from "react";
import * as THREE from "three";
import { SAMPLE_COUNT, createRacingLineGeometry } from "../circuitDefinition";

// HUD timing colours (hud.css: --positive, --yellow, --negative), toned down a
// little so the strip reads as paint on the road, not a light.
const COLORS = ["#3fae7c", "#e6bd3a", "#d6444a"];

function createGuideMaterial() {
  const m = new THREE.MeshBasicMaterial({
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
    fog: true,
  });
  const uniforms = {
    uGreen: { value: new THREE.Color(COLORS[0]) },
    uYellow: { value: new THREE.Color(COLORS[1]) },
    uRed: { value: new THREE.Color(COLORS[2]) },
  };
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nattribute vec2 aGuide;\nvarying vec2 vGuide;\nvarying vec2 vStrip;",
      )
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvGuide = aGuide;\nvStrip = uv;");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform vec3 uGreen; uniform vec3 uYellow; uniform vec3 uRed;\nvarying vec2 vGuide;\nvarying vec2 vStrip;",
      )
      .replace(
        "vec4 diffuseColor = vec4( diffuse, opacity );",
        /* glsl */ `
        float s = vGuide.x;
        vec3 col = s < 1.0 ? mix(uGreen, uYellow, s) : mix(uYellow, uRed, s - 1.0);
        // Soft edges across the strip, and faint chevrons pointing down the track.
        float across = abs(vStrip.x - 0.5) * 2.0;
        float edge = 1.0 - smoothstep(0.72, 1.0, across);
        float f = fract((vStrip.y + across * 0.55) / 2.6);
        float chevron = smoothstep(0.0, 0.06, f) * (1.0 - smoothstep(0.38, 0.44, f));
        float a = vGuide.y * edge * (0.62 + 0.3 * chevron);
        if (a < 0.003) discard;
        vec4 diffuseColor = vec4(col * (0.85 + 0.25 * chevron), a);
        `,
      );
  };
  m.customProgramCacheKey = () => "racing-line-guide";
  return m;
}

const RacingLineGuide = forwardRef(function RacingLineGuide(_, ref) {
  const { geometry, attr } = useMemo(() => {
    const g = createRacingLineGeometry();
    const rows = g.attributes.position.count / 2;
    const a = new THREE.BufferAttribute(new Float32Array(rows * 2 * 2), 2);
    a.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute("aGuide", a);
    return { geometry: g, attr: a };
  }, []);
  const material = useMemo(createGuideMaterial, []);
  const mesh = useMemo(() => {
    const m = new THREE.Mesh(geometry, material);
    m.renderOrder = 2; // after the road and its paint
    m.visible = false;
    m.name = "racing-line-guide";
    return m;
  }, [geometry, material]);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  useImperativeHandle(
    ref,
    () => ({
      /** Copy the guide's per-sample colour and visibility to the strip; hide it if `show` is false. */
      update(guide, show) {
        mesh.visible = show;
        if (!show) return;
        const out = attr.array;
        const rows = out.length / 4;
        for (let r = 0; r < rows; r++) {
          const i = r % SAMPLE_COUNT;
          const s = guide.state[i], a = guide.alpha[i];
          out[r * 4] = s;
          out[r * 4 + 1] = a;
          out[r * 4 + 2] = s;
          out[r * 4 + 3] = a;
        }
        attr.needsUpdate = true;
      },
    }),
    [mesh, attr],
  );

  return <primitive object={mesh} />;
});

export default RacingLineGuide;
