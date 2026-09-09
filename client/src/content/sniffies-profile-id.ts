// Runs in the isolated world on sniffies.com.
// - Listens for clicks on profile markers ([data-testid="cv-marker-avatar-image"]).
// - Extracts the user id (and profile pic URL) from the marker's background-image URL.
// - When a profile panel (#app-screen) renders its cruiserNameLabel span,
//   injects a star toggle (always shown) and the user id text (debug-gated).
// - Report-button injection (id resolution, the panel-switch race handling,
//   deep-link/no-photo fixes) lives in core/src/report-button-hook.ts, shared
//   verbatim with the userscript's src/report.ts — see that file's header.

import {
  CLIENT_SECRET,
  DEBUG,
  FAVORITES_NOTIFICATIONS_ENABLED,
  REPORTING_ENABLED,
  SERVER_BASE,
} from "../shared/env.js";
import {
  createLogger,
  installProfileBorderRedirect,
  installReportButtonInjection,
  refreshBlockedBotsIfStale,
  APP_SCREEN_SELECTOR,
  NAME_LABEL_SELECTOR,
  type MarkerSelection,
} from "@sniffies-projects/core";
import {
  DEFAULT_PROFILE_BORDER_OPEN,
  SETTINGS_KEYS,
  getLocalSettings,
  setBlockedBots,
  type ProfileBorderOpen,
} from "../shared/settings.js";

const clientHeaders = (): Record<string, string> => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${CLIENT_SECRET}`,
});

const log = createLogger("profile-id");
const INJECTED_ATTR = "data-sniffies-injection";
const STAR_ON = "★";
const STAR_OFF = "☆";

interface ApiFavoriteEntry {
  user_id: string;
  profile_pic_url: string | null;
  favorited_at: string;
}

let favoritedIds = new Set<string>();
let currentGuid = "";
let currentSniffiesUserId = "";
let currentProfileBorderOpen: ProfileBorderOpen = { ...DEFAULT_PROFILE_BORDER_OPEN };
// The most recent marker click's extraction, kept only to hand a favorite's
// profilePicUrl to injectIntoNameLabel — onProfileResolved below only uses it
// when its userId still matches the panel being resolved (it won't after a
// URL-driven self-correction, e.g. a deep link or a no-photo marker).
let lastMarkerSelection: MarkerSelection | null = null;

const isFavorite = (userId: string): boolean => favoritedIds.has(userId);

const fetchFavorites = async (guid: string): Promise<void> => {
  if (!guid || !SERVER_BASE) {
    return;
  }
  try {
    const res = await fetch(`${SERVER_BASE}/api/favorites?guid=${encodeURIComponent(guid)}`, {
      headers: clientHeaders(),
    });
    if (!res.ok) {
      return;
    }
    const data = (await res.json()) as { ok: boolean; favorites: ApiFavoriteEntry[] };
    favoritedIds = new Set((data.favorites ?? []).map((f) => f.user_id));
    refreshAllInjections();
  } catch (err) {
    log.error("fetchFavorites failed", err);
  }
};

const renderStar = (star: HTMLElement, userId: string): void => {
  const isFav = isFavorite(userId);
  star.textContent = isFav ? STAR_ON : STAR_OFF;
  star.setAttribute("aria-pressed", String(isFav));
  star.title = isFav ? "Unfavorite" : "Favorite";
};

const renderIdText = (idText: HTMLElement): void => {
  idText.style.display = DEBUG ? "" : "none";
};

const buildInjection = (userId: string, profilePicUrl: string | null): HTMLElement => {
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
    if (!currentGuid) {
      log.warn("no guid — open settings to register your phone");
      return;
    }
    const next = !isFavorite(userId);
    // Optimistic UI update.
    if (next) {
      favoritedIds.add(userId);
    } else {
      favoritedIds.delete(userId);
    }
    renderStar(star, userId);
    try {
      await fetch(`${SERVER_BASE}/api/favorites`, {
        method: "POST",
        headers: clientHeaders(),
        body: JSON.stringify({
          guid: currentGuid,
          userId,
          profilePicUrl,
          favorite: next,
        }),
      });
    } catch (err) {
      log.error("failed to persist favorite", err);
      // Roll back optimistic update.
      if (next) {
        favoritedIds.delete(userId);
      } else {
        favoritedIds.add(userId);
      }
      renderStar(star, userId);
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
  userId: string,
  profilePicUrl: string | null,
): void => {
  if (!FAVORITES_NOTIFICATIONS_ENABLED) {
    return;
  }
  const screen = nameLabel.closest(APP_SCREEN_SELECTOR);
  if (!screen) {
    return;
  }
  const existing = screen.querySelector<HTMLElement>(`[${INJECTED_ATTR}]`);
  if (existing) {
    if (existing.getAttribute(INJECTED_ATTR) === userId) {
      refreshInjection(existing, userId);
      return;
    }
    existing.remove();
  }
  const node = buildInjection(userId, profilePicUrl);
  nameLabel.insertAdjacentElement("afterend", node);
  log("injected for user", userId);
};

// Registered before the favorites click listener below so it can claim
// out-of-radius profile clicks first (via stopImmediatePropagation).
installProfileBorderRedirect(() => currentProfileBorderOpen);

installReportButtonInjection({
  serverBase: SERVER_BASE,
  getAuthHeaders: clientHeaders,
  reportingEnabled: REPORTING_ENABLED,
  getReporterUserId: () => currentSniffiesUserId,
  onMarkerClick: (_marker, selection) => {
    lastMarkerSelection = selection;
  },
  onProfileResolved: (screen, userId) => {
    const nameLabel = screen.querySelector<HTMLElement>(NAME_LABEL_SELECTOR);
    if (!nameLabel) {
      return;
    }
    const profilePicUrl =
      lastMarkerSelection?.userId === userId ? lastMarkerSelection.profilePicUrl : null;
    injectIntoNameLabel(nameLabel, userId, profilePicUrl);
  },
});

void getLocalSettings().then(
  ({ guid, profileBorderOpen, sniffiesUserId, blockedBotsFetchedAt }) => {
    currentGuid = guid;
    currentSniffiesUserId = sniffiesUserId;
    currentProfileBorderOpen = { ...DEFAULT_PROFILE_BORDER_OPEN, ...profileBorderOpen };
    if (guid) {
      void fetchFavorites(guid);
    }
    if (REPORTING_ENABLED) {
      refreshBlockedBotsIfStale(
        blockedBotsFetchedAt,
        SERVER_BASE,
        clientHeaders,
        (userIds, fetchedAt) => setBlockedBots(userIds, fetchedAt),
      );
    }
    log(`initialized, guid ${guid ? "present" : "missing"}`);
  },
);

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") {
    return;
  }
  const guidChange = changes[SETTINGS_KEYS.guid];
  if (guidChange) {
    currentGuid = typeof guidChange.newValue === "string" ? guidChange.newValue : "";
    if (currentGuid) {
      void fetchFavorites(currentGuid);
    }
  }
  const sniffiesUserIdChange = changes[SETTINGS_KEYS.sniffiesUserId];
  if (sniffiesUserIdChange) {
    currentSniffiesUserId =
      typeof sniffiesUserIdChange.newValue === "string" ? sniffiesUserIdChange.newValue : "";
  }
  const profileBorderChange = changes[SETTINGS_KEYS.profileBorderOpen];
  if (profileBorderChange) {
    currentProfileBorderOpen = {
      ...DEFAULT_PROFILE_BORDER_OPEN,
      ...(profileBorderChange.newValue as ProfileBorderOpen | undefined),
    };
  }
});
