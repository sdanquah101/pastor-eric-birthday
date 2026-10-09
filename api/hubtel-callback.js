// Hubtel posts the final status of a checkout here (callbackUrl).
// The callback is not signed, so it is only trusted when it comes from Hubtel's
// published IP, matches a gift this site started, and pays at least that amount.
import { readJson } from "./_lib.js";
import { HUBTEL_IPS, markPaid, markFailed } from "./_hubtel.js";

const pick = (o, ...keys) => { for (const k of keys) if (o && o[k] != null) return o[k]; };

export default async function handler(req, res) {
  if (req.method !== "POST") { res.statusCode = 405; return res.end(); }
  const ip = String(req.headers["x-real-ip"] || req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  if (!HUBTEL_IPS().includes(ip)) {
    console.warn("[hubtel-callback] ignored call from", ip);
    res.statusCode = 403; return res.end();
  }
  try {
    const b = await readJson(req);
    const d = pick(b, "Data", "data") || {};
    const reference = String(pick(d, "ClientReference", "clientReference") || "");
    const code = String(pick(b, "ResponseCode", "responseCode") || "");
    const status = String(pick(d, "Status", "status") || pick(b, "Status", "status") || "").toLowerCase();
    const amount = Number(pick(d, "Amount", "amount"));
    const pay = pick(d, "PaymentDetails", "paymentDetails") || {};
    const detail = pick(d, "Description", "description") || "";
    if (!/^HBD[0-9a-f]{24}$/.test(reference)) { res.statusCode = 200; return res.end("ignored"); }
    if (code === "0000" && (status === "success" || status === "paid")) {
      const r = await markPaid(reference, {
        amountMinor: Number.isFinite(amount) ? Math.round(amount * 100) : undefined,
        channel: pick(pay, "PaymentType", "paymentType"), detail,
      });
      if (!r.ok) console.warn("[hubtel-callback]", reference, r.reason);
    } else {
      await markFailed(reference, `${code} ${detail}`.trim());
    }
  } catch (e) {
    console.error("[hubtel-callback]", e.message);
  }
  res.statusCode = 200;
  res.end("ok");
}
