# Drop original photos here

Put the full-size photos in this folder, then run `npm run photos` from the site folder.

- Sub-folders become albums in the gallery: `ministry/`, `phanet/`, `family/` …
- JPEG, PNG, WebP and AVIF work. Export iPhone HEIC photos as JPEG first.
- Name files `001-something.jpg`, `002-…` if you want a set order (or run `npm run photos -- --sort=date`).

Nothing in this folder is committed to git or uploaded to Vercel — only the resized copies in `photos/web/`.
