import { installHidePhotoClick, installSentPhotoHider } from "@sniffies-projects/core";

(() => {
  let ownUserId = "";
  installHidePhotoClick(installSentPhotoHider(() => ownUserId));

  window.addEventListener("message", (event) => {
    if (event.source !== window) {
      return;
    }
    const msg = event.data as Record<string, unknown> | null;
    if (msg?.source === "sniffies-user-id-hook" && typeof msg.userId === "string") {
      ownUserId = msg.userId;
    }
  });
})();
