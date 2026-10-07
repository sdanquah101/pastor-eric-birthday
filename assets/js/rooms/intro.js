/* ================= OPENING: FIVE PHOTOS WEAVE INTO ONE =================
   Four photos are cut into a grid of cells. Warp cells (columns) drop in,
   weft cells (rows) shoot across, then the final portrait comes through
   the weave diagonally. */
import { $, reduced, isSmall } from "../lib/dom.js";
import { photo, bestSrc, loadImg, place } from "../lib/photos.js";
import SITE from "../../../content/site.js";

export async function intro(onLeave, photosReady) {
  const box = $("#intro"), mosaic = $("#mosaic"), status = $("#introStatus");
  document.body.classList.add("is-locked");

  let finished = false, left = false;
  const finish = () => {
    if (finished) return; finished = true;
    mosaic.querySelectorAll(".cell").forEach((c) => {
      c.getAnimations({ subtree: true }).forEach((a) => a.finish());
      c.style.opacity = "1"; c.lastChild.style.opacity = "1";
    });
    mosaic.classList.add("is-done");
    status.textContent = "";
    $("#introText").classList.add("is-in");
    setTimeout(() => $("#enter").focus({ preventScroll: true }), 300);
  };
  const leave = () => {
    if (left) return; left = true;
    finish();
    const gone = () => { box.remove(); document.body.classList.remove("is-locked"); };
    onLeave();
    if (reduced) return gone();
    box.classList.add("is-leaving");
    setTimeout(gone, 1000);
  };
  $("#enter").addEventListener("click", leave);
  $("#skip").addEventListener("click", leave);
  document.addEventListener("keydown", function k(e) {
    if (e.key === "Escape" && document.body.contains(box)) { leave(); document.removeEventListener("keydown", k); }
  });

  // size the frame: portrait 3:4, as large as the screen allows next to (or above) the name
  const small = isSmall();
  const landscapePhone = !small && innerHeight < 520;
  let H = Math.min(innerHeight * (small ? 0.5 : landscapePhone ? 0.8 : 0.76), 760), W = H * 0.75;
  if (W > innerWidth * 0.86) { W = innerWidth * 0.86; H = W / 0.75; }
  mosaic.style.setProperty("--mw", W + "px");
  mosaic.style.setProperty("--mh", H + "px");

  await photosReady;
  if (left) return;
  const cfg = SITE.intro || {};
  const weave = (cfg.weave || []).map(photo).filter(Boolean);
  const final = photo(cfg.final) || weave[0];
  if (!final) { finish(); return; } // no photos yet: just the name and the button
  while (weave.length < 4) weave.push(final);

  status.textContent = "Weaving";
  const srcs = new Map([...weave, final].map((p) => [p.id, bestSrc(p, W, H)]));
  await Promise.all([...srcs.values()].map(loadImg));
  if (left) return;

  const C = small ? 5 : 6, R = small ? 7 : 8, cw = W / C, ch = H / R;
  const fin = place(final, W, H, 0.18);
  const cells = [];
  for (let i = 0; i < R; i++) for (let j = 0; j < C; j++) {
    const warp = (i + j) % 2 === 0;
    const p = warp ? weave[j % 2] : weave[2 + (i % 2)];
    const c = place(p, W, H, 0.25);
    const el = document.createElement("div");
    el.className = "cell " + (warp ? "cell--warp" : "cell--weft");
    Object.assign(el.style, { left: j * cw + "px", top: i * ch + "px", width: Math.ceil(cw) + 1 + "px", height: Math.ceil(ch) + 1 + "px", opacity: "0" });
    const a = document.createElement("i"), b = document.createElement("i");
    Object.assign(a.style, {
      backgroundImage: `url(${srcs.get(p.id)})`, backgroundSize: `${c.bw}px ${c.bh}px`,
      backgroundPosition: `${c.ox - j * cw}px ${c.oy - i * ch}px`,
    });
    Object.assign(b.style, {
      backgroundImage: `url(${srcs.get(final.id)})`, backgroundSize: `${fin.bw}px ${fin.bh}px`,
      backgroundPosition: `${fin.ox - j * cw}px ${fin.oy - i * ch}px`,
    });
    el.append(a, b);
    mosaic.append(el);
    cells.push({ el, b, i, j, warp });
  }

  if (reduced) return finish();
  const E = "cubic-bezier(.2,.75,.15,1)";
  // 1. warp: columns drop and rise into place, alternating
  cells.filter((c) => c.warp).forEach((c) => {
    c.el.style.opacity = "1";
    const dir = c.j % 2 ? 1 : -1;
    c.el.animate([{ transform: `translateY(${dir * (H + 120)}px)` }, { transform: "none" }],
      { duration: 1100, delay: 100 + c.j * 110, easing: E, fill: "backwards" });
  });
  // 2. weft: rows shoot across from alternating sides
  cells.filter((c) => !c.warp).forEach((c) => {
    const dir = c.i % 2 ? 1 : -1;
    c.el.animate([{ transform: `translateX(${dir * (W + 160)}px)`, opacity: 1 }, { transform: "none", opacity: 1 }],
      { duration: 1000, delay: 1150 + c.i * 90, easing: E, fill: "backwards" }).onfinish = () => (c.el.style.opacity = "1");
  });
  // 3. the fifth photo comes through the weave, diagonally
  const t3 = 1150 + R * 90 + 1100;
  cells.forEach((c) => {
    c.b.animate([{ opacity: 0, transform: "scale(1.08)" }, { opacity: 1, transform: "none" }],
      { duration: 700, delay: t3 + (c.i + c.j) * 55, easing: "ease-out", fill: "both" });
  });
  setTimeout(finish, t3 + (R + C) * 55 + 700);
}
