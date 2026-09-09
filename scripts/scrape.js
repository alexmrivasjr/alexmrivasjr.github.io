import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { scrapeProductPage } from "./lib/retailer.js";
import { closeBrowser } from "./lib/browser.js";
import { fetchHomeDepotProduct } from "./lib/serpapi.js";
import { sleep, withTimeout } from "./lib/http.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

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
  const previouslyNotified = await readJson(NOTIFIED_FILE, {});

  const currentDeals = [];
  const errors = [];

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
      let result, method;
      try {
        ({ product: result, method } = await withTimeout(
          scrapeProductPage(url),
          60000,
          `Lowe's product ${product.productId} lookup`
        ));
      } catch (err) {
        errors.push({ category: product.category, retailer: "lowes", error: err.message });
        continue;
      }
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

  // scrapeProductPage's browser fallback may have launched Chromium --
  // without closing it, that browser process stays alive and Node never exits.
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
