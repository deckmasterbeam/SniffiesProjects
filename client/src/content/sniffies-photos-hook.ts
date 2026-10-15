import {
  installHidePhotoClick,
  installHidePhotoMenuButtons,
  installSentPhotoHider,
} from "@sniffies-projects/core";

(() => {
  let ownUserId = "";
  // Off until the relay reports the stored setting.
  let enabled = false;
  const isEnabled = (): boolean => enabled;

  installHidePhotoClick(
    installSentPhotoHider(() => ownUserId),
    isEnabled,
  );
  installHidePhotoMenuButtons(isEnabled);

  window.addEventListener("message", (event) => {
    if (event.source !== window) {
      return;
    }
    const msg = event.data as Record<string, unknown> | null;
    if (msg?.source === "sniffies-user-id-hook" && typeof msg.userId === "string") {
      ownUserId = msg.userId;
    } else if (msg?.source === "sniffies-bot-block-relay") {
      enabled = msg.premiumFeaturesEnabled === true;
    }
  });
})();
