import { createLogger } from "./log.js";
import { HIDE_PHOTO_BUTTON_SELECTOR, PHOTO_MESSAGE_SELECTOR } from "./sniffies-selectors.js";
import type { SentPhotoHider } from "./sent-photos.js";

const log = createLogger("hide-photo");

const MESSAGE_ID_PREFIX = "message-";

/** The message `_id` of the photo a "Hide Photo" button belongs to, read off the photo container's id. */
const messageIdFor = (button: Element): string | null => {
  const photo = button.closest(PHOTO_MESSAGE_SELECTOR);
  const id = photo?.querySelector(`[id^="${MESSAGE_ID_PREFIX}"]`)?.id;
  return id ? id.slice(MESSAGE_ID_PREFIX.length) : null;
};

/**
 * Takes over clicks on "Hide Photo" button, which is paywalled: the click is
 * swallowed before Sniffies' handler runs and the hide request is made directly.
 * After a successful hide the page reloads, since Sniffies only shows hidden state on load.
 */
export const installHidePhotoClick = (
  hider: Pick<SentPhotoHider, "hideOne">,
  reload: () => void = () => location.reload(),
): (() => void) => {
  const handler = (event: MouseEvent): void => {
    if (!(event.target instanceof Element)) {
      return;
    }
    const button = event.target.closest(HIDE_PHOTO_BUTTON_SELECTOR);
    const messageId = button && messageIdFor(button);
    if (!button || !messageId) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    log("hiding photo", messageId);
    void hider.hideOne(messageId).then((error) => {
      if (error) {
        log.warn("couldn't hide photo:", error);
        return;
      }
      // Sniffies won't re-render hidden state from our call, so reload to show it.
      reload();
    });
  };

  document.addEventListener("click", handler, true);
  return () => document.removeEventListener("click", handler, true);
};
