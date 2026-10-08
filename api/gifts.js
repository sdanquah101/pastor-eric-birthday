// Admin only (ADMIN_PASSWORD). GET lists every gift; POST { action: "sync" } pulls
// successful birthday payments from Paystack and records any the site missed.
import { db, send, readJson, recordGift, paystack, isBirthdayGift, isAdmin, ConfigError } from "./_lib.js";

export default async function handler(req, res) {
  if (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length < 8) {
    return send(res, 503, { error: "The admin page is off. Set ADMIN_PASSWORD (8+ characters) in Vercel and redeploy." });
  }
  if (!isAdmin(req)) return send(res, 401, { error: "Wrong password." });

  try {
    if (req.method === "POST") {
      const { action } = await readJson(req);
      if (action !== "sync") return send(res, 400, { error: "Unknown action." });
      return send(res, 200, await syncFromPaystack());
    }
    if (req.method !== "GET") return send(res, 405, { error: "Method not allowed" });

    const sql = db();
    const gifts = await sql`
      select reference, amount_minor, currency, name, email, note, anonymous, channel, paid_at
      from gifts order by paid_at desc nulls last, id desc`;
    const wishes = await sql`select count(*)::int as n from wishes where hidden = false`;
    return send(res, 200, { gifts, wishes: wishes[0].n });
  } catch (e) {
    if (e instanceof ConfigError) return send(res, 500, { error: e.message });
    console.error(e);
    return send(res, 500, { error: "Something went wrong on the server. Try again in a moment." });
  }
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
