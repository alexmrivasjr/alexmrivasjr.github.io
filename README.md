# alexmrivasjr.github.io

[![CI](https://github.com/alexmrivasjr/alexmrivasjr.github.io/actions/workflows/ci.yml/badge.svg)](https://github.com/alexmrivasjr/alexmrivasjr.github.io/actions/workflows/ci.yml)

My engineering portfolio, plus a live production tool it showcases. The
site and the tool are served from GitHub Pages and run on GitHub Actions,
at **$0** hosting cost.

| URL | What it is |
|---|---|
| [`/`](https://alexmrivasjr.github.io/) | Portfolio: selected work, how I build, toolbox |
| [`/deals/`](https://alexmrivasjr.github.io/deals/) | Soil & Compost Deal Tracker: an exact-SKU price watcher with Web Push alerts |

## If you're reviewing my work, start here

1. **[Case studies](docs/case-studies/)**: one per project, each covering
   problem, constraints, architecture, decisions, verification, and next
   steps.
2. **[Engineering standards](docs/ENGINEERING.md)**: the standards I work
   to, with links to where each is practiced, plus an honest list of known
   gaps.
3. **[ADR 0001](docs/adr/0001-portfolio-at-root-tracker-at-deals.md)**: a
   worked example of a decision record. It explains how this site was
   restructured without breaking live push subscriptions.
4. **The git log**:
   `git log --no-merges --invert-grep --grep="Update deals data"` shows the
   human commits without the bot noise. Commits follow Conventional
   Commits, and their bodies explain *why*.

## Repository layout

```
index.html, assets/css/portfolio.css   Portfolio (static, no build step)
deals/index.html, assets/js/app.js     Deal tracker UI
sw.js, manifest.webmanifest            Tracker PWA (must stay at root, see ADR 0001)
scripts/scrape.js, scripts/lib/        Scraper: SerpApi + JSON-LD + Playwright fallback
scripts/send-push.js                   Web Push (VAPID) sender
scripts/dev/check-site.js              CI checks: links, JSON, JS syntax
config/                                Tracked SKUs and price thresholds
data/                                  Scraper output (committed by the scheduled bot)
docs/                                  ADRs, case studies, standards, runbook
.github/workflows/                     ci.yml · scrape-deals.yml · scrape-lottery.yml
```

## Local development

```bash
npm install                 # only needed for the scraper (Playwright, web-push)
npm run check               # the same checks CI runs
python3 -m http.server 8000 # preview at http://localhost:8000
npm run scrape              # run the scraper locally (SERPAPI_KEY optional)
```

Running the deal tracker (secrets, push setup, troubleshooting) is
documented in the **[runbook](docs/deal-tracker-runbook.md)**.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Branch, then PR, with CI green
before merge.
