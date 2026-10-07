/* ================= GALLERY: THE LOOM + ALL PHOTOS =================
   Loom view: the frame is cut into vertical strips. When the photo changes,
   each strip carries [current photo, a length of kente, next photo]; odd and
   even strips travel in opposite directions at different speeds, so the
   picture unweaves into cloth and reweaves as the next one. Only the two
   photos involved are ever in the frame, so it stays light with hundreds.

   Grid view: every photo as a lazy-loaded thumbnail, with album filters
   when photos/originals/ has sub-folders. Tapping one opens it in the loom. */
import { $, $$, h, reduced, isSmall, onResize } from "../lib/dom.js";
import { stripBg, stripBgH } from "../lib/kente.js";
import { galleryPhotos, albums, bestSrc, srcset, loadImg, place, fitFor, altText } from "../lib/photos.js";
import { onRoom, currentRoom } from "./nav.js";
import SITE from "../../../content/site.js";

const cfg = SITE.gallery || {};
let list = [];            // photos in the current album
let album = "";           // "" = all
let idx = 0;              // photo asked for
let shown = 0;            // photo standing still in the frame
let view = "loom";
let active = false;
let FW = 0, FH = 0, SW = 0, N = 0, KH = 0, U = 0;
let strips = [];
let raf = 0, token = 0, moving = false;
let lastInput = 0, auto = 0, gridBuilt = false;

const room = () => $("#gallery");

/* ---------- loom ---------- */
function layout() {
  const frame = $("#loomframe"), stage = $("#gStage");
  if (!stage.clientWidth) return;
  const small = isSmall();
  const cs = getComputedStyle(stage);
  const availW = stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  const availH = stage.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
  // tall screens get a portrait frame, wide ones a landscape frame
  const ratio = availH > availW * 1.1 ? 0.8 : 1.5;
  FW = Math.min(availW, availH * ratio, 1180);
  FH = FW / ratio;
  if (FH > availH) { FH = availH; FW = FH * ratio; }
  N = small ? 6 : 10;
  SW = Math.floor(FW / N);           // whole-pixel strips, so no hairline gaps between them
  FW = SW * N; FH = Math.floor(FH);
  KH = Math.round(FH * 0.8); U = FH + KH;
  frame.style.width = FW + "px"; frame.style.height = FH + "px";
  frame.textContent = "";
  strips = [];
  for (let j = 0; j < N; j++) {
    const reel = h("div", { class: "lreel" });
    const s = h("div", { class: "lstrip", style: { width: SW + "px" } }, reel);
    frame.append(s);
    // centre strips arrive first, edges trail behind: the cloth ripples outwards
    const dist = N > 1 ? Math.abs(j - (N - 1) / 2) / ((N - 1) / 2) : 0;
    strips.push({ j, reel, rev: j % 2 === 1, k: 0.065 - dist * 0.028, lag: dist * 220, pos: 0, v: 0, target: 0, start: 0 });
  }
  moving = false; cancelAnimationFrame(raf); raf = 0;
  settle(idx);
}

function photoSeg(p, j) {
  const fit = fitFor(p, FW, FH);
  const c = place(p, FW, FH, p.focus ?? 0.3, fit);
  const style = { height: FH + "px", backgroundColor: "#141210" };
  const x = (v) => `${v - j * SW}px`;
  if (fit === "cover") {
    Object.assign(style, {
      backgroundImage: `url(${bestSrc(p, FW, FH)})`,
      backgroundSize: `${c.bw}px ${c.bh}px`, backgroundPosition: `${x(c.ox)} ${c.oy}px`,
    });
  } else {
    // the whole photo, over a dimmed, softly enlarged copy of itself
    const b = place(p, FW, FH, p.focus ?? 0.3, "cover");
    Object.assign(style, {
      backgroundImage: `url(${bestSrc(p, FW, FH, "contain")}), linear-gradient(rgba(20,18,16,.62), rgba(20,18,16,.62)), url(photos/web/${p.id}-${p.widths[0]}.webp)`,
      backgroundSize: `${c.bw}px ${c.bh}px, 100% 100%, ${b.bw}px ${b.bh}px`,
      backgroundPosition: `${x(c.ox)} ${c.oy}px, 0 0, ${x(b.ox)} ${b.oy}px`,
    });
  }
  return h("span", { class: "lseg", style });
}
function kenteSeg(j) {
  return h("span", { class: "lseg lseg--kente", style: { height: KH + "px", backgroundImage: stripBg(200 + (j % 5)).url } });
}

/** Show photo k still in the frame, with nothing else on the reels. */
function settle(k) {
  const p = list[k];
  shown = k;
  strips.forEach((s) => {
    s.reel.textContent = "";
    if (p) s.reel.append(photoSeg(p, s.j));
    s.pos = s.target = 0; s.v = 0;
    s.reel.style.transform = "translate3d(0,0,0)";
  });
  mark();
  // have the neighbours ready for the next turn
  [k + 1, k - 1].forEach((n) => { const q = list[(n + list.length) % list.length]; if (q) loadImg(bestSrc(q, FW, FH, fitFor(q, FW, FH))); });
}

function mark() {
  const p = list[idx], n = list.length;
  $("#gCount").textContent = n ? `${idx + 1} / ${n}` : "";
  $("#gThread").style.width = n ? `${((idx + 1) / n) * 100}%` : "0";
  const cap = $("#gCaption");
  cap.textContent = p?.caption || "";
  cap.hidden = !p?.caption;
  $("#loomframe").setAttribute("aria-label", p ? altText(p, idx) : "No photos yet");
}

async function to(k, { user = true, dir } = {}) {
  if (!list.length || !strips.length) return;
  k = (k + list.length) % list.length;
  if (user) lastInput = performance.now();
  const my = ++token;
  // a turn already under way snaps to its end before the next one starts
  if (moving) { moving = false; cancelAnimationFrame(raf); raf = 0; settle(idx); }
  const from = shown;
  idx = k;
  mark();
  if (k === from) return;
  dir ??= k > from ? 1 : -1;
  const a = list[from], b = list[k];
  if (reduced) return settle(k);

  const frame = $("#loomframe");
  frame.classList.add("is-loading");
  await Promise.race([loadImg(bestSrc(b, FW, FH, fitFor(b, FW, FH))), new Promise((ok) => setTimeout(ok, 6000))]);
  frame.classList.remove("is-loading");
  if (my !== token) return; // a newer turn took over while this photo loaded

  const now = performance.now();
  strips.forEach((s) => {
    const up = (dir > 0) !== s.rev;
    s.reel.textContent = "";
    if (up) { s.reel.append(photoSeg(a, s.j), kenteSeg(s.j), photoSeg(b, s.j)); s.pos = 0; s.target = U; }
    else { s.reel.append(photoSeg(b, s.j), kenteSeg(s.j), photoSeg(a, s.j)); s.pos = U; s.target = 0; }
    s.v = 0; s.start = now + s.lag;
    s.reel.style.transform = `translate3d(0,${-s.pos}px,0)`;
  });
  moving = true;
  raf = requestAnimationFrame(loop);
}

function loop() {
  let still = true;
  const now = performance.now();
  strips.forEach((s) => {
    if (now < s.start) { still = false; return; }
    // spring with a little overshoot, like cloth settling
    s.v = (s.v + (s.target - s.pos) * s.k * 0.5) * 0.8;
    s.pos += s.v;
    if (Math.abs(s.target - s.pos) > 0.4 || Math.abs(s.v) > 0.4) still = false; else { s.pos = s.target; s.v = 0; }
    s.reel.style.transform = `translate3d(0,${(-s.pos).toFixed(1)}px,0)`;
  });
  if (!still) { raf = requestAnimationFrame(loop); return; }
  raf = 0; moving = false;
  settle(idx);
}

function bindLoom() {
  const frame = $("#loomframe"), stage = $("#gStage");
  $("#gNext").addEventListener("click", () => to(idx + 1, { dir: 1 }));
  $("#gPrev").addEventListener("click", () => to(idx - 1, { dir: -1 }));
  let acc = 0, lock = 0;
  stage.addEventListener("wheel", (e) => {
    if (view !== "loom") return;
    e.preventDefault();
    const now = performance.now();
    if (now < lock) return;
    acc += Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    if (Math.abs(acc) > 50) { const d = Math.sign(acc); to(idx + d, { dir: d }); acc = 0; lock = now + 750; }
  }, { passive: false });
  let sx = 0, sy = 0, down = false;
  frame.addEventListener("pointerdown", (e) => { down = true; sx = e.clientX; sy = e.clientY; frame.setPointerCapture(e.pointerId); });
  frame.addEventListener("pointercancel", () => (down = false));
  frame.addEventListener("pointerup", (e) => {
    if (!down) return; down = false;
    const dx = e.clientX - sx, dy = e.clientY - sy, d = Math.abs(dx) > Math.abs(dy) ? dx : dy;
    if (Math.abs(d) > 40) { const n = d < 0 ? 1 : -1; to(idx + n, { dir: n }); }
    else if (Math.abs(d) < 6) to(idx + 1, { dir: 1 });
  });
  document.addEventListener("keydown", (e) => {
    if (!active || view !== "loom" || $("#reader").open || e.target.closest?.("input, textarea, select")) return;
    if (["ArrowRight", "ArrowDown", "PageDown"].includes(e.key) || (e.key === " " && e.target === frame)) { e.preventDefault(); to(idx + 1, { dir: 1 }); }
    if (["ArrowLeft", "ArrowUp", "PageUp"].includes(e.key)) { e.preventDefault(); to(idx - 1, { dir: -1 }); }
  });
}

function autoplay(on) {
  clearInterval(auto);
  const secs = Number(cfg.autoplay ?? 5);
  if (!on || reduced || !secs) return;
  auto = setInterval(() => {
    if (active && view === "loom" && !document.hidden && performance.now() - lastInput > 9000) to(idx + 1, { user: false, dir: 1 });
  }, secs * 1000);
}

/* ---------- grid ---------- */
function buildGrid() {
  gridBuilt = true;
  const names = albums(), all = galleryPhotos();
  const chips = $("#gAlbums");
  chips.hidden = names.length === 0;
  if (names.length) {
    const chip = (name, label, count) => h("button", {
      type: "button", class: "pill" + (name === album ? " is-on" : ""), "aria-pressed": String(name === album),
      onclick: () => setAlbum(name),
    }, label, h("span", { class: "pill__n", text: String(count) }));
    chips.append(chip("", "All", all.length), ...names.map((n) => chip(n, n, all.filter((p) => p.album === n).length)));
  }
  renderGrid();
}

function renderGrid() {
  const ul = $("#photogrid");
  ul.textContent = "";
  ul.append(...list.map((p, i) => h("li", {},
    h("button", { type: "button", class: "ph", "aria-label": `Open photo ${i + 1}: ${altText(p, i)}`, onclick: () => openFromGrid(i) },
      h("img", {
        src: bestSrc(p, 200, 200), srcset: srcset(p), sizes: "(max-width: 760px) 34vw, 220px",
        width: p.w, height: p.h, alt: "", loading: i < 12 ? "eager" : "lazy", decoding: "async",
        style: { backgroundColor: p.color, objectPosition: `50% ${Math.round((p.focus ?? 0.3) * 100)}%` },
      })))));
  $("#gEmpty").hidden = list.length > 0;
}

function setAlbum(name) {
  album = name;
  const all = galleryPhotos();
  list = name ? all.filter((p) => p.album === name) : all;
  $$("#gAlbums .pill").forEach((b, i) => {
    const on = (i === 0 ? "" : albums()[i - 1]) === name;
    b.classList.toggle("is-on", on); b.setAttribute("aria-pressed", String(on));
  });
  idx = 0;
  renderGrid();
  $("#gTotal").textContent = countLabel();
  if (strips.length) settle(0);
}

function openFromGrid(i) {
  idx = i;
  setView("loom");
  $("#loomframe").focus({ preventScroll: true });
}

function setView(v) {
  view = v;
  room().dataset.view = v;
  $$(".switch--gallery .pill").forEach((b) => { const on = b.dataset.view === v; b.classList.toggle("is-on", on); b.setAttribute("aria-pressed", String(on)); });
  $("#gLoom").hidden = v !== "loom";
  $("#gGrid").hidden = v !== "grid";
  scrollTo(0, 0);
  if (v === "grid") { if (!gridBuilt) buildGrid(); }
  else requestAnimationFrame(layout);
  autoplay(v === "loom");
}

const countLabel = () => `${list.length} photo${list.length === 1 ? "" : "s"}`;

export function setupGallery() {
  list = galleryPhotos();
  $("[data-gallery-heading]").textContent = cfg.heading || "Gallery";
  $("#gTotal").textContent = countLabel();
  $("#gThread").style.backgroundImage = stripBgH(300);
  room().dataset.view = "loom";
  $$(".switch--gallery .pill").forEach((b) => b.addEventListener("click", () => setView(b.dataset.view)));
  bindLoom();
  onResize(() => { if (active && view === "loom") layout(); }, 150);
  onRoom("gallery", {
    enter() { active = true; if (view === "loom") { layout(); autoplay(true); } },
    leave() { active = false; autoplay(false); },
  });
  if (currentRoom() === "gallery") { active = true; layout(); autoplay(true); }
}
