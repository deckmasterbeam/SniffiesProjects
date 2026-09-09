import type { BrowserContext } from "@playwright/test";

// chrome.storage.local is only reachable from an extension-privileged
// context — the background service worker, popup, options, or settings
// pages — never from a regular page like the fixture. The service worker is
// the only one of those guaranteed to exist without opening a page for it,
// so route storage access through it.
const getServiceWorker = async (context: BrowserContext) => {
  const [existing] = context.serviceWorkers();
  return existing ?? context.waitForEvent("serviceworker");
};

/** Reads the extension's entire chrome.storage.local — see ExtensionLocalSettings in core/src/settings.ts. */
export const getExtensionStorage = async (
  context: BrowserContext,
): Promise<Record<string, unknown>> => {
  const worker = await getServiceWorker(context);
  return worker.evaluate(() => chrome.storage.local.get(null));
};

/**
 * Seeds chrome.storage.local directly, so a test can set up
 * ExtensionLocalSettings state without clicking through the popup/settings
 * UI for every field. Merges with existing values (chrome.storage.local.set
 * semantics), same as the extension's own setters.
 */
export const setExtensionStorage = async (
  context: BrowserContext,
  data: Record<string, unknown>,
): Promise<void> => {
  const worker = await getServiceWorker(context);
  await worker.evaluate((d) => chrome.storage.local.set(d), data);
};

/** Clears chrome.storage.local — useful for resetting between tests that share a context. */
export const clearExtensionStorage = async (context: BrowserContext): Promise<void> => {
  const worker = await getServiceWorker(context);
  await worker.evaluate(() => chrome.storage.local.clear());
};
