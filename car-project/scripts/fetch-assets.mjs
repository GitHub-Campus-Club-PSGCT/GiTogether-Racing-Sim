// Download CC0 textures + HDRI from Poly Haven and convert them for the web.
// Raw downloads go to assets-src/downloads (gitignored); web-ready files to public/assets.
// Usage: node scripts/fetch-assets.mjs
import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import sharp from "sharp";

const UA = { "User-Agent": "asset-fetch" };
const RAW = "assets-src/downloads";
const OUT = "public/assets";

const TEXTURES = [
  // [polyhaven id, local name, resolution, output px]
  ["asphalt_track", "asphalt", "2k", 2048],
  ["leafy_grass", "grass", "1k", 1024],
  ["gravel_floor_02", "gravel", "1k", 1024],
  ["concrete_wall_003", "concrete", "1k", 1024],
  ["concrete_floor_02", "paddock", "1k", 1024],
];
const MAPS = { Diffuse: "color", nor_gl: "normal", arm: "arm" };
const HDRI = "kloofendal_48d_partly_cloudy_puresky";

async function json(url) {
  const r = await fetch(url, { headers: UA });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}

async function download(entry, dest) {
  if (existsSync(dest) && md5(readFileSync(dest)) === entry.md5) return dest;
  const r = await fetch(entry.url, { headers: UA });
  if (!r.ok) throw new Error(`${r.status} ${entry.url}`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (entry.md5 && md5(buf) !== entry.md5) throw new Error(`md5 mismatch for ${entry.url}`);
  writeFileSync(dest, buf);
  console.log(`  downloaded ${dest} (${(buf.length / 1e6).toFixed(1)} MB)`);
  return dest;
}

const md5 = (buf) => createHash("md5").update(buf).digest("hex");

// Minimal Radiance .hdr (RGBE, new-style RLE) reader, used to find the sun.
function readHdr(buf) {
  let pos = 0;
  const line = () => {
    let s = "";
    while (buf[pos] !== 0x0a) s += String.fromCharCode(buf[pos++]);
    pos++;
    return s;
  };
  while (line() !== "");
  const [, h, , w] = line().split(" ");
  const width = +w, height = +h;
  const data = new Float32Array(width * height * 3);
  const scan = new Uint8Array(width * 4);
  for (let y = 0; y < height; y++) {
    pos += 4; // RLE header: 2 2 hi lo
    for (let c = 0; c < 4; c++) {
      let x = 0;
      while (x < width) {
        let n = buf[pos++];
        if (n > 128) {
          n -= 128;
          const v = buf[pos++];
          while (n--) scan[c * width + x++] = v;
        } else {
          while (n--) scan[c * width + x++] = buf[pos++];
        }
      }
    }
    for (let x = 0; x < width; x++) {
      const e = scan[3 * width + x];
      const f = e ? Math.pow(2, e - 136) : 0;
      const i = (y * width + x) * 3;
      data[i] = scan[x] * f;
      data[i + 1] = scan[width + x] * f;
      data[i + 2] = scan[2 * width + x] * f;
    }
  }
  return { width, height, data };
}

mkdirSync(RAW, { recursive: true });

for (const [id, name, res, px] of TEXTURES) {
  console.log(`texture ${id}`);
  const files = await json(`https://api.polyhaven.com/files/${id}`);
  const dir = `${OUT}/textures/${name}`;
  mkdirSync(dir, { recursive: true });
  for (const [key, out] of Object.entries(MAPS)) {
    const entry = files[key][res].jpg;
    const raw = await download(entry, `${RAW}/${id}_${key}_${res}.jpg`);
    await sharp(raw)
      .resize(px, px)
      .webp({ quality: key === "Diffuse" ? 86 : 92 })
      .toFile(`${dir}/${out}.webp`);
  }
}

console.log(`hdri ${HDRI}`);
const hdri = await json(`https://api.polyhaven.com/files/${HDRI}`);
mkdirSync(`${OUT}/env`, { recursive: true });
const hdrPath = await download(hdri.hdri["1k"].hdr, `${RAW}/${HDRI}_1k.hdr`);
writeFileSync(`${OUT}/env/sky_1k.hdr`, readFileSync(hdrPath));
const tm = await download(hdri.tonemapped, `${RAW}/${HDRI}_tonemapped.jpg`);
// Background: only the upper hemisphere is ever visible above the terrain.
const meta = await sharp(tm).metadata();
await sharp(tm)
  .extract({ left: 0, top: 0, width: meta.width, height: Math.round(meta.height * 0.55) })
  .resize(4096, Math.round(4096 * 0.55 * (meta.height / meta.width)))
  .webp({ quality: 82 })
  .toFile(`${OUT}/env/sky_upper.webp`);

// Sun direction = brightest region of the HDR, in three.js equirect convention.
const img = readHdr(readFileSync(hdrPath));
let best = 0, bx = 0, by = 0;
for (let y = 0; y < img.height / 2; y++) {
  for (let x = 0; x < img.width; x++) {
    const i = (y * img.width + x) * 3;
    const l = img.data[i] * 0.2126 + img.data[i + 1] * 0.7152 + img.data[i + 2] * 0.0722;
    if (l > best) { best = l; bx = x; by = y; }
  }
}
const phi = (bx + 0.5) / img.width * 2 * Math.PI; // longitude
const theta = (by + 0.5) / img.height * Math.PI; // polar angle from +Y
// three.js equirect: u = atan2(dir.z, dir.x) / 2π + 0.5, v = asin(dir.y)/π + 0.5 (v=1 at top)
const lon = phi - Math.PI;
const sun = {
  x: Math.cos(lon) * Math.sin(theta),
  y: Math.cos(theta),
  z: Math.sin(lon) * Math.sin(theta),
  elevationDeg: 90 - (theta * 180) / Math.PI,
  peak: best,
};
writeFileSync(`${OUT}/env/sun.json`, JSON.stringify(sun, null, 2));
console.log("sun", sun);
console.log("done");
