# alexmrivasjr.github.io — Soil & Compost Deal Tracker

A small site + bot that checks Home Depot and Lowe's once a day for deals on:

| Category | Alert threshold |
|---|---|
| Raised bed soil | $2.50 / bag |
| Potting mix | $2.50 / bag |
| Steer manure compost | $1.50 / bag |

When something drops at or below its threshold, it shows up on the site and (if
you've enabled it) sends a browser push notification.

## How it works

- **GitHub Actions** (`.github/workflows/scrape-deals.yml`) runs daily on a
  cron schedule (and on-demand via "Run workflow"). It scrapes each retailer's
  search results for each category, first trying a plain HTTP request +
  parsing the page's embedded `schema.org` product data (JSON-LD), then
  falling back to a headless Chromium render (Playwright) with CSS selectors
  if the simple request comes back empty or blocked.
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
   - `VAPID_PRIVATE_KEY` — see below, was generated for you already.
   - `VAPID_SUBJECT` — set to `mailto:alexmrivasjr@gmail.com`.
   - `PUSH_SUBSCRIPTION` — added in step 4, after you subscribe.

   The matching **public** key is already committed in
   `assets/js/app.js` (public keys are safe to expose). The **private** key
   was generated during development and was shown to you in chat — it is
   **not** committed anywhere in this repo. If you ever need a fresh keypair
   (e.g. the private key leaks), run:
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

Edit `config/products.json`. Each entry has a `threshold` (dollars) and a
`retailers` map of search URLs. Add a new category the same way.

## If scraping stops finding anything

Home Depot and Lowe's both run bot-detection (Cloudflare/Akamai/PerimeterX)
that can change behavior at any time, and their page markup changes
periodically. If `data/deals.json` keeps showing entries in `errors`, or the
headless-browser fallback returns zero products:

1. Check the failing run's logs in the Actions tab for the actual error.
2. If it's a selector problem (browser fallback ran but found 0 product
   cards), open the retailer's search page in a real browser, inspect a
   product tile with devtools, and add the new CSS selector to the matching
   array in `config/selectors.json` — no code changes needed.
3. If requests are being blocked outright (e.g. persistent CAPTCHA/403 from
   both the HTTP and browser paths), that retailer may need a longer cooldown
   between requests, or scraping may not be viable for a period — the
   workflow will simply log the error and keep working for whichever
   retailer/category still succeeds.

This scraper is intentionally low-frequency (once/day) and only fetches
public search-result pages for personal price tracking — please don't lower
the interval to something aggressive.

## Local development

```
npm install
npm run scrape       # writes data/deals.json, data/new-deals.json
npm run send-push    # sends a push for anything in data/new-deals.json (needs env vars set)
```
