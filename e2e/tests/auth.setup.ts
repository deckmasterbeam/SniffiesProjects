import { test as setup } from "@playwright/test";

const AUTH_FILE = ".auth/user.json";

// Captures a real logged-in Sniffies session for the "canary" project to
// reuse — deliberately via manual login, not scripted credentials. Run
// headed (`yarn auth:capture`, i.e. `playwright test --project=setup
// --headed`): a Playwright Inspector window opens paused on page.pause() —
// log in yourself in that browser window, then click "Resume" in the
// Inspector. The resulting session (cookies/localStorage) is written to
// AUTH_FILE and picked up by every "canary" test via storageState.
//
// Re-run this whenever the saved session expires (canary tests will start
// looking logged-out / redirecting to a login screen).
setup("authenticate", async ({ page }) => {
  setup.setTimeout(5 * 60_000);
  await page.goto("https://sniffies.com/");
  await page.pause();
  await page.context().storageState({ path: AUTH_FILE });
});
