import { createLogger } from "./log.js";

export type ClientType = "chrome-client" | "bookmarklet";

export interface LogInitOptions {
  serverBase: string;
  clientSecret: string;
  userId: string;
  clientType: ClientType;
  version: string;
}

/**
 * Best-effort telemetry ping fired once per client init, so the server can
 * track which user ids are running which client/version combinations.
 * Failures are swallowed — telemetry must never block or break the caller.
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
    // Best-effort — network/server failures are not actionable here.
    log.error("init ping failed", err);
  }
};
