import { OWN_MARKER_SELECTOR } from "./sniffies-selectors.js";

export const watchOwnIdInDom = (onUserId: (userId: string) => void): void => {
  const read = (): boolean => {
    const id = document.querySelector(OWN_MARKER_SELECTOR)?.id;
    if (id) {
      onUserId(id);
    }
    return !!id;
  };
  if (read()) {
    return;
  }
  const observer = new MutationObserver(() => {
    if (read()) {
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
};
