import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { scrapeCategoryUrl } from "./lib/retailer.js";
import { closeBrowser } from "./lib/browser.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const PRODUCTS_CONFIG = path.join(ROOT, "config", "products.json");
const SELECTORS_CONFIG = path.join(ROOT, "config", "selectors.json");
const DEALS_FILE = path.join(ROOT, "data", "deals.json");
const NOTIFIED_FILE = path.join(ROOT, "data", "notified.json");
const NEW_DEALS_FILE = path.join(ROOT, "data", "new-deals.json");

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function dealKey(deal) {
  return `${deal.category}|${deal.retailer}|${deal.url || deal.title}`;
}

async function main() {
  const products = await readJson(PRODUCTS_CONFIG, {});
  const selectors = await readJson(SELECTORS_CONFIG, {});
  const previouslyNotified = await readJson(NOTIFIED_FILE, {});

  const currentDeals = [];
  const errors = [];

  for (const [categoryKey, category] of Object.entries(products)) {
    for (const [retailerKey, url] of Object.entries(category.retailers)) {
      console.log(`Scraping ${retailerKey} for "${category.label}"...`);
      let result;
      try {
        result = await scrapeCategoryUrl(url, { retailerKey, selectors });
      } catch (err) {
        errors.push({ category: categoryKey, retailer: retailerKey, error: err.message });
        continue;
      }

      const matches = result.products.filter((p) => p.price <= category.threshold);
      console.log(
        `  ${result.products.length} products parsed (${result.method}), ${matches.length} at/under $${category.threshold}`
      );

      for (const match of matches) {
        currentDeals.push({
          category: categoryKey,
          categoryLabel: category.label,
          retailer: retailerKey,
          title: match.title,
          price: match.price,
          threshold: category.threshold,
          url: match.url,
          foundAt: new Date().toISOString(),
        });
      }
    }
  }

  await closeBrowser();

  // Figure out which of today's deals are genuinely new, so we don't push a
  // notification every single day for a deal that's still active.
  const nowKeys = new Set(currentDeals.map(dealKey));
  const newDeals = currentDeals.filter((deal) => !previouslyNotified[dealKey(deal)]);

  const updatedNotified = {};
  for (const deal of currentDeals) {
    updatedNotified[dealKey(deal)] = previouslyNotified[dealKey(deal)] || deal.foundAt;
  }
  // Drop stale entries for deals that are no longer active so the file
  // doesn't grow forever and a deal can re-alert if it comes back later.
  for (const key of Object.keys(updatedNotified)) {
    if (!nowKeys.has(key)) delete updatedNotified[key];
  }

  await mkdir(path.dirname(DEALS_FILE), { recursive: true });
  await writeFile(
    DEALS_FILE,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        deals: currentDeals,
        errors,
      },
      null,
      2
    )
  );
  await writeFile(NOTIFIED_FILE, JSON.stringify(updatedNotified, null, 2));
  await writeFile(NEW_DEALS_FILE, JSON.stringify(newDeals, null, 2));

  console.log(`\nDone. ${currentDeals.length} active deal(s), ${newDeals.length} new since last run.`);
  if (errors.length) {
    console.log(`${errors.length} scrape error(s):`, errors);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
