import type { BrowserContext } from "@playwright/test";
import { CLIENT_SERVER_BASE } from "./client-env.js";

/**
 * Stubs every server/api endpoint the extension calls, so tests never hit a
 * real (or even local dev) server — see PLAYWRIGHT_TESTING_TODO.md §0's
 * "Server stubbing" item. Register this once per test via the `context`
 * fixture; override a specific route afterward (`context.route(...)` again
 * with the same pattern) in an individual test that needs different
 * behavior, e.g. a failure response.
 */
export const mockServerApis = async (context: BrowserContext): Promise<void> => {
  await context.route(`${CLIENT_SERVER_BASE}/api/report`, (route) =>
    route.fulfill({ json: { ok: true } }),
  );
  await context.route(`${CLIENT_SERVER_BASE}/api/blocked-bots`, (route) =>
    route.fulfill({ json: { ok: true, userIds: [] } }),
  );
  await context.route(`${CLIENT_SERVER_BASE}/api/favorites*`, (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({ json: { ok: true, favorites: [] } });
    }
    return route.fulfill({ json: { ok: true } });
  });
  await context.route(`${CLIENT_SERVER_BASE}/api/save-number`, (route) =>
    route.fulfill({ json: { ok: true, guid: "test-guid" } }),
  );
  await context.route(`${CLIENT_SERVER_BASE}/api/send-guid`, (route) =>
    route.fulfill({ json: { ok: true } }),
  );
};
