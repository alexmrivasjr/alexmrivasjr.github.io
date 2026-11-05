// Public VAPID key -- safe to expose client-side. Generated with
// `npm run generate-vapid-keys`; the matching private key lives only in the
// VAPID_PRIVATE_KEY GitHub Actions secret.
const VAPID_PUBLIC_KEY = "BIdsfO9iFRqfd-CrN6fvttnIJ3Xg8p9WCoK-z35Yys_9wx5g0CURCg_NcdSSCreK_qe6I1ibP2EpDhi7FUQcjeI";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

const statusEl = document.getElementById("push-status");
const subscribeBtn = document.getElementById("subscribe-btn");
const subscriptionBox = document.getElementById("subscription-box");
const subscriptionText = document.getElementById("subscription-text");
const copyBtn = document.getElementById("copy-btn");

function setStatus(message) {
  if (statusEl) statusEl.textContent = message;
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    setStatus("This browser doesn't support service workers, so push notifications aren't available. The deals list below still works.");
    return null;
  }
  return navigator.serviceWorker.register("/sw.js");
}

async function subscribeToPush() {
  if (!("PushManager" in window)) {
    setStatus("This browser doesn't support push notifications.");
    return;
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    setStatus("Notification permission was not granted.");
    return;
  }

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const json = JSON.stringify(subscription.toJSON(), null, 2);
  if (subscriptionText) subscriptionText.value = json;
  if (subscriptionBox) subscriptionBox.hidden = false;
  setStatus("Subscribed! Copy the text below into the PUSH_SUBSCRIPTION GitHub secret (one-time setup) so the daily scraper can notify this device.");
}

if (subscribeBtn) {
  subscribeBtn.addEventListener("click", () => {
    subscribeToPush().catch((err) => setStatus(`Failed to subscribe: ${err.message}`));
  });
}

if (copyBtn) {
  copyBtn.addEventListener("click", async () => {
    if (!subscriptionText) return;
    await navigator.clipboard.writeText(subscriptionText.value);
    copyBtn.textContent = "Copied!";
    setTimeout(() => (copyBtn.textContent = "Copy"), 1500);
  });
}

registerServiceWorker();

// --- Deals list -------------------------------------------------------

const RETAILER_NAMES = { homedepot: "Home Depot", lowes: "Lowe's" };

function renderDeals(payload) {
  const list = document.getElementById("deals-list");
  const updatedEl = document.getElementById("last-updated");
  if (!list) return;

  if (updatedEl && payload.generatedAt) {
    updatedEl.textContent = `Last checked: ${new Date(payload.generatedAt).toLocaleString()}`;
  }

  list.innerHTML = "";
  if (!payload.deals || payload.deals.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.textContent = "No deals under your price thresholds right now. Check back tomorrow.";
    list.appendChild(empty);
    return;
  }

  for (const deal of payload.deals) {
    const item = document.createElement("li");
    item.className = "deal";
    const retailer = RETAILER_NAMES[deal.retailer] || deal.retailer;

    // Titles and URLs come from scraped third-party pages, so they are set
    // via textContent / a validated href rather than interpolated into HTML.
    const link = span("deal-title", deal.title, "a");
    link.href = safeHttpUrl(deal.url);
    link.target = "_blank";
    link.rel = "noopener";

    item.append(
      span("deal-retailer", retailer),
      link,
      span("deal-price", `$${deal.price.toFixed(2)}`),
      span("deal-threshold", `threshold: $${deal.threshold.toFixed(2)} (${deal.categoryLabel})`),
    );
    list.appendChild(item);
  }
}

function span(className, text, tag = "span") {
  const el = document.createElement(tag);
  el.className = className;
  el.textContent = text ?? "";
  return el;
}

function safeHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : "#";
  } catch {
    return "#";
  }
}

fetch("/data/deals.json", { cache: "no-store" })
  .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
  .then(renderDeals)
  .catch(() => {
    const list = document.getElementById("deals-list");
    if (list) list.innerHTML = "<li class=\"empty\">Deals haven't been scraped yet — the first scheduled run will populate this.</li>";
  });
