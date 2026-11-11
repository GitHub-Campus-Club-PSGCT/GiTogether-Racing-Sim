// Turn the source W17 GLB into the game's hero car:
//  - bake the root rotation (nose to -Z, Y up)
//  - split the four wheels into their own pivot nodes so they can spin and steer
//  - replace the real-team livery with an original one; drop sponsor/decal sheets
//  - resize textures to 2K WebP and meshopt-compress
// Usage: node scripts/prepare-car.mjs
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { transformMesh, transformPrimitive, textureCompress, meshopt, prune, dedup } from "@gltf-transform/functions";
import { MeshoptEncoder } from "meshoptimizer";
import sharp from "sharp";
import * as THREE from "three";
import { GITHUB_MARK_PATHS } from "../src/racing/scene/Scenery/githubMark.js";

const SRC = "assets-src/car/f1_2026_w17.glb";
const OUT = "public/assets/car/hero.glb";

// Livery palette (matches the UI: graphite + race red). The paint pattern itself
// is drawn at runtime from the car's 3D shape (HeroCar.jsx), not from a texture.
const LIVERY = {
  base: [29, 31, 35], // graphite
  accent: [225, 6, 0], // race red
};
const NUMBER = "33";

await MeshoptEncoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.encoder": MeshoptEncoder });
const doc = await io.read(SRC);
const root = doc.getRoot();
const buffer = root.listBuffers()[0];
const carNode = root.listNodes()[0];
const mesh = carNode.getMesh();

// 1. Bake the node rotation, then turn 180° so the nose points to -Z.
const m = new THREE.Matrix4().fromArray(carNode.getMatrix());
m.premultiply(new THREE.Matrix4().makeRotationY(Math.PI));
transformMesh(mesh, m.toArray());
carNode.setRotation([0, 0, 0, 1]).setTranslation([0, 0, 0]).setScale([1, 1, 1]);
carNode.setName("hero_car");

// 2. Remove sponsor decals and steering-wheel decal sheets.
for (const prim of mesh.listPrimitives()) {
  const name = prim.getMaterial()?.getName() ?? "";
  if (/^mercedes_decals|^sw_decals/.test(name)) {
    mesh.removePrimitive(prim);
    prim.dispose();
  }
}

// 3. Split wheel primitives into four clusters.
const WHEEL_MATS = /^(mercedes_wheel_hub|discs|sidewall|tread_medium)/;
const WHEELS = ["FL", "FR", "RL", "RR"];
const quadrant = (x, z) => (z < 0 ? (x < 0 ? "FL" : "FR") : x < 0 ? "RL" : "RR");

function subset(prim, tris, offset) {
  const idx = prim.getIndices().getArray();
  const remap = new Map();
  const order = [];
  const newIdx = new Uint32Array(tris.length * 3);
  tris.forEach((t, k) => {
    for (let c = 0; c < 3; c++) {
      const v = idx[t * 3 + c];
      if (!remap.has(v)) {
        remap.set(v, order.length);
        order.push(v);
      }
      newIdx[k * 3 + c] = remap.get(v);
    }
  });
  const out = doc.createPrimitive().setMaterial(prim.getMaterial()).setMode(prim.getMode());
  for (const sem of prim.listSemantics()) {
    const src = prim.getAttribute(sem);
    const size = src.getElementSize();
    const arr = src.getArray();
    const dst = new arr.constructor(order.length * size);
    order.forEach((v, i) => {
      for (let k = 0; k < size; k++) dst[i * size + k] = arr[v * size + k];
    });
    if (sem === "POSITION" && offset) {
      for (let i = 0; i < order.length; i++) for (let k = 0; k < 3; k++) dst[i * 3 + k] -= offset[k];
    }
    out.setAttribute(
      sem,
      doc.createAccessor().setType(src.getType()).setArray(dst).setNormalized(src.getNormalized()).setBuffer(buffer),
    );
  }
  out.setIndices(doc.createAccessor().setType("SCALAR").setArray(newIdx).setBuffer(buffer));
  return out;
}

const clusters = Object.fromEntries(WHEELS.map((w) => [w, []]));
const centers = {};
for (const prim of mesh.listPrimitives()) {
  const name = prim.getMaterial()?.getName() ?? "";
  if (!WHEEL_MATS.test(name)) continue;
  const pos = prim.getAttribute("POSITION").getArray();
  const idx = prim.getIndices().getArray();
  const groups = Object.fromEntries(WHEELS.map((w) => [w, []]));
  const rest = [];
  for (let t = 0; t < idx.length / 3; t++) {
    let cx = 0, cz = 0;
    for (let c = 0; c < 3; c++) {
      cx += pos[idx[t * 3 + c] * 3] / 3;
      cz += pos[idx[t * 3 + c] * 3 + 2] / 3;
    }
    if (Math.abs(cx) > 0.45) groups[quadrant(cx, cz)].push(t);
    else rest.push(t);
  }
  if (/^tread_medium/.test(name)) {
    for (const w of WHEELS) {
      const b = new THREE.Box3();
      const v = new THREE.Vector3();
      for (const t of groups[w]) for (let c = 0; c < 3; c++) b.expandByPoint(v.fromArray(pos, idx[t * 3 + c] * 3));
      centers[w] = b.getCenter(new THREE.Vector3()).toArray();
      centers[w + "_radius"] = (b.max.y - b.min.y) / 2;
    }
  }
  clusters.__pending = clusters.__pending ?? [];
  clusters.__pending.push({ prim, groups, rest });
}
for (const { prim, groups, rest } of clusters.__pending) {
  for (const w of WHEELS) if (groups[w].length) clusters[w].push(subset(prim, groups[w], centers[w]));
  if (rest.length) mesh.addPrimitive(subset(prim, rest, null));
  mesh.removePrimitive(prim);
  prim.dispose();
}
// 3b. Front uprights / brake ducts: these sit inside the front wheels but belong
// to the body mesh, so they would stay straight while the wheel steers. Move every
// small connected piece inside a front wheel's envelope onto that wheel's steer node.
function connectedComponents(prim) {
  const pos = prim.getAttribute("POSITION").getArray();
  const idx = prim.getIndices().getArray();
  const key = new Map();
  const id = new Int32Array(pos.length / 3);
  for (let i = 0; i < id.length; i++) {
    const k = `${Math.round(pos[i * 3] * 2000)},${Math.round(pos[i * 3 + 1] * 2000)},${Math.round(pos[i * 3 + 2] * 2000)}`;
    if (!key.has(k)) key.set(k, key.size);
    id[i] = key.get(k);
  }
  const parent = Int32Array.from({ length: key.size }, (_, i) => i);
  const find = (a) => {
    while (parent[a] !== a) a = parent[a] = parent[parent[a]];
    return a;
  };
  for (let t = 0; t < idx.length; t += 3) {
    const a = find(id[idx[t]]);
    parent[find(id[idx[t + 1]])] = a;
    parent[find(id[idx[t + 2]])] = a;
  }
  const comps = new Map();
  for (let t = 0; t < idx.length / 3; t++) {
    const r = find(id[idx[t * 3]]);
    let c = comps.get(r);
    if (!c) comps.set(r, (c = { tris: [], min: [1e9, 1e9, 1e9], max: [-1e9, -1e9, -1e9] }));
    c.tris.push(t);
    for (let k = 0; k < 3; k++) {
      for (let q = 0; q < 3; q++) {
        const v = pos[idx[t * 3 + k] * 3 + q];
        if (v < c.min[q]) c.min[q] = v;
        if (v > c.max[q]) c.max[q] = v;
      }
    }
  }
  return [...comps.values()];
}

const uprights = { FL: [], FR: [] };
for (const prim of mesh.listPrimitives()) {
  const captured = { FL: [], FR: [] };
  let any = false;
  for (const c of connectedComponents(prim)) {
    const cx = (c.min[0] + c.max[0]) / 2, cy = (c.min[1] + c.max[1]) / 2, cz = (c.min[2] + c.max[2]) / 2;
    for (const w of ["FL", "FR"]) {
      const [wx, wy, wz] = centers[w];
      const inside =
        Math.abs(cx - wx) < 0.3 && Math.hypot(cy - wy, cz - wz) < 0.45 && c.max[0] - c.min[0] < 0.6;
      if (inside) {
        captured[w].push(...c.tris);
        any = true;
      }
    }
  }
  if (!any) continue;
  const taken = new Set([...captured.FL, ...captured.FR]);
  const total = prim.getIndices().getCount() / 3;
  const rest = [];
  for (let t = 0; t < total; t++) if (!taken.has(t)) rest.push(t);
  for (const w of ["FL", "FR"]) if (captured[w].length) uprights[w].push(subset(prim, captured[w], centers[w]));
  console.log(`upright parts from ${prim.getMaterial().getName()}: FL ${captured.FL.length} / FR ${captured.FR.length} triangles`);
  if (rest.length) mesh.addPrimitive(subset(prim, rest, null));
  mesh.removePrimitive(prim);
  prim.dispose();
}

// The true axle of each wheel. The front wheels carry ~3° of camber, so spinning
// them about the car's plain X axis makes them wobble; spin about the real axle instead.
// A tyre is a flat ring, so its axle is the direction of least spread (smallest eigenvector).
function axleDirection(prims) {
  const pts = [];
  for (const prim of prims) {
    if (!/^(tread_medium|sidewall)/.test(prim.getMaterial()?.getName() ?? "")) continue;
    const arr = prim.getAttribute("POSITION").getArray();
    for (let i = 0; i < arr.length; i += 3) pts.push(new THREE.Vector3(arr[i], arr[i + 1], arr[i + 2]));
  }
  const c = pts.reduce((a, p) => a.add(p), new THREE.Vector3()).multiplyScalar(1 / pts.length);
  const C = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (const p of pts) {
    const d = [p.x - c.x, p.y - c.y, p.z - c.z];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) C[i * 3 + j] += (d[i] * d[j]) / pts.length;
  }
  const inv = new THREE.Matrix3().set(...C).invert();
  const axis = new THREE.Vector3(1, 0, 0);
  for (let k = 0; k < 60; k++) axis.applyMatrix3(inv).normalize();
  if (axis.x < 0) axis.negate();
  return axis;
}

for (const w of WHEELS) {
  const wheelMesh = doc.createMesh(`wheel_${w}_mesh`);
  const axis = axleDirection(clusters[w]);
  const toAxle = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), axis);
  // Express the wheel geometry in the axle frame, where the axle is +X.
  const intoAxleFrame = new THREE.Matrix4().makeRotationFromQuaternion(toAxle.clone().invert());
  clusters[w].forEach((p) => {
    transformPrimitive(p, intoAxleFrame.toArray());
    wheelMesh.addPrimitive(p);
  });
  console.log(`wheel ${w}: camber ${THREE.MathUtils.radToDeg(Math.asin(axis.y)).toFixed(2)}°`);
  // wheel_XX (steer pivot at the hub) -> wheel_XX_axle (fixed camber) -> wheel_XX_spin -> wheel_XX_geo
  //                                   -> wheel_XX_upright (steers, does not spin)
  const holder = doc.createNode(`wheel_${w}_geo`).setMesh(wheelMesh);
  const spin = doc.createNode(`wheel_${w}_spin`).addChild(holder);
  const axle = doc.createNode(`wheel_${w}_axle`).setRotation(toAxle.toArray()).addChild(spin);
  const pivot = doc.createNode(`wheel_${w}`).setTranslation(centers[w]).addChild(axle);
  if (uprights[w]?.length) {
    const uprightMesh = doc.createMesh(`wheel_${w}_upright_mesh`);
    uprights[w].forEach((p) => uprightMesh.addPrimitive(p));
    pivot.addChild(doc.createNode(`wheel_${w}_upright`).setMesh(uprightMesh));
  }
  carNode.addChild(pivot);
}
carNode.setExtras({ wheelRadius: centers.FL_radius, wheelCenters: Object.fromEntries(WHEELS.map((w) => [w, centers[w]])) });
console.log("wheel radius", centers.FL_radius.toFixed(3), "centres", WHEELS.map((w) => centers[w].map((n) => n.toFixed(2)).join(",")));

// 4. Livery.
// The source paint textures carry the original team's livery artwork, so they are
// replaced outright with a plain swatch; the pattern is drawn by the paint shader.
function paintSwatch() {
  return sharp({ create: { width: 16, height: 16, channels: 4, background: { r: LIVERY.base[0], g: LIVERY.base[1], b: LIVERY.base[2], alpha: 1 } } })
    .png()
    .toBuffer();
}

function numberSheet() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="512">
    <style>
      .name { font: 800 76px Arial, Helvetica, sans-serif; fill: #f2f4f6; }
      .badge { font: 800 64px Arial, Helvetica, sans-serif; fill: #ffffff; }
      .num { font: italic 900 250px Arial, Helvetica, sans-serif; }
    </style>
    <rect x="590" y="18" width="400" height="96" rx="6" fill="rgb(${LIVERY.base.join(",")})"/>
    <rect x="590" y="104" width="400" height="10" fill="rgb(${LIVERY.accent.join(",")})"/>
    <g transform="translate(612 34) scale(2.6)" fill="#f0f6fc">${GITHUB_MARK_PATHS.map((d) => `<path d="${d}"/>`).join("")}</g>
    <text x="815" y="90" class="badge" text-anchor="middle">${NUMBER}</text>
    <text x="250" y="430" class="num" text-anchor="middle" fill="#f4f4f4" stroke="rgb(${LIVERY.base.join(",")})" stroke-width="14" paint-order="stroke">${NUMBER}</text>
    <text x="768" y="430" class="num" text-anchor="middle" fill="#f4f4f4" stroke="rgb(${LIVERY.accent.join(",")})" stroke-width="14" paint-order="stroke">${NUMBER}</text>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

// Tyre sidewall: remove the real tyre-maker logos and print fictional ones.
async function rebrandSidewall(png) {
  const img = sharp(png);
  const { width, height } = await img.metadata();
  const raw = await img.ensureAlpha().raw().toBuffer();
  for (let i = 0; i < raw.length; i += 4) {
    const r = raw[i], g = raw[i + 1], b = raw[i + 2];
    if (r > g + 45 && r > b + 45) {
      raw[i] = 27;
      raw[i + 1] = 27;
      raw[i + 2] = 28;
    }
  }
  const W = width, H = height;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <style>.t { font: italic 900 ${Math.round(H * 0.05)}px Arial, sans-serif; fill: #d81e1e; }</style>
    <text x="${W * 0.63}" y="${H * 0.395}" class="t" transform="rotate(180 ${W * 0.78} ${H * 0.38})">SOFT</text>
    <text x="${W * 0.1}" y="${H * 0.95}" class="t">SOFT</text>
    <rect x="${W * 0.05}" y="${H * 0.355}" width="${W * 0.34}" height="${H * 0.012}" fill="#d81e1e"/>
    <rect x="${W * 0.48}" y="${H * 0.915}" width="${W * 0.34}" height="${H * 0.012}" fill="#d81e1e"/>
  </svg>`;
  return sharp(raw, { raw: { width, height, channels: 4 } })
    .composite([{ input: Buffer.from(svg) }])
    .png()
    .toBuffer();
}

for (const tex of root.listTextures()) {
  const name = tex.getName();
  if (name === "S") {
    tex.setImage(await rebrandSidewall(tex.getImage())).setMimeType("image/png");
  }
  if (/^mercedes_paint/.test(name)) {
    tex.setImage(await paintSwatch()).setMimeType("image/png");
  } else if (/^mercedes_driver_63/.test(name)) {
    tex.setImage(await numberSheet()).setMimeType("image/png");
  }
  tex.setName(name.replace(/^mercedes_/, "").replace(/\.tif/, "").replace(/63/, "num"));
}
for (const mat of root.listMaterials()) {
  mat.setName(mat.getName().replace(/^mercedes_/, "").replace(/_63/, "_num").replace(/\.\d+$/, ""));
}

// 5. Optimise.
await doc.transform(
  dedup(),
  prune(),
  textureCompress({ encoder: sharp, targetFormat: "webp", resize: [2048, 2048], quality: 88 }),
  meshopt({ encoder: MeshoptEncoder, level: "medium" }),
);
await io.write(OUT, doc);
const { statSync } = await import("node:fs");
console.log(`${OUT}: ${(statSync(OUT).size / 1e6).toFixed(2)} MB`);
