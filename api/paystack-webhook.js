// Paystack calls this URL when a payment succeeds, even if the giver closes the page early.
// Set it in Paystack Dashboard > Settings > API Keys & Webhooks:
//   https://pastor-eric-birthday.vercel.app/api/paystack-webhook
import crypto from "node:crypto";
import { readRaw, recordGift, isBirthdayGift } from "./_lib.js";

export default async function handler(req, res) {
  if (req.method !== "POST") { res.statusCode = 405; return res.end(); }
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) { console.error("[webhook] PAYSTACK_SECRET_KEY is not set"); res.statusCode = 503; return res.end(); }
  const raw = await readRaw(req);
  const sig = String(req.headers["x-paystack-signature"] || "");
  const expected = crypto.createHmac("sha512", secret).update(raw).digest("hex");
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    res.statusCode = 401; return res.end();
  }
  try {
    const event = JSON.parse(raw);
    // the Paystack account may take other payments too; only birthday gifts belong here
    if (event.event === "charge.success" && event.data?.status === "success" && isBirthdayGift(event.data)) {
      await recordGift(event.data);
    }
  } catch (e) {
    console.error(e);
  }
  res.statusCode = 200;
  res.end("ok");
}
