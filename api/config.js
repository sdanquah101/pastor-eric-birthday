import { send } from "./_lib.js";

export default function handler(req, res) {
  send(res, 200, {
    paystackPublicKey: process.env.PAYSTACK_PUBLIC_KEY || "",
  }, "public, s-maxage=300");
}
