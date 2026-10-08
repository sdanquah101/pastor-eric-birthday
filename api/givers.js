// Public gift wall: who has given, their notes, and the total raised.
// Never sends individual amounts, emails or references (those are on /admin only).
// Givers who ticked "Keep my name private" appear as "A friend".
import { db, send } from "./_lib.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return send(res, 405, { error: "Method not allowed" });
  try {
    const sql = db();
    const givers = await sql`
      select case when anonymous or coalesce(trim(name), '') = '' then null else name end as name,
             note, paid_at
      from gifts order by paid_at desc nulls last, id desc limit 500`;
    const totals = await sql`
      select currency, sum(amount_minor)::bigint as amount_minor, count(*)::int as count
      from gifts group by currency order by count desc`;
    return send(res, 200, {
      count: totals.reduce((n, t) => n + t.count, 0),
      totals: totals.map((t) => ({ currency: t.currency, amount_minor: Number(t.amount_minor) })),
      givers,
    }, "public, s-maxage=15, stale-while-revalidate=60");
  } catch (e) {
    console.error(e);
    return send(res, 500, { error: "Could not load gifts right now." });
  }
}
