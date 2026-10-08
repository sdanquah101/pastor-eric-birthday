import { send } from "./_lib.js";

const mode = (k, prefix) => (!k ? "missing" : k.startsWith(`${prefix}_live_`) ? "live" : k.startsWith(`${prefix}_test_`) ? "test" : "unrecognised");

export default function handler(req, res) {
  send(res, 200, {
    paystackPublicKey: process.env.PAYSTACK_PUBLIC_KEY || "",
    // Which settings are present in Vercel (never the values). Shown on the admin page.
    status: {
      database: Boolean(process.env.DATABASE_URL),
      paystackSecretKey: mode(process.env.PAYSTACK_SECRET_KEY, "sk"),
      adminPassword: (process.env.ADMIN_PASSWORD || "").length >= 8,
    },
  }, "no-store");
}
