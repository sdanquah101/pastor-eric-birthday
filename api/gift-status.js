// The Give page asks this after Hubtel sends the giver back: has their gift been confirmed?
import { db, send } from "./_lib.js";
import { recheck, hubtelReady } from "./_hubtel.js";

export default async function handler(req, res) {
  const ref = String(new URL(req.url, "http://x").searchParams.get("ref") || "");
  if (!/^HBD[0-9a-f]{24}$/.test(ref)) return send(res, 400, { error: "Bad reference." });
  try {
    const sql = db();
    let [p] = await sql`select status, amount_minor, currency, name, created_at from pending_gifts where reference = ${ref}`;
    if (!p) return send(res, 404, { error: "Not found." });
    // the callback usually arrives within seconds; after 20s also ask Hubtel directly (works only if whitelisted)
    if (p.status === "pending" && hubtelReady() && Date.now() - new Date(p.created_at) > 20000) {
      await recheck(ref).catch(() => {});
      [p] = await sql`select status, amount_minor, currency, name, created_at from pending_gifts where reference = ${ref}`;
    }
    return send(res, 200, { status: p.status, amount: p.amount_minor / 100, currency: p.currency, name: p.name });
  } catch (e) {
    console.error("[gift-status]", e.message);
    return send(res, 500, { error: "Couldn't check right now." });
  }
}
