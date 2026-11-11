import { useMemo } from "react";
import { useSurfaceTextures } from "../materials";
import { createSceneryMaterials } from "./sceneryMaterials";
import { brandStripTexture } from "./textures";
import { GRANDSTANDS } from "./layout";
import Grandstand from "./Grandstand";
import PitComplex from "./PitComplex";
import StartGantry from "./StartGantry";
import Trackside from "./Trackside";
import Trees from "./Trees";

export default function Scenery() {
  const textures = useSurfaceTextures();
  const materials = useMemo(() => createSceneryMaterials(textures), [textures]);
  const fascia = useMemo(() => brandStripTexture(), []);
  return (
    <group>
      {GRANDSTANDS.map((stand, i) => (
        <Grandstand key={stand.id} stand={stand} materials={materials} fascia={fascia} seed={i + 1} />
      ))}
      <PitComplex textures={textures} materials={materials} />
      <StartGantry materials={materials} />
      <Trackside materials={materials} />
      <Trees />
    </group>
  );
}
