const SERPAPI_KEY = process.env.SERPAPI_KEY;
const STORE_ID = process.env.HD_STORE_ID || "4739";
const ZIP = process.env.HD_ZIP || "99336";
const UPPERBOUND = process.env.HD_UPPERBOUND || "5";

if (!SERPAPI_KEY) {
  console.error("SERPAPI_KEY not set");
  process.exit(1);
}

async function main() {
  const params = new URLSearchParams({
    engine: "home_depot",
    q: "clearance",
    store_id: STORE_ID,
    delivery_zip: ZIP,
    lowerbound: "0",
    upperbound: UPPERBOUND,
    api_key: SERPAPI_KEY,
  });

  const url = `https://serpapi.com/search.json?${params}`;
  console.log(`Making ONE test call: q=clearance, store=${STORE_ID}, zip=${ZIP}, price $0-$${UPPERBOUND}`);

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
    console.log("\nSample of first 3 items found:");
    for (const p of products.slice(0, 3)) {
      console.log(`  - ${p.title} | $${p.price} | ${p.link}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
