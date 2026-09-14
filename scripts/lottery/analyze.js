#!/usr/bin/env node
/**
 * Ranks WA Lottery scratch games by expected value and computes exact
 * profit probabilities (hypergeometric, not independence-approximated) for
 * buying 1/2/3/5/10 tickets of the best-EV game.
 *
 * Input: a JSON file shaped like scripts/lottery/data/games.example.json --
 * one entry per game with its full prize-tier table (value / totalPrinted /
 * remaining per tier), ticketPrice, and overallOddsDenominator (from the
 * game's published "overall odds of winning: 1 in X"). Get real per-game
 * data from scripts/lottery/scrape.js run somewhere with access to
 * walottery.com (see that file's header + the repo README for why this
 * session couldn't run it directly).
 *
 * Usage:
 *   node scripts/lottery/analyze.js scripts/lottery/data/games.example.json
 */
import { readFile } from "node:fs/promises";
import { computeGameStats } from "./lib/ev.js";
import { profitStats } from "./lib/hypergeometric.js";

const TICKET_COUNTS = [1, 2, 3, 5, 10];

function fmtMoney(n) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}
function fmtPct(n) {
  return `${(n * 100).toFixed(2)}%`;
}

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: node scripts/lottery/analyze.js <games.json>");
    process.exitCode = 1;
    return;
  }
  const games = JSON.parse(await readFile(file, "utf8"));
  const ranked = games.map(computeGameStats).sort((a, b) => b.evPercent - a.evPercent);

  console.log("=== Games ranked by expected value ===\n");
  for (const g of ranked) {
    console.log(
      `#${g.id} ${g.name} -- $${g.ticketPrice}/ticket\n` +
        `  remaining tickets (est.): ${g.remainingTickets.toLocaleString()}\n` +
        `  remaining prize value: ${fmtMoney(g.remainingPrizeValue)}\n` +
        `  EV per ticket: ${fmtMoney(g.evPerTicket)} (${fmtPct(g.evPercent)} of ticket price)\n`
    );
  }

  const best = ranked[0];
  console.log(`=== Best EV game: #${best.id} ${best.name} -- profit probability by ticket count ===\n`);
  console.log("(exact multivariate-hypergeometric draw from the estimated remaining ticket pool, no independence approximation)\n");
  for (const n of TICKET_COUNTS) {
    if (n > best.remainingTickets) {
      console.log(`  n=${n}: skipped (exceeds estimated remaining tickets)`);
      continue;
    }
    const stats = profitStats(best.tiers, best.remainingTickets, best.ticketPrice, n);
    console.log(
      `  n=${n} ($${(n * best.ticketPrice).toLocaleString()} spent): ` +
        `P(net profit)=${fmtPct(stats.profitProbability)}  ` +
        `P(break even)=${fmtPct(stats.breakEvenProbability)}  ` +
        `P(net loss)=${fmtPct(stats.lossProbability)}  ` +
        `E[return]=${fmtMoney(stats.expectedValue)}`
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
