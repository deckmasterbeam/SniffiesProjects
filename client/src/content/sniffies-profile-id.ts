// Runs in the isolated world on sniffies.com.
// - Listens for clicks on profile markers ([data-testid="cv-marker-avatar-image"]).
// - Extracts the user id (and profile pic URL) from the marker's background-image URL.
// - When a profile panel (#app-screen) renders its cruiserNameLabel span,
//   injects a star toggle (always shown) and the user id text (debug-gated).

import {
  CLIENT_SECRET,
  DEBUG,
  FAVORITES_NOTIFICATIONS_ENABLED,
  REPORTING_ENABLED,
  SERVER_BASE,
} from "../shared/env.js";
import {
  createLogger,
  REPORT_MODAL_CSS,
  REPORT_MODAL_HTML,
  wireReportModal,
  type ReportModalHandle,
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
const MARKER_SELECTOR = '[data-testid="cv-marker-avatar-image"]';
const MARKER_CONTAINER_SELECTOR = '[data-testid="markerUserContainer"]';
const APP_SCREEN_SELECTOR = "#app-screen";
const NAME_LABEL_SELECTOR = '[data-testid="cruiserNameLabel"]';
const PIN_BUTTON_SELECTOR = '[data-testid="pinUserButton"]';
const INJECTED_ATTR = "data-sniffies-injection";
const REPORT_INJECTED_ATTR = "data-sniffies-report-injection";
const REPORT_MODAL_ROOT_ID = "snp-report-root";
const STAR_ON = "★";
const STAR_OFF = "☆";
const BLOCKED_BOTS_MAX_AGE_MS = 24 * 60 * 60 * 1000;

interface ProfileSelection {
  userId: string;
  profilePicUrl: string | null;
}

interface ApiFavoriteEntry {
  user_id: string;
  profile_pic_url: string | null;
  favorited_at: string;
}

interface ApiBlockedBotsResponse {
  ok: boolean;
  userIds: string[];
}

let lastSelection: ProfileSelection | null = null;
let favoritedIds = new Set<string>();
let currentGuid = "";
let currentSniffiesUserId = "";
let currentProfileBorderOpen: ProfileBorderOpen = { ...DEFAULT_PROFILE_BORDER_OPEN };
let reportModal: ReportModalHandle | null = null;
let reportTarget: string | null = null;

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

const submitReport = async (reportedUserId: string, message: string): Promise<void> => {
  if (!SERVER_BASE) {
    throw new Error("server not configured");
  }
  const res = await fetch(`${SERVER_BASE}/api/report`, {
    method: "POST",
    headers: clientHeaders(),
    body: JSON.stringify({
      reportType: "bot_suspected",
      reportedUserId,
      reporterUserId: currentSniffiesUserId,
      message: message || undefined,
    }),
  });
  if (!res.ok) {
    throw new Error(`report failed with status ${res.status}`);
  }
};

const ensureReportModal = (): ReportModalHandle => {
  if (reportModal) {
    return reportModal;
  }
  const style = document.createElement("style");
  style.textContent = REPORT_MODAL_CSS;
  document.head.appendChild(style);

  const root = document.createElement("div");
  root.id = REPORT_MODAL_ROOT_ID;
  root.innerHTML = REPORT_MODAL_HTML;
  document.body.appendChild(root);

  reportModal = wireReportModal(root, {
    onSubmit: async (message) => {
      if (!reportTarget) {
        return;
      }
      await submitReport(reportTarget, message);
    },
    onCancel: () => {
      reportTarget = null;
    },
  });
  return reportModal;
};

const fetchBlockedBots = async (): Promise<void> => {
  if (!SERVER_BASE) {
    return;
  }
  try {
    const res = await fetch(`${SERVER_BASE}/api/blocked-bots`, {
      headers: clientHeaders(),
    });
    if (!res.ok) {
      return;
    }
    const data = (await res.json()) as ApiBlockedBotsResponse;
    await setBlockedBots(data.userIds ?? [], Date.now());
  } catch (err) {
    log.error("fetchBlockedBots failed", err);
  }
};

const refreshBlockedBotsIfStale = async (blockedBotsFetchedAt: number): Promise<void> => {
  if (Date.now() - blockedBotsFetchedAt > BLOCKED_BOTS_MAX_AGE_MS) {
    await fetchBlockedBots();
  }
};

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
  star.title = isFav ? "Unfavorite" : "Favorite";
};

const renderIdText = (idText: HTMLElement): void => {
  idText.style.display = DEBUG ? "" : "none";
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

const buildReportButton = (userId: string): HTMLButtonElement => {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.setAttribute(REPORT_INJECTED_ATTR, userId);
  btn.setAttribute("aria-label", "Report profile");
  btn.title = "Report as suspected bot";
  btn.style.cssText = [
    "background:transparent",
    "border:none",
    "padding:0 8px",
    "cursor:pointer",
    "font-size:16px",
    "line-height:1",
    "color:#f04438",
    "display:flex",
    "align-items:center",
  ].join(";");
  btn.textContent = "🚩";
  btn.addEventListener("click", (event) => {
    event.stopPropagation();
    if (!currentSniffiesUserId) {
      log.warn("no sniffies user id observed yet — cannot report");
      return;
    }
    reportTarget = userId;
    ensureReportModal().open();
  });
  return btn;
};

const injectReportButton = (screen: Element, selection: ProfileSelection): void => {
  if (!REPORTING_ENABLED) {
    return;
  }
  const pinButton = screen.querySelector<HTMLElement>(PIN_BUTTON_SELECTOR);
  const controlsContainer = pinButton?.parentElement;
  if (!controlsContainer) {
    return;
  }
  const existing = controlsContainer.querySelector<HTMLElement>(`[${REPORT_INJECTED_ATTR}]`);
  if (existing) {
    if (existing.getAttribute(REPORT_INJECTED_ATTR) === selection.userId) {
      return;
    }
    existing.remove();
  }
  controlsContainer.prepend(buildReportButton(selection.userId));
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

const injectIntoNameLabel = (nameLabel: HTMLElement, selection: ProfileSelection): void => {
  if (!FAVORITES_NOTIFICATIONS_ENABLED) {
    return;
  }
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
  log("injected for user", selection.userId);
};

const tryInjectIntoScreen = (screen: Element): void => {
  if (!lastSelection) {
    return;
  }
  const nameLabel = screen.querySelector<HTMLElement>(NAME_LABEL_SELECTOR);
  if (nameLabel) {
    injectIntoNameLabel(nameLabel, lastSelection);
  }
  injectReportButton(screen, lastSelection);
};

const observer = new MutationObserver((mutations) => {
  if (!lastSelection) {
    return;
  }
  for (const m of mutations) {
    for (const node of m.addedNodes) {
      if (!(node instanceof HTMLElement)) {
        continue;
      }
      const matchesNameLabel =
        node.matches?.(NAME_LABEL_SELECTOR) || !!node.querySelector?.(NAME_LABEL_SELECTOR);
      const matchesPinButton =
        node.matches?.(PIN_BUTTON_SELECTOR) || !!node.querySelector?.(PIN_BUTTON_SELECTOR);
      if (!matchesNameLabel && !matchesPinButton) {
        continue;
      }
      const screen = document.querySelector(APP_SCREEN_SELECTOR);
      if (screen) {
        tryInjectIntoScreen(screen);
      }
    }
  }
});

const startObserving = (): void => {
  observer.observe(document.body, { childList: true, subtree: true });
};

document.addEventListener(
  "click",
  (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    if (currentProfileBorderOpen.enabled) {
      const container = target.closest<HTMLElement>(MARKER_CONTAINER_SELECTOR);
      if (container && container.dataset.withinRadius === "false" && container.id) {
        event.stopPropagation();
        event.preventDefault();
        const url = `https://sniffies.com/profile/${container.id}`;
        if (currentProfileBorderOpen.openInNewTab) {
          window.open(url, "_blank");
        } else {
          window.location.href = url;
        }
        return;
      }
    }

    const marker = target.closest<HTMLElement>(MARKER_SELECTOR);
    if (!marker) {
      return;
    }
    const selection = extractFromMarker(marker);
    if (!selection) {
      log("click on marker but no user id found", marker);
      return;
    }
    lastSelection = selection;
    log("marker clicked", selection);
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

void getLocalSettings().then(
  ({ guid, profileBorderOpen, sniffiesUserId, blockedBotsFetchedAt }) => {
    currentGuid = guid;
    currentSniffiesUserId = sniffiesUserId;
    currentProfileBorderOpen = { ...DEFAULT_PROFILE_BORDER_OPEN, ...profileBorderOpen };
    if (guid) {
      void fetchFavorites(guid);
    }
    if (REPORTING_ENABLED) {
      void refreshBlockedBotsIfStale(blockedBotsFetchedAt);
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
