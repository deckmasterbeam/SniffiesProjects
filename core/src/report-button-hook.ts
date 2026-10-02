import type { MarkerSelection, ReportButtonInjectionOptions } from "./contracts.js";
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
  PROFILE_OPTIONS_MENU_SELECTOR,
} from "./sniffies-selectors.js";

const log = createLogger("report-button");
const REPORT_INJECTED_ATTR = "data-sniffies-report-injection";
const REPORT_BUTTON_LABEL = "Sniffies Project: Report";
const REPORT_MODAL_ROOT_ID = "snp-report-root";

const CLICK_REINJECT_RETRY_WINDOW_MS = 1000;
const CLICK_REINJECT_RETRY_INTERVAL_MS = 100;

const INITIAL_LOAD_REINJECT_RETRY_WINDOW_MS = 3000;
const INITIAL_LOAD_REINJECT_RETRY_INTERVAL_MS = 300;

const extractUserIdFromUrl = (url: string): string | null => {
  try {
    const parsed = new URL(url);
    const first = parsed.pathname.split("/").filter(Boolean)[0];
    return first && /^[a-f0-9]{16,}$/i.test(first) ? first : null;
  } catch {
    return null;
  }
};

// Matches /profile/<id>
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

  const currentProfileUserId = (): string | null =>
    extractUserIdFromProfilePath(location.pathname) ?? lastUserId;

  // Clones one of the menu's own buttons
  const buildReportButton = (template: HTMLButtonElement): HTMLButtonElement => {
    const btn = template.cloneNode(true) as HTMLButtonElement;
    btn.removeAttribute("data-testid");
    btn.setAttribute(REPORT_INJECTED_ATTR, "");
    btn.title = "Report as suspected bot";
    const label = btn.querySelector("span") ?? btn;
    const icon = label.querySelector("i");
    label.textContent = REPORT_BUTTON_LABEL;
    if (icon) {
      icon.className = icon.className.replace(/\bfa-\S+/, "fa-flag");
      label.prepend(icon);
    }
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      if (!options.getReporterUserId()) {
        log.warn("no sniffies user id observed yet — cannot report");
        return;
      }

      const userId = currentProfileUserId();
      if (!userId) {
        log.warn("no profile id resolved — cannot report");
        return;
      }
      reportTarget = userId;
      ensureReportModal().open();
    });
    return btn;
  };

  const mountReportButton = (menu: Element): void => {
    const template = menu.querySelector<HTMLButtonElement>("button:last-of-type");
    if (!template || menu.querySelector(`[${REPORT_INJECTED_ATTR}]`)) {
      return;
    }
    menu.append(buildReportButton(template));
  };

  const resolveProfile = (): void => {
    const screen = document.querySelector(APP_SCREEN_SELECTOR);
    const userId = currentProfileUserId();
    if (screen && userId) {
      options.onProfileResolved?.(screen, userId);
    }
  };

  const resolveProfileWithRetries = (windowMs: number, intervalMs: number): void => {
    if (!options.onProfileResolved) {
      return;
    }
    selectionGeneration += 1;
    const generation = selectionGeneration;
    const deadline = performance.now() + windowMs;
    const attempt = (): void => {
      if (generation !== selectionGeneration) {
        return;
      }
      resolveProfile();
      if (performance.now() < deadline) {
        setTimeout(attempt, intervalMs);
      }
    };
    attempt();
  };

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (!(node instanceof HTMLElement)) {
          continue;
        }
        const menu = node.matches(PROFILE_OPTIONS_MENU_SELECTOR)
          ? node
          : node.querySelector(PROFILE_OPTIONS_MENU_SELECTOR);
        if (menu && options.reportingEnabled) {
          mountReportButton(menu);
        }
        if (
          node.matches(`${NAME_LABEL_SELECTOR}, ${PIN_BUTTON_SELECTOR}`) ||
          node.querySelector(`${NAME_LABEL_SELECTOR}, ${PIN_BUTTON_SELECTOR}`)
        ) {
          resolveProfile();
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

      const selection = extractFromMarker(marker);
      options.onMarkerClick?.(marker, selection);
      log(
        selection ? "marker clicked" : "marker clicked but no id in its image — resolving from URL",
        selection ?? marker,
      );
      if (selection) {
        lastUserId = selection.userId;
      }
      resolveProfileWithRetries(CLICK_REINJECT_RETRY_WINDOW_MS, CLICK_REINJECT_RETRY_INTERVAL_MS);
    },
    true,
  );

  if (document.body) {
    startObserving();
  } else {
    document.addEventListener("DOMContentLoaded", startObserving, { once: true });
  }

  const initialProfileUserId = extractUserIdFromProfilePath(location.pathname);
  if (initialProfileUserId) {
    log("initial page load on a profile URL", initialProfileUserId);
    resolveProfileWithRetries(
      INITIAL_LOAD_REINJECT_RETRY_WINDOW_MS,
      INITIAL_LOAD_REINJECT_RETRY_INTERVAL_MS,
    );
  }
};

const fetchBlockedBots = async (
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
