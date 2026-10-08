/* ================= GIVE (Paystack) =================
   Paystack's popup takes the payment; /api/verify confirms it server-side
   and /api/paystack-webhook records it even if the giver closes the tab.
   The gift cloth above the form lives in ./gifts.js. */
import { $, $$, h, API, fmt } from "../lib/dom.js";
import { setupGifts, loadGifts } from "./gifts.js";
import SITE from "../../../content/site.js";

export function setupGive() {
  const g = SITE.giving || {};
  const cur = g.currency || "GHS";
  let amount = g.defaultAmount || (g.presets || [100])[0];
  let publicKey = g.publicKey || "";
  const grid = $("[data-presets]"), custom = $("#gCustom"), btn = $("#giveSubmit"), msg = $("#giveMsg");

  $("[data-give-heading]").textContent = g.heading || "Send a birthday gift";
  setupGifts();
  $("[data-give-text]").textContent = g.text || "";
  $("[data-currency]").textContent = cur;

  const label = () => (btn.textContent = amount > 0 ? `Give ${fmt(amount, cur)}` : "Choose an amount");
  (g.presets || []).forEach((v) => {
    const b = h("button", { type: "button", class: "amt", "aria-pressed": String(v === amount), "aria-label": fmt(v, cur), text: Number(v).toLocaleString() });
    b.addEventListener("click", () => {
      amount = v;
      custom.value = "";
      $$(".amt", grid).forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      label();
    });
    grid.append(b);
  });
  custom.addEventListener("input", () => {
    const v = parseFloat(custom.value.replace(/[^\d.]/g, ""));
    amount = isFinite(v) ? v : 0;
    $$(".amt", grid).forEach((x) => x.setAttribute("aria-pressed", "false"));
    label();
  });
  label();

  fetch(API + "/config")
    .then((r) => (r.ok ? r.json() : null))
    .then((c) => { if (c && c.paystackPublicKey) publicKey = c.paystackPublicKey; })
    .catch(() => {});

  const loadPaystack = () =>
    window.PaystackPop
      ? Promise.resolve()
      : new Promise((ok, no) => {
          const s = document.createElement("script");
          s.src = "https://js.paystack.co/v2/inline.js";
          s.onload = ok;
          s.onerror = () => no(new Error("Paystack could not load. Check your connection and try again."));
          document.head.append(s);
        });

  $("#giveForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    msg.classList.remove("is-error");
    const name = $("#gName").value.trim();
    const email = $("#gEmail").value.trim();
    const note = $("#gNote").value.trim();
    const anonymous = $("#gAnon").checked;
    const err = (t, el) => { msg.textContent = t; msg.classList.add("is-error"); el?.focus(); };
    if (!(amount >= 1)) return err(`Enter an amount of at least ${cur} 1.`, custom);
    if (name.length < 2) return err("Add your name.", $("#gName"));
    if (!/^\S+@\S+\.\S+$/.test(email)) return err("Enter a valid email so Paystack can send your receipt.", $("#gEmail"));
    if (!publicKey) return err("Giving isn't switched on yet. The site owner needs to add a Paystack public key.");

    btn.disabled = true;
    msg.textContent = "Opening Paystack…";
    try {
      await loadPaystack();
      const reference = `PHANET-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const popup = new window.PaystackPop();
      popup.newTransaction({
        key: publicKey,
        email,
        amount: Math.round(amount * 100),
        currency: cur,
        reference,
        metadata: {
          name, note, anonymous,
          custom_fields: [
            { display_name: "Giver", variable_name: "giver", value: anonymous ? "Anonymous" : name },
            { display_name: "Occasion", variable_name: "occasion", value: "Birthday gift" },
          ],
        },
        onSuccess: (tx) => confirm(tx.reference || reference, name),
        onCancel: () => { msg.textContent = "Payment cancelled. You were not charged."; btn.disabled = false; },
        onError: (er) => { err(er?.message || "Paystack couldn't start the payment. Try again."); btn.disabled = false; },
      });
    } catch (ex) {
      err(ex.message);
      btn.disabled = false;
    }
  });

  async function confirm(reference, name) {
    msg.textContent = "Confirming your gift…";
    let ok = false, data = {};
    try {
      const r = await fetch(API + "/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reference }),
      });
      data = await r.json().catch(() => ({}));
      ok = r.ok && data.ok;
    } catch {}
    const form = $("#giveForm");
    form.textContent = "";
    form.append(h("div", { class: "thanks", role: "status" },
      h("h3", { text: `Thank you, ${name.split(" ")[0]}.` }),
      h("p", { text: ok
        ? `Your gift of ${fmt(data.amount, data.currency || cur)} has been received.`
        : "Paystack has your payment. Confirmation is still on its way and will be recorded automatically." }),
      h("p", { class: "thanks__ref", text: `Reference: ${reference}` })));
    if (ok) {
      await loadGifts({ fresh: true, celebrate: true });
      if (!$("#gifts").hidden) form.firstChild.append(h("button", {
        type: "button", class: "btn btn--line thanks__see", text: "See your strip on his cloth",
        onclick: () => $("#gifts").scrollIntoView({ behavior: "smooth", block: "start" }),
      }));
    }
  }
}
