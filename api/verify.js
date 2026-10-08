import { send, readJson, recordGift, paystack } from "./_lib.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });
  try {
    const { reference } = await readJson(req);
    if (!reference || !/^[\w.-]{6,100}$/.test(reference)) return send(res, 400, { ok: false, error: "Missing payment reference." });

    const { ok, body } = await paystack(`/transaction/verify/${encodeURIComponent(reference)}`);
    const tx = body?.data;
    if (!ok || !tx || tx.status !== "success") {
      return send(res, 402, { ok: false, status: tx?.status || "unknown" });
    }
    await recordGift(tx);
    return send(res, 200, { ok: true, amount: tx.amount / 100, currency: tx.currency, reference: tx.reference });
  } catch (e) {
    // shows up in Vercel > Logs, so a missing or wrong key is easy to spot
    console.error("[verify]", e.message);
    return send(res, 500, { ok: false, error: "Could not confirm the payment right now." });
  }
}
