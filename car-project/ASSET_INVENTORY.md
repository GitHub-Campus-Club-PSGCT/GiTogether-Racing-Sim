# F1 RUSH — ASSET INVENTORY & SPECIFICATION

This document catalogs all verified 3D models and textures in the project repository for F1 RUSH.

---

## 1. Formula 1 Car Model (`f1_2026_w17.glb`)

- **Location**: `public/assets/car/source/f1_2026_w17.glb`
- **File Size**: 40,091,884 bytes (~40.09 MB)
- **Format**: Binary GLTF (GLB v2)
- **Geometry & Hierarchy**:
  - Single scene, single root node `f1_2026_w17` with rotation quaternion `[0.7071, 0, 0, 0.7071]` (90° pitch correction to align forward axis with $-Z$).
  - One consolidated mesh with **29 sub-mesh primitives**.
- **Materials**:
  - Exactly **29 PBR materials** (including `generics.007`, `mercedes_paint.007`, `mercedes_paint2.007`, `mercedes_carbon1.007`, `mercedes_carbon3.007`, `mercedes_number_63.005`, `rear_light_2.007`, `mercedes_wheel_hub`, `sidewall`, `tread_medium`).
- **Textures**:
  - 33 embedded texture buffer views within the GLB.
  - 28 external PNG texture references also backed up in `public/assets/car/textures/`.
- **Dimensions**:
  - Width: ~1.92 m
  - Length: ~5.39 m
  - Height: ~1.20 m (realistic 1:1 scale for modern Formula 1 cars)

---

## 2. Downloaded Racing Kit Models (`public/assets/racing-kit/Models/GLTF format/`)

All **112 GLB files** were verified. The kit follows a ~1.0 m modular grid standard. The models integrated in Stage 2 include:

| File Name | Vertices / Primitives | Modular Dimensions $(x, y, z)$ | In-Game Role & Scaling |
|---|---|---|---|
| `overheadLights.glb` | 3 primitives | $1.26\text{m} \times 0.69\text{m} \times 0.19\text{m}$ | Spanning start/finish gantry over road; scaled $20\times \times 12\times \times 6\times$ (25.2m span, 8.3m height). |
| `pitsGarage.glb` | 4 primitives, embedded `tankco` texture | $1.0\text{m} \times 0.7\text{m} \times 1.09\text{m}$ | Team open pit boxes along main straight infield; scaled $9.5\times \times 7.5\times \times 8.5\times$. |
| `pitsGarageClosed.glb` | 5 primitives | $1.0\text{m} \times 0.7\text{m} \times 1.09\text{m}$ | End garages and scrutineering bays; scaled $9.5\times \times 7.5\times \times 8.5\times$. |
| `pitsOffice.glb` | 4 primitives | $1.0\text{m} \times 1.0\text{m} \times 1.0\text{m}$ | Race control and team management headquarters; scaled $10.5\times \times 9.0\times \times 10.0\times$. |
| `tentLong.glb` | 2 primitives | $1.0\text{m} \times 0.6\text{m} \times 2.0\text{m}$ | Paddock hospitality village behind garages; scaled $8.0\times \times 7.0\times \times 6.5\times$. |
| `barrierWall.glb` | 1 primitive | $1.0\text{m} \times 0.13\text{m} \times 0.12\text{m}$ | Pit wall divider along pit straight; scaled $9.8\times \times 8.0\times \times 6.0\times$. |
| `grandStandCovered.glb` | 5 primitives | $1.0\text{m} \times 1.19\text{m} \times 1.02\text{m}$ | Main straight covered grandstands; scaled $16.0\times \times 9.0\times \times 11.5\times$. |
| `grandStandCoveredRound.glb`| 5 primitives | $1.64\text{m} \times 1.19\text{m} \times 1.64\text{m}$| Turn 1 sweeping arena grandstand; scaled $14.0\times \times 9.5\times \times 14.0\times$. |
| `grandStand.glb` | 4 primitives | $1.0\text{m} \times 0.9\text{m} \times 1.0\text{m}$ | Back straight DRS spectator seating; scaled $15.0\times \times 8.0\times \times 11.0\times$. |
| `billboard.glb` | 4 primitives, embedded banner texture | $1.0\text{m} \times 1.0\text{m} \times 0.48\text{m}$ | Turn 1, Back Straight, and Turn 6 sponsor billboards; scaled $10\text{-}11\times \times 7.5\times \times 6\times$. |
| `bannerTowerRed.glb` | 3 primitives | $0.39\text{m} \times 1.25\text{m} \times 0.39\text{m}$ | Sector marker towers; scaled $7.0\times \times 9.0\times \times 7.0\times$. |
| `bannerTowerGreen.glb` | 3 primitives | $0.39\text{m} \times 1.25\text{m} \times 0.39\text{m}$ | Sector marker towers; scaled $7.0\times \times 9.0\times \times 7.0\times$. |
| `flagCheckers.glb` | 2 meshes | $0.2\text{m} \times 1.25\text{m} \times 0.04\text{m}$ | Checkered flags at Start/Finish safety perimeter; scaled $5.5\times \times 6.0\times \times 5.5\times$. |
| `lightPostLarge.glb` | 3 primitives | $0.38\text{m} \times 0.8\text{m} \times 0.1\text{m}$ | High-performance `InstancedMesh` floodlight towers (28 instances around perimeter). |
| `treeLarge.glb` | 2 primitives | $0.36\text{m} \times 1.51\text{m} \times 0.41\text{m}$ | High-performance `InstancedMesh` tree clusters (90 instances in outer scenery). |

