#!/usr/bin/env node
/**
 * Scrapes prize-tier tables for WA Lottery scratch games from
 * walottery.com's Explorer pages (client-rendered; requires a real browser).
 *
 * IMPORTANT: this could not be developed against the live site or verified
 * end-to-end in the environment this was written in -- that sandbox's
 * network egress policy blocks walottery.com entirely (confirmed via direct
 * curl: `CONNECT tunnel failed, response 403`), along with every third-party
 * scratch-off tracker site and even unrelated sites like en.wikipedia.org.
 * So the DOM structure below is inferred from how WA Lottery's ASP.NET
 * WebForms pages typically render (GridView tables, jQuery-UI tabs), not
 * confirmed against the actual rendered HTML. Run with --dump on a machine
 * that *can* reach walottery.com first; if the generic table-row heuristic
 * below doesn't find rows, the dumped HTML/screenshot will show what
 * selectors actually need adjusting.
 *
 * Usage:
 *   node scripts/lottery/scrape.js --id 1927 --id 1971 --id 1972 --id 1988
 *   node scripts/lottery/scrape.js --id 1972 --dump   # also saves raw HTML + screenshot for debugging
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

function parseArgs(argv) {
  const ids = [];
  let dump = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--id") ids.push(argv[++i]);
    else if (argv[i] === "--dump") dump = true;
  }
  return { ids, dump };
}

const MONEY_RE = /\$[\d,]+(?:\.\d{2})?/;
const INT_RE = /^-?[\d,]+$/;

/**
 * Heuristic row extraction: walk every <table> row on the rendered page and
 * keep rows that look like a prize-tier line -- first cell is a dollar
 * amount, and at least two more cells are plain integers (total printed /
 * claimed / remaining, in whatever order/column-count the page uses).
 */
async function extractTierRows(page) {
  return page.$$eval(
    "table",
    (tables, patterns) => {
      const moneyRe = new RegExp(patterns.money);
      const intRe = new RegExp(patterns.int);
      const rows = [];
      for (const table of tables) {
        for (const tr of table.querySelectorAll("tr")) {
          const cells = [...tr.querySelectorAll("td,th")].map((c) => c.textContent.trim());
          if (cells.length < 3) continue;
          if (!moneyRe.test(cells[0])) continue;
          const numericCells = cells.slice(1).filter((c) => intRe.test(c.replace(/,/g, "")));
          if (numericCells.length < 2) continue;
          rows.push(cells);
        }
      }
      return rows;
    },
    { money: MONEY_RE.source, int: INT_RE.source }
  );
}

function rowsToTiers(rows) {
  // Expect [prizeAmount, totalPrinted, claimed?, remaining] or
  // [prizeAmount, totalPrinted, remaining] -- take first numeric column as
  // totalPrinted and last as remaining, which matches every state-lottery
  // "prizes remaining" table layout seen in practice.
  return rows
    .map((cells) => {
      const value = Number(cells[0].replace(/[^0-9.]/g, ""));
      const nums = cells.slice(1).map((c) => Number(c.replace(/,/g, ""))).filter((n) => Number.isFinite(n));
      if (nums.length < 2) return null;
      return { value, totalPrinted: nums[0], remaining: nums[nums.length - 1] };
    })
    .filter(Boolean)
    .filter((t) => t.value > 0);
}

async function scrapeGame(browser, id, { dump }) {
  const context = await browser.newContext({ userAgent: USER_AGENT });
  const page = await context.newPage();
  const url = `https://walottery.com/Scratch/Explorer.aspx?id=${id}`;
  console.log(`[${id}] loading ${url}`);
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
    // Give any AJAX-populated grid a moment beyond networkidle.
    await page.waitForTimeout(2000);

    if (dump) {
      await mkdir(OUT_DIR, { recursive: true });
      await writeFile(path.join(OUT_DIR, `raw-${id}.html`), await page.content());
      await page.screenshot({ path: path.join(OUT_DIR, `raw-${id}.png`), fullPage: true });
      console.log(`[${id}] dumped raw HTML + screenshot to scripts/lottery/data/`);
    }

    const rows = await extractTierRows(page);
    const tiers = rowsToTiers(rows);
    if (!tiers.length) {
      console.warn(`[${id}] no tier rows matched the generic heuristic -- rerun with --dump and adjust extractTierRows()`);
    }

    const nameMatch = await page.title();
    return { id, name: nameMatch, url, tiers, scrapedAt: new Date().toISOString() };
  } catch (err) {
    console.error(`[${id}] failed: ${err.message}`);
    return { id, url, tiers: [], error: err.message, scrapedAt: new Date().toISOString() };
  } finally {
    await context.close();
  }
}

async function main() {
  const { ids, dump } = parseArgs(process.argv.slice(2));
  if (!ids.length) {
    console.error("Usage: node scripts/lottery/scrape.js --id 1927 [--id 1971 ...] [--dump]");
    process.exitCode = 1;
    return;
  }

  // Playwright normally manages its own browser download, but in some sandboxed
  // dev environments the pre-installed browser revision doesn't match the
  // installed playwright package's expected revision -- fall back to an
  // explicit path (env override, or this repo's dev-container convention)
  // only when that's the situation, so a normal `npx playwright install` setup
  // elsewhere is unaffected.
  const fallbackChromium = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
  const executablePath =
    process.env.PLAYWRIGHT_CHROMIUM_PATH || (existsSync(fallbackChromium) ? fallbackChromium : undefined);
  const browser = await chromium.launch({ headless: true, executablePath });
  const results = [];
  try {
    for (const id of ids) {
      results.push(await scrapeGame(browser, id, { dump }));
    }
  } finally {
    await browser.close();
  }

  await mkdir(OUT_DIR, { recursive: true });
  const outPath = path.join(OUT_DIR, "scraped-games.json");
  await writeFile(outPath, JSON.stringify(results, null, 2));
  console.log(`\nWrote ${outPath}`);
  for (const r of results) {
    console.log(`  #${r.id}: ${r.tiers.length} tier row(s)${r.error ? ` (error: ${r.error})` : ""}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
