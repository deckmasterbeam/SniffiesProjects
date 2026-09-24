// Injects a status line directly under Sniffies' own Travel Mode city search
// box, so both the general limitation (search-only capture) and any pending
// capture are visible right where the user is already looking — no need to
// open the extension's own panel to see either. Sniffies tears down and
// rebuilds this dialog every time Travel Mode opens, so re-injection is
// retried via MutationObserver, same pattern as report-button-hook.ts's
// injected report button.

import { CITIES_INPUT_SELECTOR } from "./sniffies-selectors.js";

const STATUS_ELEMENT_ID = "snp-city-search-status";

// Shown whenever nothing is pending — moving the map itself isn't
// observable to the extension (no capturable signal for a raw drag), only a
// search result or a real "Travel here" PUT are, so this sets expectations
// up front rather than leaving silent failure to be debugged after the fact.
const DEFAULT_NOTE_TEXT =
  'Location spoofing only picks up cities you search for here — moving the map before tapping "Travel here" won\'t be captured.';

const NOTE_STYLE = ["margin:6px 0 0", "padding:0", "font-size:11px", "color:#7a90a4"].join(";");

const PENDING_STYLE = [
  "margin:6px 0 0",
  "padding:0",
  "font-size:12px",
  "font-weight:600",
  "color:#ff5500",
].join(";");

export interface CitySearchStatusHandle {
  /** Shows a "captured, pending Travel Here confirmation" message. */
  showPending: (description: string) => void;
  /** Reverts to the default instructional note — e.g. once "Travel here" confirms it, or it's cleared. */
  clear: () => void;
}

/** Mounts a status/instructional message next to Sniffies' own Travel Mode city search box. */
export const installCitySearchStatusUI = (): CitySearchStatusHandle => {
  let pendingText: string | null = null;

  const findAnchor = (): Element | null => {
    const input = document.querySelector(CITIES_INPUT_SELECTOR);
    return input?.closest("cities-input") ?? null;
  };

  const render = (): void => {
    const anchor = findAnchor();
    if (!anchor) {
      return;
    }
    let el = document.getElementById(STATUS_ELEMENT_ID);
    if (!el) {
      el = document.createElement("p");
      el.id = STATUS_ELEMENT_ID;
      anchor.appendChild(el);
    }
    if (pendingText) {
      el.textContent = pendingText;
      el.setAttribute("style", PENDING_STYLE);
    } else {
      el.textContent = DEFAULT_NOTE_TEXT;
      el.setAttribute("style", NOTE_STYLE);
    }
  };

  // Re-render whenever the dialog re-renders (e.g. Travel Mode reopened)
  // and our element isn't there yet but should be.
  const observer = new MutationObserver(() => {
    if (!document.getElementById(STATUS_ELEMENT_ID)) {
      render();
    }
  });
  const startObserving = (): void => {
    observer.observe(document.body, { childList: true, subtree: true });
  };
  if (document.body) {
    startObserving();
    render();
  } else {
    document.addEventListener(
      "DOMContentLoaded",
      () => {
        startObserving();
        render();
      },
      { once: true },
    );
  }

  return {
    showPending: (description) => {
      pendingText = `Captured "${description}" — pending until you click "Travel here".`;
      render();
    },
    clear: () => {
      pendingText = null;
      render();
    },
  };
};
