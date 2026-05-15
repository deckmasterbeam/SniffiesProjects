declare const __SEEN_EVENTS_LOGGING__: boolean;

// Isolated-world content script on sniffies.com.
// Listens for parsed WebSocket events forwarded by the MAIN-world hook
// (via window.postMessage). When a "UserAwake" event arrives for a favorited
// user id, asks the background to send an SMS via the Twilio backend.

import {
  SETTINGS_KEYS,
  getLocalSettings,
  recordSeenEvent,
  type FavoritesMap,
  type NotifySettings,
} from "../shared/settings.js";

const TAG = "[sniffies-events]";

let favorites: FavoritesMap = {};
let notify: NotifySettings = { phone: "", endpoint: "", secret: "" };

const hasNotifyConfig = (): boolean => Boolean(notify.phone);

interface ForwardedMessage {
  source: "sniffies-ws-hook";
  kind: "message";
  raw: string | null;
  parsed: unknown;
}

const isForwardedMessage = (value: unknown): value is ForwardedMessage =>
  typeof value === "object" &&
  value !== null &&
  (value as { source?: unknown }).source === "sniffies-ws-hook" &&
  (value as { kind?: unknown }).kind === "message";

interface UserAwakeEvent {
  eventName: "UserAwake";
  data: string;
}

const isUserAwakeEvent = (value: unknown): value is UserAwakeEvent => {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return v.eventName === "UserAwake" && typeof v.data === "string";
};

interface UserJoinedEvent {
  eventName: "userJoined";
  data: { _id: string; data: unknown };
}

const isUserJoinedEvent = (value: unknown): value is UserJoinedEvent => {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  if (v.eventName !== "userJoined") return false;
  const d = v.data;
  return typeof d === "object" && d !== null && typeof (d as Record<string, unknown>)._id === "string";
};

const notifyFavorite = (userId: string, trigger: string): void => {
  if (!Object.prototype.hasOwnProperty.call(favorites, userId)) return;
  if (!hasNotifyConfig()) {
    console.log(`${TAG} [${trigger}] favorite active but notify not configured`, userId);
    return;
  }
  console.log(`${TAG} [${trigger}] favorite active, requesting SMS`, userId);
  chrome.runtime
    .sendMessage({ type: "NOTIFY_FAVORITE_AWAKE", userId })
    .catch((err) => console.error(`${TAG} sendMessage failed`, err));
};

const handleParsed = (parsed: unknown): void => {
  if (isUserAwakeEvent(parsed)) {
    notifyFavorite(parsed.data, "UserAwake");
  } else if (isUserJoinedEvent(parsed)) {
    notifyFavorite(parsed.data._id, "userJoined");
  }
};

window.addEventListener("message", (event: MessageEvent) => {
  if (event.source !== window) return;
  if (!isForwardedMessage(event.data)) return;

  const { parsed } = event.data;
  if (__SEEN_EVENTS_LOGGING__ && typeof parsed === "object" && parsed !== null) {
    const eventName = (parsed as Record<string, unknown>).eventName;
    if (typeof eventName === "string") {
      void recordSeenEvent(eventName, parsed);
    }
  }

  handleParsed(parsed);
});

// Load current settings + favorites, then watch for changes.
void getLocalSettings().then((settings) => {
  favorites = settings.favorites;
  notify = settings.notify;
  console.log(
    `${TAG} initialized; favorites =`,
    Object.keys(favorites).length,
    "notify configured =",
    hasNotifyConfig(),
  );
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") {
    return;
  }
  const favChange = changes[SETTINGS_KEYS.favorites];
  if (favChange) {
    const next = favChange.newValue;
    favorites = next && typeof next === "object" ? (next as FavoritesMap) : {};
  }
  const notifyChange = changes[SETTINGS_KEYS.notify];
  if (notifyChange) {
    const next = notifyChange.newValue;
    notify =
      next && typeof next === "object"
        ? (next as NotifySettings)
        : { phone: "", endpoint: "", secret: "" };
  }
});
