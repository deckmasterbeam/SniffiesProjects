import { createLogger } from "./log.js";
import {
  HIDE_ALL_PHOTOS_BUTTON_SELECTOR,
  PROFILE_OPTIONS_MENU_SELECTOR,
  UNHIDE_ALL_PHOTOS_BUTTON_SELECTOR,
} from "./sniffies-selectors.js";

const log = createLogger("hide-photo-menu");

const INJECTED_ATTR = "data-sniffies-photos-injection";
const REPORT_INJECTED_ATTR = "data-sniffies-report-injection";

const MENU_BUTTONS = [
  {
    selector: HIDE_ALL_PHOTOS_BUTTON_SELECTOR,
    testId: "hideAllPhotosButton",
    label: "Hide All My Photos",
    icon: "fa-eye-slash",
  },
  {
    selector: UNHIDE_ALL_PHOTOS_BUTTON_SELECTOR,
    testId: "unhideAllPhotosButton",
    label: "Unhide All My Photos",
    icon: "fa-eye",
  },
] as const;

/** Clones one of the menu's own buttons, so it picks up Sniffies' styling. */
const buildButton = (
  template: HTMLButtonElement,
  { testId, label, icon }: (typeof MENU_BUTTONS)[number],
): HTMLButtonElement => {
  const btn = template.cloneNode(true) as HTMLButtonElement;
  btn.removeAttribute(REPORT_INJECTED_ATTR);
  btn.removeAttribute("title");
  // The same test id as Sniffies' own button, so installHidePhotoClick takes the click over.
  btn.setAttribute("data-testid", testId);
  btn.setAttribute(INJECTED_ATTR, "");
  const span = btn.querySelector("span") ?? btn;
  const iconEl = span.querySelector("i");
  span.textContent = label;
  if (iconEl) {
    iconEl.className = iconEl.className.replace(/\bfa-\S+/, icon);
    span.prepend(iconEl);
  }
  return btn;
};

const mountButtons = (menu: Element): void => {
  const template = menu.querySelector<HTMLButtonElement>(
    `button:not([${INJECTED_ATTR}]):not([${REPORT_INJECTED_ATTR}])`,
  );
  if (!template) {
    return;
  }
  for (const spec of MENU_BUTTONS) {
    // Paid accounts already have Sniffies' own button.
    if (!menu.querySelector(spec.selector)) {
      menu.append(buildButton(template, spec));
      log("added", spec.label);
    }
  }
};

/**
 * Adds Hide All My Photos / Unhide All My Photos to the profile options menu when Sniffies didn't
 * render them (free accounts). The clicks are handled by installHidePhotoClick.
 */
export const installHidePhotoMenuButtons = (isEnabled: () => boolean): (() => void) => {
  const observer = new MutationObserver((mutations) => {
    if (!isEnabled()) {
      return;
    }
    for (const { addedNodes } of mutations) {
      for (const node of addedNodes) {
        if (!(node instanceof HTMLElement)) {
          continue;
        }
        const menu = node.matches(PROFILE_OPTIONS_MENU_SELECTOR)
          ? node
          : node.querySelector(PROFILE_OPTIONS_MENU_SELECTOR);
        if (menu) {
          mountButtons(menu);
        }
      }
    }
  });
  const start = (): void => observer.observe(document.body, { childList: true, subtree: true });
  if (document.body) {
    start();
  } else {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  }
  return () => observer.disconnect();
};
