// Download CC0 tree models from Poly Haven and bake them into impostor atlases.
// Requires the Vite dev server (npm run dev) on port 5173.
// Usage: node scripts/bake-impostors.mjs
import { mkdirSync, existsSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { chromium } from "playwright-core";
import sharp from "sharp";

const UA = { "User-Agent": "asset-fetch" };
const TREES = ["island_tree_01", "tree_small_02"];
const RAW = "assets-src/downloads/models";
const OUT = "public/assets/trees";
const FRAME = 512;
const base = process.argv[2] ?? "http://localhost:5173";

async function fetchFile(url, dest) {
  if (existsSync(dest)) return;
  mkdirSync(dirname(dest), { recursive: true });
  const r = await fetch(url, { headers: UA });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
}

mkdirSync(OUT, { recursive: true });
const meta = {};
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=metal", "--ignore-gpu-blocklist"] });
const page = await browser.newPage();
page.on("pageerror", (e) => console.error("page:", e.message));
await page.goto(`${base}/scripts/bake/bake.html`);
await page.waitForFunction(() => window.bakeReady === true);

for (const id of TREES) {
  console.log(`tree ${id}`);
  const files = await (await fetch(`https://api.polyhaven.com/files/${id}`, { headers: UA })).json();
  const g = files.gltf["1k"].gltf;
  const dir = `${RAW}/${id}`;
  await fetchFile(g.url, `${dir}/${id}.gltf`);
  for (const [rel, entry] of Object.entries(g.include ?? {})) await fetchFile(entry.url, `${dir}/${rel}`);

  const result = await page.evaluate(
    ([url, frame]) => window.bake(url, frame),
    [`/${dir}/${id}.gltf`, FRAME],
  );
  for (const pass of ["albedo", "normal"]) {
    const png = Buffer.from(result[pass].split(",")[1], "base64");
    await sharp(png).webp({ quality: pass === "albedo" ? 88 : 92, alphaQuality: 100 }).toFile(`${OUT}/${id}_${pass}.webp`);
  }
  meta[id] = { frames: 8, frameWorld: result.frameWorld, height: result.height, width: result.width };
  console.log("  ", meta[id]);
}
writeFileSync(`${OUT}/impostors.json`, JSON.stringify(meta, null, 2));
await browser.close();
