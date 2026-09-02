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
  installProfileBorderRedirect,
  REPORT_MODAL_CSS,
  REPORT_MODAL_HTML,
  wireReportModal,
  type ReportModalHandle,
  MARKER_AVATAR_SELECTOR as MARKER_SELECTOR,
  APP_SCREEN_SELECTOR,
  NAME_LABEL_SELECTOR,
  PIN_BUTTON_SELECTOR,
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
// Bumped on every marker click / initial-load resolution. scheduleReinjectionRetries
// captures the value at schedule time so a retry chain can tell it's been
// superseded by a newer click and stop — this replaces comparing against a
// specific ProfileSelection object, which doesn't work now that a click can
// kick off a retry chain without ever producing one (see tryInjectIntoScreen).
let selectionGeneration = 0;
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

// Matches /profile/<id> (and subpaths like /profile/<id>/chat) for a page
// that loads directly onto a profile — no marker click fires in that case,
// so this is the only way to learn which profile is showing on init.
const extractUserIdFromProfilePath = (pathname: string): string | null => {
  const segments = pathname.split("/").filter(Boolean);
  const id = segments[0] === "profile" ? segments[1] : undefined;
  return id && /^[a-f0-9]{16,}$/i.test(id) ? id : null;
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

// ── Profile injection ────────────────────────────────────────────────────────
// Injects the favorite star + report flag into whichever profile panel is
// currently open. Three things trigger it — a marker click, an initial page
// load landing directly on a profile URL, and a MutationObserver watching
// for the panel's DOM — and all three funnel through tryInjectIntoScreen,
// which resolves *who* from the URL rather than trusting whichever trigger
// called it.

const tryInjectIntoScreen = (screen: Element): void => {
  // A marker's background-image (the other source of identity — used below
  // only for profilePicUrl) is absent for accounts with no profile photo,
  // so it can't always say who's showing. The URL can: Sniffies' routing
  // updates it to /profile/<id> whenever a panel opens, photo or not. Re-
  // resolving here on every call — not just once at click time — lets it
  // override a stale or absent lastSelection, which is what makes injection
  // self-correct no matter which trigger ends up calling this.
  const urlUserId = extractUserIdFromProfilePath(location.pathname);
  if (urlUserId && lastSelection?.userId !== urlUserId) {
    lastSelection = { userId: urlUserId, profilePicUrl: null };
  }
  if (!lastSelection) {
    return;
  }
  const nameLabel = screen.querySelector<HTMLElement>(NAME_LABEL_SELECTOR);
  if (nameLabel) {
    injectIntoNameLabel(nameLabel, lastSelection);
  }
  injectReportButton(screen, lastSelection);
};

// A click-triggered panel switch is a quick, already-loaded transition, so
// it's worth polling relatively often to keep the flag feeling responsive.
const CLICK_REINJECT_RETRY_WINDOW_MS = 1000;
const CLICK_REINJECT_RETRY_INTERVAL_MS = 100;
// An initial page load has no interactive urgency but can take longer to
// settle (a full data fetch + app bootstrap, not just a panel swap), so
// this polls less often over a longer window than the click case.
const INITIAL_LOAD_REINJECT_RETRY_WINDOW_MS = 3000;
const INITIAL_LOAD_REINJECT_RETRY_INTERVAL_MS = 300;

// Reruns tryInjectIntoScreen every intervalMs until windowMs elapses.
// Unconditional, no "did it work" check: injectReportButton always stamps
// whatever container it finds, so checking our own attribute afterward
// would look "done" immediately even mid-transition, into the wrong
// (outgoing) panel. Idempotent and cheap, so polling past the point of
// actually succeeding costs nothing. Bails out once `generation` is stale
// — a newer click/load has advanced selectionGeneration since this chain
// was scheduled.
const scheduleReinjectionRetries = (
  generation: number,
  windowMs: number = CLICK_REINJECT_RETRY_WINDOW_MS,
  intervalMs: number = CLICK_REINJECT_RETRY_INTERVAL_MS,
): void => {
  const deadline = performance.now() + windowMs;
  const attempt = (): void => {
    if (generation !== selectionGeneration) {
      return;
    }
    const screen = document.querySelector(APP_SCREEN_SELECTOR);
    if (screen) {
      tryInjectIntoScreen(screen);
    }
    if (performance.now() < deadline) {
      setTimeout(attempt, intervalMs);
    }
  };
  setTimeout(attempt, intervalMs);
};

// Shared entry point for both triggers below. Advances selectionGeneration
// (invalidating any older retry chain still running), takes one immediate
// attempt, then starts polling in case the panel hasn't rendered yet.
// `selection` may be null (e.g. a no-photo marker click) since
// tryInjectIntoScreen can resolve the id from the URL on its own.
const triggerInjection = (
  selection: ProfileSelection | null,
  windowMs: number = CLICK_REINJECT_RETRY_WINDOW_MS,
  intervalMs: number = CLICK_REINJECT_RETRY_INTERVAL_MS,
): void => {
  selectionGeneration += 1;
  if (selection) {
    lastSelection = selection;
  }
  const screen = document.querySelector(APP_SCREEN_SELECTOR);
  if (screen) {
    tryInjectIntoScreen(screen);
  }
  scheduleReinjectionRetries(selectionGeneration, windowMs, intervalMs);
};

const observer = new MutationObserver((mutations) => {
  // No lastSelection guard here: tryInjectIntoScreen resolves the id from
  // the URL itself, which matters when the very first profile ever viewed
  // has no photo (no click-derived selection to fall back on either).
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

// Registered before the favorites click listener below so it can claim
// out-of-radius profile clicks first (via stopImmediatePropagation).
installProfileBorderRedirect(() => currentProfileBorderOpen);

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
    // This listener runs in the capture phase, before Sniffies' own click
    // handling has switched the panel — so identity and timing both need
    // handling downstream: extractFromMarker can't identify a no-photo
    // account at all, and even when it can, the panel it's reading from may
    // still be showing the *previous* profile. triggerInjection's immediate
    // attempt + retry loop, and tryInjectIntoScreen's URL resolution, cover
    // both.
    const selection = extractFromMarker(marker);
    log(
      selection ? "marker clicked" : "marker clicked but no id in its image — resolving from URL",
      selection ?? marker,
    );
    triggerInjection(selection);
  },
  true,
);

if (document.body) {
  startObserving();
} else {
  document.addEventListener("DOMContentLoaded", startObserving, { once: true });
}

// Landing directly on a profile URL (deep link, hard refresh) shows that
// profile's panel without any marker click ever firing.
const initialProfileUserId = extractUserIdFromProfilePath(location.pathname);
if (initialProfileUserId) {
  const initialSelection: ProfileSelection = {
    userId: initialProfileUserId,
    profilePicUrl: null,
  };
  log("initial page load on a profile URL", initialSelection);
  triggerInjection(
    initialSelection,
    INITIAL_LOAD_REINJECT_RETRY_WINDOW_MS,
    INITIAL_LOAD_REINJECT_RETRY_INTERVAL_MS,
  );
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
