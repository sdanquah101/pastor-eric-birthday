// Admin only (ADMIN_PASSWORD). GET lists every gift plus Hubtel gifts still awaiting confirmation.
// POST { action: "sync" }: pull birthday payments from Paystack (if its key is set) and
//   re-check pending Hubtel gifts with Hubtel's status API (works only from whitelisted IPs).
// POST { action: "confirm", reference }: mark a pending Hubtel gift as paid after checking the Hubtel dashboard.
// POST { action: "dismiss", reference }: mark a pending gift as not paid (hides it from the list).
import { db, send, readJson, recordGift, paystack, isBirthdayGift, isAdmin, ConfigError } from "./_lib.js";
import { hubtelReady, recheck, markPaid, markFailed } from "./_hubtel.js";

export default async function handler(req, res) {
  if (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length < 8) {
    return send(res, 503, { error: "The admin page is off. Set ADMIN_PASSWORD (8+ characters) in Vercel and redeploy." });
  }
  if (!isAdmin(req)) return send(res, 401, { error: "Wrong password." });

  try {
    if (req.method === "POST") {
      const { action, reference } = await readJson(req);
      if (action === "sync") return send(res, 200, await syncAll());
      if (action === "confirm" || action === "dismiss") {
        if (!/^HBD[0-9a-f]{24}$/.test(String(reference || ""))) return send(res, 400, { error: "Bad reference." });
        if (action === "dismiss") { await markFailed(reference, "dismissed on /admin"); return send(res, 200, { ok: true }); }
        const r = await markPaid(reference, { detail: "marked paid on /admin" });
        return r.ok ? send(res, 200, { ok: true }) : send(res, 400, { error: r.reason });
      }
      return send(res, 400, { error: "Unknown action." });
    }
    if (req.method !== "GET") return send(res, 405, { error: "Method not allowed" });

    const sql = db();
    const gifts = await sql`
      select reference, amount_minor, currency, name, email, note, anonymous, channel, paid_at
      from gifts order by paid_at desc nulls last, id desc`;
    const wishes = await sql`select count(*)::int as n from wishes where hidden = false`;
    const pending = await sql`
      select reference, amount_minor, currency, name, email, note, anonymous, detail, created_at
      from pending_gifts where status = 'pending' order by created_at desc limit 200`;
    return send(res, 200, { gifts, pending, wishes: wishes[0].n });
  } catch (e) {
    if (e instanceof ConfigError) return send(res, 500, { error: e.message });
    console.error(e);
    return send(res, 500, { error: "Something went wrong on the server. Try again in a moment." });
  }
}

async function syncAll() {
  const out = { added: 0, birthdayGifts: 0, checked: 0, notes: [] };
  if (process.env.PAYSTACK_SECRET_KEY) {
    try { Object.assign(out, await syncFromPaystack()); }
    catch (e) { out.notes.push(e instanceof ConfigError ? e.message : "Paystack could not be reached."); }
  }
  if (hubtelReady()) {
    const rows = await db()`select reference from pending_gifts where status = 'pending' and created_at > now() - interval '30 days' order by created_at desc limit 50`;
    let paid = 0, blocked = 0;
    for (const { reference } of rows) {
      const r = await recheck(reference).catch(() => "error");
      if (r === "paid") paid++; else if (r === "blocked") blocked++;
    }
    out.added += paid;
    out.hubtelPending = rows.length - paid;
    if (blocked) out.notes.push("Hubtel's status check refused this server (its IP isn't whitelisted), so pending Hubtel gifts were not re-checked. Check them in your Hubtel dashboard and use Mark as paid.");
  }
  return out;
}

async function syncFromPaystack() {
  let page = 1, pages = 1, seen = 0, found = 0;
  const before = (await db()`select count(*)::int as n from gifts`)[0].n;
  do {
    const { ok, body } = await paystack(`/transaction?status=success&perPage=100&page=${page}`);
    if (!ok) throw new Error(body?.message || "Paystack did not return transactions.");
    for (const tx of body.data || []) {
      seen++;
      if (tx.status === "success" && isBirthdayGift(tx)) { found++; await recordGift(tx); }
    }
    pages = body.meta?.pageCount || 1;
    page++;
  } while (page <= pages && page <= 50);
  const after = (await db()`select count(*)::int as n from gifts`)[0].n;
  return { checked: seen, birthdayGifts: found, added: after - before };
}
