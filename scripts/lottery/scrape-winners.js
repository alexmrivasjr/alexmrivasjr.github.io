#!/usr/bin/env node
/**
 * Scrapes WA Lottery's "Winners By Game" feed (walottery.com/winners/Search.aspx)
 * and filters to a given city list + day window.
 *
 * Recon (recon-winners.js) showed the page renders a single big table with
 * columns DATE | GAME | JACKPOT | NAME | LOCATION, no date-range or city
 * filter in the UI (only game, name, zip code) -- the table itself already
 * comes pre-loaded with a feed of recent winners. GAME is only present in
 * the row where it changes (rowspan-style grouping), so this walks rows in
 * order and carries the last-seen game forward for rows missing that cell.
 *
 * Usage:
 *   node scripts/lottery/scrape-winners.js --days 30 --cities "Kennewick,Pasco,Richland,West Richland,Burbank,Finley"
 */
import { chromium } from "playwright";
import { writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "data");
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const URL = "https://walottery.com/winners/Search.aspx";

function parseArgs(argv) {
  let cities = [];
  let days = 30;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--city") cities.push(argv[++i].toUpperCase());
    else if (argv[i] === "--cities") cities = argv[++i].split(",").map((c) => c.trim().toUpperCase()).filter(Boolean);
    else if (argv[i] === "--days") days = Number(argv[++i]);
  }
  return { cities, days };
}

/** Pulls every row of the winners table as [date, game|null, jackpotText, name, locationCellText]. */
async function extractRawRows(page) {
  return page.$$eval("table tr", (trs) => {
    const rows = [];
    for (const tr of trs) {
      const cells = [...tr.querySelectorAll("td")];
      if (cells.length !== 4 && cells.length !== 5) continue;
      const text = (el) => el.innerText.trim();
      if (cells.length === 5) {
        rows.push({ date: text(cells[0]), game: text(cells[1]), jackpot: text(cells[2]), name: text(cells[3]), location: text(cells[4]) });
      } else {
        rows.push({ date: text(cells[0]), game: null, jackpot: text(cells[1]), name: text(cells[2]), location: text(cells[3]) });
      }
    }
    return rows;
  });
}

function normalizeRows(rawRows) {
  let currentGame = null;
  const out = [];
  for (const r of rawRows) {
    if (!/^\$/.test(r.jackpot) && !/^\d/.test(r.jackpot.replace(/[$,]/g, ""))) continue; // skip header/junk rows
    if (r.game) currentGame = r.game;
    const jackpot = Number(r.jackpot.replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(jackpot)) continue;
    const date = new Date(r.date);
    if (isNaN(date.getTime())) continue;
    const locLines = r.location.split("\n").map((l) => l.trim()).filter(Boolean);
    const storeName = locLines[0] || "";
    const addressLine = locLines[1] || "";
    const parts = addressLine.split(",").map((p) => p.trim());
    const city = parts.length >= 2 ? parts[parts.length - 2] : "";
    const state = parts.length >= 1 ? parts[parts.length - 1] : "";
    out.push({
      date: date.toISOString().slice(0, 10),
      game: currentGame,
      prize: jackpot,
      name: r.name,
      storeName,
      address: addressLine,
      city,
      state,
    });
  }
  return out;
}

async function main() {
  const { cities, days } = parseArgs(process.argv.slice(2));

  const fallbackChromium = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
  const executablePath =
    process.env.PLAYWRIGHT_CHROMIUM_PATH || (existsSync(fallbackChromium) ? fallbackChromium : undefined);
  const browser = await chromium.launch({ headless: true, executablePath });
  const context = await browser.newContext({ userAgent: USER_AGENT });
  const page = await context.newPage();

  try {
    console.log(`loading ${URL}`);
    await page.goto(URL, { waitUntil: "networkidle", timeout: 45000 });
    await page.waitForTimeout(2000);

    // In case the grid lazy-loads more rows on scroll, scroll to the bottom
    // repeatedly until the row count stops growing (capped so a runaway
    // infinite-scroll page can't hang the job forever).
    let rows = await extractRawRows(page);
    for (let i = 0; i < 40; i++) {
      const before = rows.length;
      await page.mouse.wheel(0, 20000);
      await page.waitForTimeout(1000);
      rows = await extractRawRows(page);
      if (rows.length <= before) break;
    }
    console.log(`extracted ${rows.length} raw table rows`);

    const winners = normalizeRows(rows);
    console.log(`normalized to ${winners.length} winner records`);

    const dates = winners.map((w) => w.date).sort();
    console.log(`date range covered: ${dates[0]} .. ${dates[dates.length - 1]}`);

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    const cityFiltered = winners.filter((w) => cities.length === 0 || cities.includes(w.city.toUpperCase()));
    const filtered = cityFiltered.filter((w) => w.date >= cutoffStr);

    await mkdir(OUT_DIR, { recursive: true });
    const outPath = path.join(OUT_DIR, "winners-all.json");
    await writeFile(outPath, JSON.stringify(winners, null, 2));
    const filteredPath = path.join(OUT_DIR, "winners-filtered.json");
    await writeFile(
      filteredPath,
      JSON.stringify({ generatedAt: new Date().toISOString(), days, cutoffDate: cutoffStr, cities, results: filtered }, null, 2)
    );

    console.log(`\nWrote ${outPath} (${winners.length} total records)`);
    console.log(`Wrote ${filteredPath} (${filtered.length} matching records, cities=${cities.join("/")}, since ${cutoffStr})`);

    const totalPrize = filtered.reduce((s, w) => s + w.prize, 0);
    console.log(`\n${filtered.length} winner(s) in [${cities.join(", ")}] since ${cutoffStr}, total value $${totalPrize.toLocaleString()}`);
    for (const w of filtered) {
      console.log(`  ${w.date}  $${w.prize.toLocaleString()}  ${w.game}  ${w.name}  ${w.storeName} (${w.city}, ${w.state})`);
    }
  } finally {
    await context.close();
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
