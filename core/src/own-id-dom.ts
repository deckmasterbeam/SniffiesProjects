import { createLogger } from "./log.js";
import { OWN_MARKER_SELECTOR } from "./sniffies-selectors.js";

const log = createLogger("own-id-dom");

export const watchOwnIdInDom = (onUserId: (userId: string) => void): void => {
  const read = (): boolean => {
    const id = document.querySelector(OWN_MARKER_SELECTOR)?.id;
    if (id) {
      log("found own marker, user id", id);
      onUserId(id);
    }
    return !!id;
  };
  log("looking for own marker", OWN_MARKER_SELECTOR);
  if (read()) {
    return;
  }
  log("own marker not on the page yet, watching for it");
  const observer = new MutationObserver(() => {
    if (read()) {
      log("stopped watching");
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
};
