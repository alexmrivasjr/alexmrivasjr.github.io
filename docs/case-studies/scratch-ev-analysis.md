# Case study: Scratch-Ticket Expected-Value Analysis

> Scrape a lottery's published prize tables and compute expected value and
> the **exact** probability of profit when buying N tickets, using the
> correct statistical model.

| | |
|---|---|
| **Stack** | Node · Playwright · BigInt exact arithmetic · GitHub Actions (`workflow_dispatch` with typed inputs) |
| **Status** | Research tool on branch [`claude/wa-lottery-loteria-ev-azd1rn`](https://github.com/alexmrivasjr/alexmrivasjr.github.io/tree/claude/wa-lottery-loteria-ev-azd1rn/scripts/lottery) |

## The interesting part: picking the right model

A game's remaining tickets are a **finite population**, and buying N tickets
is drawing N of them **without replacement**. Treating each ticket as an
independent draw (the binomial shortcut) overstates variance, and it gets
less accurate as N becomes a meaningful share of a thin remaining pool.

The calculator builds the exact joint distribution of (tickets drawn, total
winnings) with a dynamic program over prize tiers. It uses **exact BigInt
binomial coefficients** to avoid floating-point loss and normalizes by
C(population, N) at the end. There's no simulation and no approximation in
the combinatorics.

## Result

| Game | Price | EV / ticket | Return |
|---|---|---|---|
| #1927 | $10 | $7.74 | 77.4% |
| #1971 | $10 | $7.22 | 72.2% |
| #1988 | $5 | $3.21 | 64.3% |
| #1972 | $2 | $1.24 | 62.0% |

For the best game, P(profit) climbs from 13.0% at one ticket to 17.3% at
ten. It never gets near 50%, which is consistent with a game designed to
return less than 100%.

## Engineering notes

- **Scraped data was cross-checked against independent figures.** Printed
  totals and overall odds matched published numbers before I trusted the
  results.
- **Assumptions are labelled.** "Remaining tickets" is an odds-ratio
  estimate, not a published number, and the README says so next to every
  result.
- **Recon before scraping.** A `winners-recon` mode dumps the page structure
  first, so the parser is written against observed markup, not guesses.
- The scraper runs in GitHub Actions on manual dispatch with typed inputs,
  because the dev sandbox had no network access to the site.
