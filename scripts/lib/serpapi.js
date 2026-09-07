const SERPAPI_URL = "https://serpapi.com/search.json";

/**
 * Looks up a single Home Depot product by ID at a specific store via SerpApi's
 * home_depot_product engine. Unlike search-result scraping this returns the
 * exact price at your local store, including clearance markdowns that don't
 * show up in generic search results. Returns null (instead of throwing) on
 * any failure so callers can skip that product and keep checking the rest.
 */
export async function fetchHomeDepotProduct(productId, { storeId, zip, apiKey, timeoutMs = 90000 }) {
  const params = new URLSearchParams({
    engine: "home_depot_product",
    product_id: productId,
    store_id: storeId,
    delivery_zip: zip,
    api_key: apiKey,
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${SERPAPI_URL}?${params}`, { signal: controller.signal });
    if (!res.ok) {
      console.warn(`[serpapi] product ${productId} -> HTTP ${res.status}`);
      return null;
    }
    const data = await res.json();
    const product = data.product_results || {};
    if (typeof product.price !== "number") {
      console.warn(`[serpapi] product ${productId} -> no price in response`);
      return null;
    }
    return {
      title: product.title || `Home Depot product ${productId}`,
      price: product.price,
      url: product.link || `https://www.homedepot.com/p/${productId}`,
    };
  } catch (err) {
    console.warn(`[serpapi] product ${productId} -> ${err.message}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
