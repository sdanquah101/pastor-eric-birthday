#!/usr/bin/env node
/* ------------------------------------------------------------------
   Photo pipeline.

   1. Put original photos in photos/originals/  (sub-folders become albums,
      e.g. photos/originals/ministry/IMG_2041.jpg -> album "Ministry").
   2. Run:  npm run photos
   3. Edit content/photos.json to add alt text, captions, focus, order.

   For every original this writes web-sized WebP files to photos/web/
   (400, 1000 and 1800px on the long edge, never upscaled), reads the
   size and main colour, and adds or updates its entry in
   content/photos.json. Your edits in that file (alt, caption, focus,
   album, hidden, share, order) are kept on every run.

   Options:
     --force        re-encode every photo, even unchanged ones
     --sort=date    re-order all photos by date taken (oldest first)
     --sort=name    re-order all photos by file name
     --prune        drop entries (and web files) whose originals are gone
   ------------------------------------------------------------------ */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ORIGINALS = path.join(ROOT, "photos/originals");
const WEB = path.join(ROOT, "photos/web");
const MANIFEST = path.join(ROOT, "content/photos.json");
const LONG_EDGES = [400, 1000, 1800];
const QUALITY = 78;
const EXT = /\.(jpe?g|png|webp|tiff?|avif|heic|heif)$/i;

const args = process.argv.slice(2);
const FORCE = args.includes("--force");
const PRUNE = args.includes("--prune");
const SORT = (args.find((a) => a.startsWith("--sort=")) || "").split("=")[1] || "";

const slug = (s) =>
  s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "photo";
const titleCase = (s) => s.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).trim();
const exists = (p) => fs.access(p).then(() => true, () => false);

async function walk(dir) {
  const out = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true }).catch(() => [])) {
    if (e.name.startsWith(".")) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else if (EXT.test(e.name)) out.push(p);
  }
  return out;
}

// "2019:06:14 10:22:05" appears in the EXIF block of most camera and phone photos
function takenFrom(exif) {
  if (!exif) return null;
  const m = exif.toString("latin1").match(/(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}` : null;
}

const hex = ({ r, g, b }) => "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");

async function readManifest() {
  try {
    const m = JSON.parse(await fs.readFile(MANIFEST, "utf8"));
    return Array.isArray(m.photos) ? m : { photos: [] };
  } catch (e) {
    if (e.code !== "ENOENT") throw new Error(`content/photos.json is not valid JSON: ${e.message}`);
    return { photos: [] };
  }
}

async function encode(file, id) {
  const img = sharp(file, { failOn: "none" }).rotate(); // apply phone orientation
  const meta = await img.metadata();
  const turned = (meta.orientation || 1) >= 5;
  const w = turned ? meta.height : meta.width, h = turned ? meta.width : meta.height;
  const long = Math.max(w, h);
  const edges = LONG_EDGES.filter((l) => l < long);
  if (edges.length < LONG_EDGES.length) edges.push(Math.min(long, LONG_EDGES.at(-1)));
  const widths = [];
  for (const l of [...new Set(edges)]) {
    const tw = Math.round((w * l) / long);
    // sharp drops EXIF (including GPS location) unless asked to keep it
    await sharp(file, { failOn: "none" }).rotate().resize({ width: tw })
      .webp({ quality: QUALITY, effort: 5 }).toFile(path.join(WEB, `${id}-${tw}.webp`));
    widths.push(tw);
  }
  const { dominant } = await sharp(file, { failOn: "none" }).rotate().resize(64).stats();
  return { w, h, widths, color: hex(dominant), taken: takenFrom(meta.exif) };
}

async function main() {
  await fs.mkdir(WEB, { recursive: true });
  const manifest = await readManifest();
  const byFile = new Map(manifest.photos.map((p) => [p.file, p]));
  const ids = new Set(manifest.photos.map((p) => p.id));
  const files = (await walk(ORIGINALS)).sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
  const seen = new Set();
  let added = 0, updated = 0, skipped = 0;
  const failed = [];

  for (const abs of files) {
    const rel = path.relative(ORIGINALS, abs).split(path.sep).join("/");
    seen.add(rel);
    const stat = await fs.stat(abs);
    let entry = byFile.get(rel);
    const fresh = !entry;
    if (fresh) {
      const base = slug(rel.replace(EXT, "").replace(/\//g, "-"));
      let id = base, n = 2;
      while (ids.has(id)) id = `${base}-${n++}`;
      ids.add(id);
      const folder = rel.includes("/") ? titleCase(rel.split("/")[0]) : "";
      entry = { id, file: rel, alt: "", caption: "", album: folder, focus: 0.3 };
    }
    const outputsThere = entry.widths?.length &&
      (await Promise.all(entry.widths.map((w) => exists(path.join(WEB, `${entry.id}-${w}.webp`))))).every(Boolean);
    if (!FORCE && !fresh && outputsThere && entry.bytes === stat.size) { skipped++; continue; }

    process.stdout.write(`  ${fresh ? "+" : "~"} ${rel} `);
    try {
      // remove stale sizes before writing new ones
      for (const w of entry.widths || []) await fs.rm(path.join(WEB, `${entry.id}-${w}.webp`), { force: true });
      Object.assign(entry, await encode(abs, entry.id), { bytes: stat.size });
      if (!entry.taken) delete entry.taken;
      console.log(`-> ${entry.id} (${entry.w}x${entry.h})`);
      if (fresh) { manifest.photos.push(entry); byFile.set(rel, entry); added++; } else updated++;
    } catch (e) {
      console.log("FAILED");
      failed.push(`${rel}: ${e.message.split("\n")[0]}`);
      if (fresh) ids.delete(entry.id);
    }
  }

  // entries whose original isn't on this computer are kept (originals aren't committed) unless --prune
  if (PRUNE) {
    const keep = [];
    for (const p of manifest.photos) {
      if (seen.has(p.file)) { keep.push(p); continue; }
      for (const w of p.widths || []) await fs.rm(path.join(WEB, `${p.id}-${w}.webp`), { force: true });
      console.log(`  - ${p.file} (original removed)`);
    }
    manifest.photos = keep;
    const live = new Set(keep.flatMap((p) => (p.widths || []).map((w) => `${p.id}-${w}.webp`)));
    for (const f of await fs.readdir(WEB)) if (f.endsWith(".webp") && !live.has(f)) await fs.rm(path.join(WEB, f));
  }

  if (SORT === "date") manifest.photos.sort((a, b) => (a.taken || "9999").localeCompare(b.taken || "9999") || a.file.localeCompare(b.file));
  if (SORT === "name") manifest.photos.sort((a, b) => a.file.localeCompare(b.file, "en", { numeric: true }));

  // the picture WhatsApp/Facebook show when the link is shared
  const share = manifest.photos.find((p) => p.share) || manifest.photos[0];
  if (share) {
    const src = (await exists(path.join(ORIGINALS, share.file))) ? path.join(ORIGINALS, share.file)
      : path.join(WEB, `${share.id}-${Math.max(...share.widths)}.webp`);
    if (await exists(src)) {
      // 1200x630 band; shareFocus (else focus) picks how far down the photo it sits: 0 = top, 1 = bottom
      const focus = share.shareFocus ?? share.focus ?? 0.3;
      const scaled = await sharp(src).rotate().resize({ width: 1200, height: 630, fit: "outside" }).toBuffer({ resolveWithObject: true });
      const { width: sw, height: sh } = scaled.info;
      await sharp(scaled.data).extract({
        left: Math.round((sw - 1200) / 2), top: Math.round(Math.min(1, Math.max(0, focus)) * (sh - 630)), width: 1200, height: 630,
      }).jpeg({ quality: 82, mozjpeg: true }).toFile(path.join(ROOT, "photos/share.jpg"));
    }
  }

  const ordered = manifest.photos.map((p) => ({
    id: p.id, file: p.file, alt: p.alt ?? "", caption: p.caption ?? "", album: p.album ?? "",
    focus: p.focus ?? 0.3, ...(p.shareFocus != null ? { shareFocus: p.shareFocus } : {}),
    ...(p.hidden ? { hidden: true } : {}), ...(p.share ? { share: true } : {}),
    w: p.w, h: p.h, widths: p.widths, color: p.color, ...(p.taken ? { taken: p.taken } : {}), bytes: p.bytes,
  }));
  await fs.writeFile(MANIFEST, JSON.stringify({ photos: ordered }, null, 2) + "\n");

  const noAlt = ordered.filter((p) => !p.alt && !p.hidden).length;
  console.log(`\n${ordered.length} photos in content/photos.json  (+${added} new, ${updated} updated, ${skipped} unchanged)`);
  if (noAlt) console.log(`${noAlt} photo(s) have no alt text yet. Add a short description for screen readers in content/photos.json.`);
  if (failed.length) {
    console.log(`\nCould not read ${failed.length} file(s):\n  ${failed.join("\n  ")}`);
    console.log("iPhone HEIC photos: export them as JPEG first (Photos app > Export, or set Camera > Formats > Most Compatible).");
    process.exitCode = 1;
  }
}

main().catch((e) => { console.error(e.message); process.exit(1); });
