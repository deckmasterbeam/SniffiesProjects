// Report-button injection into the Sniffies profile panel, the report modal,
// and the bot-blocking network filter. Direct MAIN-world port of the Chrome
// client's src/content/sniffies-profile-id.ts + sniffies-bot-block-hook.ts —
// the userscript runs entirely in the page's own world (no isolated-world
// relay needed, see user-id-logger.ts), so both install directly here rather
// than needing a postMessage bridge. Favorites/star injection is excluded —
// the userscript has no favorites feature.
//
// The panel-switch/deep-link/no-photo click-handling races below mirror ones
// found and fixed the hard way in the client (see TODO.md section 4) — this
// ports the fixed logic rather than re-deriving it, so consult that history
// before changing the retry scheduling.

import {
  createLogger,
  installBotBlockHook,
  wireReportModal,
  REPORT_MODAL_CSS,
  REPORT_MODAL_HTML,
  type ReportModalHandle,
  type BotBlockState,
  MARKER_AVATAR_SELECTOR as MARKER_SELECTOR,
  APP_SCREEN_SELECTOR,
  PIN_BUTTON_SELECTOR,
} from "@sniffies-projects/core";
import { CLIENT_SECRET, REPORTING_ENABLED, SERVER_BASE } from "./shared/env.js";
import {
  getBlockedBots,
  getBlockedBotsFetchedAt,
  getBotBlockingEnabled,
  recordBlockedBotEvent,
  setBlockedBots,
} from "./shared/settings.js";

const log = createLogger("report");
const REPORT_INJECTED_ATTR = "data-sniffies-report-injection";
const REPORT_MODAL_ROOT_ID = "snp-report-root";
const BLOCKED_BOTS_MAX_AGE_MS = 24 * 60 * 60 * 1000;

interface ApiBlockedBotsResponse {
  ok: boolean;
  userIds: string[];
}

export interface ReportFeatureState {
  currentSniffiesUserId: string;
  botBlockState: BotBlockState;
}

const clientHeaders = (): Record<string, string> => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${CLIENT_SECRET}`,
});

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

const extractUserIdFromMarker = (el: HTMLElement): string | null => {
  const bg = el.style.backgroundImage || getComputedStyle(el).backgroundImage;
  if (!bg || bg === "none") {
    return null;
  }
  const match = bg.match(/url\((['"]?)(.*?)\1\)/);
  const rawUrl = match?.[2];
  return rawUrl ? extractUserIdFromUrl(rawUrl) : null;
};

const installReportButtonInjection = (state: ReportFeatureState): void => {
  let lastUserId: string | null = null;
  // Bumped on every marker click / initial-load resolution, so a retry chain
  // can tell it's been superseded by a newer one and stop.
  let selectionGeneration = 0;
  let reportModal: ReportModalHandle | null = null;
  let reportTarget: string | null = null;

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
        reporterUserId: state.currentSniffiesUserId,
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
      if (!state.currentSniffiesUserId) {
        log.warn("no sniffies user id observed yet — cannot report");
        return;
      }
      reportTarget = userId;
      ensureReportModal().open();
    });
    return btn;
  };

  const injectReportButton = (screen: Element, userId: string): void => {
    const pinButton = screen.querySelector<HTMLElement>(PIN_BUTTON_SELECTOR);
    const controlsContainer = pinButton?.parentElement;
    if (!controlsContainer) {
      return;
    }
    const existing = controlsContainer.querySelector<HTMLElement>(`[${REPORT_INJECTED_ATTR}]`);
    if (existing) {
      if (existing.getAttribute(REPORT_INJECTED_ATTR) === userId) {
        return;
      }
      existing.remove();
    }
    controlsContainer.prepend(buildReportButton(userId));
  };

  // Re-resolves the id from the URL on every call (not just once at click
  // time) so it can override a stale or absent lastUserId — this is what
  // makes injection self-correct no matter which trigger below calls it,
  // including no-photo marker clicks that can't identify anyone themselves.
  const tryInjectIntoScreen = (screen: Element): void => {
    const urlUserId = extractUserIdFromProfilePath(location.pathname);
    if (urlUserId && lastUserId !== urlUserId) {
      lastUserId = urlUserId;
    }
    if (!lastUserId) {
      return;
    }
    injectReportButton(screen, lastUserId);
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

  const triggerInjection = (
    userId: string | null,
    windowMs: number = CLICK_REINJECT_RETRY_WINDOW_MS,
    intervalMs: number = CLICK_REINJECT_RETRY_INTERVAL_MS,
  ): void => {
    selectionGeneration += 1;
    if (userId) {
      lastUserId = userId;
    }
    const screen = document.querySelector(APP_SCREEN_SELECTOR);
    if (screen) {
      tryInjectIntoScreen(screen);
    }
    scheduleReinjectionRetries(selectionGeneration, windowMs, intervalMs);
  };

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (!(node instanceof HTMLElement)) {
          continue;
        }
        const matchesPinButton =
          node.matches?.(PIN_BUTTON_SELECTOR) || !!node.querySelector?.(PIN_BUTTON_SELECTOR);
        if (!matchesPinButton) {
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
      const marker = target.closest<HTMLElement>(MARKER_SELECTOR);
      if (!marker) {
        return;
      }
      const userId = extractUserIdFromMarker(marker);
      log(
        userId ? "marker clicked" : "marker clicked but no id in its image — resolving from URL",
        userId ?? marker,
      );
      triggerInjection(userId);
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
    log("initial page load on a profile URL", initialProfileUserId);
    triggerInjection(
      initialProfileUserId,
      INITIAL_LOAD_REINJECT_RETRY_WINDOW_MS,
      INITIAL_LOAD_REINJECT_RETRY_INTERVAL_MS,
    );
  }
};

/**
 * Installs the bot-block network hook (always, mirroring the Chrome client's
 * MAIN-world hook script) and, if REPORTING_ENABLED, the report-button
 * injection machinery above. Returns the mutable state object — the caller
 * wires currentSniffiesUserId from installUserIdLogging's callback, and the
 * bot-block panel UI reads/writes botBlockState directly.
 */
export const installReportFeature = (): ReportFeatureState => {
  const state: ReportFeatureState = {
    currentSniffiesUserId: "",
    botBlockState: { blockedIds: new Set(getBlockedBots()), enabled: getBotBlockingEnabled() },
  };

  installBotBlockHook(
    () => state.botBlockState,
    (ids) => recordBlockedBotEvent(ids),
  );

  if (REPORTING_ENABLED) {
    installReportButtonInjection(state);
  }

  return state;
};

const fetchBlockedBots = async (state: ReportFeatureState): Promise<void> => {
  if (!SERVER_BASE) {
    return;
  }
  try {
    const res = await fetch(`${SERVER_BASE}/api/blocked-bots`, { headers: clientHeaders() });
    if (!res.ok) {
      return;
    }
    const data = (await res.json()) as ApiBlockedBotsResponse;
    const userIds = data.userIds ?? [];
    setBlockedBots(userIds, Date.now());
    state.botBlockState = { ...state.botBlockState, blockedIds: new Set(userIds) };
  } catch (err) {
    log.error("fetchBlockedBots failed", err);
  }
};

export const refreshBlockedBotsIfStale = (state: ReportFeatureState): void => {
  if (!REPORTING_ENABLED) {
    return;
  }
  if (Date.now() - getBlockedBotsFetchedAt() > BLOCKED_BOTS_MAX_AGE_MS) {
    void fetchBlockedBots(state);
  }
};
