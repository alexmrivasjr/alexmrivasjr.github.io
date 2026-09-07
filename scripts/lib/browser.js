import { chromium } from "playwright";
import { USER_AGENT, withTimeout } from "./http.js";

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

/**
 * Opens a context+page with a couple of defensive guards that have caused
 * real hangs against bot-walled retailer pages in the past: an unhandled JS
 * dialog (alert/confirm) blocks the renderer's main thread indefinitely, so
 * it never fires domcontentloaded even with a navigation timeout set -- we
 * auto-dismiss any dialog the page throws up.
 */
async function newHardenedPage(browser) {
  const context = await browser.newContext({ userAgent: USER_AGENT });
  const page = await context.newPage();
  page.on("dialog", (dialog) => dialog.dismiss().catch(() => {}));
  return { context, page };
}

/**
 * Closes a context with its own hard deadline. context.close() has no
 * built-in timeout, so if the browser process is wedged (e.g. after a
 * malformed page or a crashed renderer) this would otherwise hang the whole
 * script forever instead of just losing one page's data.
 */
async function closeContextSafely(context, timeoutMs = 10000) {
  try {
    await withTimeout(context.close(), timeoutMs, "context.close()");
  } catch (err) {
    console.warn(`[browser] ${err.message}`);
  }
}

/**
 * Renders a single page with headless Chromium and returns its final HTML,
 * for callers that just need to run their own extraction (e.g. JSON-LD) on
 * client-rendered content rather than pulling DOM nodes via CSS selectors.
 */
export async function renderHtml(url, { timeoutMs = 30000 } = {}) {
  const browser = await getBrowser();
  const { context, page } = await newHardenedPage(browser);
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    return await withTimeout(page.content(), 10000, "page.content()");
  } catch (err) {
    console.warn(`[browser] ${url} -> ${err.message}`);
    return null;
  } finally {
    await closeContextSafely(context);
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
  const { context, page } = await newHardenedPage(browser);
  const results = [];

  try {
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });

    const cardSelector = await firstMatchingSelector(page, selectorSet.productCard);
    if (!cardSelector) {
      const title = await page.title().catch(() => "");
      const bodyText = (await page.locator("body").innerText().catch(() => "")).slice(0, 300).replace(/\s+/g, " ");
      console.warn(
        `[browser] no product cards matched any known selector for ${url} | HTTP ${response?.status()} | title="${title}" | body snippet: "${bodyText}"`
      );
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
    await closeContextSafely(context);
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
