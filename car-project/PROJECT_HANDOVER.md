# F1 RUSH — PROJECT HANDOVER DOCUMENT

---

## 1. Project Overview & Architecture
- **Framework**: React 19 + Vite 8 + Three.js 0.187 + React Three Fiber 9 + Drei 10
- **Application Structure**:
  - `src/App.jsx` mounts `<RacingGame />`
  - `src/racing/RacingGame.jsx`: Core orchestrator containing `<Canvas>`, `<GameScene>`, driving simulation loop, HUD telemetry, and modal screens.
  - `src/racing/circuitDefinition.js`: **Single source of truth** for track coordinates, 17-point closed CatmullRom spline (~983m), $O(1)$ spatial projection, procedural road/kerb/barrier geometry generation, and SVG radar map generation.
  - `src/racing/TracksideEnvironment.jsx`: Stage 2 trackside 3D models and instanced scenery.
  - `src/racing/AuthenticF1Car.jsx`: Stage 3 authentic textured 3D car model (`f1_2026_w17.glb`).
  - `src/racing/audio.js`: Zero-dependency Web Audio procedural synthesizer (engine pitch, tire squeal, impact thump, countdown beeps).
  - `src/racing/RacingGame.css`: High-performance arcade HUD and responsive UI.

---

## 2. Controls & Driving Mechanics (CRITICAL — PRESERVE)
- **Controls mapping**:
  - `W` / `ArrowUp`: Accelerate ($+32\text{ m/s}^2$)
  - `S` / `ArrowDown` / `Space`: Brake ($-48\text{ m/s}^2$)
  - `A` / `ArrowLeft`: Steer Left ($+\text{yaw}$)
  - `D` / `ArrowRight`: Steer Right ($-\text{yaw}$)
  - `R`: Reset car onto track centerline facing circuit tangent
  - `Esc` / `P`: Pause / Resume
- **Heading Convention**:
  - `yaw` at start: $-\pi/2$ (facing $+X$)
  - Forward vector: $v_x = -\sin(\text{yaw})$, $v_z = -\cos(\text{yaw})$
  - Turn rate: $\text{steering} \times \text{speedFactor} \times 1.55 \times \text{highSpeedFactor} \times \text{grip}$
  - Soft drift: lateral velocity damped toward $\text{steering} \times \text{speed} \times 0.05$

---

## 3. Stages Status

### Stage 1: Circuit Architecture & Track Geometry
- **Status**: **COMPLETE**
- 14m wide asphalt ribbon, 1.2m raised red/white kerbs, 4m runoff, $\pm 12.2$m perimeter barriers.
- 8 checkpoint gates with lap validation ($> 8.0$s and $\ge 6$ gates visited).

### Stage 2: Trackside Environment
- **Status**: **COMPLETE**
- Implemented in `src/racing/TracksideEnvironment.jsx`.
- Verified assets from `public/assets/racing-kit/Models/GLTF format/` integrated:
  - Start/Finish overhead lights gantry spanning track at $(0, 0, 100)$ with checkered flags.
  - Pit Lane Complex: 8 garages, 2 race control offices, 3 paddock tents, pit wall, and sector banner towers.
  - Spectator Grandstands: 5 covered grandstands along Main Straight, Turn 1 round arena, Back Straight stands.
  - Trackside sponsor billboards positioned on corner braking approaches.
  - 28 floodlight towers and 90 tree clusters rendered via `InstancedMesh`.

### Stage 3: Authentic Car Model Integration
- **Status**: **COMPLETE**
- Implemented in `src/racing/AuthenticF1Car.jsx`.
- Loaded `public/assets/car/source/f1_2026_w17.glb` (40.09 MB):
  - Preserved all 29 PBR materials and high-resolution textures.
  - Aligned orientation to local nose $-Z$ with calibrated tire ground clearance ($Y = 1.16$m offset).
  - Dynamic rear LED brake light modulation (emissive red glow during active braking).
  - Preserved full driving physics, camera tracking, and steering responsiveness.
  - Build and lint tests pass with 0 errors.

### Stage 4: Visual Polish & Atmosphere
- **Status**: **READY TO COMMENCE**
- Enhanced environment lighting, sky dome, and realistic asphalt textures.
