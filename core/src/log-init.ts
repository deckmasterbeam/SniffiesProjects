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
    return;
  }
  try {
    await fetch(`${serverBase}/api/logInit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${clientSecret}`,
      },
      body: JSON.stringify({ userId, clientType, version }),
    });
  } catch {
    // Best-effort — network/server failures are not actionable here.
  }
};
