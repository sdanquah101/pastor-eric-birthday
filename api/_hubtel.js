// Hubtel Online Checkout (redirect flow).
// Docs: https://businessdocs-developers.hubtel.com/docs/api-reference-online-checkout
//
// Vercel settings:
//   PAYMENT_PROVIDER=hubtel            switch the Give form from Paystack to Hubtel
//   HUBTEL_API_ID, HUBTEL_API_KEY      API keys (Basic auth "id:key")
//   HUBTEL_MERCHANT_ACCOUNT            Collection (merchant) account number, e.g. 11684
//   HUBTEL_CALLBACK_IPS (optional)     comma-separated IPs allowed to call the callback;
//                                      default is Hubtel's published 108.129.40.25
import crypto from "node:crypto";
import { db, clean, ConfigError } from "./_lib.js";

const INITIATE = "https://payproxyapi.hubtel.com/items/initiate";
const STATUS = (acct) => `https://api-txnstatus.hubtel.com/transactions/${encodeURIComponent(acct)}/status`;
export const HUBTEL_IPS = () =>
  (process.env.HUBTEL_CALLBACK_IPS || "108.129.40.25").split(",").map((s) => s.trim()).filter(Boolean);

export const hubtelReady = () =>
  Boolean(process.env.HUBTEL_API_ID && process.env.HUBTEL_API_KEY && process.env.HUBTEL_MERCHANT_ACCOUNT);
export const provider = () =>
  (process.env.PAYMENT_PROVIDER || "").toLowerCase() === "hubtel" && hubtelReady() ? "hubtel" : "paystack";

function auth() {
  if (!hubtelReady()) throw new ConfigError("HUBTEL_API_ID, HUBTEL_API_KEY and HUBTEL_MERCHANT_ACCOUNT must all be set in Vercel.");
  return "Basic " + Buffer.from(`${process.env.HUBTEL_API_ID}:${process.env.HUBTEL_API_KEY}`).toString("base64");
}

/** Unguessable reference, within Hubtel's 32-character limit. */
export const newReference = () => "HBD" + crypto.randomBytes(12).toString("hex"); // 27 chars

/** Save the gift as pending and ask Hubtel for a checkout page. */
export async function startCheckout({ amount, name, email, note, anonymous, site }) {
  const reference = newReference();
  const amountMinor = Math.round(amount * 100);
  await db()`
    insert into pending_gifts (reference, amount_minor, email, name, note, anonymous)
    values (${reference}, ${amountMinor}, ${email || null}, ${name}, ${note || null}, ${Boolean(anonymous)})`;
  const r = await fetch(INITIATE, {
    method: "POST",
    headers: { authorization: auth(), accept: "application/json", "content-type": "application/json", "cache-control": "no-cache" },
    body: JSON.stringify({
      totalAmount: Number((amountMinor / 100).toFixed(2)),
      description: "Birthday gift for Pastor Eric Obeng Kwakye", // no special characters allowed
      callbackUrl: `${site}/api/hubtel-callback`,
      returnUrl: `${site}/?gift=${reference}#give`,
      cancellationUrl: `${site}/?gift=${reference}&cancelled=1#give`,
      merchantAccountNumber: process.env.HUBTEL_MERCHANT_ACCOUNT,
      clientReference: reference,
      payeeName: name,
      ...(email ? { payeeEmail: email } : {}),
    }),
  });
  const body = await r.json().catch(() => ({}));
  if (r.status === 401 || r.status === 403) throw new ConfigError("Hubtel rejected HUBTEL_API_ID / HUBTEL_API_KEY. Check them in Vercel.");
  if (!r.ok || body.responseCode !== "0000" || !body.data?.checkoutUrl) {
    const why = body.message || body.data?.message || `Hubtel answered ${r.status} (code ${body.responseCode || "none"})`;
    await db()`update pending_gifts set status = 'failed', detail = ${clean(why, 300)}, updated_at = now() where reference = ${reference}`;
    console.error("[hubtel initiate]", r.status, JSON.stringify(body).slice(0, 500));
    const e = new Error(body.responseCode === "4070"
      ? "That amount can't be processed by Hubtel right now. Try a different amount."
      : "Hubtel couldn't start the payment. Please try again in a moment.");
    e.userFacing = true;
    throw e;
  }
  await db()`update pending_gifts set checkout_id = ${body.data.checkoutId || null}, updated_at = now() where reference = ${reference}`;
  return { reference, checkoutUrl: body.data.checkoutUrl };
}

const CHANNEL = { mobilemoney: "mobile_money", card: "card", wallet: "wallet", ghqr: "ghqr", cash: "cash", cheque: "cheque" };

/** Move a pending gift into gifts. Idempotent. amountMinor (if given) must cover the pledged amount. */
export async function markPaid(reference, { amountMinor, channel, detail } = {}) {
  const sql = db();
  const [p] = await sql`select * from pending_gifts where reference = ${reference}`;
  if (!p) return { ok: false, reason: "unknown reference" };
  if (amountMinor != null && amountMinor + 1 < p.amount_minor) {
    await sql`update pending_gifts set detail = ${`paid ${amountMinor} < expected ${p.amount_minor}`}, updated_at = now() where reference = ${reference}`;
    return { ok: false, reason: "amount lower than expected" };
  }
  const ch = CHANNEL[String(channel || "").toLowerCase()] || channel || null;
  await sql`
    insert into gifts (reference, amount_minor, currency, email, name, note, anonymous, channel, paid_at)
    values (${p.reference}, ${amountMinor ?? p.amount_minor}, ${p.currency}, ${p.email}, ${p.name}, ${p.note}, ${p.anonymous}, ${ch}, now())
    on conflict (reference) do nothing`;
  await sql`update pending_gifts set status = 'paid', detail = ${clean(detail || "", 300) || null}, updated_at = now() where reference = ${reference}`;
  return { ok: true };
}

export async function markFailed(reference, detail) {
  await db()`update pending_gifts set status = 'failed', detail = ${clean(detail || "", 300) || null}, updated_at = now()
             where reference = ${reference} and status = 'pending'`;
}

/** Hubtel's Transaction Status API. Only works from whitelisted IPs; returns null (not an error) when blocked. */
export async function checkStatus(reference) {
  const r = await fetch(`${STATUS(process.env.HUBTEL_MERCHANT_ACCOUNT)}?clientReference=${encodeURIComponent(reference)}`, {
    headers: { authorization: auth(), accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  }).catch((e) => ({ ok: false, status: 0, json: async () => ({ message: e.message }) }));
  if (r.status === 403 || r.status === 0) return { blocked: true };
  const body = await r.json().catch(() => ({}));
  if (!r.ok || body.responseCode !== "0000" || !body.data) return { unknown: true, message: body.message };
  return {
    status: String(body.data.status || "").toLowerCase(), // paid | unpaid | refunded
    amountMinor: body.data.amount != null ? Math.round(Number(body.data.amount) * 100) : null,
    channel: body.data.paymentMethod,
  };
}

/** Try the status API for one pending gift and apply the answer. */
export async function recheck(reference) {
  const s = await checkStatus(reference);
  if (s.blocked) return "blocked";
  if (s.status === "paid") { const m = await markPaid(reference, { amountMinor: s.amountMinor, channel: s.channel, detail: "status check" }); return m.ok ? "paid" : m.reason; }
  return s.status || "unknown";
}
