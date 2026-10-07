// Paystack calls this URL when a payment succeeds, even if the giver closes the page early.
// Set it in Paystack Dashboard > Settings > API Keys & Webhooks:  https://YOUR-DOMAIN/api/paystack-webhook
import crypto from "node:crypto";
import { readRaw, recordGift } from "./_lib.js";

export default async function handler(req, res) {
  if (req.method !== "POST") { res.statusCode = 405; return res.end(); }
  const raw = await readRaw(req);
  const sig = req.headers["x-paystack-signature"];
  const expected = crypto.createHmac("sha512", process.env.PAYSTACK_SECRET_KEY || "").update(raw).digest("hex");
  if (!sig || sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    res.statusCode = 401; return res.end();
  }
  try {
    const event = JSON.parse(raw);
    if (event.event === "charge.success" && event.data?.status === "success") await recordGift(event.data);
  } catch (e) {
    console.error(e);
  }
  res.statusCode = 200;
  res.end("ok");
}
