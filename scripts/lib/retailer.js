import { fetchHtml, sleep } from "./http.js";
import { extractProductsFromJsonLd } from "./jsonld.js";
import { renderAndExtract, renderHtml } from "./browser.js";

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

/**
 * Scrapes a single product detail page (not a search-results page) via its
 * schema.org JSON-LD, for exact-SKU tracking by product ID/URL. Falls back
 * to a headless render if the plain request comes back empty -- the product
 * page markup itself needs no per-retailer CSS selectors since JSON-LD is
 * generic across retailers that publish it.
 */
export async function scrapeProductPage(url, { politeDelayMs = 1500 } = {}) {
  await sleep(politeDelayMs);

  const html = await fetchHtml(url);
  if (html) {
    const [product] = extractProductsFromJsonLd(html);
    if (product) return { product, method: "http+jsonld" };
  }

  console.warn(`[product] no JSON-LD product found, falling back to headless browser for ${url}`);
  const renderedHtml = await renderHtml(url);
  if (!renderedHtml) return { product: null, method: "browser" };
  const [product] = extractProductsFromJsonLd(renderedHtml);
  return { product: product || null, method: "browser" };
}
