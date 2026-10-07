/* ================= ROOMS, NAVIGATION AND THE CURTAIN =================
   The site is one page with five rooms (home + four). Only one is shown at
   a time. Moving between rooms, a stole spreads to fill the screen, the room
   is swapped behind it, then the cloth lifts away. */
import { $, $$, h, reduced } from "../lib/dom.js";
import { stripBg } from "../lib/kente.js";
import SITE from "../../../content/site.js";

const ROOMS = SITE.rooms || [];
const hooks = new Map(); // id -> { enter, leave }
const HOME_TITLE = document.title;
let current = null, busy = false;

/** Rooms that need to do work when shown/hidden (gallery autoplay, wish layout) register here. */
export const onRoom = (id, h) => hooks.set(id, h);
export const currentRoom = () => current;

export function buildNav() {
  const tpl = $("#roombarTpl");
  $$(".roombar-slot").forEach((slot) => {
    const id = slot.closest(".room").id;
    const room = ROOMS.find((r) => r.id === id) || {};
    slot.replaceWith(tpl.content.cloneNode(true));
    $(`#${id} .roombar__here`).textContent = room.label || "";
    const nav = $(`#${id} .roombar__nav`);
    ROOMS.forEach((r) => nav.append(link(r, r.label, r.id === id)));
  });
  const tabs = $("#tabbar");
  ROOMS.forEach((r) => tabs.append(link(r, r.short || r.label, false)));
}

function link(r, label, here) {
  const a = h("a", { href: "#" + r.id, "data-room": r.id, "aria-current": here ? "page" : null },
    h("i", { "aria-hidden": "true", style: { backgroundImage: stripBg(r.seed).url } }),
    h("span", { text: label }));
  return a;
}

function show(id, { focus = false } = {}) {
  const prev = current;
  $$(".room").forEach((r) => (r.hidden = r.id !== id));
  current = id;
  document.body.dataset.room = id;
  $("#tabbar").hidden = id === "home";
  $$("#tabbar a").forEach((a) => (a.dataset.room === id ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current")));
  $("#foot").hidden = id === "home" || id === "gallery";
  scrollTo(0, 0);
  if (prev && prev !== id) hooks.get(prev)?.leave?.();
  hooks.get(id)?.enter?.();
  const label = (ROOMS.find((r) => r.id === id) || {}).label;
  document.title = id === "home" || !label ? HOME_TITLE : `${label} | ${HOME_TITLE.replace(/^Happy Birthday, /, "")}'s birthday`;
  if (focus) {
    const head = $(`#${id} h1, #${id} h2`);
    if (head) { head.setAttribute("tabindex", "-1"); head.focus({ preventScroll: true }); }
  }
  dispatchEvent(new CustomEvent("room:shown", { detail: id }));
}

function go(id, fromEl) {
  if (busy || id === current || !document.getElementById(id)) return;
  const room = ROOMS.find((r) => r.id === id) || ROOMS.find((r) => r.id === current) || ROOMS[0];
  if (reduced) return show(id, { focus: true });
  busy = true;
  const cur = $("#curtain");
  cur.style.backgroundImage = stripBg(room.seed).url;
  const cloth = fromEl?.querySelector(".stole__cloth, i");
  const src = cloth ? cloth.getBoundingClientRect() : { left: 0, top: -innerHeight, width: innerWidth, height: innerHeight };
  cur.classList.add("is-on");
  const from = `inset(${src.top}px ${innerWidth - src.left - src.width}px ${innerHeight - src.top - src.height}px ${src.left}px)`;
  const spread = cur.animate([{ clipPath: from }, { clipPath: "inset(0 0 0 0)" }], { duration: 650, easing: "cubic-bezier(.7,0,.2,1)", fill: "forwards" });
  spread.onfinish = () => {
    show(id, { focus: true });
    const lift = cur.animate([{ transform: "translateY(0)" }, { transform: "translateY(-100%)" }], { duration: 750, delay: 120, easing: "cubic-bezier(.7,0,.2,1)", fill: "forwards" });
    lift.onfinish = () => { cur.classList.remove("is-on"); spread.cancel(); lift.cancel(); busy = false; };
  };
}

const isRoom = (id) => !!id && document.getElementById(id)?.classList.contains("room");

export function startRouter() {
  document.addEventListener("click", (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute("href").slice(1);
    if (!isRoom(id)) return;
    e.preventDefault();
    if (id === current) return;
    // some embedded previews block address-bar changes; navigation still works without it
    try { history.pushState({ id }, "", id === "home" ? location.pathname + location.search : "#" + id); } catch {}
    go(id, a.classList.contains("stole") || a.closest("#tabbar, .roombar__nav") ? a : null);
  });
  addEventListener("popstate", () => go(location.hash.slice(1) || "home"));

  // shared links (e.g. /#wishes) go straight to the room and skip the opening
  const start = location.hash.slice(1);
  const deep = start !== "home" && isRoom(start);
  show(deep ? start : "home");
  return deep;
}
