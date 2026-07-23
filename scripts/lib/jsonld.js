import * as cheerio from "cheerio";

function toNumberPrice(value) {
  if (value == null) return null;
  const num = Number(String(value).replace(/[^0-9.]/g, ""));
  return Number.isFinite(num) ? num : null;
}

function extractFromNode(node, results) {
  if (!node || typeof node !== "object") return;

  if (Array.isArray(node)) {
    for (const item of node) extractFromNode(item, results);
    return;
  }

  if (Array.isArray(node["@graph"])) {
    extractFromNode(node["@graph"], results);
  }

  const type = node["@type"];
  const isProduct =
    type === "Product" || (Array.isArray(type) && type.includes("Product"));

  if (isProduct) {
    const name = node.name;
    const offers = Array.isArray(node.offers) ? node.offers[0] : node.offers;
    const price = offers?.price ?? offers?.priceSpecification?.price;
    const url = node.url || offers?.url;
    const numericPrice = toNumberPrice(price);
    if (name && numericPrice != null) {
      results.push({ title: String(name).trim(), price: numericPrice, url: url || null });
    }
  }

  if (Array.isArray(node.itemListElement)) {
    for (const entry of node.itemListElement) {
      extractFromNode(entry.item ?? entry, results);
    }
  }
}

/**
 * Parses <script type="application/ld+json"> blocks out of raw HTML and
 * returns any schema.org Product entries found (name + numeric price + url).
 * This is far more stable across redesigns than CSS-class scraping, since
 * retailers keep this markup for SEO/rich-snippet purposes.
 */
export function extractProductsFromJsonLd(html) {
  const $ = cheerio.load(html);
  const results = [];

  $("script[type='application/ld+json']").each((_, el) => {
    const raw = $(el).contents().text();
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      extractFromNode(parsed, results);
    } catch {
      // Malformed or partial JSON-LD block; skip it.
    }
  });

  return results;
}
