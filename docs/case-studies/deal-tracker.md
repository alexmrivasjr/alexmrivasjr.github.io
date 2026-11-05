# Case study: Soil & Compost Deal Tracker

> Watch a short, fixed list of exact retail SKUs for price drops at my local
> stores and push a notification to my phone when one hits, with **zero
> hosting cost** and no server.

| | |
|---|---|
| **Stack** | Node 20 · GitHub Actions (cron) · SerpApi · JSON-LD parsing with a Playwright fallback · Web Push (VAPID) · installable PWA on GitHub Pages |
| **Status** | In production since Sep 2026, running 4×/week |
| **Live** | [alexmrivasjr.github.io/deals/](https://alexmrivasjr.github.io/deals/) |
| **Source** | [`scripts/`](../../scripts), [`deals/`](../../deals), [workflow](../../.github/workflows/scrape-deals.yml) |

## Problem

Garden soil goes on clearance at my local Home Depot and Lowe's, but
clearance prices are **store-specific** and often don't show up in search
results at all. Checking six product pages by hand several times a week
isn't sustainable.

## Constraints

- **$0 to run.** No server, no paid hosting, no third-party push service.
- **Be a good citizen.** Exact SKUs only, a low schedule frequency, and no
  broad category or keyword scraping. The README states this explicitly.
- **Both retailers run bot detection** (Akamai, PerimeterX, Cloudflare), so
  failures must degrade gracefully instead of breaking the run.

## Architecture

```mermaid
flowchart LR
  cron[GitHub Actions cron<br/>Mon/Tue/Thu/Fri] --> scrape[scripts/scrape.js]
  scrape -->|Home Depot, by product ID| serp[SerpApi<br/>store-local price]
  scrape -->|Lowe's, by product ID| http[HTTP + JSON-LD]
  http -. blocked/empty .-> pw[Headless Chromium]
  scrape --> deals[(data/deals.json)]
  scrape --> new[(new-deals.json)]
  new --> push[scripts/send-push.js<br/>Web Push / VAPID]
  push --> phone[📱 Installed PWA]
  deals --> site[/deals/ page]
```

- Home Depot prices come from SerpApi's product API, which returns the
  **store-local** price, including clearance markdowns.
- Lowe's prices are parsed from the product page's `schema.org` JSON-LD. If
  the plain request comes back empty or blocked, it falls back to a headless
  Chromium render.
- `data/notified.json` de-duplicates alerts, so the same markdown doesn't
  page me twice.
- Per-product failures go into an `errors` array in `deals.json` and the
  run continues. One blocked retailer doesn't take down the other.

## How it evolved (from the git history)

| Step | What changed and why |
|---|---|
| v0 (`home_depot_search` repo) | A single Python script: SerpApi polling plus **SMTP email** alerts. It worked, but email was too slow to act on and it only covered one retailer. |
| v1 | Rewrote it in Node as a PWA with Web Push: notifications arrive within seconds of a run, with no email setup and no extra service. |
| Removed category scraping | Generic category and keyword scraping produced noise and made more requests than the use case justified. Narrowed to exact-SKU tracking (`57d81c9`). |
| Measured before building | A "clearance sweep" idea was tested with **temporary, clearly labelled diagnostic scripts** that measured real API cost. The data didn't justify it, so the tooling was removed again (`5dda2a8` → `2a755da`). |
| Stopped double-billing | Disabled the v0 repo's schedule once v1 covered the same SKUs, to stop duplicate SerpApi usage. |
| Key hygiene | Rotated the VAPID keypair (`fb2e687`). The private key exists only as an Actions secret. |
| Security fix | Scraped titles were going into `innerHTML`. They're now rendered with `textContent`, and hrefs are restricted to `http(s)`. |
| Moved to `/deals/` | Made room for this portfolio **without breaking the live push subscription**. See [ADR 0001](../adr/0001-portfolio-at-root-tracker-at-deals.md). |

## What I'd do next

- **Unit tests** for the JSON-LD parser and the threshold and de-dup logic,
  using fixture HTML captured from real pages. This is the project's
  biggest gap today.
- **Move data commits off `main`.** The bot's `Update deals data` commits
  bury the human history. Writing data to a dedicated `data` branch, or
  publishing it as a Pages artifact, would keep `main` readable.
- Support more than one push subscription.
