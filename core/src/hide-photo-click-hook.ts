import { createLogger } from "./log.js";
import {
  HIDE_ALL_PHOTOS_BUTTON_SELECTOR,
  HIDE_PHOTO_BUTTON_SELECTOR,
  PHOTO_MESSAGE_SELECTOR,
  UNHIDE_ALL_PHOTOS_BUTTON_SELECTOR,
} from "./sniffies-selectors.js";
import type { SentPhotoHider } from "./sent-photos.js";

const log = createLogger("hide-photo");

const MESSAGE_ID_PREFIX = "message-";

/** The message `_id` of the photo a "Hide Photo" button belongs to, read off the photo container's id. */
const messageIdFor = (button: Element): string | null => {
  const photo = button.closest(PHOTO_MESSAGE_SELECTOR);
  const id = photo?.querySelector(`[id^="${MESSAGE_ID_PREFIX}"]`)?.id;
  return id ? id.slice(MESSAGE_ID_PREFIX.length) : null;
};

/** The profile that is open: /profile/<id>[/chat]. */
const openProfileId = (): string | null =>
  location.pathname.match(/^\/profile\/([a-f0-9]{16,})/i)?.[1] ?? null;

/**
 * Takes over clicks on Sniffies' paywalled photo-hiding buttons: "Hide Photo" on one photo, and
 * "Hide All My Photos" / "Unhide All My Photos" in the profile menu. The click is swallowed
 * before Sniffies' handler runs and the request is made directly. After a success the page
 * reloads, since Sniffies only shows hidden state on load.
 */
export const installHidePhotoClick = (
  hider: Pick<SentPhotoHider, "hideOne" | "setAllHidden">,
  isEnabled: () => boolean,
  reload: () => void = () => location.reload(),
  onError: (message: string) => void = (message) => window.alert(message),
): (() => void) => {
  const resolve = (target: Element): (() => Promise<string | null>) | null => {
    const hideOne = target.closest(HIDE_PHOTO_BUTTON_SELECTOR);
    const messageId = hideOne && messageIdFor(hideOne);
    if (messageId) {
      return () => hider.hideOne(messageId, openProfileId());
    }
    const profileId = openProfileId();
    if (profileId && target.closest(HIDE_ALL_PHOTOS_BUTTON_SELECTOR)) {
      return () => hider.setAllHidden(profileId, true);
    }
    if (profileId && target.closest(UNHIDE_ALL_PHOTOS_BUTTON_SELECTOR)) {
      return () => hider.setAllHidden(profileId, false);
    }
    return null;
  };

  const handler = (event: MouseEvent): void => {
    const action = isEnabled() && event.target instanceof Element ? resolve(event.target) : null;
    if (!action) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    void action().then((error) => {
      if (error) {
        log.warn("couldn't change photo visibility:", error);
        onError(error);
        return;
      }
      reload();
    });
  };

  document.addEventListener("click", handler, true);
  return () => document.removeEventListener("click", handler, true);
};
