# Playwright E2E Testing — TODO

Goal: end-to-end coverage of the Chrome extension (`client/`) and the userscript (`userscript/`)
that the existing Vitest unit tests can't reach — real DOM injection, `chrome.storage`
round-trips, XHR/WebSocket patching against actual network traffic, and the popup/options/settings
extension pages. Lives in `e2e/` — see `e2e/README.md` for setup and how to run things.

---

## 0. Test harness (blocking prerequisites)

- [x] **Fixture page DOM shapes.** `e2e/fixtures/sniffies-mock.html` reproduces the marker-click →
      panel-open flow (`markerUserContainer`, `cv-marker-avatar-image`, `#app-screen`,
      `cruiserNameLabel`, `pinUserButton`, `Sitelinks` nav), including a deliberately async
      panel render (`setTimeout`) to exercise `sniffies-profile-id.ts`'s retry/poll logic for real.
  - [ ] **Fake XHR/WS endpoints for bot-block-hook.ts** — not built yet. Needed once §3 (bot
        blocking) is tackled: the four surfaces in `core/src/bot-block-hook.ts`
        (`post-authentication`, `chat-data`, `messages`, the `prod.ws.sniffies.com` WebSocket).
- [x] **Chrome extension loading.** `e2e/fixtures/extension.ts` — `chromium.launchPersistentContext`
      with `--load-extension`/`--disable-extensions-except` pointed at `client/dist`, waits for the
      MV3 service worker to get the extension id. Routes `https://sniffies.com/**` to the fixture
      HTML via `context.route(...).fulfill(...)` — this is what lets the real content scripts
      (matched by the browser against the real manifest host pattern) inject against fixture content
      without any request ever leaving the machine. Proven working end-to-end by
      `e2e/tests/extension/smoke.spec.ts` (2 passing tests: marker click → panel → report button →
      submit round trip; and the profile-border redirect for an out-of-radius marker).
- [x] **Userscript loading strategy — direct injection.** `e2e/fixtures/userscript.ts` —
      `page.addInitScript({ content })` with the exact built `userscript/dist/sniffies-tools.user.js`,
      run against the same shared `sniffies-mock.html` fixture the extension tests use. Safe because
      the userscript declares `@grant none` and only touches plain `localStorage`/DOM/fetch/
      geolocation — no GM_* APIs a real manager would need to polyfill, so this is a faithful stand-in
      for what a manager would do at `@run-at document-start`. Proven working end-to-end by
      `e2e/tests/userscript/smoke.spec.ts` (2 passing tests, mirroring the extension's: FAB mounts →
      panel opens; and the profile-border redirect for an out-of-radius marker).
  - [ ] **Follow-up: a Tampermonkey-based smoke test** — load a real userscript manager extension
        into the same kind of persistent context as `extension.ts` and install the built `.user.js`
        through it, for at least one test that exercises the real install/match/run-at pipeline
        rather than assuming direct injection faithfully stands in for it. Not started; direct
        injection covers all feature-logic testing needs in the meantime.
- [x] **Server stubbing.** `e2e/fixtures/server-mocks.ts` — intercepts `report`, `favorites`,
      `save-number`, `send-guid`, `blocked-bots` via `context.route`, matched against
      `CLIENT_SERVER_BASE` (read live from `client/.env`'s `SERVER_BASE`, via
      `e2e/fixtures/client-env.ts`, so it can't silently drift from whatever the extension under
      test was actually built with). Wired into the `extension` fixture by default; overridable
      per-test. Exercised by the smoke test's report-submit assertion.
- [x] **Storage seeding/inspection helpers.** `e2e/fixtures/storage.ts` —
      `getExtensionStorage`/`setExtensionStorage`/`clearExtensionStorage`, routed through the
      background service worker (the only extension-privileged context guaranteed to exist without
      opening a page for it). Used by the smoke test to seed `sniffiesUserId` and
      `profileBorderOpen` directly instead of faking a WebSocket connect or clicking through UI.

---

## 0b. Drift detection against live sniffies.com

The fixture in §0 tests "does our code do the right thing given this input" — it can never tell us
whether that input still matches what real Sniffies sends, since the fixture is entirely under our
control and Sniffies isn't. This already happened once silently (the API hostname changed between
two HAR captures an hour apart — see `TODO.md`'s bot-block section). This is a deliberately separate,
non-gating suite: it never asserts business logic, only "does this shape still exist," and it's run
manually/on a schedule, not on every push, since it depends on a live third-party site and a real
account.

- [x] **`e2e/` package scaffolded** — `@playwright/test`, a `setup` project that captures an
      authenticated session, and a `canary` project that reuses it. See `e2e/README.md`.
- [x] **Manual-auth pattern, not scripted login.** `e2e/tests/auth.setup.ts` opens a headed browser
      and calls `page.pause()` — a human logs in themselves in the Inspector, then resumes; the
      session is saved to `.auth/user.json` (gitignored) and reused by the canary tests. No
      password is ever typed by test code.
- [x] **Site contract — single source of truth.** `e2e/site-contract.ts` lists every DOM selector
      our extension code depends on existing on the real site, each with a description and which
      source file it came from, so the canary list can't quietly drift out of sync with what the
      code actually reads.
- [x] **Selector canary — confirmed green against the live site.** `e2e/tests/canary/live-selectors.spec.ts`
      checks the map has at least one visitor marker (`markerUserContainer`) and that clicking one
      opens a profile panel exposing `cruiserNameLabel` + `pinUserButton`. First live run surfaced a
      real bug: it asserted `toBeVisible()` on `markerUserContainer`, but that element is a
      zero-size positioning anchor by design (confirmed via console — `0x0` bounding box,
      `visibility:visible`) whose actual pixels come from an absolutely-positioned child; our code
      only ever does `.closest()` + reads data attributes off it, never needs it to have a layout
      box. Fixed by switching to `toBeAttached()` (presence, not visibility) and documented on the
      selector itself in `core/src/sniffies-selectors.ts` so it isn't re-broken by a future test.
      Also fixed a config bug found along the way: `canary`'s `dependencies: ["setup"]` forced the
      manual, `page.pause()`-gated login to re-run on every single invocation — removed.
- [ ] **Payload/schema canary — not started.** Same idea for the network shapes in
      `core/src/bot-block-hook.ts` (`nearbyVisitors.visitors[]._id`, `conversationData.conversations[]`,
      the WS `eventName`/`data` shapes). Either capture real XHR/WS traffic from the same
      authenticated session (via `page.route`/CDP) and assert field presence, or keep doing what's
      already worked once — pull a fresh HAR by hand and run a small script against it.
- [x] Use a dedicated test account, not a personal one — Sniffies has its own anti-bot detection
      (the thing this whole feature filters around), and repeated automated visits risk getting a
      real account flagged.

---

## 1. Geo override (location spoofing) — `core/src/geo-hook.ts`

- [ ] Enabling override in popup/panel makes `getCurrentPosition` return the spoofed coords on the
      fixture page.
- [ ] `watchPosition` subscribers get refreshed immediately when the override is saved while a
      watch is active (`refreshWatches`).
- [ ] Disabling override falls back to real/native coords.
- [ ] "Fill with current position" button uses the native (unpatched) geolocation call.
- [ ] Userscript-only: spoofed coords get patched into the outgoing
      `/api/visitor/current/location` fetch body (both the "last request re-sent" path and the
      "proactive PUT" path in `userscript/src/userscript.ts`).
- [ ] Persists across page reload (storage-backed) and updates live if changed while the tab is
      already open (extension: `storage.onChanged` → relay → `postMessage`).

## 2. Profile border / outside-geofence click — `core/src/profile-border-hook.ts`

- [ ] Clicking a marker with `data-within-radius="false"` navigates directly to `/profile/<id>`,
      bypassing the paywall handler (verify `stopImmediatePropagation` actually suppresses
      Sniffies' own handler — simulate a competing capture-phase listener in the fixture).
- [ ] `openInNewTab` true vs false changes `window.open` vs `location.assign`.
- [ ] Feature disabled → click falls through untouched.
- [ ] Marker with `data-within-radius="true"` (or missing) is never intercepted.

## 3. Bot blocking (XHR + WebSocket filtering) — `core/src/bot-block-hook.ts`

Explicitly called out in the source as untestable against live Sniffies, but fully testable
against a fixture that fakes the four surfaces:

- [ ] `POST .../api/post-authentication` — blocked ids removed from `nearbyVisitors.visitors` and
      `partialVisitorData`.
- [ ] `GET .../api/v2/post-authentication/chat-data` — blocked conversations/userIds/
      partialVisitorData removed.
- [ ] `GET .../api/messages` — blocked-author messages and partialUsers removed.
- [ ] Live WS frames (`userJoined`, `userUpdated`, `userAwake`, `userDisconnected`,
      `userRemoved`, `newMsg`) from a blocked id never reach a page-registered
      `addEventListener("message", …)` or `.onmessage` handler.
- [ ] API host variability: same path on two different `*.sniffies.com` hostnames both get
      filtered (regression test for the exact bug called out in the code comments).
- [ ] Toggling bot blocking off mid-session stops filtering new responses; toggling on filters
      again.
- [ ] Before the relay delivers real state (`enabled:false` default), responses pass through
      unfiltered — no race-condition false blocking.
- [ ] Filtered ids get recorded and the popup's "N bots blocked in the last 24 hours" count
      reflects them (ties to `core/src/blocked-bot-log.ts` day-bucket logic — including a
      day-boundary case).

## 4. Report button / report modal — `core/src/report-ui.ts`, `client/src/content/sniffies-profile-id.ts`

- [ ] 🚩 button is injected next to the pin button on a profile panel, only once (not duplicated
      on repeated mutation-observer fires).
- [ ] Report button does nothing until `currentSniffiesUserId` has been observed (no reporter id
      yet).
- [ ] Clicking opens the modal; submit posts
      `{reportType: "bot_suspected", reportedUserId, reporterUserId, message}` to `/api/report`
      and shows "Reported. Thanks." then auto-closes.
- [ ] Submit failure (mocked 500) shows "Failed to submit report" and re-enables the submit
      button.
- [ ] Cancel / backdrop click closes without submitting and clears `reportTarget`.
- [ ] `REPORTING_ENABLED` flag off → button never injected.
- [ ] Switching profiles while modal-adjacent state exists doesn't leak the previous
      `reportTarget`.

## 5. Blocked-bot account management (settings page) — `client/src/settings/settings.ts`

- [ ] Textarea round-trips a newline-separated list to `chrome.storage.local` blockedBots on Save.
- [ ] Validation: an invalid (non-24-char-hex) id blocks save and lists which entries were
      invalid; valid ids still get deduped.
- [ ] Server-fetched blocklist (`/api/blocked-bots`) populates storage on first load / when stale
      (>24h, per `refreshBlockedBotsIfStale`).
- [ ] "Reset to defaults" clears storage and the textarea reflects empty state after reload.
- [ ] Storage inspector table shows/hides and reflects current values, including after a reset.

## 6. Popup — `client/src/popup/popup.ts`

- [ ] Geo section, profile-border section, favorites section, bot-blocking section each remember
      open/closed state across popup reopen.
- [ ] Feature-flag gating: `FAVORITES_NOTIFICATIONS_ENABLED` / `REPORTING_ENABLED` off → checkbox
      disabled, "Coming soon!" hint, strikethrough label.
- [ ] Bot-blocking checkbox toggles `botBlockingEnabled` in storage.
- [ ] "Open settings" opens the full settings page in a new tab and closes the popup.
- [ ] Version badge shows `chrome.runtime.getManifest().version`.

## 7. Settings page — phone/recovery/favorites — `client/src/settings/settings.ts`

- [ ] Phone save rejects non-E.164 input inline; valid input POSTs to `/api/save-number`, stores
      phone + returned guid, then loads favorites.
- [ ] "Text me my code" requires a valid phone already entered; success/error states render.
- [ ] Pasting a recovery code saves it as guid and reloads favorites.
- [ ] Favorites grid renders cards from `/api/favorites`, empty-state message when none, and
      "Remove" unfavorites + re-renders.
- [ ] Network failure on any of the above shows the error text branch, not a silent failure.

## 8. Options page (legacy `enabled` toggle) — `client/src/options/options.ts`

- [ ] Loads current `chrome.storage.sync.enabled`, toggling and saving persists it and shows
      "Saved." — worth a quick pass since it's wired to `chrome.storage.sync` (different area
      than everything else, which is `.local`) — good candidate to confirm it's still
      intentionally separate and not dead.

## 9. Background service worker — `client/src/background/background.ts`

- [ ] `onInstalled` seeds `enabled`/`installedAt` into `storage.sync` without clobbering
      pre-existing values (upgrade path).
- [ ] `GET_SETTINGS` runtime message returns current sync settings.
- [ ] Content script `PING` → `PONG` round trip confirms the isolated-world content script is
      alive on a matched host.

## 10. Userscript-specific (no popup/options — everything lives in the FAB panel) — `userscript/src/userscript.ts`

- [ ] FAB button mounts next to `[title="Sitelinks"]` when present at load, and via
      `MutationObserver` when it appears later (SPA nav).
- [ ] Clicking FAB opens/closes the panel; panel contains working geo-override and
      profile-border forms wired to userscript-local storage (not `chrome.storage`).
- [ ] Double-injection guard: `window.__sniffiesInjected` prevents mounting twice if the script
      runs again.
- [ ] `installHooks()` throwing doesn't prevent `mountUI` from still rendering a usable (if
      degraded) panel — verify the try/catch fallback path.
- [ ] User-id logging (`userscript/src/user-id-logger.ts`) still fires independent of the rest of
      the UI.

## 11. Cross-cutting / regression

- [ ] Extension reload/update preserves existing `chrome.storage.local` settings (no destructive
      migration).
- [ ] Manifest permissions sanity: extension actually gets `geolocation`/`storage`/`<all_urls>`
      in the test browser context.
- [ ] All MAIN-world hooks (geo, user-id, bot-block) each guard against double-install
      (`__sniffiesPatched` etc.) — load the content scripts twice in the fixture and assert no
      duplicate patching/errors.
- [ ] Console has no uncaught errors on a full "load fixture → click marker → open profile →
      toggle every feature" pass, for both packages.

---

## Notes / open questions

- Bot-blocking (§3) and the injection-retry logic (§4) are the highest-value areas — both are
  integration-shaped, hard to unit-test, and the source comments admit they only get manual
  verification today.
- Suggested starting point: scaffold the harness (§0), then do bot-blocking against the Chrome
  extension first.
