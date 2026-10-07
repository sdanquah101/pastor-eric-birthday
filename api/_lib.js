import { neon } from "@neondatabase/serverless";
import crypto from "node:crypto";

let _sql;
export function db() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
  _sql ??= neon(process.env.DATABASE_URL);
  return _sql;
}

export function send(res, status, body, cache) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", cache || "no-store");
  res.end(JSON.stringify(body));
}

export async function readJson(req) {
  if (req.body && typeof req.body === "object") return req.body;
  const raw = await readRaw(req);
  try { return JSON.parse(raw || "{}"); } catch { return {}; }
}

export function readRaw(req) {
  return new Promise((ok, no) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => ok(data));
    req.on("error", no);
  });
}

export function ipHash(req) {
  const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "").split(",")[0].trim();
  return crypto.createHash("sha256").update(ip + (process.env.IP_SALT || "phanet")).digest("hex").slice(0, 32);
}

export const clean = (v, max) =>
  String(v ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, max);

/** Save a successful Paystack transaction. Safe to call twice for the same reference. */
export async function recordGift(tx) {
  const sql = db();
  const m = tx.metadata || {};
  const meta = typeof m === "string" ? safeParse(m) : m;
  await sql`
    insert into gifts (reference, amount_minor, currency, email, name, note, anonymous, channel, paid_at)
    values (
      ${tx.reference}, ${tx.amount}, ${tx.currency}, ${tx.customer?.email || null},
      ${clean(meta.name, 60) || null}, ${clean(meta.note, 200) || null}, ${Boolean(meta.anonymous)},
      ${tx.channel || null}, ${tx.paid_at || tx.paidAt || new Date().toISOString()}
    )
    on conflict (reference) do nothing`;
}
function safeParse(s) { try { return JSON.parse(s); } catch { return {}; } }
