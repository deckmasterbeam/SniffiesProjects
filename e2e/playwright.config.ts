import { defineConfig, devices } from "@playwright/test";

const AUTH_FILE = ".auth/user.json";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  // "list" alone leaves nothing to inspect after a failure — the html report
  // bundles the trace/screenshot/video captured below into one browsable,
  // shareable file (`playwright-report/index.html`), viewable via
  // `npx playwright show-report`.
  reporter: [["list"], ["html", { open: "never" }]],
  timeout: 60_000,
  use: {
    // Kept only for a failing test, since these are meaningless on a pass and
    // "on" would blow up storage on a suite that mostly fails while the flow
    // is still being tuned against the live site.
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      // Captures a real logged-in session via manual login (see auth.setup.ts) —
      // never run headless, there's no automated login to wait on.
      name: "setup",
      testMatch: /auth\.setup\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      // The live drift canary — see e2e/README.md. Deliberately not part of any
      // default `playwright test` run; invoke with `--project=canary`.
      //
      // Deliberately NOT wired up via `dependencies: ["setup"]` — Playwright
      // re-runs a project's dependencies on every single invocation, which
      // would force the manual, page.pause()-gated login in auth.setup.ts to
      // block every canary run, defeating the whole point of capturing a
      // session once and reusing it. Run `yarn auth:capture` yourself
      // whenever the saved session is missing or has expired; canary just
      // loads it from AUTH_FILE below. If AUTH_FILE doesn't exist, Playwright
      // fails fast with a clear ENOENT on that path — that's your signal to
      // run auth:capture, not a bug.
      name: "canary",
      testDir: "./tests/canary",
      use: {
        ...devices["Desktop Chrome"],
        storageState: AUTH_FILE,
      },
    },
    {
      // Fixture-based Chrome extension tests — PLAYWRIGHT_TESTING_TODO.md §0
      // onward. No `use: devices[...]` here: tests import `test`/`expect`
      // from fixtures/extension.ts, whose custom `context` fixture launches
      // Chromium itself (chromium.launchPersistentContext with
      // --load-extension) rather than using Playwright's default browser
      // launch, so most project-level `use` options wouldn't apply anyway.
      name: "extension",
      testDir: "./tests/extension",
    },
    {
      // Fixture-based userscript tests — "direct injection" loading strategy,
      // see fixtures/userscript.ts. Uses Playwright's normal browser launch
      // (unlike "extension", no persistent context / --load-extension
      // needed), so devices["Desktop Chrome"] applies here.
      name: "userscript",
      testDir: "./tests/userscript",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
