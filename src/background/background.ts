// Background service worker (Manifest V3).
// Runs on demand; do not rely on long-lived global state.

declare const __NOTIFY_ENDPOINT__: string;
declare const __NOTIFY_SECRET__: string;

import { getFavorites, getNotify } from "../shared/settings.js";

interface ExtensionSyncSettings {
  enabled: boolean;
  installedAt: number;
}

interface NotifyResult {
  ok: boolean;
  sid?: string;
  error?: string;
}

// Per-user-id debounce so a chatty WebSocket doesn't spam SMS.
// In-memory only; resets when the service worker is unloaded — that's fine
// for this size of app (Chrome unloads after ~30s idle).
const DEBOUNCE_MS = 10 * 60 * 1000;
const lastNotifiedAt = new Map<string, number>();

chrome.runtime.onInstalled.addListener(async (details) => {
  console.log("[bg] onInstalled", details.reason);
  const defaults: ExtensionSyncSettings = {
    enabled: true,
    installedAt: Date.now(),
  };
  const existing = await chrome.storage.sync.get(Object.keys(defaults));
  const merged = { ...defaults, ...existing };
  await chrome.storage.sync.set(merged);
});

const sendNotify = async (message: string): Promise<NotifyResult> => {
  const { phone, endpoint, secret } = await getNotify();
  const resolvedEndpoint = endpoint || __NOTIFY_ENDPOINT__;
  const resolvedSecret = secret || __NOTIFY_SECRET__;
  if (!phone || !resolvedEndpoint || !resolvedSecret) {
    return { ok: false, error: "notify_not_configured" };
  }

  let response: Response;
  try {
    response = await fetch(resolvedEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resolvedSecret}`,
      },
      body: JSON.stringify({ phone, message }),
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { ok: false, error };
  }

  let body: { ok?: boolean; sid?: string; error?: string; detail?: string };
  try {
    body = (await response.json()) as typeof body;
  } catch {
    return { ok: false, error: `non_json_response_${response.status}` };
  }

  if (!response.ok || !body.ok) {
    return { ok: false, error: body.error ?? `http_${response.status}` };
  }
  return { ok: true, sid: body.sid };
};

const handleFavoriteAwake = async (userId: string): Promise<NotifyResult> => {
  const favorites = await getFavorites();
  if (!Object.prototype.hasOwnProperty.call(favorites, userId)) {
    return { ok: false, error: "not_favorited" };
  }
  const now = Date.now();
  const last = lastNotifiedAt.get(userId) ?? 0;
  if (now - last < DEBOUNCE_MS) {
    return { ok: false, error: "debounced" };
  }
  lastNotifiedAt.set(userId, now);

  const result = await sendNotify(
    `Sniffies: favorited cruiser ${userId} is online.`,
  );
  if (!result.ok) {
    // Roll back the debounce so the next event can retry.
    lastNotifiedAt.delete(userId);
  }
  return result;
};

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "GET_SETTINGS") {
    chrome.storage.sync.get(null).then((settings) => {
      sendResponse({ ok: true, settings });
    });
    return true;
  }

  if (message?.type === "NOTIFY_TEST") {
    sendNotify("Sniffies extension: test message").then((result) => {
      sendResponse(result);
    });
    return true;
  }

  if (
    message?.type === "NOTIFY_FAVORITE_AWAKE" &&
    typeof message.userId === "string"
  ) {
    handleFavoriteAwake(message.userId).then((result) => {
      if (!result.ok && result.error !== "debounced") {
        console.warn("[bg] notify failed", result.error, message.userId);
      }
      sendResponse(result);
    });
    return true;
  }

  return false;
});
