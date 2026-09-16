# Distressed-property lead-sourcing pipeline

A local tool that pulls, normalizes, and cross-references public-record
leads on distressed / motivated-seller real estate for a county, so you can
review a short, high-signal list instead of browsing county websites by
hand. Ships with fully researched configs for **Benton County, WA** and
**Franklin County, WA** (the Tri-Cities area) and a template for adding
any other county.

**This produces leads, not verified deals.** Every row still needs a manual
title search before you spend money or make an offer -- see the caveats
printed by every run and repeated in `run_report.md`.

## The five source categories

| # | Source | Typical automation reality |
|---|--------|------------------------------|
| 1 | County Tax Office (delinquent tax / tax-sale / tax-title list) | Automatable **only** if the county publishes a direct CSV/XLSX/PDF file. Most publish a page describing the process instead -- manual by default. |
| 2 | County Clerk/Recorder (liens, deeds, judgments, notices of default/trustee sale) | Almost always a grantor/grantee/parcel **search form**, not a bulk export. Treated as a confirmatory step: it runs last and generates a "go check this address" task for every lead the other sources found. |
| 3 | Code Enforcement | Rarely has a public list at all; usually complaint-driven. Manual by default, with per-city notes since cities often run their own code enforcement separate from the county. |
| 4 | District Clerk / Court Records (probate, divorce, foreclosure suits) | Case-search portals are interactive and often gated behind a paid subscription (e.g. Washington's JIS-Link) for full/bulk access. Manual by default. |
| 5 | Foreclosure sales (auction stage) | Automatable in some judicial-foreclosure states that publish a sheriff-sale list. In non-judicial / deed-of-trust states (Washington included), there's no single county-run list -- it folds back into source #2's "Notice of Trustee Sale" document-type filter. |

The tool never guesses at scraping a search form or bypassing a robots.txt
disallow. If a source can't be automated cleanly and legitimately, it shows
up in `manual_followups.csv` with the exact portal URL and search
instructions instead of failing silently or faking data.

## Install

```
cd distressed-property-leads
pip install -r requirements.txt
```

## Run it

```
python -m leadgen.cli --county benton_wa --out ./out
```

This writes `out/benton_wa/`:

- **`leads.csv`** -- normalized leads (address, owner, source, amount,
  filing/delinquency date, link back to the record), high-signal leads
  first.
- **`manual_followups.csv`** -- every source/record that needs a human
  to look it up, with the portal URL and exact instructions.
- **`run_report.md`** -- summary counts plus the caveats below.

As shipped, Benton County has no confirmed, directly-downloadable bulk
list for any of its five sources (see `counties/benton_wa.yaml` for why,
source by source) -- so a run there produces 0 automated leads and 10
manual-follow-up items. That's accurate, not a bug: re-check the portals
periodically, since counties do occasionally start publishing a real
file.

Franklin County's `tax_delinquent` source is set to `automatable: true`,
pointed at what looks like a stable URL for the Treasurer's annual
"Judgment Foreclosing Tax Liens and Order of Sale" -- but that URL was
inferred from search-engine snippets, not confirmed by actually opening
the page (this dev environment's network access couldn't reach
franklincountywa.gov at all). **Run it once somewhere with normal
internet access and check `out/franklin_wa/leads.csv` /
`manual_followups.csv` before trusting it unattended** -- see the long
`reason` note in `counties/franklin_wa.yaml` for exactly what to verify.
If the URL is wrong or the PDF doesn't parse cleanly, the pipeline
degrades to a manual-follow-up with the specific error rather than
failing silently or fabricating rows -- it just won't have found anything
automatically that run.

## High-signal flagging

After all sources run, `leadgen/crossref.py` normalizes every address
(abbreviating street types, stripping unit numbers, standardizing
directionals) and flags any address that shows up under **more than one
source category** as `high_signal=yes` with a `matched_sources` list --
e.g. tax-delinquent *and* a code violation, or probate *and*
tax-delinquent. It also does a weaker, secondary pass on fuzzy-matched
owner names across categories at different addresses (e.g. an absentee
owner with one property tax-delinquent and a separate probate filing).

## Phone push notifications for new high-signal leads

This reuses the same Web Push setup already documented in the repo root
README (VAPID keys + a `PUSH_SUBSCRIPTION` secret from subscribing on
`https://alexmrivasjr.github.io/`) -- if you've already got that working
for the soil-deal tracker, no new setup is needed.

- `.github/workflows/scrape-leads.yml` runs weekly (Mondays), checking
  **every county in `counties/`** (currently `benton_wa` and
  `franklin_wa`) one after another. On-demand (Actions tab -> "Pull
  distressed-property leads" -> Run workflow) takes an optional `county`
  input to run just one; leave it blank to run all of them, same as the
  schedule.
- Each run writes `reports/<county>.html` -- a small, phone-friendly,
  self-contained HTML page (high-signal leads first, then other leads,
  then manual follow-ups, with the same caveats as always) and commits it
  back to the repo, where GitHub Pages serves it at
  `https://alexmrivasjr.github.io/distressed-property-leads/reports/<county>.html`.
- `data/notified/<county>.json` tracks which high-signal lead groups
  (address + matched sources) have already been notified about, so a
  **push notification only fires for genuinely new high-signal leads** --
  not every run, and not for single-source leads. Tapping the notification
  opens that county's HTML report.
- A lead that stops being high-signal (e.g. a source's data changed) is
  dropped from the notified-state file, so it can re-alert if it becomes
  high-signal again later -- same behavior as the soil tracker's
  `data/notified.json`.

To run this locally instead of waiting for the schedule:

```
python -m leadgen.cli --county benton_wa --out ./out \
  --html-report reports/benton_wa.html \
  --notified-state data/notified/benton_wa.json \
  --new-leads-json data/new-leads.json
npm run send-lead-push   # needs VAPID_*/PUSH_SUBSCRIPTION env vars set
```

As shipped, Benton County has no automatable bulk list yet (see below), so
`data/new-leads.json` will be `[]` and no push will fire until that
changes or you point it at a county that does have a real downloadable
list.

## Adding a new county

1. Copy `counties/_template.yaml` to `counties/<key>.yaml` (e.g.
   `king_wa.yaml`, `harris_tx.yaml`).
2. For each of the five source blocks, research the county's actual page:
   - Is there a **direct file URL** (not a search form)? If yes, check
     `<that domain>/robots.txt` yourself, and if it doesn't disallow the
     path, set `automatable: true`, `list_url`, and `list_format`
     (`csv`/`xlsx`/`pdf`). Add `column_aliases` if the file's headers don't
     match the defaults in `leadgen/sources/*.py`.
   - If it's a search form, a paid portal, or there's no public list at
     all, leave `automatable: false` and fill in `reason` and
     `manual_instructions` so the run report tells you exactly what to do
     by hand.
3. `python -m leadgen.cli --county <key> --out ./out` and check the output.

The pipeline itself (`leadgen/`) is county-agnostic -- you should not need
to touch any `.py` file to add a new county unless that county's list uses
a genuinely different file structure the generic CSV/XLSX/PDF parser can't
handle (see `leadgen/sources/list_fetch.py`).

## Design choices worth knowing about

- **robots.txt is checked at runtime, not just documented.**
  `leadgen/robots.py` fetches and parses the target domain's robots.txt
  before every automated request and **fails closed**: if robots.txt can't
  be fetched at all, the source treats the URL as disallowed rather than
  assuming permission, and falls back to a manual-follow-up entry.
- **No source fails silently.** Every source returns either `Lead`s,
  `ManualFollowUp`s, or both -- there's no code path that just returns
  nothing when something wasn't automatable.
- **Timestamps everywhere.** Every lead and every manual-follow-up item
  carries the UTC `pulled_at` time it was generated, and the run report
  repeats the 10-30 day data-lag caveat, because smaller counties'
  published data can be stale by that much.
- **PDF/CSV/XLSX parsing is generic and reusable**
  (`leadgen/sources/list_fetch.py`): point it at a URL and a `list_format`,
  give it `column_aliases` for whatever that county calls its columns, and
  it maps rows into the common `Lead` schema. If parsing fails or finds no
  rows, it reports a manual-follow-up with the reason instead of pretending
  the run succeeded.

## Testing

```
python -m pytest tests/ -q
```

Tests cover address/owner normalization, cross-source high-signal
flagging, the CSV/column-remapping logic, the robots.txt fail-closed
behavior, and the notified-state dedup logic -- all offline, no network
calls. `test_county_configs.py` also runs every `counties/*.yaml` file
through the full pipeline, so a typo'd key in a new county config fails
the test suite instead of shipping broken.

## Legal/ethical notes

- Every source here is a public record. Nothing in this tool logs into an
  account, pays for or bypasses a paid data source, or works around a
  CAPTCHA/rate limit.
- If a county's terms of service explicitly prohibit automated access even
  to a page that robots.txt allows, respect that -- robots.txt is a floor,
  not a substitute for reading the terms.
- Treat `leads.csv` as a starting point for manual research, never as a
  finished mailing list or an "actionable" list you can wholesale hand to
  a marketing tool.
