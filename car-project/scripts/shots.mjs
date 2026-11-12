// Screenshot the running game at fixed spots on the circuit.
// Usage: node scripts/shots.mjs [baseUrl] [outDir] [label]
// Requires `npm run dev` (or `npm run preview`) to be running.
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const base = process.argv[2] ?? "http://localhost:5173";
const outDir = process.argv[3] ?? "shots";
const label = process.argv[4] ?? "shot";
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

await page.goto(`${base}/?debug=1${process.env.SHOT_UI ? "" : "&ui=0"}${process.env.SHOT_Q ? `&q=${process.env.SHOT_Q}` : ""}`, { waitUntil: "networkidle" });
await page.waitForFunction(() => window.__f1 && window.__f1.ready(), null, { timeout: 120000 });
if (process.env.SHOT_UI) {
  // Loading screen waits for a key press once the circuit is ready.
  await page.waitForTimeout(1600);
  await page.screenshot({ path: `${outDir}/${label}-loader.png` });
  await page.keyboard.press("Enter");
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${outDir}/${label}-loader-to-title.png` });
  await page.waitForTimeout(900);
}

const spots = JSON.parse(process.env.SHOT_SPOTS ?? "null") ?? [
  { name: "grid", u: 0.0, lateral: 0 },
  { name: "turn1", u: 0.17, lateral: 0 },
  { name: "compression", u: 0.13, lateral: 2 },
  { name: "hairpin", u: 0.7, lateral: 0 },
  { name: "backstraight", u: 0.55, lateral: -2 },
];
for (const spot of spots) {
  await page.evaluate((s) => {
    window.__f1.placeAt(s.u ?? 0, s.lateral ?? 0, s.speed ?? 0);
    if (s.cam) window.__f1.view(s.cam, s.target);
    if (s.steer != null) window.__f1.steer(s.steer);
    for (const [k, v] of Object.entries(s.assists ?? {})) window.__f1.assist(k, v);
    if (s.screen) window.__f1.screen(s.screen, s.results);
  }, spot);
  if (spot.drive) {
    await page.evaluate(() => window.__f1.race(true));
    await page.waitForTimeout(spot.drive * 1000);
    if (spot.after) await page.evaluate((n) => window.__f1.screen(n), spot.after);
    if (spot.after) await page.waitForTimeout(spot.afterWait ?? 700);
  } else {
    await page.waitForTimeout(1500);
  }
  await page.screenshot({ path: `${outDir}/${label}-${spot.name}.png` });
}
const fps = await page.evaluate(() => window.__f1.measureFps(3000));
const stats = await page.evaluate(() => window.__f1.stats());
console.log(JSON.stringify({ fps, stats, errors }, null, 2));
await browser.close();
