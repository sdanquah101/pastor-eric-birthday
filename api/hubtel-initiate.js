// Starts a Hubtel checkout: saves the gift as pending and returns Hubtel's payment page URL.
import { send, readJson, clean, ConfigError } from "./_lib.js";
import { startCheckout, provider } from "./_hubtel.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });
  if (provider() !== "hubtel") return send(res, 409, { error: "Hubtel giving is not switched on." });
  try {
    const b = await readJson(req);
    const amount = Math.round(Number(b.amount) * 100) / 100;
    const name = clean(b.name, 60), email = clean(b.email, 120), note = clean(b.note, 200);
    if (!(amount >= 1) || amount > 100000) return send(res, 400, { error: "Enter an amount between GHS 1 and GHS 100,000." });
    if (name.length < 2) return send(res, 400, { error: "Add your name." });
    if (email && !/^\S+@\S+\.\S+$/.test(email)) return send(res, 400, { error: "That email doesn't look right." });
    const site = `https://${req.headers["x-forwarded-host"] || req.headers.host}`;
    const out = await startCheckout({ amount, name, email, note, anonymous: Boolean(b.anonymous), site });
    return send(res, 200, out);
  } catch (e) {
    console.error("[hubtel-initiate]", e.message);
    if (e.userFacing) return send(res, 502, { error: e.message });
    if (e instanceof ConfigError) return send(res, 500, { error: "Giving isn't set up correctly yet. Please let the organisers know." });
    return send(res, 500, { error: "Couldn't start the payment. Please try again." });
  }
}
