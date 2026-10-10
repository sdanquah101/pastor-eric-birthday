/* ================= THE GIFT CLOTH (top of the Give room) =================
   Every gift is a kente strip hanging in a dark band, under the total raised
   in gold. A spotlight below cycles through the givers' notes; tapping a
   strip shows that giver. "Read all" switches to a plain list.
   Data comes from /api/givers: names (or "A friend") and notes only.
   Individual amounts are never sent to the public site. */
import { $, $$, h, API, fmt, reduced, onResize } from "../lib/dom.js";
import { stripBg, hash } from "../lib/kente.js";
import { onRoom, currentRoom } from "./nav.js";

const state = { givers: [], active: -1, timer: 0, pauseUntil: 0, loaded: false, newest: null };
const label = (g) => g.name || "A friend";

export async function loadGifts({ fresh = false, celebrate = false } = {}) {
  const box = $("#gifts");
  let data;
  try {
    const r = await fetch(API + "/givers" + (fresh ? `?t=${Date.now()}` : ""), { headers: { accept: "application/json" } });
    if (!r.ok) throw new Error(r.status);
    data = await r.json();
  } catch {
    box.hidden = true; // preview mode or API down: no cloth rather than a broken one
    return;
  }
  const prev = state.givers.length;
  state.givers = data.givers || [];
  state.newest = celebrate && state.givers.length > prev ? 0 : null;
  const n = data.count || 0;
  $("#giftsTotal").textContent = n ? (data.totals || []).map((t) => fmt(t.amount_minor / 100, t.currency)).join(" + ") : "Be the first";
  $("#giftsCount").textContent = n
    ? `raised from ${n.toLocaleString()} gift${n === 1 ? "" : "s"}. Every gift adds a strip to his cloth.`
    : "to add a strip to his birthday cloth.";
  box.hidden = false;
  renderCloth(!state.loaded || celebrate);
  renderList();
  state.loaded = true;
  spotlight(state.newest ?? 0, false);
  autoplay();
}

/* Strip width shrinks as gifts grow, then the cloth wraps into rows. Empty
   slots at the end of the last row show bare threads: still being woven. */
function renderCloth(animate) {
  const cloth = $("#giftsCloth");
  const W = cloth.clientWidth || 300, gap = 4, n = state.givers.length;
  const small = innerWidth < 760;
  const maxW = small ? 40 : 56, minW = small ? 22 : 26;
  const sw = Math.max(minW, Math.min(maxW, Math.floor((W - gap * Math.max(0, n - 1)) / Math.max(n, 1))));
  const perRow = Math.max(1, Math.floor((W + gap) / (sw + gap)));
  const rows = Math.max(1, Math.ceil(n / perRow));
  cloth.style.setProperty("--sw", sw + "px");
  cloth.style.setProperty("--sh", (rows > 2 ? (small ? 84 : 110) : small ? 120 : 170) + "px");
  const strips = state.givers.map((g, i) => {
    const b = h("button", {
      type: "button", class: "gstrip" + (i === state.newest ? " is-new" : ""), role: "listitem",
      "aria-label": g.note ? `Gift from ${label(g)}: ${g.note}` : `Gift from ${label(g)}`,
      style: { backgroundImage: stripBg(400 + (hash(`${g.paid_at}|${g.name}|${i}`) % 40)).url },
      onclick: () => { state.pauseUntil = performance.now() + 15000; spotlight(i, true); },
    });
    if (animate && !reduced) b.style.animationDelay = `${Math.min(i, 24) * 60}ms`;
    else b.classList.add("is-still");
    return b;
  });
  const loose = (perRow - (n % perRow)) % perRow || (n === 0 ? perRow : 0);
  const threads = Array.from({ length: loose }, () => h("span", { class: "gstrip gstrip--loose", "aria-hidden": "true" }));
  cloth.replaceChildren(...strips, ...threads);
}

function spotlight(i, user) {
  const g = state.givers[i];
  const spot = $("#giftsSpot");
  $$(".gstrip.is-on").forEach((s) => s.classList.remove("is-on"));
  if (!g) {
    $("#spotNote").textContent = "His cloth is waiting for its first gift.";
    $("#spotName").textContent = "";
    spot.classList.add("is-empty");
    return;
  }
  spot.classList.remove("is-empty");
  state.active = i;
  $$(".gstrip:not(.gstrip--loose)")[i]?.classList.add("is-on");
  const show = () => {
    $("#spotNote").textContent = g.note || "A birthday gift, with love.";
    $("#spotName").textContent = label(g);
    spot.classList.toggle("is-plain", !g.note);
  };
  if (reduced || !user && !state.loaded) return show();
  spot.classList.add("is-swap");
  setTimeout(() => { show(); spot.classList.remove("is-swap"); }, 220);
}

// walk through the notes on its own while nobody is touching the cloth
function autoplay() {
  clearInterval(state.timer);
  if (reduced || state.givers.length < 2) return;
  state.timer = setInterval(() => {
    if (document.hidden || currentRoom() !== "give" || performance.now() < state.pauseUntil) return;
    if (!$("#giftsList").hidden) return;
    spotlight((state.active + 1) % state.givers.length, false);
  }, 6000);
}

function renderList() {
  $("#giftsList").replaceChildren(...state.givers.map((g) => h("li", { class: "gift" },
    h("b", { class: "gift__name", text: label(g) }),
    g.note ? h("q", { class: "gift__note", text: g.note }) : null)));
}

export function setupGifts() {
  $$(".switch--gifts .pill").forEach((b) => b.addEventListener("click", () => {
    const list = b.dataset.view === "list";
    $$(".switch--gifts .pill").forEach((x) => { const on = x === b; x.classList.toggle("is-on", on); x.setAttribute("aria-pressed", String(on)); });
    $("#giftsList").hidden = !list;
    $("#giftsCloth").hidden = list;
    $("#giftsSpot").hidden = list;
  }));
  $("#giftsCta").addEventListener("click", (e) => {
    e.preventDefault();
    const target = $("#momoCard:not([hidden])") || $("#giveForm");
    target.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    setTimeout(() => $(".amt[aria-pressed='true']")?.focus({ preventScroll: true }), reduced ? 0 : 500);
  });
  onRoom("give", { enter: () => loadGifts(), leave: () => clearInterval(state.timer) });
  onResize(() => { if (state.loaded && currentRoom() === "give") renderCloth(false); });
}
