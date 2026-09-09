import { fetchHtml, sleep } from "./http.js";
import { extractProductsFromJsonLd } from "./jsonld.js";
import { renderHtml } from "./browser.js";

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
