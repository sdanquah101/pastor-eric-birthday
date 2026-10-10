// Direct MoMo gifts (SITE.giving.momo): the giver sends money to Pastor Eric's number
// themselves, then tells us here. The site can't see his MoMo account, so these are
// self-reported: they go on the cloth at once, and organisers can remove a fake one on /admin.
import crypto from "node:crypto";
import { db, send, readJson, clean, ipHash } from "./_lib.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });
  try {
    const b = await readJson(req);
    if (b.website) return send(res, 200, { ok: true, amount: 0 }); // honeypot
    const amount = Math.round(Number(b.amount) * 100) / 100;
    const name = clean(b.name, 60), note = clean(b.note, 200);
    const phone = clean(b.phone, 16).replace(/[^\d+]/g, "");
    if (!(amount >= 1) || amount > 100000) return send(res, 400, { error: "Enter the amount you sent (GHS 1 or more)." });
    if (name.length < 2) return send(res, 400, { error: "Add your name." });
    if (phone && !/^\+?\d{9,13}$/.test(phone)) return send(res, 400, { error: "That MoMo number doesn't look right. Fix it or leave it empty." });

    const sql = db();
    const ip = ipHash(req);
    const [{ n }] = await sql`select count(*)::int as n from gifts where ip_hash = ${ip} and created_at > now() - interval '10 minutes'`;
    if (n >= 5) return send(res, 429, { error: "You've added several gifts in a few minutes. Wait a little and try again." });

    const reference = "MOMO" + crypto.randomBytes(12).toString("hex");
    await sql`
      insert into gifts (reference, amount_minor, currency, name, note, anonymous, channel, paid_at, phone, ip_hash)
      values (${reference}, ${Math.round(amount * 100)}, 'GHS', ${name}, ${note || null}, ${Boolean(b.anonymous)},
              'momo_direct', now(), ${phone || null}, ${ip})`;
    return send(res, 201, { ok: true, amount, currency: "GHS", reference });
  } catch (e) {
    console.error("[momo-gift]", e.message);
    return send(res, 500, { error: "Your gift wasn't added because the server had a problem. Try again in a moment." });
  }
}
