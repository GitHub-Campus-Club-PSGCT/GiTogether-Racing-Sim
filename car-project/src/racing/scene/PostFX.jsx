import { EffectComposer, N8AO, Bloom, SMAA, ToneMapping, Vignette, HueSaturation, BrightnessContrast } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { useGame } from "../store";

export default function PostFX() {
  const quality = useGame((s) => s.quality);
  return (
    <EffectComposer multisampling={0} enableNormalPass={false} key={quality}>
      {quality !== "low" ? (
        <N8AO
          aoRadius={2.2}
          distanceFalloff={0.8}
          intensity={2.4}
          // halfRes is avoided: it breaks render-target setup on three r187.
          quality={quality === "high" ? "medium" : "performance"}
        />
      ) : (
        <></>
      )}
      <Bloom mipmapBlur luminanceThreshold={1.1} luminanceSmoothing={0.2} intensity={0.55} radius={0.72} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <HueSaturation saturation={0.04} />
      <BrightnessContrast contrast={0.06} />
      <SMAA />
      <Vignette offset={0.32} darkness={0.42} />
    </EffectComposer>
  );
}
