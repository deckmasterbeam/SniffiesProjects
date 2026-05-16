// Background service worker for the watcher extension.
// Fetches watched user IDs from the server, then sends SMS notifications
// when those users come online.

declare const __SERVER_BASE__: string;
declare const __WATCHER_SECRET__: string;
// Legacy fallbacks.
declare const __NOTIFY_ENDPOINT__: string;
declare const __NOTIFY_SECRET__: string;

import {
  getNotifyTimestamp,
  setNotifyTimestamp,
  clearNotifyTimestamp,
} from "../shared/settings.js";

const DEBOUNCE_MS = 15 * 60 * 1000;
const WATCHED_USERS_REFRESH_MS = 5 * 60 * 1000;

let watchedUserIds = new Set<string>();
let lastWatchedFetch = 0;

const fetchWatchedUsers = async (): Promise<void> => {
  const resolvedBase = __SERVER_BASE__ || __NOTIFY_ENDPOINT__.replace(/\/api\/notify$/, "");
  const resolvedSecret = __WATCHER_SECRET__ || __NOTIFY_SECRET__;
  if (!resolvedBase || !resolvedSecret) return;
  try {
    const res = await fetch(`${resolvedBase}/api/watched-users`, {
      headers: { Authorization: `Bearer ${resolvedSecret}` },
    });
    if (!res.ok) {
      console.warn("[bg] watched-users returned", res.status);
      return;
    }
    const data = (await res.json()) as { ok: boolean; userIds: string[] };
    watchedUserIds = new Set(data.userIds ?? []);
    lastWatchedFetch = Date.now();
    console.log("[bg] watching", watchedUserIds.size, "users");
  } catch (err) {
    console.error("[bg] fetchWatchedUsers failed", err);
  }
};

const sendNotify = async (userId: string): Promise<{ ok: boolean; error?: string }> => {
  const resolvedBase = __SERVER_BASE__ || __NOTIFY_ENDPOINT__.replace(/\/api\/notify$/, "");
  const resolvedSecret = __WATCHER_SECRET__ || __NOTIFY_SECRET__;
  if (!resolvedBase || !resolvedSecret) {
    return { ok: false, error: "notify_not_configured" };
  }
  try {
    const res = await fetch(`${resolvedBase}/api/notify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resolvedSecret}`,
      },
      body: JSON.stringify({ userId }),
    });
    const body = (await res.json()) as { ok?: boolean; error?: string };
    if (!res.ok || !body.ok) return { ok: false, error: body.error ?? `http_${res.status}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
};

const handleFavoriteAwake = async (userId: string): Promise<{ ok: boolean; error?: string }> => {
  const now = Date.now();

  // Refresh watched list if stale.
  if (now - lastWatchedFetch > WATCHED_USERS_REFRESH_MS) {
    await fetchWatchedUsers();
  }

  if (!watchedUserIds.has(userId)) {
    return { ok: false, error: "not_watched" };
  }

  const last = await getNotifyTimestamp(userId);
  if (now - last < DEBOUNCE_MS) {
    return { ok: false, error: "debounced" };
  }
  await setNotifyTimestamp(userId, now);

  const result = await sendNotify(userId);
  if (!result.ok) {
    await clearNotifyTimestamp(userId);
  }
  return result;
};

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "NOTIFY_FAVORITE_AWAKE" && typeof message.userId === "string") {
    handleFavoriteAwake(message.userId).then((result) => {
      if (!result.ok && result.error !== "debounced" && result.error !== "not_watched") {
        console.warn("[bg] notify failed", result.error, message.userId);
      }
      sendResponse(result);
    });
    return true;
  }
  return false;
});

// Fetch watched users on startup.
void fetchWatchedUsers();
