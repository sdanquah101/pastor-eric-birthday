import { db, send, readJson, ipHash, clean } from "./_lib.js";

export default async function handler(req, res) {
  try {
    const sql = db();

    if (req.method === "GET") {
      const rows = await sql`
        select id::text as id, name, relation, message, created_at
        from wishes where hidden = false
        order by created_at desc limit 1000`;
      return send(res, 200, { wishes: rows }, "public, s-maxage=10, stale-while-revalidate=60");
    }

    if (req.method === "POST") {
      const b = await readJson(req);
      if (b.website) return send(res, 200, { wish: { id: "0", name: "", message: "" } }); // honeypot
      const name = clean(b.name, 60);
      const relation = clean(b.relation, 30);
      const message = clean(b.message, 600);
      if (name.length < 2) return send(res, 400, { error: "Add your name so he knows who it's from." });
      if (message.length < 3) return send(res, 400, { error: "Write a short message before lighting your wish." });

      const ip = ipHash(req);
      const [{ n }] = await sql`
        select count(*)::int as n from wishes
        where ip_hash = ${ip} and created_at > now() - interval '10 minutes'`;
      if (n >= 5) return send(res, 429, { error: "You've sent several wishes in a few minutes. Wait a little and try again." });

      const [wish] = await sql`
        insert into wishes (name, relation, message, ip_hash)
        values (${name}, ${relation || null}, ${message}, ${ip})
        returning id::text as id, name, relation, message, created_at`;
      return send(res, 201, { wish });
    }

    res.setHeader("allow", "GET, POST");
    return send(res, 405, { error: "Method not allowed" });
  } catch (e) {
    console.error(e);
    return send(res, 500, { error: "Your wish wasn't saved because the server had a problem. Try again in a moment." });
  }
}
