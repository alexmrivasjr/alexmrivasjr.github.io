import { fetchHtml, sleep } from "./http.js";
import { extractProductsFromJsonLd } from "./jsonld.js";
import { renderAndExtract } from "./browser.js";

/**
 * Scrapes a single retailer search-results URL.
 * Strategy: plain HTTP fetch + JSON-LD parse first (cheap, and stable across
 * redesigns). If that returns nothing -- either the request was blocked or
 * the page needs client-side rendering -- fall back to a headless-Chromium
 * render using the CSS selectors in config/selectors.json.
 */
export async function scrapeCategoryUrl(url, { retailerKey, selectors, politeDelayMs = 1500 }) {
  await sleep(politeDelayMs);

  const html = await fetchHtml(url);
  if (html) {
    const products = extractProductsFromJsonLd(html);
    if (products.length > 0) {
      return { products, method: "http+jsonld" };
    }
  }

  console.warn(`[${retailerKey}] no JSON-LD results, falling back to headless browser for ${url}`);
  const products = await renderAndExtract(url, selectors[retailerKey]);
  return { products, method: "browser" };
}
