// Canvas-generated signage textures (all brands and teams are fictional).
import * as THREE from "three";
import { GITHUB_MARK_PATHS, GITHUB_MARK_VIEWBOX } from "./githubMark";

export const GITHUB = { dark: "#0d1117", green: "#3fb950", greenDeep: "#238636", text: "#f0f6fc" };

/** Draw the GitHub mark centred at (cx, cy) with the given height. */
export function drawGithubMark(g, cx, cy, size, color) {
  g.save();
  g.translate(cx - size / 2, cy - size / 2);
  g.scale(size / GITHUB_MARK_VIEWBOX, size / GITHUB_MARK_VIEWBOX);
  g.fillStyle = color;
  for (const d of GITHUB_MARK_PATHS) g.fill(new Path2D(d));
  g.restore();
}

// Signage panels. Invented sponsor names have been removed (decision pending on
// what, if anything, replaces them); boards are plain colour with a thin accent.
// The GitHub Campus Club panel stays at one in seven (~14% of signage).
export const BRANDS = [
  // Neutral palette, ordered so no run of adjacent panels reads as a flag.
  { bg: "#10161f", accent: "#e10600" },
  { bg: "#2a2f37", accent: "#9aa4b2" },
  { bg: "#eef0f2", accent: "#10161f" },
  { bg: "#10161f", accent: "#9aa4b2" },
  { bg: "#3a4049", accent: "#eef0f2" },
  { bg: "#eef0f2", accent: "#e10600" },
  { name: "GitHub", sub: "CAMPUS CLUB", bg: GITHUB.dark, fg: GITHUB.text, mark: true, accent: GITHUB.green },
];

// Pit garages: neutral colour schemes, numbered, no team names.
export const TEAMS = [
  { color: "#20262f", accent: "#e10600" },
  { color: "#d9dde2", accent: "#20262f" },
  { color: "#1d3f73", accent: "#eef0f2" },
  { color: "#3a4049", accent: "#eef0f2" },
  { color: "#eef0f2", accent: "#b8161d" },
  { color: "#14181e", accent: "#9aa4b2" },
];

function canvasTexture(w, h, draw, repeat = false) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d"), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  if (repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function brandTexture(brand, { w = 1024, h = 192, repeat = false } = {}) {
  return canvasTexture(w, h, (g) => {
    g.fillStyle = brand.bg;
    g.fillRect(0, 0, w, h);
    if (!brand.name) {
      g.fillStyle = brand.accent;
      g.fillRect(0, h * 0.86, w, h * 0.08);
      return;
    }
    g.fillStyle = brand.fg;
    g.textBaseline = "middle";
    g.font = `900 italic ${Math.round(h * 0.56)}px Arial, sans-serif`;
    const tw = g.measureText(brand.name).width;
    g.font = `700 ${Math.round(h * 0.17)}px Arial, sans-serif`;
    const sw = g.measureText(brand.sub).width;
    const markW = brand.mark ? h * 0.75 : 0;
    const x0 = (w - (markW + tw + sw + h * 0.25)) / 2 + markW;
    if (brand.mark) {
      drawGithubMark(g, x0 - markW / 2 - h * 0.05, h * 0.5, h * 0.56, brand.fg);
      g.fillStyle = brand.accent;
      g.fillRect(0, h * 0.9, w, h * 0.1);
      g.fillStyle = brand.fg;
    }
    g.font = `900 italic ${Math.round(h * 0.56)}px Arial, sans-serif`;
    g.fillText(brand.name, x0, h * 0.52);
    g.globalAlpha = 0.85;
    g.font = `700 ${Math.round(h * 0.17)}px Arial, sans-serif`;
    g.fillText(brand.sub, x0 + tw + h * 0.25, h * 0.56);
  }, repeat);
}

/** A strip of alternating brands, tiled along long surfaces (fascias, parapets). */
export function brandStripTexture(h = 128) {
  const per = h * 6;
  return canvasTexture(per * BRANDS.length, h, (g) => {
    BRANDS.forEach((b, i) => {
      g.fillStyle = b.bg;
      g.fillRect(i * per, 0, per, h);
      if (!b.name) {
        g.fillStyle = b.accent;
        g.fillRect(i * per, h * 0.84, per, h * 0.1);
        return;
      }
      g.fillStyle = b.fg;
      g.textBaseline = "middle";
      g.textAlign = "center";
      g.font = `900 italic ${Math.round(h * 0.55)}px Arial, sans-serif`;
      if (b.mark) {
        const tw = g.measureText(b.name).width;
        drawGithubMark(g, i * per + per / 2 - tw / 2 - h * 0.45, h * 0.5, h * 0.55, b.fg);
        g.fillText(b.name, i * per + per / 2 + h * 0.2, h * 0.53);
        g.fillStyle = b.accent;
        g.fillRect(i * per, h * 0.9, per, h * 0.1);
      } else {
        g.fillText(b.name, i * per + per / 2, h * 0.53);
      }
    });
  }, true);
}

export function teamTexture(team, index = 0) {
  return canvasTexture(1024, 128, (g, w, h) => {
    g.fillStyle = team.color;
    g.fillRect(0, 0, w, h);
    g.fillStyle = team.accent;
    g.fillRect(0, h * 0.82, w, h * 0.18);
    g.textBaseline = "middle";
    g.textAlign = "center";
    g.fillStyle = team.color === "#eef0f2" || team.color === "#d9dde2" ? "#20262f" : "#ffffff";
    g.font = `800 ${Math.round(h * 0.42)}px Arial, sans-serif`;
    g.fillText(`GARAGE ${String(index + 1).padStart(2, "0")}`, w / 2, h * 0.42);
  });
}

export function numberBoardTexture(n) {
  return canvasTexture(256, 192, (g, w, h) => {
    g.fillStyle = "#f4f4f0";
    g.fillRect(0, 0, w, h);
    g.strokeStyle = "#111";
    g.lineWidth = 10;
    g.strokeRect(5, 5, w - 10, h - 10);
    g.fillStyle = "#111";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = "900 120px Arial, sans-serif";
    g.fillText(String(n), w / 2, h / 2 + 6);
  });
}

export function circuitSignTexture(text) {
  return canvasTexture(2048, 256, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, "#0a0d12");
    grad.addColorStop(1, "#1a2230");
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#e10600";
    g.fillRect(0, h - 18, w, 18);
    g.fillStyle = "#ffffff";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = `900 italic ${text.length > 16 ? 120 : 150}px Arial, sans-serif`;
    g.fillText(text, w / 2, h / 2);
  });
}

/** Event title sign: "GiTogether Qualifying" in GitHub colours with the mark. */
export function eventSignTexture() {
  return canvasTexture(2048, 256, (g, w, h) => {
    g.fillStyle = GITHUB.dark;
    g.fillRect(0, 0, w, h);
    g.fillStyle = GITHUB.green;
    g.fillRect(0, h - 18, w, 18);
    g.font = "900 italic 130px Arial, sans-serif";
    const text = "GiTogether Qualifying";
    const tw = g.measureText(text).width;
    const x0 = (w - tw - 190) / 2;
    drawGithubMark(g, x0 + 70, h / 2 - 6, 150, GITHUB.text);
    g.fillStyle = GITHUB.text;
    g.textBaseline = "middle";
    g.fillText(text, x0 + 190, h / 2);
  });
}
