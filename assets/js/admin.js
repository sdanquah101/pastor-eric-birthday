/* Organisers' page (admin.html): who has given, how much, and their notes.
   The password is checked by /api/gifts against ADMIN_PASSWORD in Vercel and
   kept only for this browser tab (sessionStorage). */
import { $, $$, h, API } from "./lib/dom.js";
import { weaveCloth } from "./lib/kente.js";

const KEY = "hbd-admin";
const store = {
  get: () => { try { return sessionStorage.getItem(KEY) || ""; } catch { return ""; } },
  set: (v) => { try { v ? sessionStorage.setItem(KEY, v) : sessionStorage.removeItem(KEY); } catch {} },
};
let password = store.get();
let gifts = [];
let pending = [];

const money = (minor, cur) =>
  `${cur} ${(minor / 100).toLocaleString("en-GH", { minimumFractionDigits: minor % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
const when = (iso) => iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Accra" }) : "";
const METHOD = { card: "Card", mobile_money: "Mobile money", bank: "Bank", bank_transfer: "Bank transfer", ussd: "USSD", qr: "QR", apple_pay: "Apple Pay" };

async function call(method, body) {
  const r = await fetch(API + "/gifts", {
    method, headers: { authorization: `Bearer ${password}`, ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(data.error || `The server answered ${r.status}.`); e.status = r.status; throw e; }
  return data;
}

function showLogin(message = "") {
  $("#board").hidden = true; $("#signOut").hidden = true; $("#login").hidden = false;
  $("#loginMsg").textContent = message; $("#loginMsg").classList.toggle("is-error", !!message);
  $("#pw").focus();
}

async function load() {
  try {
    const data = await call("GET");
    gifts = data.gifts || [];
    pending = data.pending || [];
    $("#login").hidden = true; $("#board").hidden = false; $("#signOut").hidden = false;
    renderStats(data.wishes);
    renderRows();
    renderPending();
  } catch (e) {
    if (e.status === 401) { store.set(""); password = ""; return showLogin(e.message); }
    showLogin(e.message);
  }
}

function renderStats(wishCount) {
  const totals = new Map();
  for (const g of gifts) totals.set(g.currency, (totals.get(g.currency) || 0) + g.amount_minor);
  const givers = new Set(gifts.map((g) => (g.email || g.name || g.reference).toLowerCase())).size;
  const tile = (label, value, hint) => h("div", { class: "stat" }, h("span", { class: "stat__label", text: label }), h("b", { class: "stat__value", text: value }), hint ? h("span", { class: "stat__hint", text: hint }) : null);
  const amount = totals.size ? [...totals].map(([c, m]) => money(m, c)).join(" + ") : "GHS 0";
  $("#stats").replaceChildren(
    tile("Total received", amount, gifts.length ? `last gift ${when(gifts[0].paid_at)}` : ""),
    tile("Gifts", String(gifts.length)),
    tile("Givers", String(givers)),
    tile("Wishes", String(wishCount ?? "–")),
  );
}

function renderRows() {
  const q = $("#search").value.trim().toLowerCase();
  const list = q ? gifts.filter((g) => [g.name, g.email, g.note, g.reference].some((v) => (v || "").toLowerCase().includes(q))) : gifts;
  $("#rows").replaceChildren(...list.map((g) => h("tr", {},
    h("td", { "data-label": "Date", text: when(g.paid_at) }),
    h("td", { "data-label": "From" }, h("span", {}, h("span", { class: "adm-name", text: g.name || "(no name)" }),
      g.anonymous ? h("span", { class: "badge", title: "Asked for their name to be kept private", text: "private" }) : null)),
    h("td", { "data-label": "Amount", class: "num adm-amount", text: money(g.amount_minor, g.currency) }),
    h("td", { "data-label": "Method", text: METHOD[g.channel] || g.channel || "" }),
    h("td", { "data-label": "Note", class: "adm-note", text: g.note || "" }),
    h("td", { "data-label": "Email" }, g.email ? h("a", { href: `mailto:${g.email}`, text: g.email }) : ""),
    h("td", { "data-label": "Reference", class: "adm-ref", text: g.reference }),
  )));
  $("#empty").hidden = gifts.length > 0;
  $(".adm-tablewrap").hidden = list.length === 0;
}

/* Hubtel gifts the giver started but Hubtel hasn't confirmed yet. Check them in the
   Hubtel dashboard (by reference), then mark each as paid or not paid. */
function renderPending() {
  const box = $("#pendingBox");
  box.hidden = pending.length === 0;
  $("#pendingCount").textContent = String(pending.length);
  $("#pendingRows").replaceChildren(...pending.map((p) => h("li", { class: "pend" },
    h("div", { class: "pend__who" },
      h("b", { text: p.name || "(no name)" }), p.anonymous ? h("span", { class: "badge", text: "private" }) : null,
      h("span", { class: "pend__amt", text: money(p.amount_minor, p.currency) })),
    h("div", { class: "pend__meta", text: `${when(p.created_at)} · ${p.reference}${p.detail ? " · " + p.detail : ""}` }),
    p.note ? h("q", { class: "pend__note", text: p.note }) : null,
    h("div", { class: "pend__actions" },
      h("button", { type: "button", class: "btn btn--black", text: "Mark as paid", onclick: (e) => decide(p, "confirm", e.currentTarget) }),
      h("button", { type: "button", class: "btn btn--line", text: "Not paid", onclick: (e) => decide(p, "dismiss", e.currentTarget) })),
  )));
}

async function decide(p, action, btn) {
  const sure = action === "confirm"
    ? `Mark ${money(p.amount_minor, p.currency)} from ${p.name || "this giver"} as paid?\n\nOnly do this after finding reference ${p.reference} as paid in your Hubtel dashboard.`
    : `Remove this pending gift from ${p.name || "this giver"}? Do this when Hubtel shows it was not paid.`;
  if (!confirm(sure)) return;
  btn.disabled = true;
  try { await call("POST", { action, reference: p.reference }); await load(); }
  catch (e) { $("#boardMsg").textContent = e.message; $("#boardMsg").classList.add("is-error"); btn.disabled = false; }
}

async function sync() {
  const btn = $("#sync"), msg = $("#boardMsg");
  btn.disabled = true; btn.textContent = "Syncing…"; msg.classList.remove("is-error");
  msg.textContent = "Checking for payments the site may have missed…";
  try {
    const r = await call("POST", { action: "sync" });
    const parts = [r.added ? `Added ${r.added} gift${r.added === 1 ? "" : "s"}.` : "Up to date: no missing gifts found."];
    if (r.hubtelPending) parts.push(`${r.hubtelPending} Hubtel gift${r.hubtelPending === 1 ? " is" : "s are"} still waiting for confirmation.`);
    parts.push(...(r.notes || []));
    msg.textContent = parts.join(" ");
    await load();
  } catch (e) {
    msg.textContent = e.message; msg.classList.add("is-error");
  } finally {
    btn.disabled = false; btn.textContent = "Sync payments";
  }
}

function downloadCsv() {
  const cell = (v) => {
    let s = String(v ?? "");
    if (/^[=+\-@]/.test(s)) s = "'" + s; // stop spreadsheets treating text as a formula
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = ["Date (Accra)", "Name", "Keep private", "Amount", "Currency", "Method", "Note", "Email", "Reference"];
  const lines = gifts.map((g) => [when(g.paid_at), g.name, g.anonymous ? "yes" : "no", (g.amount_minor / 100).toFixed(2), g.currency, METHOD[g.channel] || g.channel, g.note, g.email, g.reference].map(cell).join(","));
  const blob = new Blob(["﻿" + [head.join(","), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = h("a", { href: URL.createObjectURL(blob), download: `pastor-eric-birthday-gifts-${new Date().toISOString().slice(0, 10)}.csv` });
  document.body.append(a); a.click(); a.remove();
}

async function notices() {
  try {
    const { status: s, provider: prov } = await (await fetch(API + "/config")).json();
    if (!s) return;
    const problems = [];
    if (!s.adminPassword) problems.push("ADMIN_PASSWORD is not set in Vercel (8 or more characters), so this page cannot open.");
    if (!s.database) problems.push("DATABASE_URL is not set in Vercel, so wishes and gifts cannot be saved.");
    if (s.hubtelRequested && !s.hubtelKeys) problems.push("PAYMENT_PROVIDER is set to hubtel, but HUBTEL_API_ID, HUBTEL_API_KEY or HUBTEL_MERCHANT_ACCOUNT is missing in Vercel, so the site is still using Paystack.");
    if (prov === "paystack") {
      if (s.paystackSecretKey === "missing") problems.push("PAYSTACK_SECRET_KEY is not set in Vercel, so gifts cannot be confirmed or recorded.");
      if (s.paystackSecretKey === "unrecognised") problems.push("PAYSTACK_SECRET_KEY in Vercel does not look like a Paystack secret key (sk_live_… or sk_test_…).");
      if (s.paystackSecretKey === "test") problems.push("PAYSTACK_SECRET_KEY is a test key, but the site takes live payments. Use the sk_live_… key.");
    }
    $("#provider").textContent = prov === "hubtel" ? "Gifts are being taken through Hubtel." : "Gifts are being taken through Paystack.";
    $("#notices").replaceChildren(...problems.map((p) => h("p", { class: "adm-notice", role: "alert", text: p })));
  } catch {}
}

$$("[data-cloth]").forEach(weaveCloth);
$("#login").addEventListener("submit", (e) => { e.preventDefault(); password = $("#pw").value; store.set(password); $("#pw").value = ""; load(); });
$("#signOut").addEventListener("click", () => { store.set(""); password = ""; gifts = []; showLogin(); });
$("#sync").addEventListener("click", sync);
$("#csv").addEventListener("click", downloadCsv);
$("#search").addEventListener("input", renderRows);
notices();
if (password) load(); else showLogin();
