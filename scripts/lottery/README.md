# WA Lottery scratch-off EV & profit-probability tool

Research tool for comparing Washington State Lottery scratch-off games by
expected value and computing the exact probability of coming out ahead when
buying N tickets. Built for the "Loteria" family of games (#1927, #1971,
#1972, #1988) but works for any game given its prize-tier table.

## Results (real data, scraped 2026-09-14)

The scraper turned out to work on the first real run (via a manually-triggered
GitHub Actions job — see below), pulling actual tier tables for all four
games from `Explorer.aspx?id=####`. Cross-checks against independently-known
figures line up: #1927's and #1971's "total printed" on the $10 tier came
back as exactly 300,371 and 304,573, and #1972/#1988's published overall odds
(1 in 3.63 / 1 in 3.32) matched what turned up in search-engine snippets
earlier. Raw tiers: `data/scraped-games.json`; combined with ticket
price + overall odds: `data/games.json`. Run
`node scripts/lottery/analyze.js scripts/lottery/data/games.json` to
reproduce:

| Game | Price | EV/ticket | EV % |
|---|---|---|---|
| #1927 $250,000 Loteria 7th Edition | $10 | $7.74 | 77.4% |
| #1971 $250,000 Loteria 8th Edition | $10 | $7.22 | 72.2% |
| #1988 Loteria Grande 13th Edition | $5 | $3.21 | 64.3% |
| #1972 Loteria 29th Edition | $2 | $1.24 | 62.0% |

**#1927 has the best EV.** Exact hypergeometric profit probability for
buying N tickets of #1927:

| N | Spend | P(profit) | P(break-even) | P(loss) |
|---|---|---|---|---|
| 1 | $10 | 13.0% | 14.7% | 72.3% |
| 2 | $20 | 13.3% | 13.2% | 73.5% |
| 3 | $30 | 14.3% | 5.2% | 80.5% |
| 5 | $50 | 15.5% | 4.4% | 80.1% |
| 10 | $100 | 17.3% | 2.2% | 80.5% |

P(profit) rises slowly with N (more tickets = more chances to catch one of
the larger remaining prizes) but stays well under 50% at every N tested —
consistent with this being a below-100%-return game by design. `remaining
tickets` is still the odds-ratio *estimate* described below, not a number WA
Lottery publishes directly, so treat the EV and these probabilities as
best-available estimates rather than exact figures.

## Important limitation hit while building this

**This could not be run end-to-end or verified against live data in the
session that built it.** That sandbox's network egress policy blocks
`walottery.com` outright:

```
$ curl https://walottery.com/Scratch/TopPrizesRemaining.aspx
curl: (56) CONNECT tunnel failed, response 403
```

The same block applies to every third-party scratch-off tracker mentioned in
the original research request (scratchroi.com, scratchersparadise.com,
scratchcards.net, scratchcheck.com, lottoedge.com, scratchsmarter.com) *and*
to unrelated sites like en.wikipedia.org — so this is a blanket egress
restriction on that session's environment, not something specific to gambling
content. `scripts/lottery/scrape.js` was run against the real URL from that
sandbox and failed exactly as expected (`net::ERR_TUNNEL_CONNECTION_FAILED`),
which at least confirms the script's browser-launch/navigate/error-handling
plumbing works — what's unverified is the actual DOM-scraping logic, since
the real page HTML was never visible to write it against.

**To get real numbers, run the scraper somewhere with normal internet
access** (your own machine, or a GitHub Actions runner — this repo already
runs a similar Playwright scraper in CI for the soil-deal tracker, see
`.github/workflows/scrape-deals.yml`, and Actions runners have full outbound
internet access unlike this sandbox):

```
npm install
npx playwright install chromium   # if not already cached
node scripts/lottery/scrape.js --id 1927 --id 1971 --id 1972 --id 1988 --dump
```

`scrape.js` targets each game's `Explorer.aspx?id=####` page and pulls prize
tiers with a generic heuristic (any table row starting with a `$amount`
followed by two integer columns). Since this was written blind (no access to
the real rendered DOM), **run with `--dump` first** — it writes
`scripts/lottery/data/debug-<id>.txt` with the page title, `<table>`/`<tr>`
counts, how many rows the heuristic matched, and the first 6000 characters of
the rendered page's visible text, so you can see the actual table structure
and fix `extractTierRows()` in `scrape.js` if the heuristic doesn't match it
(e.g. if the site uses the price-tier tabs on `TopPrizesRemaining.aspx`
instead of/in addition to the per-game Explorer page).

Search-engine snippets (not full page fetches, so not usable as scrape input)
turned up scattered numbers for #1972 and #1988 that **directly illustrate
the discrepancy problem** the research task called out: one query returned
"-58.9% ROI" for #1988 and another, run minutes later, returned "-33.1% ROI"
for the same game. That's not a stale-crawl-date issue you can wave away —
it's the reason this tool computes EV from the *official* per-tier prize
table via `deriveRemainingTickets()`/`computeGameStats()` rather than trusting
any tracker's headline number.

## How the math works

### Expected value (`lib/ev.js`)

WA Lottery doesn't publish a live "tickets remaining" count, only remaining
prize counts per tier. The standard estimation (used here and by the
trackers) backs it into the published overall odds:

```
overallOddsDenominator = totalTicketsPrinted / totalWinningTicketsAtLaunch
remainingTickets ≈ remainingWinningTickets * overallOddsDenominator
```

This assumes winners are being claimed at roughly the same rate the ticket
pool is being sold through — true on average, not ticket-by-ticket, so
treat `remainingTickets` (and therefore EV) as an estimate, not an exact
figure. `deriveTotalTicketsPrinted()` uses the same method to back out the
total print run from the tier table's launch-time counts, as a
cross-check against any total-tickets-printed figure the lottery does
publish directly.

`evPerTicket = remainingPrizeValue / remainingTickets`. Games are ranked by
`evPercent = evPerTicket / ticketPrice`.

### Profit probability (`lib/hypergeometric.js`)

Buying N tickets is drawing N items **without replacement** from a finite,
fixed population (the remaining tickets) — a multivariate hypergeometric
process, not N independent per-ticket draws. Independence overstates the
variance of your outcome and gives the wrong profit probability, especially
once N is a non-trivial fraction of a thin remaining prize pool (e.g. a game
down to its last few top prizes).

`drawDistribution()` builds the *exact* joint distribution of (tickets
drawn, total prize value) via dynamic programming over prize tiers, using
exact integer (BigInt) binomial coefficients — no simulation, no floating
point precision loss, no independence shortcut. `profitStats()` then sums
that distribution's probability mass above/at/below your total spend
(`n * ticketPrice`) to get exact P(profit) / P(break-even) / P(loss), plus
`E[return]` as a sanity check (it always equals `n * evPerTicket` exactly,
since expectation is linear even under dependent sampling — a useful
built-in correctness check).

This was validated against hand-calculated probabilities for the n=1 case
(where P(profit) must equal `sum(remaining_i for tiers with value > ticketPrice) / remainingTickets`,
computable without any DP) — see below.

## Usage

```
node scripts/lottery/scrape.js --id 1927 --id 1971 --id 1972 --id 1988 --dump
node scripts/lottery/analyze.js scripts/lottery/data/scraped-games.json
```

Or hand-build a JSON file in the same shape (see
`scripts/lottery/data/games.example.json` — **synthetic numbers, not real WA
Lottery data**, included only to demonstrate/validate the tool) by
transcribing the official per-tier table from each game's tab on
https://walottery.com/Scratch/TopPrizesRemaining.aspx, plus that game's
published "Overall odds of winning: 1 in X" and ticket price:

```json
[
  {
    "id": "1972",
    "name": "Loteria 29th Edition",
    "ticketPrice": 2,
    "overallOddsDenominator": 3.63,
    "tiers": [
      { "value": 20000, "totalPrinted": 4, "remaining": 2 },
      { "value": 500, "totalPrinted": 200, "remaining": 80 }
    ]
  }
]
```

`analyze.js` prints every game ranked by EV, then exact profit probabilities
for buying 1/2/3/5/10 tickets of the best-EV game.

### Self-check

```
node scripts/lottery/analyze.js scripts/lottery/data/games.example.json
```

For the n=1 row, `P(net profit)` should equal
`sum(remaining_i for tiers with value > ticketPrice) / remainingTickets`
computed by hand from the same JSON file — confirming the DP-based
calculator agrees with the trivial closed-form case before trusting it on
n=2/3/5/10, where there's no simple closed form to check against.
