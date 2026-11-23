/* Map and 3D scene: scene setup, procedural campus, location pins, camera (orbit / top-down / walking), zoom, panning, picking and the render loop. */
import { BLOCKS, CONTEXT_BLOCKS, COURT_LAYOUT, IMAGE_HEIGHT, IMAGE_WIDTH, M, METERS_PER_PX, PEDESTRIAN_LINKS, SITE_OFFSETS, SPECIAL_R, STREET_WALL, TREE_DATA, WORLD_H, WORLD_W, applySiteOffset, campusLocations, categoryOf, locById, pxToM } from "./locations.js";
import { matches, state } from "./appState.js";
import { dom, reduceMotion, showToast } from "./dom.js";

/* =====================================================================
   Runtime state
   ===================================================================== */

let ready = false;
let renderer, scene, camera, controls, selRing, pathGroup;
let selRingBase = 1;
let fly = null;
let lastFrame = 0;
let homeTarget, homePos;
let hoverId = null;
let overlapFrame = 0;
let MAX_ANISO = 4;
let sun, sunDirV, shadowLocal = false;
const pins = new Map();

const pickables = [];

const pathTextures = [];

const keys = new Set();

const pointer = { x: 0, y: 0, moved: false, downX: 0, downY: 0, inside: false };

/* ---- Constants ---- */
const MIN_ZOOM_DISTANCE = 8;
const MAX_ZOOM_DISTANCE = 230;
const ZOOM_STEP = 1.6;
const PATH_COLORS = [0xf1b434, 0xffffff, 0xb87333];

/* =====================================================================
   Coordinate helpers
   ===================================================================== */

function toWorld(c) {
  return new THREE.Vector3((c.x / IMAGE_WIDTH - 0.5) * WORLD_W, 0, (c.y / IMAGE_HEIGHT - 0.5) * WORLD_H);
}

function groundWorldPoint(px, py, y = 0) {
  return new THREE.Vector3((px / IMAGE_WIDTH - 0.5) * WORLD_W, y, (py / IMAGE_HEIGHT - 0.5) * WORLD_H);
}

function seeded(seed) {
  let t = seed >>> 0;
  return () => { t += 0x6d2b79f5; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
}

const inPart = (pt, x, z, margin = 0) => {                         // is world-metre point (x,z) inside a rotated rectangular part?
  const a = (pt.rot * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a), dx = x - pt.cx, dz = z - pt.cz;
  return Math.abs(dx * c + dz * s) <= pt.w / 2 + margin && Math.abs(-dx * s + dz * c) <= pt.d / 2 + margin;
};

/* =====================================================================
   Procedural textures
   ===================================================================== */

/* ---------- procedural ground material texture (no photographic campus image) ---------- */
function makeProceduralGrassTexture(repeatX = 11, repeatY = 6) {
  const S = 512, extent = S * 3, tile = document.createElement("canvas");
  tile.width = tile.height = extent;
  const g = tile.getContext("2d"), rnd = seeded(7319);
  g.fillStyle = "#626d4e";
  g.fillRect(0, 0, extent, extent);

  // Draw each variation into a 3x3 wraparound tile, then crop its seamless centre.
  for (let i = 0; i < 180; i++) {
    const x = S + rnd() * S, y = S + rnd() * S, r = 18 + rnd() * 88;
    const shade = rnd() < 0.52 ? [38, 55, 31] : [157, 151, 105];
    const a = 0.025 + rnd() * 0.055;
    for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) {
      const px = x + dx, py = y + dy;
      const grad = g.createRadialGradient(px, py, 0, px, py, r);
      grad.addColorStop(0, `rgba(${shade[0]},${shade[1]},${shade[2]},${a})`);
      grad.addColorStop(1, `rgba(${shade[0]},${shade[1]},${shade[2]},0)`);
      g.fillStyle = grad;
      g.fillRect(px - r, py - r, r * 2, r * 2);
    }
  }

  // Fine grass flecks use the same wraparound treatment to avoid visible tile seams.
  for (let i = 0; i < 15500; i++) {
    const x = S + rnd() * S, y = S + rnd() * S, len = 1 + rnd() * 3.2;
    const color = rnd() < 0.58 ? `rgba(177,174,124,${0.035 + rnd() * 0.09})` : `rgba(29,43,25,${0.035 + rnd() * 0.09})`;
    const lineWidth = 0.45 + rnd() * 0.65, tilt = (rnd() - 0.5) * 1.8;
    for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) {
      g.strokeStyle = color;
      g.lineWidth = lineWidth;
      g.beginPath(); g.moveTo(x + dx, y + dy); g.lineTo(x + dx + tilt, y + dy - len); g.stroke();
    }
  }

  const c = document.createElement("canvas");
  c.width = c.height = S;
  c.getContext("2d").drawImage(tile, S, S, S, S, 0, 0, S, S);
  const t = toTex(c);
  t.repeat.set(repeatX, repeatY);
  t.anisotropy = MAX_ANISO;
  return t;
}

function makeCourtTexture(isTennis = false) {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = isTennis ? "#557b68" : "#456b7c";
  g.fillRect(0, 0, c.width, c.height);
  // Gentle two-tone wear keeps the playing surface restrained rather than glossy or neon.
  g.fillStyle = "rgba(226,232,221,0.045)";
  g.fillRect(8, 8, 248, 240);
  g.strokeStyle = "rgba(244,241,226,0.9)";
  g.lineWidth = 3;
  g.strokeRect(16, 16, 480, 224);
  if (isTennis) {
    g.beginPath(); g.moveTo(256, 16); g.lineTo(256, 240); g.stroke();
    g.beginPath(); g.moveTo(108, 16); g.lineTo(108, 240); g.moveTo(404, 16); g.lineTo(404, 240); g.stroke();
    g.beginPath(); g.moveTo(108, 76); g.lineTo(404, 76); g.moveTo(108, 180); g.lineTo(404, 180); g.stroke();
  } else {
    g.beginPath(); g.moveTo(256, 16); g.lineTo(256, 240); g.stroke();
    g.beginPath(); g.arc(256, 128, 34, 0, Math.PI * 2); g.stroke();
    [88, 424].forEach((x) => {
      g.strokeRect(x - 44, 64, 88, 128);
      g.beginPath(); g.arc(x, 128, 27, -Math.PI / 2, Math.PI / 2); g.stroke();
      g.beginPath(); g.arc(x, 128, 27, Math.PI / 2, Math.PI * 1.5); g.stroke();
    });
  }
  const texture = new THREE.CanvasTexture(c);
  texture.encoding = THREE.sRGBEncoding;
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = MAX_ANISO;
  return texture;
}

function makeDashTexture() {
  const c = document.createElement("canvas");
  c.width = 64; c.height = 16;
  const g = c.getContext("2d");
  g.fillStyle = "#fff";
  g.beginPath();
  g.moveTo(6, 3); g.lineTo(40, 3); g.lineTo(52, 8); g.lineTo(40, 13); g.lineTo(6, 13); g.lineTo(14, 8);
  g.closePath(); g.fill();
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

/* ---------- facade styles (tile = one bay x one storey, in metres) ----------
   Colours/patterns follow the reference photo of each building (see BLOCKS below). */
const FACADE = {
  balcony:   { tw: 4.2, th: 3.4, wall: "#e4d8c2", win: "balcony", frame: "#5b3b2e", glass: "#27323b", accent: "#f4eee2", rail: "#7a2f27" },
  redlab:    { tw: 3.2, th: 3.4, wall: "#a63a2e", win: "punched", frame: "#f4efe6", glass: "#2a3640", accent: "#f4efe6", ww: 0.62, wh: 0.5 },
  whitemod:  { tw: 4.0, th: 3.5, wall: "#ecebe6", win: "ribbon", frame: "#4d555b", glass: "#34414a", accent: "#d6d4cd" },
  terracotta:{ tw: 4.0, th: 3.4, wall: "#dcd7cc", win: "ribbon", frame: "#3c3f42", glass: "#2b343c", band: "#c4602f", accent: "#e8e3d8" },
  colonial:  { tw: 3.6, th: 3.4, wall: "#e8d9a8", win: "shutter", frame: "#f6f1e7", glass: "#33414a", accent: "#f6f1e7" },
  greypunch: { tw: 3.4, th: 3.3, wall: "#c9c7c2", win: "punched", frame: "#3b3f43", glass: "#2d3943", accent: "#9a8f88", ww: 0.55, wh: 0.5 },
  pinkhouse: { tw: 3.6, th: 3.4, wall: "#d9a79a", win: "punched", frame: "#f5efe8", glass: "#2e3a43", accent: "#f5efe8", ww: 0.5, wh: 0.55 },
  cream:     { tw: 3.8, th: 3.4, wall: "#e9dfc9", win: "ribbon", frame: "#7a2d28", glass: "#2d3944", accent: "#f4ede0" },
  louver:    { tw: 3.6, th: 3.4, wall: "#e7e2d4", win: "louver", frame: "#58625c", glass: "#40524f", accent: "#f2eee3" },
  brick:     { tw: 3.0, th: 3.2, wall: "#9b4a35", win: "punched", frame: "#2f2a28", glass: "#2c3a42", accent: "#d9c9b2", ww: 0.5, wh: 0.6 },
  shop:      { tw: 3.0, th: 3.4, wall: "#d8d0c0", win: "shopfront", frame: "#262626", glass: "#3a4a52", accent: "#f3efe6" },
  heritage:  { tw: 3.4, th: 3.3, wall: "#c9a45a", win: "capiz", frame: "#4a2f1c", glass: "#d8d0b8", accent: "#e9dfc7" },
  esrc:      { tw: 4.5, th: 3.6, wall: "#b8bab9", win: "steelframe", frame: "#8f2a22", glass: "#2c3a43", accent: "#8f2a22" },
  orange:    { tw: 3.6, th: 3.4, wall: "#c9cfc9", win: "ribbon", frame: "#2d3a36", glass: "#2a3e42", accent: "#e9e5d8" },
  kubo:      { tw: 2.0, th: 2.4, wall: "#5f9a98", win: "kubo", frame: "#3b4a45", glass: "#2c3a38", accent: "#7bb0ab" },
  whitehall: { tw: 5.0, th: 4.0, wall: "#e6e1d6", win: "blank", frame: "#8a8f92", glass: "#3a464e", accent: "#d2cdc2" },
  whitered:  { tw: 3.8, th: 3.4, wall: "#efece6", win: "whitered", frame: "#a02f2b", glass: "#2c3944", accent: "#a02f2b" },
  awning:    { tw: 3.6, th: 3.3, wall: "#a9a39a", win: "awning", frame: "#3b4a3c", glass: "#2d3942", accent: "#46604a" },
  condo:     { tw: 3.3, th: 3.2, wall: "#d3d0cb", win: "punched", frame: "#3b3f43", glass: "#2d3943", accent: "#8f3a2f", ww: 0.5, wh: 0.48 },
};

/* ---------- procedural texture library (canvas; 64 px per metre on facades) ---------- */
const TEX = {};

const cvs = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };

function toTex(c, srgb = true, repeat = true) {
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.encoding = THREE.sRGBEncoding;
  t.anisotropy = MAX_ANISO;
  return t;
}

function speckle(g, w, h, rnd, n, a, light = false) {
  for (let i = 0; i < n; i++) { const v = rnd() * 255 | 0; g.fillStyle = light ? `rgba(255,255,255,${a * rnd()})` : `rgba(${v * 0.3 | 0},${v * 0.3 | 0},${v * 0.3 | 0},${a * rnd()})`; g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2); }
}

function stains(g, w, h, rnd, n, a) {                                          // vertical weathering streaks
  for (let i = 0; i < n; i++) { const x = rnd() * w, len = h * (0.2 + rnd() * 0.6), gr = g.createLinearGradient(0, 0, 0, len); gr.addColorStop(0, `rgba(30,25,20,${a})`); gr.addColorStop(1, "rgba(30,25,20,0)"); g.fillStyle = gr; g.save(); g.translate(x, rnd() * h * 0.4); g.fillRect(0, 0, 1 + rnd() * 3, len); g.restore(); }
}

/* generic 3-channel painter: colour map + bump map (grey) + roughness map (G channel) */
function triCanvas(W, H, base, bump0, rough0) {
  const cm = cvs(W, H), cb = cvs(W, H), cr = cvs(W, H), m = cm.getContext("2d"), bm = cb.getContext("2d"), rm = cr.getContext("2d");
  const R = (x, y, w, h, col, bump, rough) => {
    m.fillStyle = col; m.fillRect(x, y, w, h);
    if (bump != null) { bm.fillStyle = `rgb(${bump},${bump},${bump})`; bm.fillRect(x, y, w, h); }
    if (rough != null) { rm.fillStyle = `rgb(0,${rough},0)`; rm.fillRect(x, y, w, h); }
  };
  R(0, 0, W, H, base, bump0, rough0);
  return { cm, cb, cr, m, bm, rm, R };
}

function pack(T) { return { map: toTex(T.cm), bump: toTex(T.cb, false), rough: toTex(T.cr, false) }; }

function facadeTex(name) {
  if (TEX["f:" + name]) return TEX["f:" + name];
  const st = FACADE[name], PPM = 64, W = Math.round(st.tw * PPM), H = Math.round(st.th * PPM);
  const T = triCanvas(W, H, st.wall, 128, 222), { m, bm, rm, R } = T, rnd = seeded(name.split("").reduce((a, c) => a + c.charCodeAt(0), 7));
  const glass = (x, y, w, h) => {                                              // recessed, reflective glazing with a sky-to-ground gradient
    const gr = m.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, "#6f8190"); gr.addColorStop(0.35, st.glass); gr.addColorStop(1, "#1b242b");
    m.fillStyle = gr; m.fillRect(x, y, w, h);
    bm.fillStyle = "rgb(30,30,30)"; bm.fillRect(x, y, w, h);
    rm.fillStyle = "rgb(0,38,0)"; rm.fillRect(x, y, w, h);
  };
  const win = (x, y, w, h, mull = 1) => {
    R(x - 4, y - 4, w + 8, h + 8, st.frame, 200, 150); glass(x, y, w, h);
    for (let i = 1; i <= mull; i++) R(x + (w * i) / (mull + 1) - 1.5, y, 3, h, st.frame, 205, 150);
    R(x - 6, y + h + 4, w + 12, 5, st.accent || "#ddd", 235, 215);                   // sill
    const sg = m.createLinearGradient(0, y + h + 9, 0, y + h + 9 + 24); sg.addColorStop(0, "rgba(40,32,26,0.22)"); sg.addColorStop(1, "rgba(40,32,26,0)"); m.fillStyle = sg; m.fillRect(x, y + h + 9, w, 24);  // rain stain
  };
  const kind = st.win;
  if (kind === "punched" || kind === "louver" || kind === "awning") {
    const ww = (st.ww || 0.46) * W, wh = (st.wh || 0.5) * H, x = (W - ww) / 2, y = H * 0.2;
    win(x, y, ww, wh, kind === "louver" ? 0 : 1);
    if (kind === "louver") for (let k = 0; k < 9; k++) R(x, y + 4 + (k * (wh - 8)) / 9, ww, 3, st.frame, 215, 140);
    if (kind === "awning") R(x - 8, y - 16, ww + 16, 13, st.accent, 215, 160);
  } else if (kind === "ribbon" || kind === "whitered") {
    const y = H * 0.27, h = H * 0.44, pier = W * 0.06;
    if (st.band) R(0, H * 0.82, W, H * 0.16, st.band, 150, 200);
    R(pier, y - 5, W - 2 * pier, h + 10, kind === "whitered" ? "#a02f2b" : st.frame, 200, 150);
    glass(pier + 4, y, W - 2 * pier - 8, h);
    for (let k = 1; k < 3; k++) R(pier + ((W - 2 * pier) * k) / 3 - 1.5, y, 3, h, st.frame, 205, 150);
    if (kind === "ribbon") R(0, y + h + 6, W, 5, st.accent, 230, 215);
  } else if (kind === "balcony") {
    const x = W * 0.2, w = W * 0.6, y = H * 0.1, h = H * 0.58;
    R(x - 5, y - 5, w + 10, h + 10, st.frame, 200, 150); glass(x, y, w, h); R(x + w / 2 - 2, y, 4, h, st.frame, 205, 150);
    R(0, H * 0.7, W, H * 0.27, st.rail, 168, 150);                                  // balustrade
    for (let k = 0; k < 22; k++) R((W * (k + 0.5)) / 22 - 1, H * 0.7, 2, H * 0.27, "#5a201b", 210, 140);
    R(0, H * 0.67, W, 5, st.accent, 230, 210);
    R(0, H * 0.97, W, H * 0.03, st.accent, 235, 215);
  } else if (kind === "shutter") {
    const ww = W * 0.34, wh = H * 0.52, x = (W - ww) / 2, y = H * 0.18;
    win(x, y, ww, wh, 1);
    [x - ww * 0.52, x + ww * 1.02].forEach((sx) => { R(sx, y - 2, ww * 0.5, wh + 4, st.frame, 190, 190); for (let k = 0; k < 14; k++) R(sx + 2, y + (k * wh) / 14, ww * 0.5 - 4, 2, "#d8d2c4", 120, 200); });
  } else if (kind === "shopfront") {
    R(W * 0.05, H * 0.12, W * 0.9, H * 0.72, st.frame, 200, 150); glass(W * 0.07, H * 0.14, W * 0.86, H * 0.68);
    R(W * 0.48, H * 0.14, 4, H * 0.68, st.frame, 205, 150); R(0, H * 0.02, W, H * 0.09, st.accent, 215, 200);
  } else if (kind === "capiz") {
    R(0, H * 0.64, W, H * 0.36, "#b79456", 150, 200);                               // plastered ground-floor base
    R(W * 0.06, H * 0.14, W * 0.88, H * 0.44, st.frame, 195, 190);
    for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) R(W * 0.08 + i * (W * 0.84) / 6, H * 0.16 + j * (H * 0.4) / 3, (W * 0.84) / 6 - 4, (H * 0.4) / 3 - 4, st.glass, 110, 70);
  } else if (kind === "steelframe") {
    for (let k = 0; k < 4; k++) R(0, (k * H) / 4, W, 6, st.frame, 205, 110);
    for (let k = 0; k <= 3; k++) R((k * W) / 3 - 3, 0, 6, H, st.frame, 205, 110);
    R(W * 0.06, H * 0.28, W * 0.38, H * 0.42, st.glass, 30, 38); R(W * 0.56, H * 0.28, W * 0.38, H * 0.42, st.glass, 30, 38);
  } else if (kind === "kubo") {
    for (let k = 0; k < 20; k++) R((k * W) / 20, 0, 1.5, H, "#3d6b69", 90, 200);
    R(W * 0.3, H * 0.28, W * 0.4, H * 0.42, st.frame, 190, 190); R(W * 0.34, H * 0.32, W * 0.32, H * 0.34, st.glass, 110, 100);
  } else if (kind === "blank") {
    for (let k = 1; k < 4; k++) R((k * W) / 4 - 1, 0, 2, H, "#b9b4a8", 100, 230);
    R(0, H * 0.96, W, H * 0.04, st.accent, 220, 220);
  }
  if (name === "terracotta") R(0, 0, W, 6, st.band, 150, 200);
  stains(m, W, H, rnd, 5, 0.1); speckle(m, W, H, rnd, 500, 0.12); speckle(m, W, H, rnd, 200, 0.05, true);
  return (TEX["f:" + name] = pack(T));
}

function roofTex(kind) {
  if (TEX["r:" + kind]) return TEX["r:" + kind];
  const S = 128, rnd = seeded(kind.length * 977 + kind.charCodeAt(0));
  const cfg = { maroon: ["#8a2f29", "#a8413a", "#6a221e", "rib"], pinkred: ["#9c4c49", "#b3605c", "#7a3835", "rib"], redtrim: ["#8f2f2d", "#a84743", "#6e2423", "rib"], steel: ["#9aa0a3", "#b6bcbf", "#7b8184", "rib"],
    clay: ["#9a432e", "#b45a40", "#6e2f20", "tile"], thatch: ["#4b3a26", "#6a553a", "#2d2216", "thatch"], tent: ["#dcdad4", "#f1efe9", "#9b9a95", "tent"] }[kind];
  const T = triCanvas(S, S, cfg[0], 128, 175), { m, bm, rm, R } = T;
  if (cfg[3] === "rib") for (let k = 0; k < 8; k++) { const x = (k * S) / 8; R(x, 0, S / 16, S, cfg[1], 205, 130); R(x + S / 16, 0, S / 24, S, cfg[2], 60, 190); }
  if (cfg[3] === "tile") for (let r = 0; r < 8; r++) for (let c = 0; c < 6; c++) { const x = c * (S / 6) + (r % 2) * (S / 12), y = r * (S / 8); R(x + 1, y + 1, S / 6 - 2, S / 8 - 2, rnd() < 0.5 ? cfg[0] : cfg[1], 170 + rnd() * 30, 170); R(x, y + S / 8 - 3, S / 6, 3, cfg[2], 40, 200); }
  if (cfg[3] === "thatch") for (let k = 0; k < 420; k++) { const x = rnd() * S; m.strokeStyle = rnd() < 0.5 ? cfg[1] : cfg[2]; m.globalAlpha = 0.6; m.lineWidth = 1 + rnd() * 1.5; m.beginPath(); m.moveTo(x, 0); m.lineTo(x + (rnd() - 0.5) * 8, S); m.stroke(); bm.strokeStyle = rnd() < 0.5 ? "#d0d0d0" : "#303030"; bm.lineWidth = 1.5; bm.globalAlpha = 0.6; bm.beginPath(); bm.moveTo(x, 0); bm.lineTo(x, S); bm.stroke(); }
  if (cfg[3] === "tent") for (let k = 0; k < 8; k++) { const x = (k * S) / 8; R(x, 0, 3, S, cfg[2], 80, 190); }
  m.globalAlpha = 1; bm.globalAlpha = 1;
  speckle(m, S, S, rnd, 160, 0.1); stains(m, S, S, rnd, 3, 0.12);
  return (TEX["r:" + kind] = pack(T));
}

/* ---------- simple surfaces ---------- */
function surfTex(name) {
  if (TEX["s:" + name]) return TEX["s:" + name];
  const S = 256, rnd = seeded(name.length * 313 + name.charCodeAt(1) * 17);
  const P = {   // name: [base colour, roughness, speckle]
    concrete: ["#b7b3aa", 225, 900], pavement: ["#a9a79e", 238, 1200], asphalt: ["#424741", 245, 2100], track: ["#765344", 220, 900], trackMark: ["#b08a6c", 205, 240], concreteWhite: ["#dcd9d2", 215, 600], plinth: ["#7d7a73", 230, 900], trim: ["#e7e4dc", 215, 400], canopy: ["#d0ccc2", 215, 500], column: ["#cdc8be", 215, 400],
    columnred: ["#8f2a22", 200, 300], slab: ["#d9d5cc", 215, 400], ceiling: ["#8e8a84", 235, 500], soffit: ["#b8afa2", 235, 500], roofflat: ["#6f6d68", 240, 1800], stagefloor: ["#8a857c", 220, 700],
    stepconcrete: ["#a9a69f", 225, 700], seat: ["#52667a", 160, 500], coping: ["#cfcbc2", 200, 400], curb: ["#a7a49c", 230, 700], tower: ["#9b9a95", 235, 1100], obelisk: ["#ecebe5", 210, 200],
    muralwall: ["#c0604a", 225, 700], wallred: ["#a8372e", 220, 600], pylon: ["#e3e0d6", 190, 300], signplate: ["#4a4034", 150, 200], wood: ["#7a5a3a", 215, 500], darkstone: ["#3b3b39", 215, 600],
    stone: ["#8d8a80", 225, 1200], tile: ["#2f86a8", 120, 300], deckpink: ["#b97a6b", 200, 600], courtred: ["#c0562f", 215, 700], pavers: ["#a88f84", 215, 600], brick: ["#a04a38", 215, 400],
    backboard: ["#f2f2ee", 150, 100], metal: ["#8d9296", 120, 200], solar: ["#1b2a4a", 90, 100], rail: ["#7a2f27", 190, 200], whitefence: ["#f0eee8", 190, 100], door: ["#18222a", 70, 0], glassdoor: ["#18222a", 70, 0],
    skyglass: ["#1d2d38", 60, 0], water: ["#5fb6c0", 40, 0], void: ["#1c2125", 240, 0], relief: ["#3a3832", 170, 500],
  }[name] || ["#b0aca3", 225, 500];
  const SW = name === "signplate" ? 520 : S, SH = name === "signplate" ? 180 : S;
  const T = triCanvas(SW, SH, P[0], 128, P[1]), { m, bm, rm, R } = T;
  if (name === "brick") for (let r = 0; r < 16; r++) for (let c = 0; c < 16; c++) { const horiz = (r + c) % 2 === 0, x = c * 16, y = r * 16; m.fillStyle = ["#a04a38", "#8e402f", "#b05640", "#98442f"][(rnd() * 4) | 0]; if (horiz) { m.fillRect(x + 1, y + 1, 14, 6); m.fillRect(x + 1, y + 9, 14, 6); } else { m.fillRect(x + 1, y + 1, 6, 14); m.fillRect(x + 9, y + 1, 6, 14); } }
  if (name === "pavers" || name === "deckpink" || name === "tile" || name === "stepconcrete") { const n = name === "tile" ? 16 : 8, s = S / n; m.strokeStyle = name === "tile" ? "rgba(220,235,240,.5)" : "rgba(60,50,45,.35)"; m.lineWidth = 1.5; for (let k = 0; k <= n; k++) { m.beginPath(); m.moveTo(k * s, 0); m.lineTo(k * s, S); m.stroke(); m.beginPath(); m.moveTo(0, k * s); m.lineTo(S, k * s); m.stroke(); bm.strokeStyle = "#555"; bm.lineWidth = 2; bm.beginPath(); bm.moveTo(k * s, 0); bm.lineTo(k * s, S); bm.stroke(); bm.beginPath(); bm.moveTo(0, k * s); bm.lineTo(S, k * s); bm.stroke(); } }
  if (name === "stone") for (let r = 0; r < 8; r++) for (let c = 0; c < 4; c++) { const x = c * 64 + (r % 2) * 32, y = r * 32; m.strokeStyle = "rgba(40,36,30,.55)"; m.lineWidth = 2; m.strokeRect(x, y, 64, 32); bm.strokeStyle = "#444"; bm.lineWidth = 3; bm.strokeRect(x, y, 64, 32); }
  if (name === "seat") for (let k = 0; k < 16; k++) R(0, k * 16 + 12, S, 3, "#3b4c5c", 90, 190);
  if (name === "relief") for (let k = 0; k < 60; k++) { m.strokeStyle = rnd() < 0.5 ? "#8d7a52" : "#26241f"; m.lineWidth = 2 + rnd() * 5; m.beginPath(); m.moveTo(rnd() * S, rnd() * S); m.bezierCurveTo(rnd() * S, rnd() * S, rnd() * S, rnd() * S, rnd() * S, rnd() * S); m.stroke(); bm.strokeStyle = rnd() < 0.5 ? "#e0e0e0" : "#202020"; bm.lineWidth = 3 + rnd() * 5; bm.beginPath(); bm.moveTo(rnd() * S, rnd() * S); bm.bezierCurveTo(rnd() * S, rnd() * S, rnd() * S, rnd() * S, rnd() * S, rnd() * S); bm.stroke(); }
  if (name === "wallred") { R(0, 0, S, S * 0.2, "#f0ece4", 160, 220); R(0, S * 0.2, S, 4, "#7a2620", 100, 220); }
  if (name === "tower") stains(m, S, S, rnd, 22, 0.22);
  if (name === "courtred") { m.strokeStyle = "rgba(255,255,255,.7)"; m.lineWidth = 3; m.strokeRect(14, 14, S - 28, S - 28); }
  if (name === "solar") { m.strokeStyle = "#5d7aa8"; m.lineWidth = 1; for (let k = 0; k <= 6; k++) { m.beginPath(); m.moveTo((k * S) / 6, 0); m.lineTo((k * S) / 6, S); m.stroke(); m.beginPath(); m.moveTo(0, (k * S) / 6); m.lineTo(S, (k * S) / 6); m.stroke(); } }
  if (name === "signplate") { m.fillStyle = "#c9a85a"; m.textAlign = "center"; m.font = "800 62px Georgia, serif"; m.fillText("P.U.P. LINEAR PARK", SW / 2, SH / 2 - 8); m.font = "700 42px Georgia, serif"; m.fillText("2009", SW / 2, SH / 2 + 54); }
  speckle(m, SW, SH, rnd, P[2], 0.14); if (P[2] > 300) speckle(m, SW, SH, rnd, P[2] / 3, 0.06, true);
  return (TEX["s:" + name] = pack(T));
}

function letterTex(letter) {                                                      // PUP letters on the front face of each pylon slab (reference photo)
  if (TEX["l:" + letter]) return TEX["l:" + letter];
  const T = triCanvas(128, 256, "#e3e0d6", 128, 190), { m, bm } = T, rnd = seeded(letter.charCodeAt(0));
  speckle(m, 128, 256, rnd, 500, 0.1); stains(m, 128, 256, rnd, 6, 0.14);
  m.fillStyle = "#2b2a28"; m.font = "700 86px Georgia, 'Times New Roman', serif"; m.textAlign = "center"; m.textBaseline = "middle"; m.fillText(letter, 64, 70);
  bm.fillStyle = "#101010"; bm.font = m.font; bm.textAlign = "center"; bm.textBaseline = "middle"; bm.fillText(letter, 64, 70);
  return (TEX["l:" + letter] = pack(T));
}

function fenceTex() {
  if (TEX.fence) return TEX.fence;
  const c = cvs(64, 64), g = c.getContext("2d"); g.strokeStyle = "rgba(150,155,158,0.95)"; g.lineWidth = 1.6;
  for (let k = -64; k < 128; k += 8) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + 64, 64); g.stroke(); g.beginPath(); g.moveTo(k + 64, 0); g.lineTo(k, 64); g.stroke(); }
  return (TEX.fence = toTex(c, true));
}

/* ---------- context: the neoclassical Main Building north of the campus (visible in the aerial photo, not one of the 50 locations) ---------- */
FACADE.stone = { tw: 3.8, th: 4.4, wall: "#d7c59d", win: "punched", frame: "#6f5a3c", glass: "#2c353b", accent: "#eadfc0", ww: 0.42, wh: 0.62 };

/* =====================================================================
   Materials
   ===================================================================== */

/* ---------- material factory ----------
   key forms: wall:<style>  roof:<kind>  pier:#hex  parapet:#hex  <surface name> ;  `env` is a shared IBL intensity */
const ENV_INT = 0.55;

const GLASSY = new Set(["door", "glassdoor", "skyglass", "water"]);

function makeMaterial(key) {
  const [kind, arg] = key.split(":");
  const std = (o) => new THREE.MeshStandardMaterial({ vertexColors: true, envMapIntensity: ENV_INT, ...o });
  if (kind === "wall") { const t = facadeTex(arg); return std({ map: t.map, bumpMap: t.bump, bumpScale: 2.2, roughnessMap: t.rough, roughness: 1, metalness: 0 }); }
  if (kind === "roof") { const t = roofTex(arg), metal = arg === "maroon" || arg === "pinkred" || arg === "redtrim" || arg === "steel"; return std({ map: t.map, bumpMap: t.bump, bumpScale: arg === "thatch" ? 3 : 2, roughnessMap: t.rough, roughness: 1, metalness: metal ? 0.35 : 0.0, side: THREE.DoubleSide }); }
  if (kind === "pier" || kind === "parapet") return std({ color: arg, roughness: 0.82, metalness: 0 });
  if (kind === "pylonP" || kind === "pylonU") { const t = letterTex(kind === "pylonU" ? "U" : "P"); return std({ map: t.map, bumpMap: t.bump, bumpScale: 2, roughness: 0.8, metalness: 0 }); }
  if (key === "fence") return new THREE.MeshStandardMaterial({ map: fenceTex(), transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.4, vertexColors: true });
  if (key === "water") return new THREE.MeshStandardMaterial({ color: 0x5fb6c0, transparent: true, opacity: 0.82, roughness: 0.05, metalness: 0.05, envMapIntensity: 1.5, vertexColors: true });
  const t = surfTex(key);
  const glassy = GLASSY.has(key);
  return std({ map: t.map, bumpMap: t.bump, bumpScale: key === "stone" || key === "relief" || key === "brick" ? 3 : 1.6, roughnessMap: t.rough, roughness: 1, metalness: key === "metal" || key === "solar" ? 0.55 : glassy ? 0.35 : 0, envMapIntensity: glassy ? 1.3 : ENV_INT });
}

const MAT_CACHE = {};

const materialFor = (key) => MAT_CACHE[key] || (MAT_CACHE[key] = makeMaterial(key));

/* =====================================================================
   Geometry builder
   ===================================================================== */

function addWhiteVertexColors(geometry) {
  const count = geometry.getAttribute("position").count;
  const colors = new Float32Array(count * 3);
  colors.fill(1);
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geometry;
}

/* ---------- MeshBuilder: plain-array geometry, merged per material key ---------- */
class MeshBuilder {
  constructor() { this.g = {}; this.place(0, 0, 0); }
  place(x, z, deg) { const a = (deg * Math.PI) / 180; this.ox = x; this.oz = z; this.c = Math.cos(a); this.s = Math.sin(a); return this; }
  _w(lx, lz) { return [this.ox + lx * this.c - lz * this.s, this.oz + lx * this.s + lz * this.c]; }
  _grp(k) { return this.g[k] || (this.g[k] = { p: [], n: [], u: [], c: [], i: [] }); }
  quad(key, a, b, c, d, uv, col) {
    const G = this._grp(key), base = G.p.length / 3;
    const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], ad = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
    let n = [ab[1] * ad[2] - ab[2] * ad[1], ab[2] * ad[0] - ab[0] * ad[2], ab[0] * ad[1] - ab[1] * ad[0]];
    const l = Math.hypot(n[0], n[1], n[2]);
    if (l < 1e-9) return;
    n = [n[0] / l, n[1] / l, n[2] / l];
    const nx = n[0] * this.c - n[2] * this.s, nz = n[0] * this.s + n[2] * this.c;
    [a, b, c, d].forEach((v, k) => {
      const w = this._w(v[0], v[2]);
      G.p.push(w[0], v[1], w[1]); G.n.push(nx, n[1], nz);
      G.u.push(uv[k][0], uv[k][1]);
      const cc = Array.isArray(col) ? col[k] : [col ?? 1, col ?? 1, col ?? 1];
      G.c.push(cc[0], cc[1], cc[2]);
    });
    G.i.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  tri(key, a, b, c, uv, col) { this.quad(key, a, b, c, c, [uv[0], uv[1], uv[2], uv[2]], col); this._dropDegenerate(key); }
  _dropDegenerate(key) { const G = this.g[key]; if (!G) return; G.i.length -= 3; }      // quad() pushed 2 tris; keep only the first
  /* vertical wall from (x0,z0) to (x1,z1); outward normal = (-dz, 0, dx). AO darkens the bottom 2.5 m. */
  wall(key, x0, z0, x1, z1, y0, y1, tw, th, o = {}) {
    const len = Math.hypot(x1 - x0, z1 - z0), uo = (o.uo || 0) / tw, u1 = uo + len / tw;
    const ao = o.ao ?? 0.74, band = Math.min(2.5, y1 - y0);
    const rows = ao < 1 && y1 - y0 > 0.01 ? [[y0, y0 + band, ao, 1], [y0 + band, y1, 1, 1]] : [[y0, y1, 1, 1]];
    rows.forEach(([ya, yb, ca, cb]) => {
      if (yb - ya < 1e-4) return;
      this.quad(key, [x0, ya, z0], [x1, ya, z1], [x1, yb, z1], [x0, yb, z0],
        [[uo, (ya - y0) / th + (o.vo || 0)], [u1, (ya - y0) / th + (o.vo || 0)], [u1, (yb - y0) / th + (o.vo || 0)], [uo, (yb - y0) / th + (o.vo || 0)]],
        [[ca, ca, ca], [ca, ca, ca], [cb, cb, cb], [cb, cb, cb]]);
    });
  }
  top(key, x0, z0, x1, z1, y, tw, th, col) {                                   // upward face of an axis-aligned rect
    this.quad(key, [x0, y, z0], [x0, y, z1], [x1, y, z1], [x1, y, z0], [[x0 / tw, z0 / th], [x0 / tw, z1 / th], [x1 / tw, z1 / th], [x1 / tw, z0 / th]], col ?? 1);
  }
  bottom(key, x0, z0, x1, z1, y, tw, th) {
    this.quad(key, [x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1], [[x0 / tw, z0 / th], [x1 / tw, z0 / th], [x1 / tw, z1 / th], [x0 / tw, z1 / th]], 0.7);
  }
  /* box: keys = {wall, top} (or a single string). Walls run S, E, N, W. */
  box(keys, cx, cz, w, d, y0, y1, tw = 4, th = 3.4, o = {}) {
    const k = typeof keys === "string" ? { wall: keys, top: keys } : keys;
    const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2;
    this.wall(k.wall, x0, z1, x1, z1, y0, y1, tw, th, o);
    this.wall(k.wall, x1, z1, x1, z0, y0, y1, tw, th, { ...o, uo: (o.uo || 0) + w });
    this.wall(k.wall, x1, z0, x0, z0, y0, y1, tw, th, { ...o, uo: (o.uo || 0) + w + d });
    this.wall(k.wall, x0, z0, x0, z1, y0, y1, tw, th, { ...o, uo: (o.uo || 0) + 2 * w + d });
    if (!o.noTop) this.top(k.top ?? k.wall, x0, z0, x1, z1, y1, o.rtw || tw, o.rth || th);
  }
  /* hip roof; ridge runs along local x (alongX) or z. Slope faces get u along the eave, v up the slope. */
  hipRoof(key, cx, cz, w, d, y0, rise, ov = 0.8, alongX = d <= w, tile = 1.2, soffitKey) {
    const W = (alongX ? w : d) / 2 + ov, D = (alongX ? d : w) / 2 + ov, ridge = Math.max(W - D, 0);
    const map = alongX ? (u, v) => [cx + u, cz + v] : (u, v) => [cx - v, cz + u];
    const P = (u, y, v) => { const m = map(u, v); return [m[0], y, m[1]]; };
    const sl = Math.hypot(D, rise), y1 = y0 + rise;
    const slopeUV = [[0, 0], [(2 * W) / tile, 0], [(2 * W + 2 * ridge) / 2 / tile, sl / tile], [(2 * W - 2 * ridge) / 2 / tile, sl / tile]];
    this.quad(key, P(-W, y0, D), P(W, y0, D), P(ridge, y1, 0), P(-ridge, y1, 0), slopeUV, 1);        // south slope
    this.quad(key, P(W, y0, -D), P(-W, y0, -D), P(-ridge, y1, 0), P(ridge, y1, 0), slopeUV, 1);      // north slope
    const ends = [[P(W, y0, D), P(W, y0, -D), P(ridge, y1, 0)], [P(-W, y0, -D), P(-W, y0, D), P(-ridge, y1, 0)]];
    ends.forEach(([a, b, c]) => this.tri(key, a, b, c, [[0, 0], [2 * D / tile, 0], [D / tile, sl / tile]], 1));
    const sk = soffitKey || key;
    this.quad(sk, P(-W, y0, -D), P(W, y0, -D), P(W, y0, D), P(-W, y0, D), [[0, 0], [2 * W / tile, 0], [2 * W / tile, 2 * D / tile], [0, 2 * D / tile]], 0.55);
    return y1;
  }
  /* barrel (arched) roof; axis along local x, arc across z; chord = wid, sagitta = rise */
  barrel(key, cx, cz, len, wid, y0, rise, segs = 16, tile = 1.2, endKey) {
    const R = (wid * wid / 4 + rise * rise) / (2 * rise), yc = y0 + rise - R, L = len / 2;
    const pt = (t) => { const z = -wid / 2 + (wid * t) / segs; return [z, yc + Math.sqrt(Math.max(R * R - z * z, 0))]; };
    let arc = 0;
    for (let t = 0; t < segs; t++) {
      const [z0, h0] = pt(t), [z1, h1] = pt(t + 1), seg = Math.hypot(z1 - z0, h1 - h0);
      this.quad(key, [cx - L, h0, cz + z0], [cx - L, h1, cz + z1], [cx + L, h1, cz + z1], [cx + L, h0, cz + z0],
        [[0, arc / tile], [0, (arc + seg) / tile], [len / tile, (arc + seg) / tile], [len / tile, arc / tile]], 1);
      arc += seg;
      const ek = endKey || key;
      this.quad(ek, [cx + L, y0, cz + z1], [cx + L, y0, cz + z0], [cx + L, h0, cz + z0], [cx + L, h1, cz + z1], [[z1 / tile, 0], [z0 / tile, 0], [z0 / tile, (h0 - y0) / tile], [z1 / tile, (h1 - y0) / tile]], 0.9);
      this.quad(ek, [cx - L, y0, cz + z0], [cx - L, y0, cz + z1], [cx - L, h1, cz + z1], [cx - L, h0, cz + z0], [[z0 / tile, 0], [z1 / tile, 0], [z1 / tile, (h1 - y0) / tile], [z0 / tile, (h0 - y0) / tile]], 0.9);
    }
  }
  /* cylinder / truncated cone (outward normals); capTop adds a lid */
  cyl(key, cx, cz, r0, r1, y0, y1, segs = 16, tile = 2, capTop = true, col = 1, ao = 0, inward = false) {
    for (let k = 0; k < segs; k++) {
      const a0 = (k / segs) * Math.PI * 2 + ao, a1 = ((k + 1) / segs) * Math.PI * 2 + ao;
      const p = (a, r, y) => [cx + Math.cos(a) * r, y, cz + Math.sin(a) * r];
      const u0 = (a0 * r0) / tile, u1 = (a1 * r0) / tile;
      if (inward) this.quad(key, p(a0, r0, y0), p(a1, r0, y0), p(a1, r1, y1), p(a0, r1, y1), [[u0, 0], [u1, 0], [u1, (y1 - y0) / tile], [u0, (y1 - y0) / tile]], col);
      else this.quad(key, p(a1, r0, y0), p(a0, r0, y0), p(a0, r1, y1), p(a1, r1, y1), [[u1, 0], [u0, 0], [u0, (y1 - y0) / tile], [u1, (y1 - y0) / tile]], col);
    }
    if (capTop && r1 > 0.001) for (let k = 0; k < segs; k++) {
      const a0 = (k / segs) * Math.PI * 2 + ao, a1 = ((k + 1) / segs) * Math.PI * 2 + ao;
      this.tri(key, [cx, y1, cz], [cx + Math.cos(a1) * r1, y1, cz + Math.sin(a1) * r1], [cx + Math.cos(a0) * r1, y1, cz + Math.sin(a0) * r1], [[0.5, 0.5], [0.5 + Math.cos(a1) * 0.5, 0.5 + Math.sin(a1) * 0.5], [0.5 + Math.cos(a0) * 0.5, 0.5 + Math.sin(a0) * 0.5]], col);
    }
  }
  /* sloped slab: top plane rises from yLow (south edge, +z) to yHigh (north edge), with thickness */
  slab(key, cx, cz, w, d, yLow, yHigh, th = 0.25, tile = 2) {
    const x0 = cx - w / 2, x1 = cx + w / 2, zs = cz + d / 2, zn = cz - d / 2;
    const a = [x0, yLow, zs], b = [x1, yLow, zs], c = [x1, yHigh, zn], e = [x0, yHigh, zn];
    const dn = (p) => [p[0], p[1] - th, p[2]];
    const uv = [[0, 0], [w / tile, 0], [w / tile, d / tile], [0, d / tile]];
    this.quad(key, e, a, b, c, [[0, d / tile], [0, 0], [w / tile, 0], [w / tile, d / tile]], 1);                      // top
    this.quad(key, dn(a), dn(e), dn(c), dn(b), uv, 0.6);                                                               // bottom
    this.quad(key, dn(a), dn(b), b, a, [[0, 0], [w / tile, 0], [w / tile, th / tile], [0, th / tile]], 0.9);           // south edge
    this.quad(key, dn(c), dn(e), e, c, [[0, 0], [w / tile, 0], [w / tile, th / tile], [0, th / tile]], 0.9);           // north edge
    this.quad(key, dn(b), dn(c), c, b, [[0, 0], [d / tile, 0], [d / tile, th / tile], [0, th / tile]], 0.9);           // east edge
    this.quad(key, dn(e), dn(a), a, e, [[0, 0], [d / tile, 0], [d / tile, th / tile], [0, th / tile]], 0.9);           // west edge
  }
  /* regular n-gon pyramid (ribbed roof / spire) */
  pyramid(key, cx, cz, r, y0, y1, n = 8, tile = 2, col = 1, ao = 0) {
    for (let k = 0; k < n; k++) {
      const a0 = (k / n) * Math.PI * 2 + ao, a1 = ((k + 1) / n) * Math.PI * 2 + ao;
      this.tri(key, [cx + Math.cos(a1) * r, y0, cz + Math.sin(a1) * r], [cx + Math.cos(a0) * r, y0, cz + Math.sin(a0) * r], [cx, y1, cz],
        [[1, 0], [0, 0], [0.5, 1]].map(([u, v]) => [u * (r * 2 * Math.sin(Math.PI / n)) / tile, v * Math.hypot(r, y1 - y0) / tile]), col);
    }
  }
  /* flat circular / elliptical disc facing up */
  disc(key, cx, cz, rx, rz, y, segs = 28, tile = 3, col = 1) {
    for (let k = 0; k < segs; k++) {
      const a0 = (k / segs) * Math.PI * 2, a1 = ((k + 1) / segs) * Math.PI * 2;
      this.tri(key, [cx, y, cz], [cx + Math.cos(a1) * rx, y, cz + Math.sin(a1) * rz], [cx + Math.cos(a0) * rx, y, cz + Math.sin(a0) * rz],
        [[cx / tile, cz / tile], [(cx + Math.cos(a1) * rx) / tile, (cz + Math.sin(a1) * rz) / tile], [(cx + Math.cos(a0) * rx) / tile, (cz + Math.sin(a0) * rz) / tile]], col);
    }
  }
  ring(key, cx, cz, rIn, rOut, y, segs = 32, tile = 2, col = 1) {
    for (let k = 0; k < segs; k++) {
      const a0 = (k / segs) * Math.PI * 2, a1 = ((k + 1) / segs) * Math.PI * 2;
      const P = (a, r) => [cx + Math.cos(a) * r, y, cz + Math.sin(a) * r];
      this.quad(key, P(a0, rIn), P(a1, rIn), P(a1, rOut), P(a0, rOut), [[0, 0], [0, 1], [1, 1], [1, 0]].map(([u, v]) => [(cx + u * 2) / tile, (cz + v * 2) / tile]), col);
    }
  }
  /* merge result as plain arrays (scaled to world units by `scale`) */
  arrays(scale = 1) {
    const out = {};
    Object.entries(this.g).forEach(([k, G]) => { out[k] = { p: G.p.map((v) => v * scale), n: G.n, u: G.u, c: G.c, i: G.i }; });
    return out;
  }
}

/* ---------- geometry helpers ---------- */
function makeGeo(G) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(G.p), 3));
  geo.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(G.n), 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(G.u), 2));
  geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(G.c), 3));
  geo.setIndex(new THREE.BufferAttribute(G.p.length / 3 > 65535 ? new Uint32Array(G.i) : new Uint16Array(G.i), 1));
  geo.computeBoundingSphere();
  return geo;
}

function mergeInto(dst, key, G) {
  const D = dst[key] || (dst[key] = { p: [], n: [], u: [], c: [], i: [] }), off = D.p.length / 3;
  for (let k = 0; k < G.p.length; k++) D.p.push(G.p[k]);
  for (let k = 0; k < G.n.length; k++) D.n.push(G.n[k]);
  for (let k = 0; k < G.u.length; k++) D.u.push(G.u[k]);
  for (let k = 0; k < G.c.length; k++) D.c.push(G.c[k]);
  for (let k = 0; k < G.i.length; k++) D.i.push(G.i[k] + off);
}

/* =====================================================================
   Buildings and landmarks
   ===================================================================== */

const FH = 3.4;

// typical storey height (m)

/* ---------- block (multi-storey / low-rise) generator ---------- */
function blockDims(p) {
  const minD = p.minD ?? (p.floors >= 3 ? 10 : 6.5);
  return [Math.max(p.w * METERS_PER_PX, p.minW ?? 6), Math.max(p.d * METERS_PER_PX, minD)];
}

function buildBlock(b, p, seed = 1) {
  const rnd = seeded(seed * 7919 + (p.cx | 0));
  const [x, z] = pxToM(p.cx, p.cy);
  const [W, D] = blockDims(p);
  const st = FACADE[p.style], fh = p.fh || st.th, tw = st.tw, th = fh;
  const y0 = p.pilotis ? fh : 0, H = p.floors * fh + (p.extraH || 0);
  const wallKey = "wall:" + p.style;
  const hex = (n) => (n === "accent" ? st.accent : n === "red" ? "#8f2a22" : n === "white" ? "#f4efe6" : n || st.accent);
  b.place(x, z, p.rot || 0);
  b.box({ wall: "plinth", top: "plinth" }, 0, 0, W + 0.5, D + 0.5, 0, 0.55, 3, 3, { ao: 1 });
  if (p.pilotis) {
    b.bottom("ceiling", -W / 2, -D / 2, W / 2, D / 2, y0, 3, 3);
    for (let cx = -W / 2 + 1; cx <= W / 2 - 0.9; cx += Math.max(W / Math.round(W / 5), 3)) {
      b.box("column", cx, D / 2 - 1.2, 0.55, 0.55, 0, y0, 1, 1, { ao: 1 });
      b.box("column", cx, -D / 2 + 1.2, 0.55, 0.55, 0, y0, 1, 1, { ao: 1 });
    }
    b.box("glassdoor", 0, 0, W * 0.35, D * 0.6, 0, y0 - 0.2, 3, 3, { noTop: true, ao: 1 });
  }
  b.box({ wall: wallKey, top: "roofflat" }, 0, 0, W, D, y0, H, tw, th, { noTop: true, uo: p.uo || 0, vo: 0 });
  // storey slab bands + optional accent band
  if (p.bands !== false && p.floors > 1) for (let f = 1; f < p.floors; f++) b.box("trim", 0, 0, W + 0.28, D + 0.28, f * fh - 0.14, f * fh + 0.14, 2, 1, { ao: 1 });
  b.box("trim", 0, 0, W + 0.5, D + 0.5, H - 0.1, H + 0.32, 2, 1, { ao: 1 });                         // cornice / roof edge beam
  // pilasters (corner / bay piers)
  if (p.pilasters) {
    const pw = p.pilasters.w || 0.7, key = "pier:" + hex(p.pilasters.color), step = p.pilasters.every || 0;
    const xs = [-W / 2 + pw / 2, W / 2 - pw / 2];
    if (step) for (let px = -W / 2 + step; px < W / 2 - step / 2; px += step) xs.push(px);
    xs.forEach((px) => { b.box(key, px, D / 2 + 0.08, pw, 0.3, y0, H, 1, 1, { ao: 0.8 }); b.box(key, px, -D / 2 - 0.08, pw, 0.3, y0, H, 1, 1, { ao: 0.8 }); });
  }
  // balconies / corridors on the south (front) facade
  if (p.balcony) {
    const bw = W - 1.0, by = D / 2 + (p.balcony.depth || 1.5) / 2;
    for (let f = 1; f < p.floors; f++) {
      b.box("slab", 0, by, bw, p.balcony.depth || 1.5, f * fh - 0.28, f * fh, 2, 2, { ao: 1 });
      b.box("rail", 0, D / 2 + (p.balcony.depth || 1.5) - 0.04, bw, 0.08, f * fh, f * fh + 0.95, 2, 1, { ao: 1 });
    }
  }
  if (p.balconyBack) for (let f = 1; f < p.floors; f++) b.box("slab", 0, -D / 2 - 0.7, W - 1, 1.4, f * fh - 0.25, f * fh, 2, 2, { ao: 1 });
  // entrance: recessed-looking glazed door, steps, canopy on two columns
  if (p.entrance) {
    const e = p.entrance, ex = (e.x || 0) * (W / 2 - 3), ew = e.w || 3.2, eh = Math.min(fh - 0.6, 3.0);
    const zf = D / 2;
    b.box("door", ex, zf + 0.07, ew, 0.14, y0, y0 + eh, 2, 2, { noTop: true, ao: 1 });
    b.box("trim", ex, zf + 0.1, ew + 0.4, 0.2, y0 + eh, y0 + eh + 0.35, 2, 1, { ao: 1 });
    b.box("concrete", ex, zf + 1.2, ew + 1.6, 1.6, 0, 0.32, 2, 2, { ao: 1 });
    b.box("concrete", ex, zf + 1.45, ew + 1.0, 1.0, 0.32, 0.55, 2, 2, { ao: 1 });
    if (e.canopy !== false) {
      b.box("canopy", ex, zf + 1.9, ew + 2.4, 3.0, y0 + eh + 0.35, y0 + eh + 0.6, 2, 2, { ao: 1 });
      [-1, 1].forEach((s) => b.box("column", ex + s * (ew / 2 + 0.7), zf + 3.2, 0.32, 0.32, 0, y0 + eh + 0.35, 1, 1, { ao: 0.85 }));
    }
  }
  // roofs
  const r = p.roof || { type: "flat" };
  let top = H + 0.32;
  if (r.type === "hip") {
    const rise = r.rise ?? Math.min(D * 0.28, 3.4), ov = r.ov ?? 0.9, rk = "roof:" + (r.mat || "maroon");
    top = b.hipRoof(rk, 0, 0, W, D, H + 0.3, rise, ov, undefined, 1.2, "soffit");
    if (r.skylight) {                                                  // glazed ridge strip (north wing of the Main Academic Building)
      const sx = Math.max(W - D, 4) * 0.42;
      b.box("skyglass", 0, 0, 0.9, Math.max(W, D) * 0.5, top - 0.06, top + 0.5, 2, 2, { noTop: false, ao: 1 });
      void sx;
    }
  } else if (r.type === "barrel") {
    top = H + r.rise;
    b.barrel("roof:" + (r.mat || "maroon"), 0, 0, W, D, H, r.rise, 16, 1.2, wallKey);
  } else {                                                              // flat roof: membrane, parapet, plant
    b.top("roofflat", -W / 2, -D / 2, W / 2, D / 2, H + 0.3, 3, 3);
    const ph = r.parapet ?? 0.9, pk = "parapet:" + hex(r.parapetColor);
    b.box(pk, 0, D / 2 - 0.15, W, 0.3, H + 0.3, H + 0.3 + ph, 3, 1, { ao: 1 });
    b.box(pk, 0, -D / 2 + 0.15, W, 0.3, H + 0.3, H + 0.3 + ph, 3, 1, { ao: 1 });
    b.box(pk, W / 2 - 0.15, 0, 0.3, D - 0.6, H + 0.3, H + 0.3 + ph, 3, 1, { ao: 1 });
    b.box(pk, -W / 2 + 0.15, 0, 0.3, D - 0.6, H + 0.3, H + 0.3 + ph, 3, 1, { ao: 1 });
    top = H + 0.3 + ph;
    if (r.inner) {                                                       // inset maroon hip inside the parapet (Ninoy Aquino LRC)
      const iw = W - 5, id = D - 5;
      if (iw > 4 && id > 3) top = Math.max(top, b.hipRoof("roof:maroon", 0, 0, iw, id, H + 0.3, Math.min(id * 0.3, 2.4), 0.4, undefined, 1.2, "soffit"));
    }
    if (r.lightwells) {                                                  // rooftop openings of the rear block (Main Academic Building)
      const n = r.lightwells, lw = Math.min((W - 8) / n, 14);
      for (let k = 0; k < n; k++) {
        const lx = -W / 2 + (W / (n + 1)) * (k + 1), lz = 0;
        b.box("void", lx, lz, lw * 0.55, D * 0.42, H + 0.3, H + 0.34, 2, 2, { ao: 1 });
        b.box("parapet:" + hex("accent"), lx, lz + D * 0.21, lw * 0.55 + 0.4, 0.25, H + 0.3, H + 1.3, 2, 1, { ao: 1 });
        b.box("parapet:" + hex("accent"), lx, lz - D * 0.21, lw * 0.55 + 0.4, 0.25, H + 0.3, H + 1.3, 2, 1, { ao: 1 });
        b.box("parapet:" + hex("accent"), lx + lw * 0.275, lz, 0.25, D * 0.42, H + 0.3, H + 1.3, 2, 1, { ao: 1 });
        b.box("parapet:" + hex("accent"), lx - lw * 0.275, lz, 0.25, D * 0.42, H + 0.3, H + 1.3, 2, 1, { ao: 1 });
      }
    }
    if (r.solar) {                                                       // PV array on the flat roof (visible in the aerial photo)
      const cols = Math.floor((W - 6) / 2.4), rows = Math.max(1, Math.floor((D - 5) / 3.0));
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) b.box("solar", -W / 2 + 3.3 + i * 2.4, -D / 2 + 3.2 + j * 3.0, 2.1, 2.5, H + 0.45, H + 0.52, 1, 1, { ao: 1 });
    }
    if (r.plant !== false) {                                             // stair head, water tank, a few AC units (deterministic per building)
      b.box("concrete", -W / 2 + 3.5 + rnd() * (W - 8), (rnd() - 0.5) * (D - 4), 3.2, 3.0, H + 0.3, H + 3.0, 3, 3, { ao: 1 });
      const tx = -W / 2 + 3 + rnd() * (W - 6);
      b.cyl("metal", tx, (rnd() - 0.5) * (D - 5), 0.9, 0.9, H + 0.3, H + 2.0, 12, 2, true);
      for (let k = 0; k < 3; k++) b.box("metal", -W / 2 + 2 + rnd() * (W - 4), (rnd() - 0.5) * (D - 3), 1.2, 0.8, H + 0.3, H + 1.2, 1, 1, { ao: 1 });
      top = Math.max(top, H + 3.0);
    }
  }
  return { topY: top, cx: x, cz: z, rot: p.rot || 0, w: W, d: D, h: H };
}

/* ---------- landmark / special-structure builders (metres, local frame at the marker) ---------- */
const at = (b, px, py, rot = 0) => { const [x, z] = pxToM(px, py); b.place(x, z, rot); return [x, z]; };

function fenceRun(b, x0, z0, x1, z1, h = 2.6, postGap = 3) {                    // chain-link style fence: posts + mesh quad (alpha-tested texture)
  const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(len / postGap));
  for (let k = 0; k <= n; k++) { const t = k / n; b.box("metal", x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, 0.09, 0.09, 0, h, 1, 1, { noTop: false, ao: 1 }); }
  b.quad("fence", [x0, 0.1, z0], [x1, 0.1, z1], [x1, h, z1], [x0, h, z0], [[0, 0], [len / 1.5, 0], [len / 1.5, h / 1.5], [0, h / 1.5]], 1);
  b.quad("fence", [x1, 0.1, z1], [x0, 0.1, z0], [x0, h, z0], [x1, h, z1], [[0, 0], [len / 1.5, 0], [len / 1.5, h / 1.5], [0, h / 1.5]], 1);
}

function railRun(b, x0, z0, x1, z1, h = 1.15, postGap = 3.2) {                  // white post-and-rail fence (oval track)
  const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(len / postGap)), dx = (x1 - x0) / len, dz = (z1 - z0) / len;
  for (let k = 0; k <= n; k++) b.box("whitefence", x0 + (x1 - x0) * (k / n), z0 + (z1 - z0) * (k / n), 0.14, 0.14, 0, h, 1, 1, { ao: 1 });
  [0.55, 0.95].forEach((yy) => {
    const nx = -dz * 0.04, nz = dx * 0.04;
    b.quad("whitefence", [x0 - nx, yy - 0.04, z0 - nz], [x1 - nx, yy - 0.04, z1 - nz], [x1 + nx, yy + 0.04, z1 + nz], [x0 + nx, yy + 0.04, z0 + nz], [[0, 0], [1, 0], [1, 1], [0, 1]], 1);
    b.quad("whitefence", [x1 + nx, yy - 0.04, z1 + nz], [x0 + nx, yy - 0.04, z0 + nz], [x0 - nx, yy + 0.04, z0 - nz], [x1 - nx, yy + 0.04, z1 - nz], [[0, 0], [1, 0], [1, 1], [0, 1]], 1);
  });
}

function courtFence(b, w, d, h = 3.0) {
  const hw = w / 2, hd = d / 2;
  fenceRun(b, -hw, hd, hw, hd, h); fenceRun(b, hw, hd, hw, -hd, h); fenceRun(b, hw, -hd, -hw, -hd, h); fenceRun(b, -hw, -hd, -hw, hd, h);
}

function hoop(b, x, z, facing) {                                              // basketball goal: pole, backboard, rim
  b.box("metal", x, z, 0.16, 0.16, 0, 3.4, 1, 1, { ao: 1 });
  b.box("backboard", x - facing * 0.55, z, 0.06, 1.8, 2.6, 3.65, 1, 1, { ao: 1 });
  b.cyl("metal", x - facing * 0.9, z, 0.23, 0.23, 3.02, 3.06, 10, 1, false);
}

function buildSpecial(b, id) {
  switch (id) {
    case 1: {                                                                       // The Pylon: three adjacent concrete slabs, relative heights from the photo
      at(b, 1294, 678, -18);
      b.box("plinth", 0, 0, 7.6, 3.8, 0, 0.5, 3, 3, { ao: 1 });
      const hs = [7.6, 7.4, 7.0], names = ["pylonP", "pylonU", "pylonP"];
      hs.forEach((h, k) => {
        const cx = (k - 1) * 1.88, w = 1.8, d = 1.6;
        b.wall("pylon", cx + w / 2, d / 2, cx + w / 2, -d / 2, 0.5, h, 3, 3);        // east side (swap order: outward = +x)
        b.wall("pylon", cx - w / 2, -d / 2, cx - w / 2, d / 2, 0.5, h, 3, 3);        // west side
        b.wall("pylon", cx + w / 2, -d / 2, cx - w / 2, -d / 2, 0.5, h, 3, 3);       // back
        b.top("pylon", cx - w / 2, -d / 2, cx + w / 2, d / 2, h, 3, 3);
        b.quad(names[k], [cx - w / 2, 0.5, d / 2], [cx + w / 2, 0.5, d / 2], [cx + w / 2, h, d / 2], [cx - w / 2, h, d / 2], [[0, 0], [1, 0], [1, (h - 0.5) / 7.6], [0, (h - 0.5) / 7.6]], [[0.8, 0.8, 0.8], [0.8, 0.8, 0.8], [1, 1, 1], [1, 1, 1]]);
      });
      return { topY: 7.9 };
    }
    case 2: {                                                                       // The Mural: terracotta wall carrying a bronze relief band
      at(b, 1205, 699, -18);
      b.box("plinth", 0, 0, 10.6, 0.8, 0, 0.35, 3, 3, { ao: 1 });
      b.box({ wall: "muralwall", top: "concrete" }, 0, 0, 10.2, 0.5, 0.35, 3.1, 3, 3, { ao: 0.8 });
      b.box("relief", 0, 0.3, 9.0, 0.14, 0.9, 2.5, 3, 3, { noTop: false, ao: 1 });
      return { topY: 3.4 };
    }
    case 3: case 7: case 9: return null;                                            // handled as blocks
    case 8: {                                                                       // Mabini Shrine: raised teal bahay-kubo with steep thatched hip roof
      at(b, 835, 489, 0);
      [[-2.6, -2.0], [2.6, -2.0], [-2.6, 2.0], [2.6, 2.0], [0, -2.0], [0, 2.0]].forEach(([x, z]) => b.cyl("wood", x, z, 0.13, 0.13, 0, 1.45, 8, 2, true));
      b.box("wood", 0, 0, 6.4, 5.2, 1.4, 1.6, 2, 2, { ao: 1 });
      b.box({ wall: "wall:kubo", top: "wood" }, 0, 0, 5.6, 4.4, 1.6, 4.0, 2.0, 2.4, { noTop: true, ao: 1 });
      b.hipRoof("roof:thatch", 0, 0, 5.6, 4.4, 4.0, 4.6, 1.2, true, 1.2, "soffit");
      for (let k = 0; k < 4; k++) b.box("wood", 0, 2.9 + (3 - k) * 0.32, 1.6, 0.34, 0, 0.4 * (k + 1), 1, 1, { ao: 1 });
      b.box("concrete", 5.2, 3.2, 1.0, 1.0, 0, 1.35, 1, 1, { ao: 1 });               // white pedestal beside the house (reference photo)
      return { topY: 8.6 };
    }
    case 10: {                                                                      // Obelisk on a circular stepped platform, with flagpole (reference photo)
      at(b, 886, 452, 0);
      b.cyl("concrete", 0, 0, 5.0, 5.0, 0, 0.3, 28, 3, true); b.cyl("concrete", 0, 0, 4.2, 4.2, 0.3, 0.62, 28, 3, true);
      b.box("concrete", 0, 0, 1.8, 1.8, 0.62, 1.4, 2, 2, { ao: 1 });
      b.cyl("obelisk", 0, 0, 0.62, 0.26, 1.4, 11.4, 4, 3, false, 1, Math.PI / 4);
      b.pyramid("obelisk", 0, 0, 0.26 * 1.0, 11.4, 12.2, 4, 3, 1, Math.PI / 4);
      b.cyl("metal", 3.0, -0.6, 0.06, 0.05, 0.62, 12.0, 8, 1, true);
      return { topY: 12.4 };
    }
    case 11: {                                                                      // Freedom Park: herringbone brick plaza with concrete benches (reference photo)
      at(b, 683, 473, 8);
      b.box({ wall: "concrete", top: "brick" }, 0, 0, 15, 8, 0, 0.14, 3, 3, { ao: 1, rtw: 2.4, rth: 2.4 });
      [[-4.5, 3.3, 0], [4.5, 3.3, 0], [-4.5, -3.3, Math.PI], [4.5, -3.3, Math.PI]].forEach(([x, z]) => b.box("concrete", x, z, 1.9, 0.5, 0.14, 0.56, 1, 1, { ao: 1 }));
      return { topY: 0.6 };
    }
    case 12: {                                                                      // Fountain Park: stone-rimmed circular tile pool with dark stone sculptures
      at(b, 566, 512, 0);
      b.cyl("stone", 0, 0, 5.4, 5.4, 0, 1.0, 36, 2, false);
      b.ring("stone", 0, 0, 4.3, 5.4, 1.0, 36, 2);
      b.cyl("stone", 0, 0, 4.3, 4.3, 0.55, 1.0, 36, 2, false, 1, 0, true);
      b.disc("tile", 0, 0, 4.3, 4.3, 0.55, 36, 2);
      [[-0.9, 0.2, 3.2], [0.2, -0.5, 2.8], [1.0, 0.5, 2.4]].forEach(([x, z, h]) => b.box("darkstone", x, z, 0.9, 0.7, 0.55, 0.55 + h, 1, 1, { ao: 1 }));
      return { topY: 3.6 };
    }
    case 13: {                                                                      // Inter Faith Chapel: octagonal ribbed tent roof with spire + low entrance canopy (aerial)
      at(b, 330, 480, 0);
      b.cyl("plinth", 0, 0, 12.8, 12.8, 0, 0.5, 8, 3, true, 1, Math.PI / 8);
      b.cyl("wall:whitehall", 0, 0, 11.2, 11.2, 0.5, 3.4, 8, 5.0, false, 1, Math.PI / 8);
      b.pyramid("roof:tent", 0, 0, 11.9, 3.4, 14.2, 8, 2.4, 1, Math.PI / 8);
      b.cyl("metal", 0, 0, 0.22, 0.05, 14.2, 17.0, 8, 2, true);
      b.place(...pxToM(363, 519), 0);
      b.box("canopy", 0, 0, 9, 4.5, 3.6, 3.95, 3, 3, { ao: 1 });
      [[-3.6, -1.6], [3.6, -1.6], [-3.6, 1.6], [3.6, 1.6]].forEach(([x, z]) => b.box("column", x, z, 0.3, 0.3, 0, 3.6, 1, 1, { ao: 1 }));
      return { topY: 17.2, anchorY: 4.2 };
    }
    case 15: {                                                                      // Gazebo: open hexagonal pavilion
      at(b, 116, 436, 0);
      b.cyl("concrete", 0, 0, 3.2, 3.2, 0, 0.28, 6, 2, true);
      for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; b.box("column", Math.cos(a) * 2.5, Math.sin(a) * 2.5, 0.22, 0.22, 0.28, 2.9, 1, 1, { ao: 1 }); }
      b.pyramid("roof:maroon", 0, 0, 3.8, 2.9, 4.7, 6, 1.2, 1);
      return { topY: 4.9 };
    }
    case 16: {                                                                      // Grandstand: raked seating tiers under a long cantilevered canopy (reference photo)
      const [x, z] = at(b, 718, 545, 2);
      const L = 40, Dp = 10;
      for (let t = 0; t < 7; t++) b.box({ wall: "seat", top: "seat" }, 0, Dp / 2 - 0.7 - t * 1.05, L, 1.05, 0, 0.45 * (t + 1), 3, 3, { ao: 0.85 });
      b.box({ wall: "wall:whitehall", top: "concrete" }, 0, -Dp / 2 + 0.3, L, 0.6, 0, 5.6, 5, 4, { ao: 0.8 });
      for (let c = -L / 2 + 2; c <= L / 2 - 1; c += 5) b.box("column", c, -Dp / 2 + 2.6, 0.4, 0.4, 3.2, 6.2, 1, 1, { ao: 1 });
      b.slab("roof:maroon", 0, -0.2, L + 1.2, Dp + 0.8, 5.9, 6.8, 0.3, 2.4);
      b.box("concrete", 0, Dp / 2 + 0.4, L, 0.5, 0, 0.9, 3, 3, { ao: 1 });
      return { topY: 7.0 };
    }
    case 25: {                                                                      // Linear Park: paved strip with the stone sign (reference photo)
      at(b, 630, 262, 0);
      b.box({ wall: "concrete", top: "pavers" }, 0, 0, 13, 2.6, 0, 0.12, 3, 3, { ao: 1, rtw: 2, rth: 2 });
      b.box("concrete", -4.8, -1.0, 3.4, 0.45, 0.12, 1.6, 3, 3, { ao: 0.85 });
      b.box("signplate", -4.8, -0.76, 2.6, 0.06, 0.4, 1.3, 2.6, 0.9, { ao: 1 });
      return { topY: 1.8 };
    }
    case 29: {                                                                      // Water Tower: slender concrete shaft carrying a flared drum tank (reference photo)
      at(b, 869, 252, 0);
      b.cyl("tower", 0, 0, 2.6, 2.6, 0, 0.5, 20, 3, true);
      b.cyl("tower", 0, 0, 1.7, 1.25, 0.5, 14.5, 20, 3, false);
      b.cyl("tower", 0, 0, 1.25, 4.6, 14.5, 17.0, 20, 3, false);
      b.cyl("tower", 0, 0, 4.6, 4.6, 17.0, 19.8, 20, 3, false);
      b.cyl("tower", 0, 0, 4.6, 0.5, 19.8, 21.4, 20, 3, true);
      b.cyl("metal", 0, 0, 0.5, 0.5, 21.4, 22.0, 10, 1, true);
      return { topY: 22.0 };
    }
    case 32: {                                                                      // Amphitheater: stepped semicircular seating facing a stage (reference photo)
      at(b, 581, 363, 200);
      const rows = 6, r0 = 3.0, rs = 0.95, SEG = 14;
      for (let j = 0; j < rows; j++) {
        const rin = r0 + j * rs, rout = rin + rs, y = 0.28 * (j + 1);
        for (let k = 0; k < SEG; k++) {
          const a0 = -Math.PI / 2 + (k / SEG) * Math.PI, a1 = -Math.PI / 2 + ((k + 1) / SEG) * Math.PI;
          const P = (a, r, yy) => [Math.cos(a) * r, yy, Math.sin(a) * r];
          b.quad("stepconcrete", P(a0, rin, y), P(a1, rin, y), P(a1, rout, y), P(a0, rout, y), [[0, 0], [1, 0], [1, 1], [0, 1]].map(([u, v]) => [u * 2, v]), 1);
          b.quad("stepconcrete", P(a1, rin, y - 0.28), P(a0, rin, y - 0.28), P(a0, rin, y), P(a1, rin, y), [[0, 0], [1, 0], [1, 1], [0, 1]].map(([u, v]) => [u * 2, v * 0.3]), 0.9);
        }
      }
      b.box("stagefloor", 0, -1.2, 6.5, 4.2, 0, 0.35, 3, 3, { ao: 1 });
      return { topY: 2.2 };
    }
    case 37: {                                                                      // Swimming pool: terracotta deck, coping, teal water, covered stand on the north side (ref photo)
      at(b, 1125, 425, 22);
      const W = 33, D = 12.5;
      b.box({ wall: "concrete", top: "deckpink" }, 0, 0, W + 8, D + 7, 0, 0.14, 3, 3, { ao: 1, rtw: 1.5, rth: 1.5 });
      [[0, D / 2 + 0.2, W + 0.8, 0.4], [0, -D / 2 - 0.2, W + 0.8, 0.4], [W / 2 + 0.2, 0, 0.4, D], [-W / 2 - 0.2, 0, 0.4, D]].forEach(([x, z, w, d]) => b.box("coping", x, z, w, d, 0, 0.32, 1, 1, { ao: 1 }));
      b.top("water", -W / 2, -D / 2, W / 2, D / 2, 0.2, 4, 4);
      for (let c = -W / 2; c <= W / 2; c += 5.5) b.box("column", c, -D / 2 - 2.4, 0.3, 0.3, 0.14, 3.6, 1, 1, { ao: 1 });
      b.box("concreteWhite", 0, -D / 2 - 2.9, W + 1, 3.2, 3.6, 3.9, 3, 3, { ao: 1 });
      return { topY: 4.2 };
    }
    case 38: {                                                                      // Multi-Purpose Building: steel-truss hall under a maroon barrel vault, glazed front, red columns
      at(b, 1324, 468, 21.3);
      const L = 63, D = 20.5, hallH = 7.0, wallKey = "wall:whitemod";
      b.box({ wall: "plinth", top: "plinth" }, 0, 0, L + 0.5, D + 0.5, 0, 0.5, 3, 3, { ao: 1 });
      b.box({ wall: wallKey, top: "roofflat" }, 0, 0, L, D, 0, hallH, 4.0, 3.5, { noTop: true });
      b.barrel("roof:maroon", 0, 0, L + 1.2, D + 1.4, hallH, 5.6, 18, 1.2, wallKey);
      b.box("trim", 0, 0, L + 0.4, D + 0.4, hallH - 0.15, hallH + 0.2, 3, 1, { ao: 1 });
      for (let c = -L / 2 + 2; c <= L / 2 - 1.5; c += 4.5) b.box("columnred", c, D / 2 + 1.6, 0.5, 0.5, 0, 4.6, 1, 1, { ao: 1 });
      b.box("canopy", 0, D / 2 + 0.9, L, 2.4, 4.6, 4.9, 3, 3, { ao: 1 });
      b.box("door", 0, D / 2 + 0.06, L * 0.8, 0.12, 0.3, 3.6, 3, 3, { noTop: true, ao: 1 });
      return { topY: hallH + 5.6 };
    }
    case 45: {                                                                      // NDC covered court: open-sided vaulted steel roof over a coloured court (reference photo)
      at(b, 1334, 129, 0);
      const L = 24, Wd = 14;
      b.box({ wall: "courtred", top: "courtred" }, 0, 0, L, Wd, 0, 0.12, 4, 4, { ao: 1, rtw: 4, rth: 4 });
      for (let c = -L / 2 + 1; c <= L / 2; c += L / 4) { b.box("metal", c, Wd / 2 - 0.5, 0.35, 0.35, 0, 6.2, 1, 1, { ao: 1 }); b.box("metal", c, -Wd / 2 + 0.5, 0.35, 0.35, 0, 6.2, 1, 1, { ao: 1 }); }
      b.barrel("roof:steel", 0, 0, L + 1, Wd + 1, 6.2, 2.8, 12, 1.2);
      return { topY: 9.0 };
    }
    case 4: case 5: case 6: case 44: {                                              // court fence and playing surface share one canonical layout
      const C = COURT_LAYOUT.find((court) => court.id === id);
      at(b, C.x, C.y, C.rot);
      const w = C.w * METERS_PER_PX, d = Math.max(C.d * METERS_PER_PX, 8);
      courtFence(b, w, d, id === 5 || id === 44 ? 3.4 : 2.8);
      if (id === 4 || id === 6) { hoop(b, -w / 2 + 1.0, 0, -1); hoop(b, w / 2 - 1.0, 0, 1); }
      return { topY: 0.4, anchorY: 3.0 };
    }
    default: return null;
  }
}

function buildBoundary(b) {
  STREET_WALL.forEach((run) => {
    for (let k = 0; k < run.length - 1; k++) {
      const [x0, z0] = pxToM(...run[k]), [x1, z1] = pxToM(...run[k + 1]);
      b.place(0, 0, 0);
      const len = Math.hypot(x1 - x0, z1 - z0), dx = (x1 - x0) / len, dz = (z1 - z0) / len, nx = -dz, nz = dx;
      const t = 0.18;
      const A = [x0 - nx * t, z0 - nz * t], B = [x1 - nx * t, z1 - nz * t], C = [x1 + nx * t, z1 + nz * t], D = [x0 + nx * t, z0 + nz * t];
      b.wall("wallred", B[0], B[1], A[0], A[1], 0, 1.35, 3, 1.35);                  // outward faces (both sides)
      b.wall("wallred", D[0], D[1], C[0], C[1], 0, 1.35, 3, 1.35);
      b.quad("concrete", [A[0], 1.35, A[1]], [D[0], 1.35, D[1]], [C[0], 1.35, C[1]], [B[0], 1.35, B[1]], [[0, 0], [0, 1], [len / 3, 1], [len / 3, 0]], 1);
      b.quad("curb", [x0 + nx * 0.2, 0.17, z0 + nz * 0.2], [x0 + nx * 0.7, 0.17, z0 + nz * 0.7], [x1 + nx * 0.7, 0.17, z1 + nz * 0.7], [x1 + nx * 0.2, 0.17, z1 + nz * 0.2], [[0, 0], [1, 0], [1, len / 3], [0, len / 3]], 1);
      const n = Math.floor(len / 14);
      for (let q = 0; q <= n; q++) { const px = x0 + dx * (q * 14), pz = z0 + dz * (q * 14); if (q * 14 <= len) b.box("concrete", px, pz, 0.6, 0.6, 0, 1.75, 1, 1, { ao: 0.85 }); }
    }
  });
}

/* ---------- buildings, landmarks, boundary: merged per material, per-building meshes only for walls/roofs ---------- */
const ALLPARTS = [];

function buildCampus() {
  const GL = {}, rec = {};
  const addBuilder = (b, group, mats) => {
    Object.entries(b.arrays(M)).forEach(([key, G]) => {
      if (key.startsWith("wall:") || key.startsWith("roof:")) {
        const mat = materialFor(key).clone(); mats.push(mat);
        const mesh = new THREE.Mesh(makeGeo(G), mat); mesh.castShadow = mesh.receiveShadow = true; group.add(mesh);
      } else mergeInto(GL, key, G);
    });
  };
  campusLocations.forEach((loc) => {
    const id = loc.id, b = new MeshBuilder();
    const parts = (BLOCKS[id] || []).map((p, i) => buildBlock(b, applySiteOffset(id, p), id * 10 + i));
    const sp = buildSpecial(b, id);
    parts.forEach((p) => ALLPARTS.push({ id, ...p }));
    const group = new THREE.Group(), mats = [];
    addBuilder(b, group, mats);
    scene.add(group);
    rec[id] = { group, mats, parts, sp };
  });
  const ctx = new MeshBuilder();
  CONTEXT_BLOCKS.forEach((p, i) => { const r = buildBlock(ctx, p, 9000 + i); ALLPARTS.push({ id: 0, ...r }); });
  { const [x, z] = pxToM(562, 114); ctx.place(x, z, 0); for (let k = -2; k <= 2; k++) ctx.box("concreteWhite", k * 5.5, 56 * METERS_PER_PX / 2 + 2.2, 0.9, 0.9, 0, 14.5, 2, 2, { ao: 0.9 }); ctx.box("concreteWhite", 0, 56 * METERS_PER_PX / 2 + 2.2, 28, 1.6, 14.5, 15.6, 3, 3, { ao: 1 }); }
  buildBoundary(ctx);
  { const rn = (a) => pxToM(668 + 428 * Math.sign(Math.cos(a)) * Math.pow(Math.abs(Math.cos(a)), 0.74), 672 + 105 * Math.sign(Math.sin(a)) * Math.pow(Math.abs(Math.sin(a)), 0.74));
    ctx.place(0, 0, 0); let prev = null;                                      // white post-and-rail fence round the running track (visible in the aerial photo)
    for (let k = 0; k <= 64; k++) { const a = Math.PI * 0.9 + ((Math.PI * 1.45) * k) / 64, pt = rn(a); if (prev) railRun(ctx, prev[0], prev[1], pt[0], pt[1]); prev = pt; } }
  const ground = new THREE.Group();
  addBuilder(ctx, ground, []);
  scene.add(ground);
  Object.entries(GL).forEach(([key, G]) => {
    const mesh = new THREE.Mesh(makeGeo(G), materialFor(key));
    mesh.castShadow = key !== "fence" && key !== "water" && key !== "void"; mesh.receiveShadow = key !== "fence";
    scene.add(mesh);
  });
  return rec;
}

/* =====================================================================
   Ground
   ===================================================================== */

/* Flat, independently positioned ground ribbon. Width is measured in source-map pixels. */
function addGroundRibbon(points, widthPx, materialKey, y = 0.025) {
  if (!points || points.length < 2 || widthPx <= 0) return null;
  const centers = points.map(([x, z]) => groundWorldPoint(x, z, y));
  const halfWidth = widthPx * (WORLD_W / IMAGE_WIDTH) * 0.5;
  const positions = [], uvs = [], indices = [], colors = [];
  const cumulative = [0], normals = [];

  for (let i = 1; i < centers.length; i++) cumulative.push(cumulative[i - 1] + centers[i].distanceTo(centers[i - 1]));
  for (let i = 0; i < centers.length; i++) {
    const prev = centers[Math.max(0, i - 1)], next = centers[Math.min(centers.length - 1, i + 1)];
    let dx = next.x - prev.x, dz = next.z - prev.z;
    const len = Math.hypot(dx, dz) || 1; dx /= len; dz /= len;
    normals.push([-dz, dx]);
  }

  centers.forEach((point, i) => {
    const before = normals[Math.max(0, i - 1)], after = normals[Math.min(normals.length - 1, i + 1)];
    let mx = before[0] + after[0], mz = before[1] + after[1];
    const ml = Math.hypot(mx, mz) || 1; mx /= ml; mz /= ml;
    const denom = Math.max(0.35, Math.abs(mx * after[0] + mz * after[1]));
    const miter = Math.min(halfWidth / denom, halfWidth * 2.2);
    positions.push(point.x + mx * miter, y, point.z + mz * miter);
    positions.push(point.x - mx * miter, y, point.z - mz * miter);
    const u = cumulative[i] / 7.5;
    uvs.push(u, 0, u, 1);
    colors.push(1, 1, 1, 1, 1, 1);
  });

  for (let i = 0; i < centers.length - 1; i++) {
    const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
    indices.push(a, c, b, a, d, c);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, materialFor(materialKey));
  mesh.receiveShadow = true; mesh.castShadow = false;
  scene.add(mesh);
  return mesh;
}

function addOvalGroundBand(cx, cy, outerRx, outerRy, innerRx, innerRy, materialKey, y = 0.022, exponent = 0.74) {
  const segments = 220, positions = [], uvs = [], indices = [], colors = [];
  const point = (rx, ry, a) => {
    const ca = Math.cos(a), sa = Math.sin(a);
    return groundWorldPoint(cx + rx * Math.sign(ca) * Math.pow(Math.abs(ca), exponent), cy + ry * Math.sign(sa) * Math.pow(Math.abs(sa), exponent), y);
  };
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const outer = point(outerRx, outerRy, a), inner = point(innerRx, innerRy, a);
    positions.push(outer.x, y, outer.z, inner.x, y, inner.z);
    const u = (i / segments) * 18;
    uvs.push(u, 0, u, 1);
    colors.push(1, 1, 1, 1, 1, 1);
    if (i < segments) {
      const k = i * 2;
      indices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, materialFor(materialKey));
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

function addCourtSurface(cx, cy, widthPx, depthPx, rotation, isTennis = false) {
  const center = groundWorldPoint(cx, cy, 0.035);
  const group = new THREE.Group();
  group.position.copy(center);
  // Match the rotation convention used by MeshBuilder.place().
  group.rotation.y = -(rotation || 0) * Math.PI / 180;
  const geo = new THREE.PlaneGeometry(widthPx * WORLD_W / IMAGE_WIDTH, depthPx * WORLD_W / IMAGE_WIDTH);
  const mat = new THREE.MeshStandardMaterial({ map: makeCourtTexture(isTennis), roughness: 0.94, metalness: 0, side: THREE.DoubleSide });
  const surface = new THREE.Mesh(geo, mat);
  surface.rotation.x = -Math.PI / 2;
  surface.receiveShadow = true;
  group.add(surface);
  scene.add(group);
}

function addBuildingGroundPads() {
  const addPad = (p) => {
    const [x, z] = pxToM(p.cx, p.cy);
    const [w, d] = blockDims(p);
    const group = new THREE.Group();
    group.position.set(x * M, 0.012, z * M);
    group.rotation.y = -(p.rot || 0) * Math.PI / 180;
    const geo = new THREE.PlaneGeometry((w + 1.2) * M, (d + 1.2) * M);
    addWhiteVertexColors(geo);
    const pad = new THREE.Mesh(geo, materialFor("pavement"));
    pad.rotation.x = -Math.PI / 2; pad.receiveShadow = true;
    group.add(pad); scene.add(group);

    if (p.entrance) {
      const ex = (p.entrance.x || 0) * (w / 2 - 3);
      const z0 = d / 2 + 0.6, z1 = z0 + 7.5;
      const a = (p.rot || 0) * Math.PI / 180, c = Math.cos(a), sn = Math.sin(a);
      const toPx = (lx, lz) => [p.cx + (lx * c - lz * sn) / METERS_PER_PX, p.cy + (lx * sn + lz * c) / METERS_PER_PX];
      const walkWidthM = Math.max(3.0, (p.entrance.w || 3.0) + 0.6);
      addGroundRibbon([toPx(ex, z0), toPx(ex, z1)], walkWidthM / METERS_PER_PX, "pavement", 0.026);
    }
  };
  Object.entries(BLOCKS).forEach(([id, parts]) => parts.forEach((part) => addPad(applySiteOffset(Number(id), part))));
  CONTEXT_BLOCKS.forEach(addPad);
}

/* ---------- procedural campus ground: terrain, road, track, courts and walkways ---------- */
function buildGround() {
  // Neutral, procedurally textured terrain replaces the baked aerial photograph.
  const grassMap = makeProceduralGrassTexture(11, 6);
  const grassMat = new THREE.MeshStandardMaterial({ map: grassMap, roughness: 1, metalness: 0 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(WORLD_W, WORLD_H), grassMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // A broad, softly textured outer terrain keeps the map edge from reading as a hard rectangle.
  const outerMap = makeProceduralGrassTexture(220, 220);
  const outer = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.MeshStandardMaterial({ map: outerMap, roughness: 1, metalness: 0 }));
  outer.rotation.x = -Math.PI / 2;
  outer.position.y = -0.055;
  outer.receiveShadow = true;
  scene.add(outer);

  // Main oval athletics track. The superellipse follows the existing fence alignment.
  addOvalGroundBand(668, 672, 420, 98, 394, 72, "track", 0.022);
  addOvalGroundBand(668, 672, 414.5, 92.5, 412.5, 90.5, "trackMark", 0.024);
  addOvalGroundBand(668, 672, 401.5, 79.5, 399.5, 77.5, "trackMark", 0.024);

  // Preserve the two surveyed-from-photo wall runs as separate road segments;
  // flattening them would incorrectly bridge the visible campus entrance gap.
  STREET_WALL.forEach((wallRun) => {
    const street = wallRun.map(([x, y], i) => {
      const prev = wallRun[Math.max(0, i - 1)], next = wallRun[Math.min(wallRun.length - 1, i + 1)];
      const dx = next[0] - prev[0], dy = next[1] - prev[1], len = Math.hypot(dx, dy) || 1;
      let nx = -dy / len, ny = dx / len;
      if (ny < 0) { nx *= -1; ny *= -1; }
      return [x + nx * 34, y + ny * 34];
    });
    addGroundRibbon(street, 82, "pavement", 0.014);
    addGroundRibbon(street, 70, "asphalt", 0.022);
  });

  // Court surfaces use the same dimensions, centers, and rotations as their fences.
  COURT_LAYOUT.forEach((court) => addCourtSurface(court.x, court.y, court.w, court.d, court.rot, court.kind === "tennis"));

  // Light, low-profile paved aprons and short entrance walks are derived from the building footprints.
  addBuildingGroundPads();
}

/* =====================================================================
   Spatial coordination
   ===================================================================== */

const createdPedestrianLinks = [];

function entranceEndpoint(id) {
  const original = (BLOCKS[id] || [])[0];
  if (!original || !original.entrance) return null;
  const p = applySiteOffset(id, original), [w, d] = blockDims(p);
  const lx = (p.entrance.x || 0) * (w / 2 - 3), lz = d / 2 + 0.6 + 7.5;
  const a = (p.rot || 0) * Math.PI / 180, c = Math.cos(a), sn = Math.sin(a);
  return [p.cx + (lx * c - lz * sn) / METERS_PER_PX, p.cy + (lx * sn + lz * c) / METERS_PER_PX];
}

function segmentHitsRect(a, b, rect, margin = 0) {
  const angle = (rect.rot || 0) * Math.PI / 180, c = Math.cos(angle), sn = Math.sin(angle);
  const toLocal = ([x, z]) => { const dx = x - rect.cx, dz = z - rect.cz; return [dx * c + dz * sn, -dx * sn + dz * c]; };
  const p0 = toLocal(a), p1 = toLocal(b), dx = p1[0] - p0[0], dz = p1[1] - p0[1];
  const minX = -rect.w / 2 - margin, maxX = rect.w / 2 + margin, minZ = -rect.d / 2 - margin, maxZ = rect.d / 2 + margin;
  let t0 = 0, t1 = 1;
  const clip = (p, q) => { if (Math.abs(p) < 1e-9) return q >= 0; const r = q / p; if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; } return true; };
  return clip(-dx, p0[0] - minX) && clip(dx, maxX - p0[0]) && clip(-dz, p0[1] - minZ) && clip(dz, maxZ - p0[1]) && t1 >= t0;
}

function pxCourtRect(court) {
  return { cx: (court.x - IMAGE_WIDTH / 2) * METERS_PER_PX, cz: (court.y - IMAGE_HEIGHT / 2) * METERS_PER_PX, w: court.w * METERS_PER_PX, d: court.d * METERS_PER_PX, rot: court.rot };
}

function addCampusWalkways() {
  const partToPhotoRect = (pt) => ({ cx: pt.cx / METERS_PER_PX + IMAGE_WIDTH / 2, cz: pt.cz / METERS_PER_PX + IMAGE_HEIGHT / 2, w: pt.w / METERS_PER_PX, d: pt.d / METERS_PER_PX, rot: pt.rot || 0 });
  const courtToPhotoRect = (court) => ({ cx: court.x, cz: court.y, w: court.w, d: court.d, rot: court.rot });
  PEDESTRIAN_LINKS.forEach(([fromId, toId]) => {
    const a = entranceEndpoint(fromId), b = entranceEndpoint(toId);
    if (!a || !b) return;
    const blockedByBuilding = ALLPARTS.some((pt) => pt.id !== fromId && pt.id !== toId && segmentHitsRect(a, b, partToPhotoRect(pt), 1.5));
    const blockedByCourt = COURT_LAYOUT.some((court) => segmentHitsRect(a, b, courtToPhotoRect(court), 1.5));
    if (blockedByBuilding || blockedByCourt) return;
    addGroundRibbon([a, b], 8.5, "pavement", 0.028);
    createdPedestrianLinks.push({ from: fromId, to: toId, points: [a, b] });
  });
}

function rectsOverlap(a, b, padding = 0) {
  const axes = (r) => { const t = (r.rot || 0) * Math.PI / 180; return [[Math.cos(t), Math.sin(t)], [-Math.sin(t), Math.cos(t)]]; };
  const A = axes(a), B = axes(b);
  for (const axis of A.concat(B)) {
    const ra = Math.abs(axis[0] * A[0][0] + axis[1] * A[0][1]) * a.w / 2 + Math.abs(axis[0] * A[1][0] + axis[1] * A[1][1]) * a.d / 2;
    const rb = Math.abs(axis[0] * B[0][0] + axis[1] * B[0][1]) * b.w / 2 + Math.abs(axis[0] * B[1][0] + axis[1] * B[1][1]) * b.d / 2;
    const distance = Math.abs((b.cx - a.cx) * axis[0] + (b.cz - a.cz) * axis[1]);
    if (distance >= ra + rb + padding) return false;
  }
  return true;
}

function partRect(pt) { return { cx: pt.cx, cz: pt.cz, w: pt.w, d: pt.d, rot: pt.rot || 0 }; }

function runSpatialAudit() {
  const buildingCollisions = [];
  for (let i = 0; i < ALLPARTS.length; i++) for (let j = i + 1; j < ALLPARTS.length; j++) {
    const a = ALLPARTS[i], b = ALLPARTS[j];
    if (a.id === b.id || (a.id === 0 && b.id === 0)) continue;
    if (rectsOverlap(partRect(a), partRect(b), 0.12)) buildingCollisions.push({ a: a.id, b: b.id, type: "building-footprint" });
  }
  const courtCollisions = [], courtBuildingCollisions = [], roadBuildingCollisions = [];
  const roadCenterPaths = STREET_WALL.map((wallRun) => wallRun.map(([x, y], i) => {
    const prev = wallRun[Math.max(0, i - 1)], next = wallRun[Math.min(wallRun.length - 1, i + 1)];
    const dx = next[0] - prev[0], dy = next[1] - prev[1], len = Math.hypot(dx, dy) || 1;
    let nx = -dy / len, ny = dx / len; if (ny < 0) { nx *= -1; ny *= -1; }
    return [x + nx * 34, y + ny * 34];
  }));
  ALLPARTS.forEach((pt) => {
    const rectPx = { cx: pt.cx / METERS_PER_PX + IMAGE_WIDTH / 2, cz: pt.cz / METERS_PER_PX + IMAGE_HEIGHT / 2, w: pt.w / METERS_PER_PX, d: pt.d / METERS_PER_PX, rot: pt.rot || 0 };
    const onRoad = roadCenterPaths.some((path) => path.slice(1).some((point, i) => segmentHitsRect(path[i], point, rectPx, 41)));
    if (onRoad) roadBuildingCollisions.push({ building: pt.id, type: "road-or-sidewalk-footprint" });
  });
  for (let i = 0; i < COURT_LAYOUT.length; i++) {
    const court = COURT_LAYOUT[i], rect = pxCourtRect(court);
    for (let j = i + 1; j < COURT_LAYOUT.length; j++) if (rectsOverlap(rect, pxCourtRect(COURT_LAYOUT[j]), 0.12)) courtCollisions.push([court.id, COURT_LAYOUT[j].id]);
    ALLPARTS.forEach((pt) => { if (pt.id !== court.id && rectsOverlap(rect, partRect(pt), 0.12)) courtBuildingCollisions.push({ court: court.id, building: pt.id }); });
  }

  // Larger special footprints are approximate because source aerial measurements are not surveyed.
  // These are warnings for reference-based review, never automatic relocation instructions.
  const specialFootprints = [
    { id: 16, name: "Grandstand", x: 718, y: 545, w: 41.2, d: 10.8, rot: 2 },
    { id: 29, name: "Water Tower", x: 869, y: 252, w: 9.2, d: 9.2, rot: 0 },
    { id: 32, name: "Amphitheater", x: 581, y: 363, w: 17.4, d: 14.5, rot: 200 },
    { id: 37, name: "Swimming Pool", x: 1125, y: 425, w: 41, d: 19.5, rot: 22 },
    { id: 38, name: "Multi-Purpose Building", x: 1324, y: 468, w: 64.2, d: 23.5, rot: 21.3 },
    { id: 45, name: "NDC Covered Court", x: 1334, y: 129, w: 25, d: 15, rot: 0 }
  ].map((item) => ({ ...item, cx: (item.x - IMAGE_WIDTH / 2) * METERS_PER_PX, cz: (item.y - IMAGE_HEIGHT / 2) * METERS_PER_PX, w: item.w / METERS_PER_PX, d: item.d / METERS_PER_PX }));
  const specialReview = [];
  specialFootprints.forEach((special) => ALLPARTS.forEach((pt) => {
    if (pt.id !== special.id && rectsOverlap(special, partRect(pt), 0.12)) specialReview.push({ structure: special.name, id: special.id, nearbyBuilding: pt.id, type: "approximate-special-footprint-review" });
  }));

  const report = {
    generatedAt: new Date().toISOString(),
    coordinateNote: "Image-space footprint estimates; METERS_PER_PX is not surveyed. Special-structure extents are approximate.",
    siteOffsets: Object.entries(SITE_OFFSETS).map(([id, offset]) => ({ id: Number(id), dxPx: offset[0], dyPx: offset[1] })),
    courtLayout: COURT_LAYOUT.map(({ id, x, y, w, d, rot }) => ({ id, x, y, w, d, rot })),
    buildingCollisions, courtCollisions, courtBuildingCollisions, roadBuildingCollisions, specialReview,
    pedestrianLinksCreated: createdPedestrianLinks.map(({ from, to }) => [from, to]),
    pedestrianLinksRequested: PEDESTRIAN_LINKS.map((pair) => pair.slice()),
    status: buildingCollisions.length || courtCollisions.length || courtBuildingCollisions.length || roadBuildingCollisions.length ? "review-required" : specialReview.length ? "approximate-special-review-required" : "clear"
  };
  window.__PUP_CAMPUS_SPATIAL_AUDIT__ = report;
  console.groupCollapsed("PUP campus spatial audit");
  console.info("Building footprint conflicts:", buildingCollisions);
  console.info("Court conflicts:", courtCollisions);
  console.info("Court/building conflicts:", courtBuildingCollisions);
  console.info("Road/building conflicts:", roadBuildingCollisions);
  console.info("Approximate special-structure review:", specialReview);
  console.info("Pedestrian links created:", report.pedestrianLinksCreated);
  console.groupEnd();
  return report;
}

/* =====================================================================
   Environment: sky, lighting, shadows, trees
   ===================================================================== */

const SUN = [0.62, 0.38, 0.55];

/* ---------- sky + image-based lighting ---------- */
function makeSkyTexture() {
  const W = 1024, H = 512, c = cvs(W, H), g = c.getContext("2d");
  const gr = g.createLinearGradient(0, 0, 0, H);
  [[0, "#22385c"], [0.2, "#4b6998"], [0.38, "#a7b3c4"], [0.46, "#efc08a"], [0.5, "#f6cf9a"], [0.52, "#c8a074"], [0.6, "#6a553f"], [1, "#2e271f"]].forEach(([o, col]) => gr.addColorStop(o, col));
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  const n = Math.hypot(...SUN), u = 0.5 + Math.atan2(SUN[2], SUN[0]) / (2 * Math.PI), v = 0.5 + Math.asin(SUN[1] / n) / Math.PI;
  [0, -W, W].forEach((dx) => {
    const sx = u * W + dx, sy = (1 - v) * H, glow = g.createRadialGradient(sx, sy, 0, sx, sy, 190);
    glow.addColorStop(0, "rgba(255,238,196,1)"); glow.addColorStop(0.1, "rgba(255,216,152,.8)"); glow.addColorStop(0.45, "rgba(255,172,102,.28)"); glow.addColorStop(1, "rgba(255,150,90,0)");
    g.fillStyle = glow; g.fillRect(0, 0, W, H);
  });
  const rnd = seeded(5);
  for (let k = 0; k < 26; k++) { const x = rnd() * W, y = H * (0.22 + rnd() * 0.2), w = 90 + rnd() * 200; const cg = g.createRadialGradient(x, y, 0, x, y, w); cg.addColorStop(0, "rgba(255,226,190,.16)"); cg.addColorStop(1, "rgba(255,226,190,0)"); g.fillStyle = cg; g.save(); g.translate(x, y); g.scale(1, 0.18); g.translate(-x, -y); g.fillRect(x - w, y - w, 2 * w, 2 * w); g.restore(); }
  const t = new THREE.CanvasTexture(c);
  t.mapping = THREE.EquirectangularReflectionMapping; t.encoding = THREE.sRGBEncoding;
  return t;
}

function setShadowFrustum(center, half) {
  const c = sun.shadow.camera;
  c.left = -half; c.right = half; c.top = half * 0.75; c.bottom = -half * 0.75; c.near = 20; c.far = 560;
  c.updateProjectionMatrix();
  sun.target.position.copy(center);
  sun.position.copy(center).addScaledVector(sunDirV, 280);
  sun.target.updateMatrixWorld();
}

function setupLighting() {
  sunDirV = new THREE.Vector3(...SUN).normalize();
  scene.add(new THREE.HemisphereLight(0xcfd9f0, 0x6a5238, 0.55));
  sun = new THREE.DirectionalLight(0xffc387, 2.1);
  sun.castShadow = true;
  const SH = renderer.capabilities.maxTextureSize >= 4096 && Math.min(screen.width, screen.height) > 700 ? 4096 : 2048;
  sun.shadow.mapSize.set(SH, SH); sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.05; sun.shadow.radius = 2.5;
  scene.add(sun, sun.target);
  setShadowFrustum(new THREE.Vector3(8, 0, 8), 112);
  const fill = new THREE.DirectionalLight(0x8aa0cc, 0.26); fill.position.set(-90, 40, -70); scene.add(fill);
  const sky = makeSkyTexture();
  scene.background = sky;
  try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromEquirectangular(sky).texture; pm.dispose(); } catch (e) { console.warn("environment lighting unavailable", e); }
  scene.fog = new THREE.Fog(0xdcb186, 170, 760);
}

/* ---------- soft contact shadows under buildings (cheap ambient-occlusion substitute) ---------- */
function addContactShadows() {
  const c = cvs(64, 64), g = c.getContext("2d"), gr = g.createRadialGradient(32, 32, 6, 32, 32, 32);
  gr.addColorStop(0, "rgba(0,0,0,0.55)"); gr.addColorStop(0.55, "rgba(0,0,0,0.38)"); gr.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  ALLPARTS.forEach((pt) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(pt.cx * M, 0.03, pt.cz * M);
    m.rotation.y = (-pt.rot * Math.PI) / 180;
    m.scale.set((pt.w + 7) * M, 1, (pt.d + 7) * M);
    m.renderOrder = 1;
    scene.add(m);
  });
}

/* ---------- trees: instanced, positions from the aerial photo, never inside a footprint ---------- */
function addTrees() {
  const raw = TREE_DATA.split(";").map((s) => s.split(",").map(Number));
  const courtRects = COURT_LAYOUT.map(pxCourtRect);
  const streetPaths = STREET_WALL.map((wallRun) => wallRun.map(([x, y], i) => {
    const prev = wallRun[Math.max(0, i - 1)], next = wallRun[Math.min(wallRun.length - 1, i + 1)];
    const dx = next[0] - prev[0], dy = next[1] - prev[1], len = Math.hypot(dx, dy) || 1;
    let nx = -dy / len, ny = dx / len; if (ny < 0) { nx *= -1; ny *= -1; }
    return [x + nx * 34, y + ny * 34];
  }));
  const distanceToSegment = (p, a, b) => { const dx=b[0]-a[0], dy=b[1]-a[1], l2=dx*dx+dy*dy || 1; const t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/l2)); return Math.hypot(p[0]-(a[0]+t*dx),p[1]-(a[1]+t*dy)); };
  const nearRoad = (px, py) => streetPaths.some((path) => path.slice(1).some((point, i) => distanceToSegment([px, py], path[i], point) < 42));
  const taken = (x, z, px, py) => ALLPARTS.some((pt) => inPart(pt, x, z, 4.0)) ||
    Object.values(SPECIAL_R).some(([sx, sy, r]) => { const [wx, wz] = pxToM(sx, sy); return Math.hypot(x - wx, z - wz) < r + 3; }) ||
    courtRects.some((rect) => rectsOverlap(rect, { cx: x, cz: z, w: 1.8, d: 1.8, rot: 0 }, 0.25)) || nearRoad(px, py);
  const rnd = seeded(2024), list = [];
  raw.forEach(([px, py, rp]) => { const [x, z] = pxToM(px, py); if (!taken(x, z, px, py)) list.push({ x, z, r: Math.max(2.2, rp * METERS_PER_PX * 0.95) }); });
  const far = [];                                                              // sparse tree belt beyond the photographed area, fading into the haze
  for (let k = 0; k < 320; k++) { const x = (rnd() - 0.5) * 520, z = (rnd() - 0.5) * 330; if (Math.abs(x) < WORLD_W / (2 * M) + 6 && Math.abs(z) < WORLD_H / (2 * M) + 6) continue; far.push({ x, z, r: 3 + rnd() * 3 }); }
  const all = list.concat(far), N = all.length * 3;
  const leaf = cvs(64, 64), lg = leaf.getContext("2d");
  lg.fillStyle = "#6a8a3c"; lg.fillRect(0, 0, 64, 64);
  for (let k = 0; k < 420; k++) { lg.fillStyle = `rgba(${20 + rnd() * 40 | 0},${50 + rnd() * 70 | 0},${10 + rnd() * 30 | 0},${0.25 + rnd() * 0.4})`; lg.fillRect(rnd() * 64, rnd() * 64, 2 + rnd() * 5, 2 + rnd() * 5); }
  const foliage = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ map: toTex(leaf), roughness: 0.95, metalness: 0 }), N);
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.22, 0.34, 1, 6), new THREE.MeshStandardMaterial({ color: 0x5a4430, roughness: 1 }), all.length);
  const dummy = new THREE.Object3D(), col = new THREE.Color(), pal = [0x5d7f34, 0x4d6e2b, 0x6b8a3a, 0x3f5f27, 0x72923f];
  all.forEach((t, i) => {
    const th = 2.6 + t.r * 0.55 + rnd() * 1.2;
    dummy.position.set(t.x * M, (th / 2) * M, t.z * M); dummy.rotation.set(0, 0, 0); dummy.scale.set(M, th * M, M); dummy.updateMatrix(); trunks.setMatrixAt(i, dummy.matrix);
    [[0, 0, 0, 1], [0.5, -0.12, 0.3, 0.72], [-0.45, -0.18, -0.35, 0.68]].forEach(([ox, oy, oz, s], k) => {
      const rr = t.r * s;
      dummy.position.set((t.x + ox * t.r) * M, (th + t.r * 0.55 + oy * t.r) * M, (t.z + oz * t.r) * M);
      dummy.rotation.set(rnd() * 3, rnd() * 3, 0); dummy.scale.set(rr * M, rr * 0.82 * M, rr * M); dummy.updateMatrix();
      foliage.setMatrixAt(i * 3 + k, dummy.matrix);
      foliage.setColorAt(i * 3 + k, col.setHex(pal[(rnd() * pal.length) | 0]).offsetHSL(0, 0, (rnd() - 0.5) * 0.08));
    });
  });
  [foliage, trunks].forEach((m) => { m.castShadow = true; m.receiveShadow = true; m.instanceMatrix.needsUpdate = true; scene.add(m); });
  foliage.instanceColor.needsUpdate = true;
  // contact shadows under campus trees
  const near = list, sc = cvs(64, 64), sg = sc.getContext("2d"), gr = sg.createRadialGradient(32, 32, 4, 32, 32, 32);
  gr.addColorStop(0, "rgba(0,0,0,0.5)"); gr.addColorStop(1, "rgba(0,0,0,0)"); sg.fillStyle = gr; sg.fillRect(0, 0, 64, 64);
  const sh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), near.length);
  near.forEach((t, i) => { dummy.position.set(t.x * M, 0.04, t.z * M); dummy.rotation.set(0, 0, 0); dummy.scale.set(t.r * 2.3 * M, 1, t.r * 2.3 * M); dummy.updateMatrix(); sh.setMatrixAt(i, dummy.matrix); });
  sh.renderOrder = 1; scene.add(sh);
}

/* =====================================================================
   Location markers (pins)
   ===================================================================== */

// golden-hour sun from the south-east (matches the light in the aerial photo)
const PIN_PX = 26;

/* ---------- location markers: compact numbered badges with a pointer tip, constant on-screen size ---------- */
function makePinTexture(loc, st) {
  const lm = categoryOf(loc) === "landmark", W = 128, H = 160, c = cvs(W, H), g = c.getContext("2d"), cx = 64, cy = 62, r = 46;
  const fill = lm ? (st === "idle" ? "#f1b434" : "#ffc94d") : (st === "idle" ? "#7a0000" : "#9a1212");
  const edge = lm ? "#7a0000" : "#f1b434", ink = lm ? "#3a0a0a" : "#ffffff";
  g.shadowColor = "rgba(0,0,0,0.55)"; g.shadowBlur = 9; g.shadowOffsetY = 4;
  g.fillStyle = fill; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.moveTo(cx - 24, cy + 36); g.lineTo(cx + 24, cy + 36); g.lineTo(cx, 154); g.closePath(); g.fill();
  g.shadowColor = "transparent";
  g.lineWidth = st === "idle" ? 5 : 7; g.strokeStyle = st === "idle" ? edge : st === "active" ? "#ffffff" : "#ffe9a8";
  g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
  if (st === "active") { g.lineWidth = 4; g.strokeStyle = edge; g.beginPath(); g.arc(cx, cy, r - 8, 0, Math.PI * 2); g.stroke(); }
  g.fillStyle = ink; g.font = `800 ${String(loc.id).length > 1 ? 52 : 62}px Manrope, Arial, sans-serif`; g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText(String(loc.id), cx, cy + 3);
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = MAX_ANISO;
  return t;
}

function buildPin(loc, anchorY) {
  const group = new THREE.Group(), spriteMat = new THREE.SpriteMaterial({ transparent: true, depthWrite: false });
  const tex = { idle: makePinTexture(loc, "idle") };
  spriteMat.map = tex.idle;
  const sprite = new THREE.Sprite(spriteMat);
  sprite.center.set(0.5, 0); sprite.renderOrder = 10; sprite.userData.id = loc.id;
  group.add(sprite);
  return { group, sprite, spriteMat, tex, state: "idle" };
}

function applyPinTexture(p, loc) {
  const st = loc.id === state.activeId ? "active" : loc.id === hoverId ? "hover" : "idle";
  if (p.state === st) return;
  p.state = st;
  p.spriteMat.map = p.tex[st] || (p.tex[st] = makePinTexture(loc, st));
  p.spriteMat.needsUpdate = true;
  p.spriteMat.depthTest = st !== "active";
}

function resolvePinOverlap() {
  const w = renderer.domElement.clientWidth, h = renderer.domElement.clientHeight, v = new THREE.Vector3();
  const order = [...pins.keys()].sort((a, b) => {
    const pa = pins.get(a), pb = pins.get(b), sa = (a === state.activeId ? 4 : 0) + (state.destIds.includes(a) ? 3 : 0) + (a === hoverId ? 2 : 0) + (categoryOf(locById.get(a)) === "landmark" ? 1 : 0);
    const sb = (b === state.activeId ? 4 : 0) + (state.destIds.includes(b) ? 3 : 0) + (b === hoverId ? 2 : 0) + (categoryOf(locById.get(b)) === "landmark" ? 1 : 0);
    return sb - sa || a - b;
  });
  const placed = [], rad = PIN_PX * 0.55;
  order.forEach((id) => {
    const p = pins.get(id);
    v.copy(p.worldPos).project(camera);
    if (v.z > 1 || v.z < -1) { p.collapsed = false; return; }
    const sx = (v.x * 0.5 + 0.5) * w, sy = (-v.y * 0.5 + 0.5) * h - rad;          // badge centre sits above the tip
    const hit = placed.some((q) => Math.hypot(q[0] - sx, q[1] - sy) < rad * 2 - 2);
    p.collapsed = hit && targetOf(p, id) <= 1.0;
    if (!p.collapsed || targetOf(p, id) > 1.0) placed.push([sx, sy]);
  });
}

const targetOf = (p, id) => (id === state.activeId ? 1.35 : state.destIds.includes(id) ? 1.15 : id === hoverId ? 1.12 : 1);

function refreshPinStates() {
  if (ready) pins.forEach((p, id) => applyPinTexture(p, locById.get(id)));
}

/* =====================================================================
   Guide lines and visual state
   ===================================================================== */

/* ---------- guide lines (direct-line guides between marker positions) ---------- */
function clearPaths() {
  while (pathGroup.children.length) {
    const m = pathGroup.children.pop();
    m.geometry.dispose();
    if (m.material.map) m.material.map.dispose();
    m.material.dispose();
  }
  pathTextures.length = 0;
}

function rebuildPaths() {
  if (!ready) return;
  clearPaths();
  const a = pins.get(state.activeId).base;
  const dashTex = makeDashTexture();
  state.destIds.forEach((id, i) => {
    if (id === state.activeId || !pins.has(id)) return;
    const b = pins.get(id).base;
    const color = PATH_COLORS[i % PATH_COLORS.length];
    const dx = b.x - a.x, dz = b.z - a.z, full = Math.hypot(dx, dz);
    const len = full - 3.2;
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.7, 2.0, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, depthTest: false }));
    ring.position.set(b.x, 0.1, b.z); ring.renderOrder = 4;
    pathGroup.add(ring);
    if (len < 0.6) return;
    const ux = dx / full, uz = dz / full;
    const mid = new THREE.Vector3(a.x + ux * (1.6 + len / 2), 0.12, a.z + uz * (1.6 + len / 2));
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(len, 1.5).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xb87333, transparent: true, opacity: 0.28, depthTest: false, depthWrite: false }));
    const tex = dashTex.clone(); tex.needsUpdate = true;
    tex.repeat.set(len / 1.8, 1);
    const band = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.62).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color, map: tex, transparent: true, opacity: 0.95, depthTest: false, depthWrite: false }));
    [glow, band].forEach((m, k) => {
      m.position.copy(mid); m.position.y += k * 0.01;
      m.rotation.y = -Math.atan2(dz, dx);
      m.renderOrder = 3 + k;
      pathGroup.add(m);
    });
    pathTextures.push(tex);
  });
  dashTex.dispose();
}

/* ---------- visual state ---------- */
export function updateVisualState() {
  if (!ready) return;
  pins.forEach((p, id) => {
    const isA = id === state.activeId, isD = state.destIds.includes(id);
    p.targetOpacity = matches(locById.get(id)) ? 1 : 0.16;
    p.keep = isA || isD;
    applyPinTexture(p, locById.get(id));
    p.build.mats.forEach((m) => m.emissive && m.emissive.setHex(isA ? 0x3a2208 : 0));
  });
  const a = pins.get(state.activeId);
  selRing.position.set(a.base.x, 0.1, a.base.z);
  selRingBase = a.radius / 2.28;
  rebuildPaths();
}

/* =====================================================================
   Camera, view modes and zoom
   ===================================================================== */

function obliqueDir(len) {
  return new THREE.Vector3(-0.38, 0.7, 0.62).normalize().multiplyScalar(len);
}

function onResize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  if (state.mode === "topdown" && !fly) {
    const p = topDownPose();
    camera.position.copy(p.pos);
    controls.target.copy(p.target);
    applyLimits("topdown");
  }
}

/* Top-down pose: camera straight above the map centre, high enough that the whole map fits the viewport */
function topDownPose() {
  const half = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const height = Math.max(WORLD_H / 2 / half, WORLD_W / 2 / (half * camera.aspect)) * 1.02;
  return { pos: new THREE.Vector3(0, height, 0.01), target: new THREE.Vector3(0, 0, 0), height };
}

function setFogEnabled(on) {
  scene.fog.near = on ? 170 : 1e6;
  scene.fog.far = on ? 760 : 2e6;
}

function setCameraFar(far) {
  if (camera.far === far) return;
  camera.far = far;
  camera.updateProjectionMatrix();
}

/* ---------- camera ---------- */
function flyTo(pos, target, dur = 950, onDone) {
  if (!ready) return;
  if (reduceMotion) {
    camera.position.copy(pos); controls.target.copy(target); controls.update();
    if (onDone) onDone();
    return;
  }
  fly = { p0: camera.position.clone(), t0: controls.target.clone(), p1: pos.clone(), t1: target.clone(), s: performance.now(), d: dur, done: onDone };
}

function applyLimits(m) {
  const c = controls;
  c.enableRotate = c.enableZoom = c.enablePan = true;
  // Top-down view: the primary pointer (left mouse button / one finger) pans the map instead of rotating it.
  // OrbitControls binds both to ROTATE by default, which is a no-op once rotation is disabled for top-down.
  const panPrimary = state.mode === "topdown";
  c.mouseButtons.LEFT = panPrimary ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE;
  c.touches.ONE = panPrimary ? THREE.TOUCH.PAN : THREE.TOUCH.ROTATE;
  c.rotateSpeed = 0.7;
  c.minDistance = MIN_ZOOM_DISTANCE;
  c.maxDistance = m === "free" ? 2000 : MAX_ZOOM_DISTANCE;
  if (m !== "free" && m !== "topdown") setCameraFar(900);
  c.minPolarAngle = m === "free" ? 0 : 0.12;
  c.maxPolarAngle = m === "free" ? Math.PI / 2 : Math.PI / 2.08;
  if (m === "topdown") {
    const h = topDownPose().height;
    setCameraFar(Math.max(900, h * 2.5));
    c.enableRotate = false; c.minPolarAngle = 0; c.maxPolarAngle = 0;
    c.maxDistance = Math.max(MAX_ZOOM_DISTANCE, h * 1.5);
  }
  if (m === "walking") {
    c.enableZoom = false; c.enablePan = false; c.rotateSpeed = -0.45;
    c.minDistance = 0.1; c.maxDistance = 2; c.minPolarAngle = 1.0; c.maxPolarAngle = 2.1;
  }
  if (m === "free") c.minDistance = 0.1;
}

function activeBase() {
  const p = pins.get(state.activeId).base;
  return new THREE.Vector3(p.x, 1, p.z);
}

function walkingEye(a) {
  const eye = new THREE.Vector3(a.x, 1.7 * M, Math.min(a.z + 8, WORLD_H / 2 - 1));
  const dir = new THREE.Vector3(a.x - eye.x, 0, a.z - eye.z);
  if (dir.lengthSq() < 0.01) dir.set(0, 0, -1);
  dir.normalize();
  return { eye, target: eye.clone().addScaledVector(dir, 0.5) };
}

function setMode(mode, opts = {}) {
  const prev = state.mode;
  state.mode = mode;
  syncDock();
  if (!ready) return;
  setFogEnabled(mode !== "topdown");
  const a = activeBase();
  applyLimits("free");
  if (mode === "orbit") {
    if (prev === "topdown" || prev === "walking" || opts.force) {
      const t = prev === "walking" ? a : controls.target.clone();
      t.y = 1;
      flyTo(t.clone().add(obliqueDir(70)), t, 950, () => applyLimits("orbit"));
    } else applyLimits("orbit");
  } else if (mode === "topdown") {
    const p = topDownPose();
    setCameraFar(Math.max(900, p.height * 2.5));
    flyTo(p.pos, p.target, 950, () => applyLimits("topdown"));
  } else if (mode === "walking") {
    const w = walkingEye(a);
    flyTo(w.eye, w.target, 1100, () => applyLimits("walking"));
    showToast("Walking: drag to look, W A S D / arrow keys to move.", 3200);
  }
}

export function focusLocation(id) {
  if (!ready) return;
  const p = pins.get(id).base;
  const t = new THREE.Vector3(p.x, 1, p.z);
  applyLimits("free");
  const done = () => applyLimits(state.mode);
  if (state.mode === "walking") {
    const w = walkingEye(t);
    flyTo(w.eye, w.target, 900, done);
  } else if (state.mode === "topdown") {
    flyTo(new THREE.Vector3(t.x, Math.max(camera.position.y, 40), t.z + 0.01), new THREE.Vector3(t.x, 0, t.z), 900, done);
  } else {
    const dist = Math.min(Math.max(camera.position.distanceTo(controls.target), 30), 60);
    const off = camera.position.clone().sub(controls.target).normalize().multiplyScalar(dist);
    if (off.y < dist * 0.25) off.copy(obliqueDir(dist));
    flyTo(t.clone().add(off), t, 900, done);
  }
}

/* ---------- zoom in / out: step along the current view; limits are shared with wheel / pinch zoom ---------- */
function maxZoomDistance() {
  return state.mode === "topdown" ? Math.max(MAX_ZOOM_DISTANCE, topDownPose().height * 1.5) : MAX_ZOOM_DISTANCE;
}

function zoomBy(factor) {
  if (!ready || state.mode === "walking") return;
  const target = (fly ? fly.t1 : controls.target).clone();
  const off = (fly ? fly.p1 : camera.position).clone().sub(target);
  const dist = off.length();
  const next = THREE.MathUtils.clamp(dist * factor, MIN_ZOOM_DISTANCE, maxZoomDistance());
  if (Math.abs(next - dist) < 0.01) return;
  flyTo(target.clone().add(off.setLength(next)), target, 450, fly ? fly.done : undefined);
}

const zoomIn = () => zoomBy(1 / ZOOM_STEP);

const zoomOut = () => zoomBy(ZOOM_STEP);

function syncZoomButtons() {
  if (!ready) return;
  const d = camera.position.distanceTo(controls.target);
  dom.zoomIn.disabled = state.mode === "walking" || d <= MIN_ZOOM_DISTANCE + 0.5;
  dom.zoomOut.disabled = state.mode === "walking" || d >= maxZoomDistance() - 0.5;
}

export function syncDock() {
  document.querySelectorAll("[data-mode]").forEach((b) => {
    const on = b.dataset.mode === state.mode;
    b.setAttribute("aria-pressed", String(on));
    b.classList.toggle("is-on", on);
  });
  syncZoomButtons();
}

/* Binds the view-mode buttons, zoom buttons and keyboard (walking keys + Escape). */
export function bindCameraControls({ onEscape }) {
  document.querySelectorAll("[data-mode]").forEach((b) => b.addEventListener("click", () => {
    if (b.dataset.mode === state.mode && b.dataset.mode !== "topdown") return;
    setMode(b.dataset.mode, { force: true });
  }));

  dom.zoomIn.addEventListener("click", zoomIn);
  dom.zoomOut.addEventListener("click", zoomOut);

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { onEscape(); return; }
    if (e.target.matches("input")) return;
    keys.add(e.key.toLowerCase());
  });
  window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
  window.addEventListener("blur", () => keys.clear());
}

/* =====================================================================
   Picking, hover and tooltip
   ===================================================================== */

const raycaster = typeof THREE !== "undefined" ? new THREE.Raycaster() : null;

const ndc = typeof THREE !== "undefined" ? new THREE.Vector2() : null;

/* ---------- picking + tooltip ---------- */
function pickAt(cx, cy) {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObjects(pickables, false);
  for (const h of hits) {
    const id = h.object.userData.id;
    if (pins.get(id).targetOpacity > 0.5) return id;
  }
  return null;
}

function setHover(id) {
  if (id === hoverId) { if (id != null) moveTooltip(); return; }
  hoverId = id;
  refreshPinStates();
  if (renderer) renderer.domElement.style.cursor = id != null ? "pointer" : "";
  if (id == null) { hideTooltip(); return; }
  const loc = locById.get(id);
  dom.tImg.src = loc.imageUrl;
  dom.tImg.alt = `${loc.title} preview`;
  dom.tTitle.textContent = `${loc.id}. ${loc.title}`;
  dom.tDesc.textContent = loc.description;
  dom.tooltip.classList.add("is-visible");
  dom.tooltip.setAttribute("aria-hidden", "false");
  moveTooltip();
}

function moveTooltip() {
  const gap = 18, pad = 12, rect = dom.tooltip.getBoundingClientRect();
  let left = pointer.x + gap, top = pointer.y + gap;
  if (left + rect.width > window.innerWidth - pad) left = pointer.x - rect.width - gap;
  if (top + rect.height > window.innerHeight - pad) top = pointer.y - rect.height - gap;
  dom.tooltip.style.left = `${Math.max(pad, left)}px`;
  dom.tooltip.style.top = `${Math.max(pad, top)}px`;
}

function hideTooltip() {
  dom.tooltip.classList.remove("is-visible");
  dom.tooltip.setAttribute("aria-hidden", "true");
}

/* =====================================================================
   Scene setup
   ===================================================================== */

/* ---------- scene setup (3D campus) ---------- */
export function initScene({ onSelectLocation }) {
  if (!window.THREE || !THREE.OrbitControls) throw new Error("Three.js failed to load (network or CDN blocked).");
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  } catch (e) {
    throw new Error("WebGL is not available in this browser.");
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  MAX_ANISO = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  dom.host.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(42, 1, 0.12, 900);

  setupLighting();
  buildGround();
  const rec = buildCampus();
  addCampusWalkways();
  runSpatialAudit();
  addContactShadows();
  addTrees();

  campusLocations.forEach((loc) => {
    const r = rec[loc.id], [mx, mz] = pxToM(loc.coordinates.center.x, loc.coordinates.center.y);
    const own = r.parts.find((pt) => inPart(pt, mx, mz, 1)), hosts = ALLPARTS.filter((pt) => pt.id !== 0 && inPart(pt, mx, mz, 1));
    // a marker sits on its own structure; markers without a model (e.g. #21 on the Main Academic Building facade) sit on whatever they overlap
    const anchor = r.sp ? (r.sp.anchorY ?? (own ? own.topY : r.sp.topY)) : own ? own.topY : r.parts.length ? Math.max(...r.parts.map((pt) => pt.topY)) : hosts.length ? Math.max(...hosts.map((pt) => pt.topY)) : 1.8;
    const base = toWorld(loc.coordinates.center), pin = buildPin(loc, anchor);
    pin.group.position.set(base.x, (anchor + 0.5) * M, base.z);
    scene.add(pin.group);
    pickables.push(pin.sprite);
    const dims = r.parts.length ? Math.max(...r.parts.map((pt) => Math.max(pt.w, pt.d))) : r.sp ? 10 : 6;
    pins.set(loc.id, { ...pin, build: { mats: r.mats }, base, worldPos: pin.group.position, topY: anchor * M, scale: 1, targetScale: 1, opacity: 1, targetOpacity: 1, collapsed: false, keep: false, radius: Math.min(Math.max(dims * 0.4 * M, 1.6), 9) });
  });

  selRing = new THREE.Mesh(new THREE.RingGeometry(2.1, 2.45, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xf1b434, transparent: true, opacity: 0.9, depthTest: false }));
  selRing.renderOrder = 4;
  scene.add(selRing);
  pathGroup = new THREE.Group();
  scene.add(pathGroup);

  /* controls */
  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.screenSpacePanning = false;
  controls.addEventListener("start", () => {
    const interrupted = fly;
    fly = null;
    // A drag that interrupts the fly-to-top-down must still land in the fixed top-down orientation.
    if (interrupted && state.mode === "topdown") applyLimits("topdown");
  });
  controls.addEventListener("change", syncZoomButtons);

  const home = toWorld({ x: 1130, y: 560 });
  homeTarget = new THREE.Vector3(home.x, 1, home.z);
  homePos = homeTarget.clone().add(obliqueDir(88));
  camera.position.copy(homePos);
  controls.target.copy(homeTarget);
  applyLimits("orbit");

  /* input */
  const el = renderer.domElement;
  el.addEventListener("pointermove", (e) => { pointer.x = e.clientX; pointer.y = e.clientY; pointer.moved = true; pointer.inside = true; });
  el.addEventListener("pointerleave", () => { pointer.inside = false; setHover(null); });
  el.addEventListener("pointerdown", (e) => { pointer.downX = e.clientX; pointer.downY = e.clientY; });
  el.addEventListener("pointerup", (e) => {
    if (Math.hypot(e.clientX - pointer.downX, e.clientY - pointer.downY) > 5) return;
    const id = pickAt(e.clientX, e.clientY);
    if (id != null) onSelectLocation(id);
  });
  window.addEventListener("resize", onResize);
  onResize();
  ready = true;
}

/* =====================================================================
   Render loop
   ===================================================================== */

/* ---------- render loop ---------- */
export function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, (now - lastFrame) / 1000 || 0.016);
  lastFrame = now;

  if (fly) {
    const k = Math.min(1, Math.max(0, (now - fly.s) / fly.d));
    const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    camera.position.lerpVectors(fly.p0, fly.p1, e);
    controls.target.lerpVectors(fly.t0, fly.t1, e);
    if (k >= 1) { const d = fly.done; fly = null; if (d) d(); }
  } else if (state.mode === "walking" && keys.size) {
    const dir = new THREE.Vector3().subVectors(controls.target, camera.position).setY(0);
    if (dir.lengthSq() > 0) {
      dir.normalize();
      const right = new THREE.Vector3(-dir.z, 0, dir.x);
      const mv = new THREE.Vector3();
      if (keys.has("w") || keys.has("arrowup")) mv.add(dir);
      if (keys.has("s") || keys.has("arrowdown")) mv.sub(dir);
      if (keys.has("d") || keys.has("arrowright")) mv.add(right);
      if (keys.has("a") || keys.has("arrowleft")) mv.sub(right);
      if (mv.lengthSq() > 0) {
        mv.normalize().multiplyScalar((keys.has("shift") ? 11 : 4.5) * M * dt);
        camera.position.add(mv); controls.target.add(mv);
        camera.position.x = THREE.MathUtils.clamp(camera.position.x, -WORLD_W / 2, WORLD_W / 2);
        camera.position.z = THREE.MathUtils.clamp(camera.position.z, -WORLD_H / 2, WORLD_H / 2);
      }
    }
  }
  if (!fly && state.mode !== "walking") {
    controls.target.x = THREE.MathUtils.clamp(controls.target.x, -WORLD_W / 2 - 10, WORLD_W / 2 + 10);
    controls.target.z = THREE.MathUtils.clamp(controls.target.z, -WORLD_H / 2 - 10, WORLD_H / 2 + 10);
  }
  controls.update();

  const k = 1 - Math.exp(-dt * 10);
  const perPx = (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) / (renderer.domElement.clientHeight || 800);
  if (overlapFrame++ % 6 === 0) resolvePinOverlap();
  pins.forEach((p, id) => {
    const tgt = p.collapsed && !p.keep && id !== hoverId ? 0.45 : targetOf(p, id);
    p.scale += (tgt - p.scale) * k;
    const dist = camera.position.distanceTo(p.worldPos), sz = dist * perPx * PIN_PX * p.scale;
    p.sprite.scale.set(sz, sz * 1.25, 1);
    const fade = state.mode === "walking" ? 1 - 0.9 * THREE.MathUtils.clamp((dist - 45) / 40, 0, 1) : 1;
    const to = p.targetOpacity * fade * (p.collapsed && !p.keep ? 0.8 : 1);
    if (Math.abs(to - p.opacity) > 0.002) { p.opacity += (to - p.opacity) * k; p.spriteMat.opacity = p.opacity; }
  });
  if (state.mode === "walking") { setShadowFrustum(controls.target, 46); shadowLocal = true; }
  else if (shadowLocal) { setShadowFrustum(new THREE.Vector3(8, 0, 8), 112); shadowLocal = false; }
  const pulse = 1 + 0.1 * Math.sin(now / 380);
  selRing.scale.set(pulse * selRingBase, 1, pulse * selRingBase);
  pathTextures.forEach((t) => { t.offset.x -= dt * 0.9; });

  renderer.render(scene, camera);

  if (pointer.moved && pointer.inside) {
    pointer.moved = false;
    if (!fly) setHover(pickAt(pointer.x, pointer.y));
  }
}

/* Reset the camera to the home view (used by the app-level reset). */
export function resetCameraView() {
  if (ready) {
    setFogEnabled(true);
    applyLimits("free");
    flyTo(homePos, homeTarget, 1000, () => applyLimits("orbit"));
  }
}
