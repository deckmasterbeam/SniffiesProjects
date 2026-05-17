import { getHookSettings, DEFAULT_HOOK_SETTINGS, type HookSettings } from "../shared/settings.js";

const TAG = "[sniffies-events]";

const broadcastHookSettings = async (): Promise<void> => {
  let settings: HookSettings;
  try {
    settings = await getHookSettings();
  } catch {
    settings = DEFAULT_HOOK_SETTINGS;
  }
  window.postMessage({ source: "sniffies-hook-settings", settings }, "*");
  console.log(TAG, "hook settings broadcast", settings);
};

void broadcastHookSettings();

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
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const v = value as Record<string, unknown>;
  return v.eventName === "UserAwake" && typeof v.data === "string";
};

interface UserJoinedEvent {
  eventName: "userJoined";
  data: { _id: string; data: unknown };
}

const isUserJoinedEvent = (value: unknown): value is UserJoinedEvent => {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const v = value as Record<string, unknown>;
  if (v.eventName !== "userJoined") {
    return false;
  }
  const d = v.data;
  return (
    typeof d === "object" && d !== null && typeof (d as Record<string, unknown>)._id === "string"
  );
};

const notifyUser = (userId: string, trigger: string): void => {
  console.log(`${TAG} [${trigger}] user active, forwarding to background`, userId);
  chrome.runtime
    .sendMessage({ type: "NOTIFY_FAVORITE_AWAKE", userId })
    .catch((err) => console.error(`${TAG} sendMessage failed`, err));
};

const handleParsed = (parsed: unknown): void => {
  if (isUserAwakeEvent(parsed)) {
    notifyUser(parsed.data, "UserAwake");
  } else if (isUserJoinedEvent(parsed)) {
    notifyUser(parsed.data._id, "userJoined");
  }
};

window.addEventListener("message", (event: MessageEvent) => {
  if (event.source !== window) {
    return;
  }
  if (!isForwardedMessage(event.data)) {
    return;
  }
  handleParsed(event.data.parsed);
});

console.log(`${TAG} initialized`);
