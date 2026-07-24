export type ClientType = "chrome-client" | "userscript";

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
  const { serverBase, clientSecret, userId, clientType, version } = options;
  if (!serverBase || !userId) {
    console.log("[sniffies-log-init] skipping, missing serverBase or userId", {
      serverBase,
      userId,
    });
    return;
  }
  console.log("[sniffies-log-init] sending init ping", { userId, clientType, version });
  try {
    const res = await fetch(`${serverBase}/api/logInit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${clientSecret}`,
      },
      body: JSON.stringify({ userId, clientType, version }),
    });
    if (res.ok) {
      console.log("[sniffies-log-init] init ping sent");
    } else {
      console.error("[sniffies-log-init] init ping rejected", res.status);
    }
  } catch (err) {
    // Best-effort — network/server failures are not actionable here.
    console.error("[sniffies-log-init] init ping failed", err);
  }
};
