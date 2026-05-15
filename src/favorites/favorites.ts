import {
  SETTINGS_KEYS,
  getLocalSettings,
  type FavoriteEntry,
  type FavoritesMap,
} from "../shared/settings.js";

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

void getLocalSettings().then(({ favorites }) => {
  render(favorites);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") {
    return;
  }
  const favChange = changes[SETTINGS_KEYS.favorites];
  if (!favChange) {
    return;
  }
  const next = favChange.newValue;
  render(next && typeof next === "object" ? (next as FavoritesMap) : {});
});
