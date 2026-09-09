# alexmrivasjr.github.io — Soil & Compost Deal Tracker

A small site + bot that checks specific Home Depot and Lowe's products, by
exact SKU, for price drops:

| Product | Retailer | Threshold |
|---|---|---|
| All Natural Garden Soil, Organic - 2 cf | Home Depot | $2.00 |
| All Natural Garden Soil, Organic - 1 cf | Home Depot | $2.00 |
| All Natural Garden Soil, Organic - 3 cf | Home Depot | $2.00 |
| Organic Raised Bed & Potting Mix - 2 cf | Home Depot | $2.00 |
| Sta-Green Garden Soil, 2 cu ft | Lowe's | $2.50 |
| Sta-Green, 1-cu ft | Lowe's | $2.50 |

When something drops at or below its threshold, it shows up on the site and (if
you've enabled it) sends a browser push notification.

## How it works

- **GitHub Actions** (`.github/workflows/scrape-deals.yml`) runs
  Mon/Tue/Thu/Fri on a cron schedule (and on-demand via "Run workflow").
- Home Depot products are checked by exact product ID via
  [SerpApi](https://serpapi.com/home-depot-product-api)'s Home Depot Product
  API (`config/serpapi-products.json`), which returns the real price at your
  local store — including clearance markdowns that never show up in search
  results. This needs a `SERPAPI_KEY` secret; without it, this step is
  skipped entirely.
- Lowe's products are checked by scraping the product's own detail page
  directly (`config/lowes-products.json`) — parsing the page's embedded
  `schema.org` product data (JSON-LD), falling back to a headless Chromium
  render (Playwright) if the plain request comes back empty or blocked.
  SerpApi doesn't offer a Lowe's product API, only Home Depot's, so this
  path doesn't need any API key.
- Matches at/under threshold are written to `data/deals.json`, which the site
  reads client-side.
- New deals (ones not already notified) trigger a **Web Push** notification
  straight to your subscribed browser/phone — no third-party service, using
  the free, standard Push API + VAPID.
- The site (`index.html`) is a small installable PWA: a "Deals" list plus an
  "Enable Notifications" button.

Everything runs on GitHub's free tier (Pages + Actions) — no server to host or
pay for.

## One-time setup

1. **Merge this branch to `main`.** GitHub Pages serves this user site
   directly from the root of `main`.

2. **Add repository secrets** (Settings → Secrets and variables → Actions):
   - `SERPAPI_KEY` — needed for the Home Depot checks. Get a key from
     [serpapi.com](https://serpapi.com/).
   - `VAPID_PRIVATE_KEY` — see below, was generated for you already.
   - `VAPID_PUBLIC_KEY` — same value as the `VAPID_PUBLIC_KEY` constant
     committed in `assets/js/app.js` (the send-push script needs it as an
     env var; the copy in `app.js` is for the browser).
   - `VAPID_SUBJECT` — set to `mailto:alexmrivasjr@gmail.com`.
   - `PUSH_SUBSCRIPTION` — added in step 4, after you subscribe.

   The **private** VAPID key was generated during development and shown to
   you in chat — it is **not** committed anywhere in this repo. If you ever
   need a fresh keypair (e.g. the private key leaks), run:
   ```
   npm install
   npm run generate-vapid-keys
   ```
   and update both the secret and the `VAPID_PUBLIC_KEY` constant in
   `assets/js/app.js`.

3. **Visit your site** once it's live (`https://alexmrivasjr.github.io/`) and
   click **Enable Notifications**. Grant the browser permission prompt.

4. **Copy the subscription JSON** shown on the page and paste it as the
   `PUSH_SUBSCRIPTION` secret (Settings → Secrets and variables → Actions →
   New repository secret). This is a one-time step per device you want to
   notify. If you re-subscribe on a different browser/phone later, update
   this secret to the new value (it currently supports one active
   subscription at a time).

   **iOS note:** Safari only supports web push for PWAs added to the Home
   Screen. On iPhone: open the site in Safari → Share → *Add to Home Screen*
   → open it from the home screen icon → then tap *Enable Notifications*.

5. **Run the workflow once manually** (Actions tab → "Scrape soil & compost
   deals" → Run workflow) to confirm scraping and push delivery both work
   before waiting for the next scheduled run.

## Adjusting products or price thresholds

Edit `config/serpapi-products.json` for Home Depot: set your store's `id`
and `zip`, then list products with their Home Depot `productId` (from the
product's URL) and a `threshold`.

Edit `config/lowes-products.json` for Lowe's: list products with their
Lowe's `productId` (from the product's URL, e.g.
`lowes.com/pd/.../<productId>`) and a `threshold`. No API key needed, but
being direct product-page scraping it's subject to the same bot-detection
caveats below.

## If scraping stops finding anything

Home Depot and Lowe's both run bot-detection (Cloudflare/Akamai/PerimeterX)
that can change behavior at any time, and their page markup changes
periodically. If `data/deals.json` keeps showing entries in `errors`:

1. Check the failing run's logs in the Actions tab for the actual error.
2. If SerpApi itself is erroring for a Home Depot product, check the product
   directly on homedepot.com — it may be out of stock or discontinued at
   your store, which is not a bug to fix.
3. If Lowe's requests are being blocked outright (persistent 403 from both
   the HTTP and browser paths), that's expected occasionally — the workflow
   just logs the error and keeps working for whichever product still
   succeeds.

This tracker only checks a short, fixed list of specific products for
personal price tracking — please don't turn it into broader
category/keyword scraping or increase the schedule frequency.

## Local development

```
npm install
npm run scrape       # writes data/deals.json, data/new-deals.json
npm run send-push    # sends a push for anything in data/new-deals.json (needs env vars set)
```
