// Shared report-button injection: finds the current profile panel, injects a
// 🚩 button next to the pin button, and wires it to the report modal. Used
// identically by the Chrome client (client/src/content/sniffies-profile-id.ts)
// and the userscript (userscript/src/report.ts) — previously each ported this
// machinery by hand, including the panel-switch race handling documented in
// TODO.md section 4 (a click-triggered panel switch races Sniffies' own
// click handling, and a no-photo marker can't identify itself from its image
// alone), which is exactly the kind of fix that's easy to silently lose in
// one copy while fixing the other.
//
// The Chrome client also drives its favorites-star injection off the same
// panel-resolution/retry machinery (independent of REPORTING_ENABLED, since
// favorites is a separate flag) — `onProfileResolved` and `onMarkerClick`
// exist for that one real difference, not speculative extensibility.

import { createLogger } from "./log.js";
import {
  REPORT_MODAL_HTML,
  REPORT_MODAL_CSS,
  wireReportModal,
  type ReportModalHandle,
} from "./report-ui.js";
import {
  MARKER_AVATAR_SELECTOR as MARKER_SELECTOR,
  APP_SCREEN_SELECTOR,
  NAME_LABEL_SELECTOR,
  PIN_BUTTON_SELECTOR,
} from "./sniffies-selectors.js";

const log = createLogger("report-button");
const REPORT_INJECTED_ATTR = "data-sniffies-report-injection";
const REPORT_MODAL_ROOT_ID = "snp-report-root";

const CLICK_REINJECT_RETRY_WINDOW_MS = 1000;
const CLICK_REINJECT_RETRY_INTERVAL_MS = 100;

const INITIAL_LOAD_REINJECT_RETRY_WINDOW_MS = 3000;
const INITIAL_LOAD_REINJECT_RETRY_INTERVAL_MS = 300;

export interface MarkerSelection {
  userId: string;
  profilePicUrl: string | null;
}

export interface ReportButtonInjectionOptions {
  serverBase: string;
  getAuthHeaders: () => Record<string, string>;
  reportingEnabled: boolean;
  /** The current user's own Sniffies id. Empty means "not observed yet". */
  getReporterUserId: () => string;
  /**
   * Fired every time the current profile panel is (re-)resolved (a marker
   * click, a deep-link load, or the MutationObserver catching up) with the
   * screen element and the resolved user id, just before the report button
   * is (re)inserted. Lets a consumer inject additional per-profile UI into
   * the same panel (like a favorites star).
   */
  onProfileResolved?: (screen: Element, userId: string) => void;
  /**
   * Fired on every marker click with the raw marker element and whatever was
   * extracted from its background-image (null for a no-photo account, which
   * this hook still resolves via the URL). Lets a consumer pull additional
   * data off the marker itself without re-parsing it (the Chrome client
   * reads `profilePicUrl` for a favorite's payload).
   */
  onMarkerClick?: (marker: HTMLElement, selection: MarkerSelection | null) => void;
}

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

const extractFromMarker = (el: HTMLElement): MarkerSelection | null => {
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

export const installReportButtonInjection = (options: ReportButtonInjectionOptions): void => {
  let lastUserId: string | null = null;
  // Bumped on every marker click / initial-load resolution. A retry chain
  // captures the value at schedule time so it can tell it's been superseded
  // by a newer click and stop.
  let selectionGeneration = 0;
  let reportModal: ReportModalHandle | null = null;
  let reportTarget: string | null = null;

  const submitReport = async (reportedUserId: string, message: string): Promise<void> => {
    if (!options.serverBase) {
      throw new Error("server not configured");
    }
    const res = await fetch(`${options.serverBase}/api/report`, {
      method: "POST",
      headers: options.getAuthHeaders(),
      body: JSON.stringify({
        reportType: "bot_suspected",
        reportedUserId,
        reporterUserId: options.getReporterUserId(),
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
      if (!options.getReporterUserId()) {
        log.warn("no sniffies user id observed yet — cannot report");
        return;
      }
      reportTarget = userId;
      ensureReportModal().open();
    });
    return btn;
  };

  const injectReportButton = (screen: Element, userId: string): void => {
    if (!options.reportingEnabled) {
      return;
    }
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
    options.onProfileResolved?.(screen, lastUserId);
    injectReportButton(screen, lastUserId);
  };

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
  // `userId` may be null (e.g. a no-photo marker click) since
  // tryInjectIntoScreen can resolve the id from the URL on its own.
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
    // No lastUserId guard here: tryInjectIntoScreen resolves the id from the
    // URL itself, which matters when the very first profile ever viewed has
    // no photo (no click-derived selection to fall back on either).
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

      const marker = target.closest<HTMLElement>(MARKER_SELECTOR);
      if (!marker) {
        return;
      }
      // This listener runs in the capture phase, before Sniffies' own click
      // handling has switched the panel — so identity and timing both need
      // handling downstream: extractFromMarker can't identify a no-photo
      // account at all, and even when it can, the panel it's reading from
      // may still be showing the *previous* profile. triggerInjection's
      // immediate attempt + retry loop, and tryInjectIntoScreen's URL
      // resolution, cover both.
      const selection = extractFromMarker(marker);
      options.onMarkerClick?.(marker, selection);
      log(
        selection ? "marker clicked" : "marker clicked but no id in its image — resolving from URL",
        selection ?? marker,
      );
      triggerInjection(selection?.userId ?? null);
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

/** Shared 24h staleness check + fetch for the client's cached "blocked bots" list. */
export const fetchBlockedBots = async (
  serverBase: string,
  getAuthHeaders: () => Record<string, string>,
  onResult: (userIds: string[], fetchedAt: number) => void,
): Promise<void> => {
  if (!serverBase) {
    return;
  }
  try {
    const res = await fetch(`${serverBase}/api/blocked-bots`, { headers: getAuthHeaders() });
    if (!res.ok) {
      return;
    }
    const data = (await res.json()) as { ok: boolean; userIds: string[] };
    onResult(data.userIds ?? [], Date.now());
  } catch (err) {
    log.error("fetchBlockedBots failed", err);
  }
};

const BLOCKED_BOTS_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export const refreshBlockedBotsIfStale = (
  blockedBotsFetchedAt: number,
  serverBase: string,
  getAuthHeaders: () => Record<string, string>,
  onResult: (userIds: string[], fetchedAt: number) => void,
): void => {
  if (Date.now() - blockedBotsFetchedAt > BLOCKED_BOTS_MAX_AGE_MS) {
    void fetchBlockedBots(serverBase, getAuthHeaders, onResult);
  }
};
