declare const __SEEN_EVENTS_LOGGING__: boolean;

import {
  SETTINGS_KEYS,
  getLocalSettings,
  type FavoriteEntry,
  type FavoritesMap,
} from "../shared/settings.js";

const eventsBody = document.getElementById("events-body");
const eventsEmpty = document.getElementById("events-empty");
const eventsTable = document.getElementById("events-table");

const renderEvents = (seenEvents: Record<string, unknown>): void => {
  if (!eventsBody) return;
  const entries = Object.entries(seenEvents).sort(([a], [b]) => a.localeCompare(b));
  const hasEntries = entries.length > 0;
  if (eventsTable) eventsTable.style.display = hasEntries ? "" : "none";
  if (eventsEmpty) eventsEmpty.style.display = hasEntries ? "none" : "";
  eventsBody.replaceChildren();
  for (const [eventName, data] of entries) {
    const tr = document.createElement("tr");
    const nameTd = document.createElement("td");
    nameTd.textContent = eventName;
    const dataTd = document.createElement("td");
    const pre = document.createElement("pre");
    pre.textContent = JSON.stringify(data, null, 2);
    dataTd.append(pre);
    tr.append(nameTd, dataTd);
    eventsBody.append(tr);
  }
};

const grid = document.getElementById("grid");
const summary = document.getElementById("summary");
const template = document.getElementById("card-template");

const formatDate = (ms: number): string => {
  try {
    return new Date(ms).toLocaleString();
  } catch {
    return "";
  }
};

let currentFavorites: FavoritesMap = {};
let notifyTimestamps: Record<string, number> = {};

const renderCard = (userId: string, entry: FavoriteEntry): HTMLElement => {
  if (!(template instanceof HTMLTemplateElement)) {
    throw new Error("card template missing");
  }
  const fragment = template.content.cloneNode(true) as DocumentFragment;
  const card = fragment.querySelector(".card") as HTMLElement;

  const image = card.querySelector<HTMLElement>('[data-role="image"]');
  if (image) {
    if (entry.profilePicUrl) {
      image.style.backgroundImage = `url(${JSON.stringify(entry.profilePicUrl)})`;
    } else {
      image.classList.add("empty");
    }
  }

  const idEl = card.querySelector<HTMLElement>('[data-role="user-id"]');
  if (idEl) {
    idEl.textContent = userId;
  }

  const dateEl = card.querySelector<HTMLElement>('[data-role="favorited-at"]');
  if (dateEl) {
    dateEl.textContent = `Favorited ${formatDate(entry.favoritedAt)}`;
  }

  const notifiedEl = card.querySelector<HTMLElement>('[data-role="notified-at"]');
  if (notifiedEl) {
    const ts = notifyTimestamps[userId];
    notifiedEl.textContent = ts ? `Notified ${formatDate(ts)}` : "Not yet notified";
  }

  return card;
};

const render = (favorites: FavoritesMap): void => {
  if (!grid) {
    return;
  }
  grid.replaceChildren();

  const entries = Object.entries(favorites).sort(
    ([, a], [, b]) => b.favoritedAt - a.favoritedAt,
  );

  if (summary) {
    summary.textContent =
      entries.length === 0
        ? "No favorites yet."
        : `${entries.length} favorite${entries.length === 1 ? "" : "s"}`;
  }

  if (entries.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent =
      "Click the star next to a cruiser's name on sniffies.com to add them here.";
    grid.append(empty);
    return;
  }

  for (const [userId, entry] of entries) {
    grid.append(renderCard(userId, entry));
  }
};

void getLocalSettings().then(({ favorites, seenEvents, notifyTimestamps: ts }) => {
  currentFavorites = favorites;
  notifyTimestamps = ts;
  render(favorites);
  if (__SEEN_EVENTS_LOGGING__) {
    renderEvents(seenEvents);
  } else {
    const section = document.querySelector(".events-section");
    if (section instanceof HTMLElement) section.style.display = "none";
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") {
    return;
  }
  const tsChange = changes[SETTINGS_KEYS.notifyTimestamps];
  if (tsChange) {
    notifyTimestamps = tsChange.newValue && typeof tsChange.newValue === "object"
      ? (tsChange.newValue as Record<string, number>)
      : {};
  }
  const favChange = changes[SETTINGS_KEYS.favorites];
  if (favChange) {
    currentFavorites = favChange.newValue && typeof favChange.newValue === "object"
      ? (favChange.newValue as FavoritesMap)
      : {};
  }
  if (favChange || tsChange) {
    render(currentFavorites);
  }
  if (__SEEN_EVENTS_LOGGING__) {
    const eventsChange = changes[SETTINGS_KEYS.seenEvents];
    if (eventsChange) {
      const next = eventsChange.newValue;
      renderEvents(next && typeof next === "object" ? (next as Record<string, unknown>) : {});
    }
  }
});
