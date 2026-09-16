import { readFile } from "node:fs/promises";
import webpush from "web-push";

const NEW_LEADS_FILE = process.env.NEW_LEADS_JSON || "distressed-property-leads/data/new-leads.json";
const REPORT_URL = process.env.LEADS_REPORT_URL || "/";

async function main() {
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, PUSH_SUBSCRIPTION } = process.env;

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !PUSH_SUBSCRIPTION) {
    console.log("Push notification secrets not configured yet (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / PUSH_SUBSCRIPTION). Skipping push.");
    return;
  }

  const newLeads = JSON.parse(await readFile(NEW_LEADS_FILE, "utf8"));
  if (newLeads.length === 0) {
    console.log("No new high-signal leads since last run, skipping push.");
    return;
  }

  webpush.setVapidDetails(VAPID_SUBJECT || "mailto:example@example.com", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

  const subscription = JSON.parse(PUSH_SUBSCRIPTION);

  const { county, state } = newLeads[0];
  const title =
    newLeads.length === 1
      ? `New distressed-property lead: ${county}, ${state}`
      : `${newLeads.length} new distressed-property leads: ${county}, ${state}`;
  const body = newLeads
    .slice(0, 5)
    .map((lead) => `${lead.address} (${lead.matched_sources.join(" + ")})`)
    .join("\n");

  const payload = JSON.stringify({ title, body, url: REPORT_URL });

  try {
    await webpush.sendNotification(subscription, payload);
    console.log(`Push sent for ${newLeads.length} new high-signal lead(s).`);
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
