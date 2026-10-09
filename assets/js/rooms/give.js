/* ================= GIVE =================
   Two payment providers, chosen in Vercel (PAYMENT_PROVIDER, see /api/config):
   - Paystack: its popup takes the payment; /api/verify confirms it and
     /api/paystack-webhook records it even if the giver closes the tab.
   - Hubtel: /api/hubtel-initiate saves the gift as pending and returns Hubtel's
     checkout page; the giver pays there and comes back to /?gift=REF#give, where
     we wait for /api/gift-status to report the callback from Hubtel.
   The gift cloth above the form lives in ./gifts.js. */
import { $, $$, h, API, fmt } from "../lib/dom.js";
import { setupGifts, loadGifts } from "./gifts.js";
import SITE from "../../../content/site.js";

export function setupGive() {
  const g = SITE.giving || {};
  const cur = g.currency || "GHS";
  let amount = g.defaultAmount || (g.presets || [100])[0];
  let publicKey = g.publicKey || "";
  let provider = "paystack";
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

  const ready = fetch(API + "/config")
    .then((r) => (r.ok ? r.json() : null))
    .then((c) => {
      if (c?.paystackPublicKey) publicKey = c.paystackPublicKey;
      if (c?.provider === "hubtel") {
        provider = "hubtel";
        $$("[data-provider-name]").forEach((el) => (el.textContent = "Hubtel"));
        $("[data-email-optional]").hidden = false;
        $("#gEmail").required = false;
      }
    })
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
    await ready;
    if (provider === "hubtel") {
      if (email && !/^\S+@\S+\.\S+$/.test(email)) return err("That email doesn't look right. Fix it or leave it empty.", $("#gEmail"));
      return startHubtel({ amount, name, email, note, anonymous }, err);
    }
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

  async function startHubtel(gift, err) {
    btn.disabled = true;
    msg.textContent = "Opening Hubtel…";
    try {
      const r = await fetch(API + "/hubtel-initiate", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(gift),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data.checkoutUrl) throw new Error(data.error || "Hubtel couldn't start the payment. Please try again.");
      location.assign(data.checkoutUrl); // pay on Hubtel, then Hubtel sends them back to /?gift=REF#give
    } catch (ex) {
      err(ex.message);
      btn.disabled = false;
    }
  }

  // back from Hubtel: wait for the callback to land, then thank them
  const back = new URLSearchParams(location.search);
  const ref = back.get("gift");
  if (ref && /^HBD[0-9a-f]{24}$/.test(ref)) {
    try { history.replaceState(null, "", location.pathname + "#give"); } catch {}
    afterHubtel(ref, back.has("cancelled"));
  }

  async function afterHubtel(reference, cancelled) {
    const form = $("#giveForm");
    const box = h("div", { class: "thanks", role: "status" }, h("h3", { text: "Confirming your gift…" }),
      h("p", { text: "Hubtel is letting us know your payment went through. This usually takes a few seconds." }));
    form.replaceChildren(box);
    const again = () => h("button", { type: "button", class: "btn btn--black", text: "Try again", onclick: () => location.replace(location.pathname + "#give") });
    const started = Date.now();
    for (;;) {
      let s = {};
      try { const r = await fetch(`${API}/gift-status?ref=${reference}&t=${Date.now()}`); s = await r.json(); } catch {}
      if (s.status === "paid") {
        box.replaceChildren(
          h("h3", { text: `Thank you${s.name ? ", " + s.name.split(" ")[0] : ""}.` }),
          h("p", { text: `Your gift of ${fmt(s.amount, s.currency || cur)} has been received.` }),
          h("p", { class: "thanks__ref", text: `Reference: ${reference}` }));
        await loadGifts({ fresh: true, celebrate: true });
        if (!$("#gifts").hidden) box.append(h("button", {
          type: "button", class: "btn btn--line thanks__see", text: "See your strip on his cloth",
          onclick: () => $("#gifts").scrollIntoView({ behavior: "smooth", block: "start" }),
        }));
        return;
      }
      if (s.status === "failed" || (cancelled && Date.now() - started > 6000)) {
        box.replaceChildren(h("h3", { text: "Payment not completed" }),
          h("p", { text: "The payment was cancelled or didn't go through, so you were not charged." }), again());
        return;
      }
      if (Date.now() - started > 90000) {
        box.replaceChildren(h("h3", { text: "Almost there" }),
          h("p", { text: "Hubtel hasn't confirmed your payment yet. If you were charged, your gift will appear on his cloth once it is confirmed. There's no need to pay again." }),
          h("p", { class: "thanks__ref", text: `Reference: ${reference}` }));
        return;
      }
      await new Promise((ok) => setTimeout(ok, 3000));
    }
  }

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
