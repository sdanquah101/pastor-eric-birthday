# Birthday site for Pastor Eric Obeng Kwakye

A static site with three small serverless functions, deployed on **Vercel**, with
**Neon Postgres** for wishes and **Paystack** for gifts. No framework and no build step.

Opening weave → home with four hanging stoles → four rooms: `#story`, `#wishes`, `#gallery`, `#give`.
Links such as `https://your-domain/#wishes` open a room directly and skip the opening.

## What's where

```
index.html                 page structure (all five rooms)
content/
  site.js                  ALL the words: bio, facts, giving text, dates, which photos open the site  <- edit
  photos.json              the photo list: order, alt text, captions, albums  <- written by `npm run photos`, then edit
photos/
  originals/               drop full-size photos here (not committed, not deployed)
  web/                     resized WebP copies the site uses (generated, committed)
  share.jpg                the preview image for WhatsApp/Facebook (generated)
assets/
  css/                     one file per part: base, kente, intro, nav, home, story, gallery, wishes, give
  js/main.js               boots the page
  js/lib/                  dom helpers, kente generator, photo library
  js/rooms/                intro, home (stoles), nav (rooms + curtain), story, gallery, wishes, give
api/                       Vercel functions: wishes, verify, paystack-webhook, config, gifts (admin)
admin.html                 organisers' page at /admin: who has given, totals, CSV
db/schema.sql              run once in Neon
scripts/photos.mjs         the photo pipeline
scripts/dev.mjs            local preview server
```

## Adding the photos (about 100)

1. `npm install` (once, in this folder).
2. Copy the photos into `photos/originals/`. Sub-folders become albums in the gallery:
   ```
   photos/originals/ministry/IMG_2041.jpg
   photos/originals/phanet-family/IMG_3310.jpg
   photos/originals/celebrations/…
   ```
   JPEG, PNG, WebP and AVIF all work. Export iPhone HEIC photos as JPEG first.
3. `npm run photos`
   - makes three sizes of each (400, 1000, 1800px on the long edge, never enlarged) as WebP,
   - turns phone photos the right way up and strips location data,
   - adds each photo to `content/photos.json`, keeping anything you've already edited there.
4. Open `content/photos.json` and, for each photo, fill in:
   - `alt` — a short description for blind visitors ("Pastor Eric baptising a student at Lake Bosomtwe")
   - `caption` — optional, shown under the photo in the gallery
   - `focus` — 0 to 1, which part to keep when a photo is cropped (0 = top, 0.3 = faces near the top, 0.5 = middle)
   - `album` — change or clear the album name
   - `hidden: true` to keep a photo out of the gallery (it can still be used in the opening or story)
   - `share: true` on one photo to make it the WhatsApp preview image (then run `npm run photos` again)
5. Reorder by moving entries in the file, or run `npm run photos -- --sort=date` (date taken) or `--sort=name`.
6. Commit `photos/web/`, `photos/share.jpg` and `content/photos.json`.

Run `npm run photos` again whenever you add more. Unchanged photos are skipped.
`npm run photos -- --prune` removes photos whose originals you deleted;
`--force` re-encodes everything.

The opening weave and the story photo are chosen by id (the file name, lower-cased) in `content/site.js`.

**Size guide:** 100 photos come to roughly 25–35 MB in `photos/web/`. Visitors only download what
they look at: about 25 KB per thumbnail in the grid and 100–250 KB per photo in the loom.

## Preview on your computer

```
npm run dev        # http://localhost:3000
```
The API doesn't run in this preview, so you'll see sample wishes and giving stays off.
For the full thing use `npx vercel dev` with a `.env` file (see `.env.example`).

## 1. Database (Neon)
1. Create a project at console.neon.tech.
2. Open **SQL Editor**, paste `db/schema.sql`, run it.
3. Copy the **connection string** (pooled is fine).

## 2. Paystack
1. Dashboard > Settings > API Keys & Webhooks. Copy the **public** and **secret** keys (use the test keys first).
2. Set the **Webhook URL** to `https://pastor-eric-birthday.vercel.app/api/paystack-webhook`.
   A Paystack account has one webhook URL. If this is the same account as phaneteers.com
   (whose webhook is `https://phaneteers.com/api/paystack/webhook`), use a separate Paystack account or
   subaccount for the birthday, or gifts are still confirmed by `/api/verify` when the giver keeps the page open.
3. Make sure the account is enabled for **GHS** (mobile money and card).

## 3. Deploy (Vercel)
1. vercel.com/new → import this repo.
2. Framework preset: **Other**. Leave Root Directory as it is. No build command.
3. Environment variables (Project > Settings > Environment Variables):
   - `DATABASE_URL` — Neon connection string
   - `PAYSTACK_PUBLIC_KEY` — pk_test_… / pk_live_…
   - `PAYSTACK_SECRET_KEY` — sk_test_… / sk_live_…
   - `IP_SALT` — any random words (used to rate-limit wishes without storing IPs)
   - `ADMIN_PASSWORD` — 8+ characters; opens the organisers' page at `/admin`
4. Deploy. The live site is https://pastor-eric-birthday.vercel.app/. If it moves to another domain,
   update `og:url` and `og:image` in `index.html` so WhatsApp still shows the preview photo.

## 4. Fill in the words
Open `content/site.js` and replace everything in `[square brackets]`.
Set `birthDate` (and `birthdayThisYear`) to show his age and the date on the home page.

## Seeing who has given: /admin
Open https://pastor-eric-birthday.vercel.app/admin and enter `ADMIN_PASSWORD`. It shows every gift (name,
amount, method, note, email, Paystack reference), the total received, and a CSV download.

- **Sync from Paystack** pulls every successful birthday payment from Paystack and records any the site missed
  (for example when a giver closed the page before it confirmed). Only payments made on this site are counted:
  they carry the occasion "Birthday gift". Other payments on the same Paystack account are ignored.
- Warnings at the top of the page say when a setting is missing in Vercel (e.g. `PAYSTACK_SECRET_KEY`).
- "private" next to a name means the giver ticked "Keep my name private". The organisers still see it.

## Managing wishes and gifts (Neon SQL Editor)
```sql
update wishes set hidden = true where id = 12;          -- hide a wish
select * from wishes order by created_at desc;          -- read all
select currency, sum(amount_minor)/100.0, count(*) from gifts group by currency;
```

## On phones
Below 760px wide the rooms get a tab bar at the bottom, the gallery switches to a portrait frame with
swipe left/right, and "All photos" is a three-column grid. Everything respects the iPhone notch and home bar.
