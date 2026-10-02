import type { LogInitOptions } from "./contracts.js";
import { createLogger } from "./log.js";

/**
 * Telemetry ping fired once per client init so the server can track which user ids are running which version
 */
export const logInit = async (options: LogInitOptions): Promise<void> => {
  const log = createLogger("log-init");
  const { serverBase, clientSecret, userId, clientType, version } = options;
  if (!serverBase || !userId) {
    log("skipping, missing serverBase or userId", { serverBase, userId });
    return;
  }
  log("sending init ping", { userId, clientType, version });
  try {
    const base = serverBase.replace(/\/+$/, "");
    const res = await fetch(`${base}/api/logInit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${clientSecret}`,
      },
      body: JSON.stringify({ userId, clientType, version }),
    });
    if (res.ok) {
      log("init ping sent");
    } else {
      log.error("init ping rejected", res.status);
    }
  } catch (err) {
    log.error("init ping failed", err);
  }
};
