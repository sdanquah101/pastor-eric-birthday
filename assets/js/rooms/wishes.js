/* ================= WISHES: THE CLOTH =================
   Every wish is a square cut from a kente strip. Squares are woven into
   one cloth; empty slots show bare warp threads still on the loom. */
import { $, $$, h, API, reduced, onResize } from "../lib/dom.js";
import { stripBg, tileStyle, placeTiles, tileSeed } from "../lib/kente.js";
import { onRoom, currentRoom } from "./nav.js";
import SITE from "../../../content/site.js";

const W8 = { list: [], demo: false, active: -1 };
const reader = () => $("#reader");

function render(newId) {
  const loom = $("#loom"), list = $("#wishList");
  loom.textContent = ""; list.textContent = "";
  const w = W8.list;
  $("#wishCount").textContent = w.length.toLocaleString();
  $("#loomEmpty").hidden = w.length > 0;
  loom.hidden = w.length === 0 || !list.hidden;

  w.forEach((wish, i) => {
    const b = h("button", {
      type: "button", class: "tile" + (wish.id === newId ? " is-new" : ""), "data-id": wish.id,
      "aria-label": `Wish from ${wish.name}`, onclick: () => openReader(i),
    }, h("span", { class: "tile__name", text: wish.name }));
    tileStyle(b, wish.id);
    loom.append(b);
    list.append(h("li", {}, h("p", { text: wish.message }),
      h("small", {}, h("b", { text: wish.name }), wish.relation ? `, ${wish.relation}` : "")));
  });
  // empty loom slots show bare warp threads: the cloth is still being woven
  const cols = Math.max(1, getComputedStyle(loom).gridTemplateColumns.split(" ").length);
  const rows = Math.max(3, Math.ceil(w.length / cols) + 1);
  for (let k = rows * cols - w.length; k > 0; k--) loom.append(h("span", { class: "tile tile--loose", "aria-hidden": "true" }));
  placeTiles(loom);
}

function openReader(i) {
  const w = W8.list; if (!w.length) return;
  i = (i + w.length) % w.length; W8.active = i;
  const wish = w[i];
  $("#readerMsg").textContent = wish.message;
  $("#readerName").textContent = wish.name;
  $("#readerRel").textContent = wish.relation || "";
  $("#readerSwatch").style.backgroundImage = stripBg(tileSeed(wish.id)).url;
  const d = reader();
  if (!d.open) { d.showModal ? d.showModal() : d.setAttribute("open", ""); }
}
function closeReader() { const d = reader(); d.close ? d.close() : d.removeAttribute("open"); W8.active = -1; }

async function load() {
  try {
    const r = await fetch(API + "/wishes", { headers: { accept: "application/json" } });
    if (!r.ok) throw new Error(r.status);
    W8.list = (await r.json()).wishes || [];
  } catch {
    W8.demo = true;
    W8.list = (SITE.sampleWishes || []).slice();
    console.info("[birthday] API not reachable. Showing sample wishes (preview mode).");
  }
  if (currentRoom() === "wishes") render();
}

export function setupWishes() {
  const rel = $("[data-relations]");
  (SITE.relations || ["Friend"]).forEach((r) => rel.append(new Option(r, r)));

  onRoom("wishes", { enter: () => render() });
  onResize(() => { if (currentRoom() === "wishes") render(); });

  $$(".switch--wishes .pill").forEach((b) => b.addEventListener("click", () => {
    const list = b.dataset.view === "list";
    $$(".switch--wishes .pill").forEach((x) => { const on = x === b; x.classList.toggle("is-on", on); x.setAttribute("aria-pressed", on); });
    $("#loom").hidden = list || W8.list.length === 0;
    $("#wishList").hidden = !list;
  }));
  $("#readerClose").addEventListener("click", closeReader);
  $("#readerPrev").addEventListener("click", () => openReader(W8.active - 1));
  $("#readerNext").addEventListener("click", () => openReader(W8.active + 1));
  reader().addEventListener("click", (e) => { if (e.target === reader()) closeReader(); });
  reader().addEventListener("close", () => (W8.active = -1));
  document.addEventListener("keydown", (e) => {
    if (W8.active < 0) return;
    if (e.key === "ArrowRight") openReader(W8.active + 1);
    if (e.key === "ArrowLeft") openReader(W8.active - 1);
  });

  const form = $("#wishForm"), msg = $("#wishMsg"), ta = $("#wMsg");
  ta.addEventListener("input", () => ($("#wMsgCount").textContent = ta.value.length));
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = $("#wName").value.trim(), message = ta.value.trim(), relation = $("#wRel").value;
    $$(".field", form).forEach((f) => f.classList.remove("is-error"));
    msg.classList.remove("is-error");
    const fail = (input, text) => { input.closest(".field").classList.add("is-error"); msg.textContent = text; msg.classList.add("is-error"); input.focus(); };
    if (name.length < 2) return fail($("#wName"), "Add your name so he knows who it's from.");
    if (message.length < 3) return fail(ta, "Write a short message before weaving your wish.");
    const btn = $("#wishSubmit");
    btn.disabled = true; btn.textContent = "Weaving…";
    try {
      let wish;
      if (W8.demo) wish = { id: "local-" + Date.now(), name, relation, message };
      else {
        const r = await fetch(API + "/wishes", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ name, relation, message, website: form.website.value }),
        });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || "Your wish wasn't saved. Check your connection and try again.");
        wish = data.wish;
      }
      W8.list.unshift(wish);
      form.reset(); $("#wMsgCount").textContent = "0";
      msg.textContent = "Your wish is now part of the cloth.";
      $$(".switch--wishes .pill")[0].click();
      render(wish.id);
      $("#loom").scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
      setTimeout(() => openReader(0), reduced ? 0 : 1300);
    } catch (err) {
      msg.textContent = err.message; msg.classList.add("is-error");
    } finally {
      btn.disabled = false; btn.textContent = "Weave my wish";
    }
  });

  load();
}
