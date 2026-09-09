import { fetchHtml } from "./lib/http.js";
import { extractProductsFromJsonLd } from "./lib/jsonld.js";
import { renderHtml } from "./lib/browser.js";
import { closeBrowser } from "./lib/browser.js";

// Home Depot's real "Outdoors > Garden Center > Clearance" category page --
// a /b/ browse URL, not a /s/ search-result URL. Every 403 we've hit so far
// (both our own scraping and SerpApi's) was against /s/ search pages; this
// tests whether a /b/ category page gets the same treatment, at zero
// SerpApi cost since it doesn't touch SerpApi at all.
const URL = "https://www.homedepot.com/b/Outdoors-Garden-Center/Clearance/N-5yc1vZbx6kZ1z11adf";

async function main() {
  console.log(`Plain fetch: ${URL}`);
  const html = await fetchHtml(URL);
  if (html) {
    const products = extractProductsFromJsonLd(html);
    console.log(`Plain fetch succeeded, ${products.length} JSON-LD products found`);
    if (products.length > 0) console.log(JSON.stringify(products.slice(0, 5), null, 2));
  } else {
    console.log("Plain fetch returned null (blocked or empty) -- trying headless browser...");
  }

  console.log(`\nHeadless browser render: ${URL}`);
  const renderedHtml = await renderHtml(URL);
  if (!renderedHtml) {
    console.log("Headless browser render returned null (navigation failed or timed out)");
  } else {
    console.log(`Rendered HTML length: ${renderedHtml.length}`);
    const products = extractProductsFromJsonLd(renderedHtml);
    console.log(`${products.length} JSON-LD products found in rendered HTML`);
    if (products.length > 0) {
      console.log("\nSample of first 5 items found:");
      for (const p of products.slice(0, 5)) {
        console.log(`  - ${p.title} | $${p.price} | ${p.url}`);
      }
    } else {
      // No JSON-LD -- dump a snippet so we can see what we actually got back
      console.log("\nFirst 500 chars of rendered HTML:");
      console.log(renderedHtml.slice(0, 500));
    }
  }

  await closeBrowser();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
