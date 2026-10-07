// The photo library: reads content/photos.json (written by `npm run photos`)
// and picks the right size of each photo for the space it's shown in.
const BASE = "photos/web/";

let all = [];
let byId = new Map();

export async function loadPhotos() {
  try {
    const r = await fetch("content/photos.json");
    if (!r.ok) throw new Error(r.status);
    all = ((await r.json()).photos || []).filter((p) => p.id && p.widths?.length);
  } catch (e) {
    console.warn("[birthday] content/photos.json could not be loaded. Run `npm run photos`.", e);
    all = [];
  }
  byId = new Map(all.map((p) => [p.id, p]));
  return all;
}

/** Photos shown in the gallery, in order. */
export const galleryPhotos = () => all.filter((p) => !p.hidden);
export const photo = (id) => byId.get(id) || null;
export const albums = () => [...new Set(galleryPhotos().map((p) => p.album).filter(Boolean))];

export const url = (p, w) => `${BASE}${p.id}-${w}.webp`;
export const srcset = (p) => p.widths.map((w) => `${url(p, w)} ${w}w`).join(", ");
export const altText = (p, i) => p.alt || `Photograph ${i + 1} of Pastor Eric`;

/** Smallest file that still looks sharp in a box of cssW x cssH (cover) on this screen. */
export function bestSrc(p, cssW, cssH = cssW, fit = "cover") {
  const dpr = Math.min(devicePixelRatio || 1, 2.5);
  const ar = p.w / p.h;
  const needW = (fit === "cover" ? Math.max(cssW, cssH * ar) : Math.min(cssW, cssH * ar)) * dpr;
  const w = p.widths.find((x) => x >= needW * 0.9) || p.widths[p.widths.length - 1];
  return url(p, w);
}

const loaded = new Map();
/** Resolves once the image is downloaded and decoded (or failed). Never rejects. */
export function loadImg(src) {
  if (loaded.has(src)) return loaded.get(src);
  const pr = new Promise((ok) => {
    const im = new Image();
    im.decoding = "async";
    im.onload = () => (im.decode ? im.decode().catch(() => {}) : Promise.resolve()).then(() => ok(im));
    im.onerror = () => ok(im);
    im.src = src;
  });
  loaded.set(src, pr);
  return pr;
}

/** Background size/position that place a photo in a W x H box.
    cover: fill the box, keeping the vertical `focus` point (0 top, 1 bottom) in view.
    contain: the whole photo, centred. */
export function place(p, W, H, focus = 0.3, fit = "cover") {
  const iw = p.w || 1000, ih = p.h || 1500;
  const s = fit === "cover" ? Math.max(W / iw, H / ih) : Math.min(W / iw, H / ih);
  const bw = iw * s, bh = ih * s;
  return { bw, bh, ox: (W - bw) / 2, oy: fit === "cover" ? (H - bh) * focus : (H - bh) / 2 };
}

/** Cover when the photo's shape is close to the frame's, otherwise show it whole. */
export function fitFor(p, W, H) {
  const r = (p.w / p.h) / (W / H);
  return r > 0.78 && r < 1.28 ? "cover" : "contain";
}
