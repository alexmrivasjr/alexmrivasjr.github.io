#!/usr/bin/env node
/**
 * Recon script: dumps the structure of walottery.com's winners search page(s)
 * so a real scraper can be written against actual selectors/filters instead
 * of guessing blind. This session's sandbox cannot reach walottery.com at
 * all (see scripts/lottery/README.md), so this has to run somewhere with
 * real internet access (e.g. via GitHub Actions workflow_dispatch).
 *
 * Usage:
 *   node scripts/lottery/recon-winners.js
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

const URLS = ["https://walottery.com/Winners/default.aspx", "https://walottery.com/winners/Search.aspx"];

async function recon(browser, url) {
  const context = await browser.newContext({ userAgent: USER_AGENT });
  const page = await context.newPage();
  console.log(`loading ${url}`);
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
    await page.waitForTimeout(2000);

    const diag = await page.evaluate(() => {
      const selects = [...document.querySelectorAll("select")].map((s) => ({
        id: s.id,
        name: s.name,
        options: [...s.options].slice(0, 40).map((o) => ({ value: o.value, text: o.textContent.trim() })),
      }));
      const inputs = [...document.querySelectorAll("input")].map((i) => ({
        id: i.id,
        name: i.name,
        type: i.type,
        placeholder: i.placeholder,
      }));
      const buttons = [...document.querySelectorAll("button, input[type=submit], input[type=button]")].map((b) => ({
        id: b.id,
        text: (b.textContent || b.value || "").trim(),
      }));
      return {
        title: document.title,
        tableCount: document.querySelectorAll("table").length,
        selects,
        inputs,
        buttons,
        bodyTextSnippet: document.body.innerText.slice(0, 4000),
      };
    });

    const slug = url.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    const text =
      `url: ${url}\n` +
      `title: ${diag.title}\n` +
      `table count: ${diag.tableCount}\n\n` +
      `--- selects ---\n${JSON.stringify(diag.selects, null, 2)}\n\n` +
      `--- inputs ---\n${JSON.stringify(diag.inputs, null, 2)}\n\n` +
      `--- buttons ---\n${JSON.stringify(diag.buttons, null, 2)}\n\n` +
      `--- body text snippet ---\n${diag.bodyTextSnippet}\n`;
    await mkdir(OUT_DIR, { recursive: true });
    await writeFile(path.join(OUT_DIR, `recon-${slug}.txt`), text);
    console.log(`wrote scripts/lottery/data/recon-${slug}.txt (tables=${diag.tableCount}, selects=${diag.selects.length}, inputs=${diag.inputs.length})`);
  } catch (err) {
    console.error(`${url} failed: ${err.message}`);
  } finally {
    await context.close();
  }
}

async function main() {
  const fallbackChromium = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
  const executablePath =
    process.env.PLAYWRIGHT_CHROMIUM_PATH || (existsSync(fallbackChromium) ? fallbackChromium : undefined);
  const browser = await chromium.launch({ headless: true, executablePath });
  try {
    for (const url of URLS) {
      await recon(browser, url);
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
