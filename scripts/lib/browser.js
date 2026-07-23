import { chromium } from "playwright";
import { USER_AGENT } from "./http.js";

let browserPromise = null;

function getBrowser() {
  if (!browserPromise) {
    browserPromise = chromium.launch({ headless: true });
  }
  return browserPromise;
}

export async function closeBrowser() {
  if (browserPromise) {
    try {
      const browser = await browserPromise;
      await browser.close();
    } catch {
      // Launch itself failed earlier; nothing to close.
    }
    browserPromise = null;
  }
}

async function firstMatchingSelector(page, selectors) {
  for (const selector of selectors) {
    const count = await page.locator(selector).count();
    if (count > 0) return selector;
  }
  return null;
}

/**
 * Renders a page with headless Chromium and pulls product cards out of the
 * DOM using the candidate selectors from config/selectors.json. Used only
 * when the plain HTTP fetch + JSON-LD parse comes back empty (e.g. the page
 * needed client-side rendering or blocked the simple request).
 */
export async function renderAndExtract(url, selectorSet, { timeoutMs = 30000 } = {}) {
  const browser = await getBrowser();
  const context = await browser.newContext({ userAgent: USER_AGENT });
  const page = await context.newPage();
  const results = [];

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });

    const cardSelector = await firstMatchingSelector(page, selectorSet.productCard);
    if (!cardSelector) {
      console.warn(`[browser] no product cards matched any known selector for ${url}`);
      return results;
    }

    const cards = await page.locator(cardSelector).all();
    for (const card of cards) {
      const title = await firstText(card, selectorSet.title);
      const priceText = await firstText(card, selectorSet.price);
      const link = await firstHref(card, selectorSet.link, url);
      const price = priceText ? Number(priceText.replace(/[^0-9.]/g, "")) : null;
      if (title && Number.isFinite(price)) {
        results.push({ title: title.trim(), price, url: link });
      }
    }
  } catch (err) {
    console.warn(`[browser] ${url} -> ${err.message}`);
  } finally {
    await context.close();
  }

  return results;
}

async function firstText(card, selectors) {
  for (const selector of selectors) {
    const el = card.locator(selector).first();
    if (await el.count()) {
      const text = (await el.textContent())?.trim();
      if (text) return text;
    }
  }
  return null;
}

async function firstHref(card, selectors, baseUrl) {
  for (const selector of selectors) {
    const el = card.locator(selector).first();
    if (await el.count()) {
      const href = await el.getAttribute("href");
      if (href) return new URL(href, baseUrl).toString();
    }
  }
  return null;
}
