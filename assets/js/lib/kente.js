/* ================= KENTE GENERATOR =================
   Drawn thread by thread on a canvas. Each strip is a grid of threads:
   warp-faced sections show vertical threads (stripes, with the "pick and
   pick" ticks of alternating colours), weft-faced blocks show horizontal
   threads carrying the motifs. Every thread is shaded as a round fibre,
   interlaced over/under, with dye variation and grain, then strips are
   sewn side by side with offset blocks, the way real kente is assembled. */
import { $$, reduced } from "./dom.js";

const RGB = {
  G: [226, 166, 16], g: [244, 192, 44], B: [24, 22, 20], U: [30, 56, 172],
  N: [20, 32, 92], W: [234, 226, 206], R: [150, 32, 28],
};
const CELL = 3, TW = 36; // px per thread, threads per strip width

export function rand(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
export function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// warp layouts (half-width, mirrored). "T" = tick pair: two colours alternating each pick
const WARPS = [
  "BBGBGGGUGUGGBGGGTT",
  "BBGGBGGGGBUUBGGGTT",
  "BBGBUUGGGTTGGBGGGU",
  "BBGGGBGBGGUGGGBTTG",
];
const TICK = { G: ["B", "G"], U: ["G", "U"] };

// weft-faced motif blocks: return a colour key for thread cell (x, y) inside a block of height h
const MOTIFS = [
  // concentric stepped diamonds
  (x, y, h) => {
    const cx = (TW - 1) / 2, cy = (h - 1) / 2;
    if (y < 2 || y >= h - 2) return "B";
    if (x < 2 || x >= TW - 2) return "G";
    const d = Math.abs(x - cx) + Math.abs(y - cy) * 1.2;
    return Math.floor(d / 2.4) % 2 ? "B" : "G";
  },
  // zigzag on navy
  (x, y, h) => {
    if (y < 2 || y >= h - 2) return "G";
    const p = 12, tri = Math.abs(((x % p) + p) % p - p / 2);
    const v = (y + tri) % 8;
    return v < 2 ? "G" : v < 3 ? "B" : "N";
  },
  // chequer of small blocks, black frame
  (x, y, h) => {
    if (y < 2 || y >= h - 2 || x < 2 || x >= TW - 2) return "B";
    const bx = Math.floor((x - 2) / 4), by = Math.floor((y - 2) / 4);
    return (bx + by) % 2 ? "U" : "G";
  },
  // horizontal bands with gold bars (weft floats)
  (x, y, h) => {
    const band = ["B", "B", "G", "G", "B", "U", "U", "U", "U", "U", "U", "B", "G", "G", "B", "B"];
    const c = band[Math.floor((y / h) * band.length)];
    if (c === "U" && x % 6 > 2 && (Math.floor(y / 2) % 2 === 0)) return "g";
    return c;
  },
  // nested blocks (nkyemfre style)
  (x, y, h) => {
    const dx = Math.min(x, TW - 1 - x), dy = Math.min(y, h - 1 - y), d = Math.min(dx, dy);
    return ["B", "B", "G", "G", "B", "U", "U", "B", "G", "G", "B", "G"][d % 12];
  },
];

function buildStrip(seed) {
  const r = rand(seed);
  const half = WARPS[seed % WARPS.length];
  const cols = (half + [...half].reverse().join("")).split("");
  const tickKind = pick(r, ["G", "G", "U"]);
  const mA = MOTIFS[seed % MOTIFS.length], mB = MOTIFS[(seed * 3 + 2) % MOTIFS.length];
  // sections: [type, rows]
  const secs = [["warp", 52], ["weft", 30, mA], ["warp", 14], ["weft", 36, mB]];
  const rows = secs.reduce((a, s) => a + s[1], 0);
  const grid = new Array(TW * rows);
  let y0 = 0;
  for (const [type, h, fn] of secs) {
    for (let y = 0; y < h; y++) for (let x = 0; x < TW; x++) {
      let k;
      if (type === "warp") {
        k = cols[x];
        if (k === "T") k = TICK[tickKind][(y + x) % 2];
      } else k = fn(x, y, h);
      grid[(y0 + y) * TW + x] = [k, type];
    }
    y0 += h;
  }
  return { grid, rows, r };
}

function paintStrip(seed) {
  const { grid, rows, r } = buildStrip(seed);
  const w = TW * CELL, h = rows * CELL;
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const ctx = cv.getContext("2d");
  const img = ctx.createImageData(w, h), d = img.data;
  const lot = (r() - 0.5) * 14; // dye lot: whole strip slightly lighter/darker
  const colJ = Array.from({ length: TW }, () => (r() - 0.5) * 16);
  const rowJ = Array.from({ length: rows }, () => (r() - 0.5) * 14);
  const warpShade = [16, 4, -26];  // round vertical thread: lit left, shadow right
  const weftShade = [14, 2, -24];  // round horizontal thread: lit top, shadow bottom
  for (let ty = 0; ty < rows; ty++) for (let tx = 0; tx < TW; tx++) {
    const [k, face] = grid[ty * TW + tx];
    const base = RGB[k] || RGB.B;
    const j = lot + (face === "warp" ? colJ[tx] : rowJ[ty]) + (r() - 0.5) * 6;
    const under = (tx + ty) % 2 === 0; // interlacement: thread dips under its crossing thread
    for (let py = 0; py < CELL; py++) for (let px = 0; px < CELL; px++) {
      let s = face === "warp" ? warpShade[px] : weftShade[py];
      if (under) s -= face === "warp" ? (py === 0 ? 18 : 0) : (px === 0 ? 16 : 0);
      s += (r() - 0.5) * 10; // fibre grain
      const i = ((ty * CELL + py) * w + tx * CELL + px) * 4;
      d[i] = base[0] + j + s; d[i + 1] = base[1] + j + s; d[i + 2] = base[2] + j * 0.8 + s; d[i + 3] = 255;
    }
  }
  // selvedge: the sewn edge rolls into shadow
  for (let y = 0; y < h; y++) for (const [x, k] of [[0, -55], [1, -22], [w - 2, -18], [w - 1, -50]]) {
    const i = (y * w + x) * 4; d[i] += k; d[i + 1] += k; d[i + 2] += k;
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}

const stripCache = new Map();
/** A vertical kente strip as a CSS background: { url, w, h, cv }. Cached per seed. */
export function stripBg(seed) {
  seed = Math.abs(seed | 0);
  if (stripCache.has(seed)) return stripCache.get(seed);
  const cv = paintStrip(seed);
  const v = { url: `url(${cv.toDataURL("image/png")})`, w: cv.width, h: cv.height, cv };
  stripCache.set(seed, v);
  return v;
}

const hCache = new Map();
/** The same strip turned on its side, for horizontal bars. */
export function stripBgH(seed) {
  if (hCache.has(seed)) return hCache.get(seed);
  const s = stripBg(seed), cv = document.createElement("canvas");
  cv.width = s.h; cv.height = s.w;
  const ctx = cv.getContext("2d");
  ctx.translate(0, s.w); ctx.rotate(-Math.PI / 2); ctx.drawImage(s.cv, 0, 0);
  const url = `url(${cv.toDataURL("image/png")})`;
  hCache.set(seed, url);
  return url;
}

/** Fill a [data-cloth] element with sewn strips; neighbours offset by half a repeat, slightly misaligned by hand. */
export function weaveCloth(el) {
  const seed = +el.dataset.cloth || 1, W = +el.dataset.w || 64;
  const n = Math.ceil(el.clientWidth / W) + 1, r = rand(seed * 31);
  el.dataset.wovenFor = el.clientWidth;
  el.textContent = "";
  for (let i = 0; i < n; i++) {
    const s = stripBg(seed + (i % 5));
    const sh = s.h * (W / s.w);
    const k = document.createElement("i");
    k.style.width = W + "px";
    k.style.backgroundImage = s.url;
    k.dataset.off = (i % 2) * sh / 2 + r() * 6;
    k.dataset.dir = i % 2 ? 1 : -1;
    k.style.backgroundPositionY = -k.dataset.off + "px";
    el.append(k);
  }
}

/** A single strip as the background of a [data-strip] element. */
export function strip(el) { el.style.backgroundImage = stripBg(+el.dataset.strip || 3).url; }

/** Neighbouring strips of every cloth band drift against each other as the page scrolls. */
export function clothMotion() {
  if (reduced) return;
  let ticking = false;
  const run = () => {
    ticking = false;
    $$(".cloth").forEach((b) => {
      const rc = b.getBoundingClientRect();
      if (!rc.height || rc.bottom < 0 || rc.top > innerHeight) return;
      const t = (rc.top - innerHeight / 2) * 0.1;
      for (const k of b.children) k.style.backgroundPositionY = -(+k.dataset.off) + t * k.dataset.dir + "px";
    });
  };
  addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(run); } }, { passive: true });
  run();
}

/** Each wish is a window cut from one of the woven strips. */
export function tileSeed(id) { return 100 + (hash(String(id)) % 10); }
export function tileStyle(el, id) {
  const h = hash(String(id));
  el.style.backgroundImage = stripBg(tileSeed(id)).url;
  el.style.backgroundSize = "100% auto";
  el.dataset.frac = ((h >>> 8) % 1000) / 1000;
}
export function placeTiles(loom) {
  $$(".tile[data-frac]", loom).forEach((t) => {
    const w = t.clientWidth || 60;
    const s = stripBg(tileSeed(t.dataset.id || ""));
    const sh = s.h * (w / s.w);
    t.style.backgroundPositionY = -(+t.dataset.frac * (sh - t.clientHeight)) + "px";
  });
}
