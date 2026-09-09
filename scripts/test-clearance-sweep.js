const SERPAPI_KEY = process.env.SERPAPI_KEY;
const STORE_ID = process.env.HD_STORE_ID || "4739";
const ZIP = process.env.HD_ZIP || "99336";
const CLEARANCE_CATEGORY = "N-5yc1vZ1z11adf"; // Home Depot's own internal Clearance category node ID

if (!SERPAPI_KEY) {
  console.error("SERPAPI_KEY not set");
  process.exit(1);
}

async function main() {
  const params = new URLSearchParams({
    engine: "home_depot",
    q: CLEARANCE_CATEGORY,
    store_id: STORE_ID,
    delivery_zip: ZIP,
    api_key: SERPAPI_KEY,
  });

  const url = `https://serpapi.com/search.json?${params}`;
  console.log(`Making ONE test call: q=${CLEARANCE_CATEGORY} (Clearance category), store=${STORE_ID}, zip=${ZIP}, no price cap`);

  const res = await fetch(url);
  console.log(`HTTP status: ${res.status}`);
  const data = await res.json();

  if (data.error) {
    console.error(`SerpApi error: ${data.error}`);
    process.exit(1);
  }

  const products = data.products || [];
  console.log(`\nItems returned on this page: ${products.length}`);

  console.log("\nFull search_information block:");
  console.log(JSON.stringify(data.search_information || {}, null, 2));

  console.log("\nFull pagination/serpapi_pagination block (if present):");
  console.log(JSON.stringify(data.pagination || data.serpapi_pagination || {}, null, 2));

  console.log("\nTop-level response keys (for debugging field names):");
  console.log(Object.keys(data));

  if (products.length > 0) {
    console.log("\nFull first item (to find original/list price field name):");
    console.log(JSON.stringify(products[0], null, 2));

    console.log("\nSample of first 5 items found:");
    for (const p of products.slice(0, 5)) {
      console.log(`  - ${p.title} | $${p.price} | ${p.link}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
