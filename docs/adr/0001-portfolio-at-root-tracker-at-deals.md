# ADR 0001: Serve the portfolio at `/`, move the deal tracker to `/deals/`

- **Status:** Accepted
- **Date:** 2026-11-05
- **Deciders:** Alex Rivas

## Context

`alexmrivasjr.github.io` is a GitHub Pages *user site*: whatever sits at the
root of `main` is what anyone sees at `https://alexmrivasjr.github.io/`. Until
now that was the Soil & Compost Deal Tracker, a small PWA that receives Web
Push notifications from a scheduled GitHub Actions scraper.

I want the root URL to be my engineering portfolio. The tracker has to keep
working, and in particular **the existing push subscription must survive**:
re-subscribing means rotating the `PUSH_SUBSCRIPTION` secret by hand, and on
iOS it also means reinstalling the home-screen app.

A push subscription belongs to a service worker *registration*, and a
registration is keyed by **scope** (`/`) and **script URL** (`/sw.js`). If
`/sw.js` disappears, the browser's next update check gets a 404 and
**unregisters the worker**, which silently kills the subscription.

## Options considered

| Option | Outcome |
|---|---|
| A. Leave the tracker at `/`, put the portfolio at `/portfolio/` | Zero risk to push, but the first thing a reviewer sees is a soil-price list. Rejected. |
| B. Move the tracker into `/deals/` *including* its service worker (`/deals/sw.js`, scope `/deals/`) | Cleanest tree, but it creates a new registration, so the existing subscription dies and every device must re-subscribe. Rejected. |
| C. Separate repo for the portfolio | User sites can only be served from `<user>.github.io`. A project repo would live at `/<repo>/`, which is the same problem as option A. Rejected. |
| **D. Portfolio at `/`, tracker page at `/deals/`, service worker stays at `/sw.js` with scope `/`** | Same registration, same subscription, no secret rotation. **Chosen.** |

## Decision

- `index.html` (root) is the portfolio. It ships no JavaScript except a
  one-line redirect, described below.
- The tracker page moves to `deals/index.html`. It still registers
  `/sw.js`, so the browser reuses the existing registration.
- `sw.js` stays at the root. Its fallback notification URL changes from `/`
  to `/deals/`, and `scripts/send-push.js` gets the same change.
- `manifest.webmanifest` gets `"id": "/"` and `"start_url": "/deals/"`.
  Without an explicit `id`, a PWA's identity *defaults to its `start_url`*,
  so changing `start_url` alone would make Chrome treat the installed app as
  a different app. Pinning `id` to the old `start_url` keeps the identity
  stable.
- iOS home-screen apps keep the URL they were installed with (`/`). The
  portfolio page therefore redirects to `/deals/` **only** when it is
  running as an installed app (`display-mode: standalone`). Normal visitors
  never see the redirect.

## Consequences

- ✅ No secret rotation and no re-subscribe. Existing installs keep working.
- ✅ The root URL is now the portfolio.
- ⚠️ `/sw.js` and `/manifest.webmanifest` stay at the root even though they
  belong to the tracker. **Do not move or rename `/sw.js`.** This ADR is the
  reason.
- ⚠️ The root service worker's scope covers the portfolio too. It has no
  `fetch` handler, so it doesn't intercept portfolio requests. If one is
  ever added, it must ignore requests outside `/deals/` and `/data/`.

## How to verify

1. On a device that's already subscribed, open `/deals/`. In DevTools →
   Application → Service Workers there should be one registration
   (scope `/`, script `/sw.js`), not two.
2. Run the "Scrape soil & compost deals" workflow manually and confirm the
   push still arrives.
3. Open the installed iOS/Android app icon. It should land on `/deals/`.
