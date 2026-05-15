// Runs in the isolated world on sniffies.com.
// - Listens for clicks on profile markers ([data-testid="cv-marker-avatar-image"]).
// - Extracts the user id (and profile pic URL) from the marker's
//   background-image URL.
// - When a profile panel (#app-screen) renders its cruiserNameLabel span,
//   injects a star toggle (always shown) and the user id text (debug-gated).

import {
  DEFAULT_LOCAL_SETTINGS,
  SETTINGS_KEYS,
  getLocalSettings,
  setFavorite,
  type FavoritesMap,
} from "../shared/settings.js";

const TAG = "[sniffies-profile-id]";
const MARKER_SELECTOR = '[data-testid="cv-marker-avatar-image"]';
const APP_SCREEN_SELECTOR = "#app-screen";
const NAME_LABEL_SELECTOR = '[data-testid="cruiserNameLabel"]';
const INJECTED_ATTR = "data-sniffies-injection";
const STAR_ON = "★";
const STAR_OFF = "☆";

interface ProfileSelection {
  userId: string;
  profilePicUrl: string | null;
}

let lastSelection: ProfileSelection | null = null;
let debugEnabled = DEFAULT_LOCAL_SETTINGS.debug;
let favorites: FavoritesMap = { ...DEFAULT_LOCAL_SETTINGS.favorites };

const isFavorite = (userId: string): boolean =>
  Object.prototype.hasOwnProperty.call(favorites, userId);

const extractUserIdFromUrl = (url: string): string | null => {
  try {
    const parsed = new URL(url);
    const first = parsed.pathname.split("/").filter(Boolean)[0];
    return first && /^[a-f0-9]{16,}$/i.test(first) ? first : null;
  } catch {
    return null;
  }
};

const extractFromMarker = (el: HTMLElement): ProfileSelection | null => {
  const bg = el.style.backgroundImage || getComputedStyle(el).backgroundImage;
  if (!bg || bg === "none") {
    return null;
  }
  const match = bg.match(/url\((['"]?)(.*?)\1\)/);
  const rawUrl = match?.[2];
  if (!rawUrl) {
    return null;
  }
  const userId = extractUserIdFromUrl(rawUrl);
  if (!userId) {
    return null;
  }
  return { userId, profilePicUrl: rawUrl };
};

const renderStar = (star: HTMLElement, userId: string): void => {
  const isFav = isFavorite(userId);
  star.textContent = isFav ? STAR_ON : STAR_OFF;
  star.setAttribute("aria-pressed", String(isFav));
  if (isFav) {
    const at = favorites[userId]?.favoritedAt;
    const when = at ? new Date(at).toLocaleString() : "";
    star.title = when ? `Favorited ${when} — click to unfavorite` : "Unfavorite";
  } else {
    star.title = "Favorite";
  }
};

const renderIdText = (idText: HTMLElement): void => {
  idText.style.display = debugEnabled ? "" : "none";
};

const buildInjection = (selection: ProfileSelection): HTMLElement => {
  const { userId, profilePicUrl } = selection;

  const wrap = document.createElement("div");
  wrap.setAttribute(INJECTED_ATTR, userId);
  wrap.style.cssText = [
    "display:flex",
    "align-items:center",
    "gap:6px",
    "margin-top:4px",
    "font-family:ui-monospace,SFMono-Regular,Menlo,monospace",
  ].join(";");

  const star = document.createElement("button");
  star.type = "button";
  star.dataset.role = "favorite-toggle";
  star.style.cssText = [
    "background:transparent",
    "border:none",
    "padding:0",
    "cursor:pointer",
    "font-size:16px",
    "line-height:1",
    "color:#f5b400",
  ].join(";");
  star.addEventListener("click", async (event) => {
    event.stopPropagation();
    const next = !isFavorite(userId);
    // Optimistic UI update; storage write will also broadcast via onChanged.
    if (next) {
      favorites = {
        ...favorites,
        [userId]: { favoritedAt: Date.now(), profilePicUrl },
      };
    } else {
      const { [userId]: _removed, ...rest } = favorites;
      favorites = rest;
    }
    renderStar(star, userId);
    try {
      await setFavorite(userId, next, profilePicUrl);
    } catch (err) {
      console.error(`${TAG} failed to persist favorite`, err);
    }
  });

  const idText = document.createElement("span");
  idText.dataset.role = "user-id";
  idText.style.cssText = [
    "font-size:11px",
    "color:#888",
    "user-select:all",
    "word-break:break-all",
  ].join(";");
  idText.textContent = `id: ${userId}`;

  wrap.append(star, idText);
  renderStar(star, userId);
  renderIdText(idText);
  return wrap;
};

const refreshInjection = (wrap: HTMLElement, userId: string): void => {
  const star = wrap.querySelector<HTMLElement>('[data-role="favorite-toggle"]');
  const idText = wrap.querySelector<HTMLElement>('[data-role="user-id"]');
  if (star) {
    renderStar(star, userId);
  }
  if (idText) {
    renderIdText(idText);
  }
};

const refreshAllInjections = (): void => {
  for (const wrap of document.querySelectorAll<HTMLElement>(`[${INJECTED_ATTR}]`)) {
    const userId = wrap.getAttribute(INJECTED_ATTR);
    if (userId) {
      refreshInjection(wrap, userId);
    }
  }
};

const injectIntoNameLabel = (
  nameLabel: HTMLElement,
  selection: ProfileSelection,
): void => {
  const screen = nameLabel.closest(APP_SCREEN_SELECTOR);
  if (!screen) {
    return;
  }
  const existing = screen.querySelector<HTMLElement>(`[${INJECTED_ATTR}]`);
  if (existing) {
    if (existing.getAttribute(INJECTED_ATTR) === selection.userId) {
      refreshInjection(existing, selection.userId);
      return;
    }
    existing.remove();
  }

  const node = buildInjection(selection);
  nameLabel.insertAdjacentElement("afterend", node);
  console.log(`${TAG} injected for user`, selection.userId);
};

const tryInjectIntoScreen = (screen: Element): void => {
  if (!lastSelection) {
    return;
  }
  const nameLabel = screen.querySelector<HTMLElement>(NAME_LABEL_SELECTOR);
  if (nameLabel) {
    injectIntoNameLabel(nameLabel, lastSelection);
  }
};

// Watch the whole document for the app-screen and its name label appearing or
// changing. Angular swaps content in/out, so we can't rely on a one-shot wait.
const observer = new MutationObserver((mutations) => {
  if (!lastSelection) {
    return;
  }
  for (const m of mutations) {
    for (const node of m.addedNodes) {
      if (!(node instanceof HTMLElement)) {
        continue;
      }
      if (node.matches?.(NAME_LABEL_SELECTOR)) {
        injectIntoNameLabel(node, lastSelection);
        continue;
      }
      const nested = node.querySelector?.<HTMLElement>(NAME_LABEL_SELECTOR);
      if (nested) {
        injectIntoNameLabel(nested, lastSelection);
      }
    }
  }
});

const startObserving = (): void => {
  observer.observe(document.body, { childList: true, subtree: true });
};

// Use capture so we see the click even if Angular stops propagation.
document.addEventListener(
  "click",
  (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    const marker = target.closest<HTMLElement>(MARKER_SELECTOR);
    if (!marker) {
      return;
    }
    const selection = extractFromMarker(marker);
    if (!selection) {
      console.log(`${TAG} click on marker but no user id found`, marker);
      return;
    }
    lastSelection = selection;
    console.log(`${TAG} marker clicked`, selection);

    const screen = document.querySelector(APP_SCREEN_SELECTOR);
    if (screen) {
      tryInjectIntoScreen(screen);
    }
  },
  true,
);

if (document.body) {
  startObserving();
} else {
  document.addEventListener("DOMContentLoaded", startObserving, { once: true });
}

// Load initial state and react to changes from popup / other tabs.
void getLocalSettings().then((settings) => {
  debugEnabled = settings.debug;
  favorites = settings.favorites;
  console.log(
    `${TAG} debug =`,
    settings.debug,
    " favorites =",
    Object.keys(settings.favorites).length,
  );
  refreshAllInjections();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") {
    return;
  }
  let touched = false;
  const debugChange = changes[SETTINGS_KEYS.debug];
  if (debugChange) {
    debugEnabled = Boolean(debugChange.newValue);
    touched = true;
  }
  const favChange = changes[SETTINGS_KEYS.favorites];
  if (favChange) {
    const next = favChange.newValue;
    favorites = next && typeof next === "object" ? (next as FavoritesMap) : {};
    touched = true;
  }
  if (touched) {
    refreshAllInjections();
  }
});

console.log(`${TAG} initialized`);
