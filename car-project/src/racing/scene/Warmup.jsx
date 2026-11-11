// Gets the GPU ready before the first real frame, without freezing the page:
//   1. uploads every texture in the scene a few at a time (about 8 ms per frame;
//      a single 2K upload can take tens of milliseconds, all at once took ~1 s),
//   2. compiles every shader in the background (compileAsync uses the browser's
//      parallel shader compilation).
// Rendering stays paused (frameloop "never") until this finishes; the loading
// screen keeps animating meanwhile and shows the progress.
import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { useGame } from "../store";

const TEXTURE_SLOTS = ["map", "normalMap", "roughnessMap", "metalnessMap", "aoMap", "emissiveMap", "alphaMap", "clearcoatNormalMap", "specularIntensityMap", "specularColorMap"];

function collectTextures(scene) {
  const found = new Set();
  const add = (t) => t?.isTexture && !t.isRenderTargetTexture && t.image && found.add(t);
  scene.traverse((o) => {
    const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of mats) {
      for (const slot of TEXTURE_SLOTS) add(m[slot]);
      if (m.uniforms) for (const u of Object.values(m.uniforms)) add(u?.value);
    }
  });
  return [...found];
}

const FRAME_BUDGET_MS = 8;
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

export default function Warmup() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    let alive = true;
    (async () => {
      const { setWarmup, setCompiled } = useGame.getState();
      const textures = collectTextures(scene);
      // Upload within a small time budget per frame, then yield so the page stays responsive.
      let i = 0;
      while (i < textures.length && alive) {
        const start = performance.now();
        do gl.initTexture(textures[i++]);
        while (i < textures.length && performance.now() - start < FRAME_BUDGET_MS);
        setWarmup((i / textures.length) * 0.8);
        await nextFrame();
      }
      if (!alive) return;
      try {
        if (gl.compileAsync) await gl.compileAsync(scene, camera);
      } catch {
        // Fall back to compiling on the first frame.
      }
      if (!alive) return;
      setWarmup(1);
      setCompiled();
    })();
    return () => {
      alive = false;
    };
  }, [gl, scene, camera]);
  return null;
}
