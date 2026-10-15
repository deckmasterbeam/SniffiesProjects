import { installPlusHook, installUserIdHook, createLogger } from "@sniffies-projects/core";

(() => {
  const log = createLogger("user-id");

  const installed = installUserIdHook((userId) => {
    log("user id observed", userId);
    window.postMessage({ source: "sniffies-user-id-hook", userId }, "*");
  });

  installPlusHook((hasPlus) => {
    log("plus membership observed", hasPlus);
    window.postMessage({ source: "sniffies-plus-hook", hasPlus }, "*");
  });

  if (installed) {
    log("user id hook installed");
  }
})();
