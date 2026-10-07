/* ================= HOME: THE STOLES =================
   One kente stole per room hangs from a rail. They sway with the pointer
   (or the tilt of a phone's scroll) and lengthen when hovered. */
import { $, $$, h, reduced, onResize } from "../lib/dom.js";
import { stripBg } from "../lib/kente.js";
import SITE from "../../../content/site.js";

const ROOMS = SITE.rooms || [];
const FRINGES = [["#e2a610", "#181614"], ["#1e38ac", "#e2a610"], ["#181614", "#e2a610"], ["#e2a610", "#1e38ac"]];

export function fillHome() {
  const set = (sel, text) => $$(sel).forEach((el) => (el.textContent = text));
  set("[data-title]", SITE.title || "");
  if (SITE.name) { set("[data-first]", SITE.name.first); set("[data-middle]", SITE.name.middle); set("[data-last]", SITE.name.last); }
  set("[data-hero-kicker]", SITE.heroKicker || "Happy birthday,");
  set("[data-hero-line]", SITE.heroLine || "");
  if (SITE.birthDate) {
    const born = new Date(SITE.birthDate + "T00:00:00");
    const day = SITE.birthdayThisYear ? new Date(SITE.birthdayThisYear + "T00:00:00")
      : new Date(new Date().getFullYear(), born.getMonth(), born.getDate());
    const el = $("[data-date]");
    el.textContent = `Turning ${day.getFullYear() - born.getFullYear()} on ${day.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`;
    el.hidden = false;
  }
}

export function buildStoles() {
  const wrap = $("#stoles");
  ROOMS.forEach((r, k) => {
    const a = h("a", { class: "stole", href: "#" + r.id, "data-room": r.id },
      h("span", { class: "stole__loop" }),
      h("span", { class: "stole__cloth", style: { backgroundImage: stripBg(r.seed).url } }),
      h("span", { class: "stole__fringe" }),
      h("span", { class: "stole__tag", text: r.label }));
    a.style.setProperty("--k", k);
    a.style.setProperty("--f1", FRINGES[k % 4][0]);
    a.style.setProperty("--f2", FRINGES[k % 4][1]);
    wrap.append(a);
  });
  sizeStoles();
  onResize(sizeStoles, 100);
  const rack = $(".rack");
  rack.addEventListener("pointerover", (e) => rack.classList.toggle("has-hover", e.pointerType === "mouse" && !!e.target.closest(".stole")));
  rack.addEventListener("pointerleave", () => rack.classList.remove("has-hover"));
  sway();
}

function sizeStoles() {
  const rackH = $(".rack").clientHeight;
  $$(".stole").forEach((s, k) => {
    const base = Math.max(120, Math.round((rackH - 160) * (ROOMS[k].length || 0.7))) + "px";
    s.style.setProperty("--base", base);
    s.style.setProperty("--len", base);
  });
}

// the stoles swing from the rail with the motion of the pointer
function sway() {
  if (reduced) return;
  const home = $("#home");
  const st = $$(".stole").map(() => ({ a: 0, v: 0 }));
  let lastX = null, lastY = null, push = 0, running = false;
  home.addEventListener("pointermove", (e) => {
    if (lastX !== null) push += Math.max(-40, Math.min(40, e.clientX - lastX)) * 0.012;
    lastX = e.clientX;
  }, { passive: true });
  // on phones, scrolling the home page gives the stoles a little nudge
  addEventListener("scroll", () => {
    if (home.hidden) return;
    if (lastY !== null) push += Math.max(-30, Math.min(30, scrollY - lastY)) * 0.01;
    lastY = scrollY;
  }, { passive: true });
  const tick = (t) => {
    if (home.hidden || document.hidden) { running = false; return; }
    $$(".stole").forEach((el, k) => {
      const s = st[k];
      const breeze = Math.sin(t / 1400 + k * 1.7) * 0.6;
      s.v += (-push * (0.8 + k * 0.12) - s.a * 0.035 + breeze * 0.02) - s.v * 0.08;
      s.a = Math.max(-6, Math.min(6, s.a + s.v * 0.5));
      el.style.transform = `rotate(${s.a.toFixed(2)}deg)`;
    });
    push *= 0.6;
    requestAnimationFrame(tick);
  };
  const start = () => { if (!running && !home.hidden && !document.hidden) { running = true; requestAnimationFrame(tick); } };
  document.addEventListener("visibilitychange", start);
  addEventListener("room:shown", start);
  start();
}
