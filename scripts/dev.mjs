#!/usr/bin/env node
// Local preview without Vercel: serves the site on http://localhost:3000.
// The /api routes are not run here, so the page shows sample wishes and giving stays off.
// For the full thing (database + Paystack) use `npx vercel dev` with a .env file.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.PORT) || 3000;
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".webp": "image/webp",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon",
};

http.createServer((req, res) => {
  const url = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (url.startsWith("/api/")) {
    res.writeHead(404, { "content-type": "application/json" });
    return res.end(JSON.stringify({ error: "API not available in local preview" }));
  }
  let file = path.join(ROOT, path.normalize(url).replace(/^(\.\.[/\\])+/, ""));
  if (!file.startsWith(ROOT) || file.includes(`${path.sep}photos${path.sep}originals`)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
  else if (!path.extname(file) && fs.existsSync(file + ".html")) file += ".html"; // /admin -> admin.html, as on Vercel
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end("Not found"); }
    res.writeHead(200, { "content-type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream", "cache-control": "no-store" });
    res.end(data);
  });
}).listen(PORT, () => console.log(`Birthday site preview: http://localhost:${PORT}`));
