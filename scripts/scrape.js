import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { scrapeCategoryUrl, scrapeProductPage } from "./lib/retailer.js";
import { closeBrowser } from "./lib/browser.js";
import { fetchHomeDepotProduct } from "./lib/serpapi.js";
import { sleep } from "./lib/http.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const PRODUCTS_CONFIG = path.join(ROOT, "config", "products.json");
const SELECTORS_CONFIG = path.join(ROOT, "config", "selectors.json");
const SERPAPI_PRODUCTS_CONFIG = path.join(ROOT, "config", "serpapi-products.json");
const LOWES_PRODUCTS_CONFIG = path.join(ROOT, "config", "lowes-products.json");
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

  const serpapiConfig = await readJson(SERPAPI_PRODUCTS_CONFIG, null);
  const serpapiKey = process.env.SERPAPI_KEY;

  if (serpapiConfig?.products?.length) {
    if (!serpapiKey) {
      console.warn("[serpapi] SERPAPI_KEY not set, skipping exact-product checks");
    } else {
      for (const product of serpapiConfig.products) {
        await sleep(1000);
        console.log(`Checking Home Depot product ${product.productId} ("${product.label}") via SerpApi...`);
        const result = await fetchHomeDepotProduct(product.productId, {
          storeId: serpapiConfig.store.id,
          zip: serpapiConfig.store.zip,
          apiKey: serpapiKey,
        });
        if (!result) {
          errors.push({ category: product.category, retailer: "homedepot", error: "SerpApi lookup failed" });
          continue;
        }
        console.log(`  $${result.price} (threshold $${product.threshold})`);
        if (result.price <= product.threshold) {
          currentDeals.push({
            category: product.category,
            categoryLabel: product.label,
            retailer: "homedepot",
            title: result.title,
            price: result.price,
            threshold: product.threshold,
            url: result.url,
            foundAt: new Date().toISOString(),
          });
        }
      }
    }
  }

  const lowesConfig = await readJson(LOWES_PRODUCTS_CONFIG, null);

  if (lowesConfig?.products?.length) {
    for (const product of lowesConfig.products) {
      const url = `https://www.lowes.com/pd/${product.productId}`;
      console.log(`Checking Lowe's product ${product.productId} ("${product.label}")...`);
      const { product: result, method } = await scrapeProductPage(url);
      if (!result) {
        errors.push({ category: product.category, retailer: "lowes", error: "product page lookup failed" });
        continue;
      }
      console.log(`  $${result.price} (${method}, threshold $${product.threshold})`);
      if (result.price <= product.threshold) {
        currentDeals.push({
          category: product.category,
          categoryLabel: product.label,
          retailer: "lowes",
          title: result.title,
          price: result.price,
          threshold: product.threshold,
          url: result.url || url,
          foundAt: new Date().toISOString(),
        });
      }
    }
  }

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
