import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import webpush from "web-push";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const NEW_DEALS_FILE = path.join(ROOT, "data", "new-deals.json");

async function main() {
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, PUSH_SUBSCRIPTION } = process.env;

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !PUSH_SUBSCRIPTION) {
    console.log("Push notification secrets not configured yet (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / PUSH_SUBSCRIPTION). Skipping push, deals.json is still updated.");
    return;
  }

  const newDeals = JSON.parse(await readFile(NEW_DEALS_FILE, "utf8"));
  if (newDeals.length === 0) {
    console.log("No new deals since last run, skipping push.");
    return;
  }

  webpush.setVapidDetails(VAPID_SUBJECT || "mailto:example@example.com", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

  const subscription = JSON.parse(PUSH_SUBSCRIPTION);

  const title = newDeals.length === 1 ? "New soil/compost deal found!" : `${newDeals.length} new deals found!`;
  const body = newDeals
    .slice(0, 5)
    .map((d) => `${d.retailer === "homedepot" ? "Home Depot" : "Lowe's"}: ${d.title} — $${d.price.toFixed(2)}`)
    .join("\n");

  const payload = JSON.stringify({
    title,
    body,
    url: newDeals[0].url || "/",
  });

  try {
    await webpush.sendNotification(subscription, payload);
    console.log(`Push sent for ${newDeals.length} new deal(s).`);
  } catch (err) {
    console.error(`Failed to send push notification: ${err.message}`);
    if (err.statusCode === 404 || err.statusCode === 410) {
      console.error("The stored PUSH_SUBSCRIPTION has expired or is invalid — re-subscribe on the site and update the secret.");
    }
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
