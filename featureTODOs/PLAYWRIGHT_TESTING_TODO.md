# Playwright E2E Testing — TODO

Goal: end-to-end coverage of the Chrome extension (`client/`) and the userscript (`userscript/`)
that the existing Vitest unit tests can't reach — real DOM injection, `chrome.storage`
round-trips, XHR/WebSocket patching against actual network traffic, and the popup/options/settings
extension pages. Lives in `e2e/` — see `e2e/README.md` for setup and how to run things.

---

## 0. Test harness (blocking prerequisites)

- [x] **Fixture page DOM shapes** — `e2e/fixtures/sniffies-mock.html` reproduces the marker-click →
      panel-open flow, including an async panel render to exercise the retry/poll logic for real.
  - [x] **Fake XHR/WS endpoints for the profile-filter hook** — `e2e/fixtures/sniffies-api.ts`
        (`mockApi`: answers API paths by path only, on any of the hosts Sniffies has used, with CORS
        for the cross-origin ones, and records what the page sent; `sendXhr` makes the request the
        way Sniffies' code does) and `e2e/fixtures/bot-block.ts` (the four surfaces —
        `post-authentication`, `chat-data`, `messages`, the `prod.ws.sniffies.com` WebSocket via
        `page.routeWebSocket`). The hook was `core/src/bot-block-hook.ts` when this was written; it is
        now `core/src/profile-filter-hook.ts` and also applies the profile filters (§13).
        **Gotcha:** route the WebSocket _before_ the page loads. The hooks keep the `WebSocket` they
        find when they inject, so a route added afterwards is never the one they connect through.
- [x] **Chrome extension loading** — `e2e/fixtures/extension.ts` loads the real built `client/dist`
      via `launchPersistentContext`, routing `sniffies.com` to the fixture HTML so the real content
      scripts inject against it with no network involved. Proven by
      `e2e/tests/extension/smoke.spec.ts` (2 passing tests).
- [x] **Userscript loading — direct injection** — `e2e/fixtures/userscript.ts` injects the built
      `.user.js` via `page.addInitScript`, a faithful stand-in for a real manager since the script
      needs no `GM_*` APIs. Proven by `e2e/tests/userscript/smoke.spec.ts` (2 passing tests).
  - [ ] **Follow-up: a Tampermonkey-based smoke test** — load a real userscript manager and install
        the built `.user.js` through it, for at least one test exercising the real
        install/match/run-at pipeline. Not started; direct injection covers feature-logic testing
        needs in the meantime.
- [x] **Server stubbing** — `e2e/fixtures/server-mocks.ts` intercepts `report`/`favorites`/
      `save-number`/`send-guid`/`blocked-bots` via `context.route`, read live from the client's own
      `.env` so it can't drift from what the extension under test was built with.
- [x] **Storage seeding/inspection helpers** — `e2e/fixtures/storage.ts`, routed through the
      background service worker.

---

## 0b. Drift detection against live sniffies.com

A deliberately separate, non-gating suite: the §0 fixture can only test "does our code handle this
input correctly," never whether that input still matches what real Sniffies sends. This already
happened once silently (an API hostname changed between two HAR captures an hour apart). Run
manually/on a schedule, not on every push, since it needs a live site + a real account.

- [x] **`e2e/` package scaffolded** — Playwright, a `setup` project capturing an authenticated
      session, and a `canary` project that reuses it.
- [x] **Manual-auth pattern, not scripted login** — a human logs in once via `page.pause()`; the
      session is saved and reused. No password ever typed by test code.
- [x] **Site contract** — `e2e/site-contract.ts`, the single source of truth pairing every DOM
      selector the code depends on with its source, so the canary can't silently drift from it.
- [x] **Selector canary, confirmed green against the live site** — checks the map has a visitor
      marker and that clicking one opens a profile panel. Found and fixed one real bug along the
      way (a zero-size-by-design element was asserted `toBeVisible()` instead of `toBeAttached()`).
- [x] **Payload/schema canary (HAR-based)** — `e2e/scripts/check-har-schema.mjs` checks every field
      path `bot-block-hook.ts` reads against a real captured HAR, validated against 7 captures. This
      is what caught the `newConversation` WS leak (see `Bot_Reporting_TODO.md` §5).
- [x] Uses a dedicated test account, not a personal one, to avoid tripping Sniffies' own anti-bot
      detection.

---

## 0c. Full mocked Sniffies (HAR-based) — default target for most e2e tests

Direction: two suites with separate jobs.

- **Mocked suite (default, automated):** a mocked Sniffies that replays a captured HAR. Tests every
  feature end to end with no human interaction, no live site, no real account — safe to run on every
  push / in CI. Most tests (§1–§7, §10–§11) live here.
- **Live suite (manual, drift check):** the existing §0b suite against real sniffies.com, with the
  human-authenticated session reused across tests. Run by hand to check that the real API
  calls/responses and DOM anchors still match what the mock assumes. Not gating, not in CI.

This extends the existing `e2e/fixtures/sniffies-mock.html` + `server-mocks.ts` approach rather
than replacing it.

- [ ] **Sanitized HAR fixture** — strip auth tokens, cookies, and real user ids/photos/messages from
      a captured HAR and commit the result. Never commit a raw capture.
- [ ] **HTTP replay** — `context.route` serving the sanitized HAR's API responses by path only (not
      hostname — the API host has changed before). Playwright's `routeFromHAR` is the starting
      point, but ids/timestamps will need templating so tests can control the data (e.g. "this
      visitor is a blocked bot").
- [ ] **WebSocket replay** — (hand-built frames exist for §3, in `e2e/fixtures/bot-block.ts`; not
      HAR-based, and only the frame types the hook reads) `page.routeWebSocket` to push frames (`userJoined`, `newMsg`,
      `newConversation`, …) on demand; also covers the "Fake XHR/WS endpoints for bot-block-hook.ts"
      item in §0.
- [ ] **Page/DOM layer** — decide how far to go: keep the hand-built `sniffies-mock.html` (cheap,
      covers the selectors in `e2e/site-contract.ts`), or serve real captured page HTML/JS so
      Sniffies' own handlers (e.g. the paywall click handler) run for real. The second is higher
      fidelity but pulls in third-party scripts that may break offline.
- [ ] **Fixture builder API** — small helpers like `mockSniffies({ visitors, blockedIds, chats })`
      so tests describe data, not raw HAR entries.
- [ ] **Keep the mock honest (manual)** — extend the live canary to diff real responses/DOM against
      the mock's assumptions (builds on `e2e/scripts/check-har-schema.mjs` and `site-contract.ts`);
      when it fails, refresh the HAR and re-sanitize. Run by hand, never as part of the automated
      suite.
- [ ] **Separate the two suites in config** — mocked tests in their own Playwright project with no
      dependency on the `setup` (manual login) project; live tests stay behind `setup`. A plain
      `npm test` runs only the mocked project.
- [ ] **Migrate tests** — move §1–§7 and §10–§11 tests onto the mock; keep only the live-only
      scenarios on the shared-token suite (state which ones in each test's header comment).

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
  - [x] Bookmarklet — `e2e/tests/bookmarklet/profile-border.spec.ts` (competing listener is on the marker, not capture-phase on document: a post-load bookmarklet can't pre-empt one the site registered first).
- [ ] `openInNewTab` true vs false changes `window.open` vs `location.assign`.
  - [x] Bookmarklet — `e2e/tests/bookmarklet/profile-border.spec.ts`.
- [ ] Feature disabled → click falls through untouched.
  - [x] Bookmarklet — `e2e/tests/bookmarklet/profile-border.spec.ts`.
- [ ] Marker with `data-within-radius="true"` (or missing) is never intercepted.
  - [x] Bookmarklet — `e2e/tests/bookmarklet/profile-border.spec.ts`.

The click-redirect is now bookmarklet-only. The extension and userscript instead raise
`nearbyVisitors.emitRadiusInMiles` in the `post-authentication` / `softReload` responses
(`core/src/profile-filter-hook.ts`), so Sniffies opens out-of-radius profiles itself:

- [ ] E2E (`e2e/fixtures/sniffies-mock.html`): mock a soft reload with a visitor beyond the radius.
      Assert the marker ends up `data-within-radius="true"` with "Profiles Outside Boundary" on, and
      still `"false"` with it off. The mock needs to derive `data-within-radius` from
      `emitRadiusInMiles` the way Sniffies does. Cover the extension and the userscript.

## 3. Bot blocking (XHR + WebSocket filtering) — `core/src/profile-filter-hook.ts`

Covered by `e2e/tests/userscript/bot-block.spec.ts` (runs in CI) and
`e2e/tests/extension/bot-block.spec.ts` (same checks; the extension's state arrives by message, so
they poll). Fixtures: `e2e/fixtures/bot-block.ts`.

Explicitly called out in the source as untestable against live Sniffies, but fully testable
against a fixture that fakes the four surfaces:

- [x] `POST .../api/post-authentication` — blocked ids removed from `nearbyVisitors.visitors` and
      `partialVisitorData`.
- [x] `GET .../api/v2/post-authentication/chat-data` — blocked conversations/userIds/
      partialVisitorData removed.
- [x] `GET .../api/messages` — blocked-author messages and partialUsers removed.
- [x] Live WS frames (`userJoined`, `userUpdated`, `userAwake`, `userDisconnected`,
      `userRemoved`, `newMsg`) from a blocked id never reach a page-registered
      `addEventListener("message", …)` or `.onmessage` handler.
      (`newConversation` isn't in the fixture's frames yet.)
- [x] API host variability: same path on two different `*.sniffies.com` hostnames both get
      filtered (regression test for the exact bug called out in the code comments).
      (Three: same-origin, `uswapi.sniffies.com` and `usw.api.sniffies.com`.)
- [x] Toggling bot blocking off mid-session stops filtering new responses; toggling on filters
      again.
      (Userscript through the panel's switch, extension through `chrome.storage`.)
- [ ] Before the relay delivers real state (`enabled:false` default), responses pass through
      unfiltered — no race-condition false blocking. (Needs a request fired before the content
      script's first message; Playwright's init scripts don't run in a reliable order against
      content scripts, so this is only checked in the unit tests so far. "Already off at load" is
      covered in both specs.)
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
- [ ] Feature-flag gating: `FAVORITES_NOTIFICATIONS_ENABLED` off → checkbox disabled, "Coming soon!" hint,
      strikethrough label.
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

- [ ] FAB button mounts in `[data-testid="iconHolderRightBottom"]` when present at load, and via
      `MutationObserver` when it appears later (SPA nav).
  - [x] Bookmarklet — `e2e/tests/bookmarklet/fab-panel.spec.ts`.
  - [x] Userscript, icon row present at load only — `e2e/tests/userscript/premium-panel.spec.ts`.
- [ ] Clicking FAB opens/closes the panel; panel contains working geo-override and
      profile-border forms wired to userscript-local storage (not `chrome.storage`).
  - [x] Bookmarklet (profile-border form only; it has no geo override) — `e2e/tests/bookmarklet/fab-panel.spec.ts`, `e2e/tests/bookmarklet/profile-border.spec.ts`.
  - [x] Userscript, open/close only (the geo and profile-border forms aren't exercised) — `e2e/tests/userscript/premium-panel.spec.ts`.
- [ ] Double-injection guard: `window.__sniffiesInjected` prevents mounting twice if the script
      runs again.
  - [x] Userscript, injected twice (one FAB, no errors, still filters once) — `e2e/tests/userscript/bot-block.spec.ts`.
  - [x] Bookmarklet (a second tap toggles the panel instead) — `e2e/tests/bookmarklet/fab-panel.spec.ts`.
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
  - [x] Userscript (all its hooks at once; checked through the bot-block filtering, which would
        double-filter or throw) — `e2e/tests/userscript/bot-block.spec.ts`.
  - [ ] Extension.
- [ ] Console has no uncaught errors on a full "load fixture → click marker → open profile →
      toggle every feature" pass, for both packages.
  - [x] Bookmarklet — `e2e/tests/bookmarklet/console-errors.spec.ts`.
  - [x] Userscript, including the filters' network paths and a live socket —
        `e2e/tests/userscript/bot-block.spec.ts`.
  - [ ] Extension.
  - These tests stub `api.github.com` (the update check) and the userscript's `logInit` ping: left
    alone, a rate-limited GitHub 403 or a CORS failure logs an error that has nothing to do
    with the code under test.

---

## 12. Premium Features panel (master toggle + per-feature switches)

The bookmarklet's Premium panel specs pass (`e2e/tests/bookmarklet/`). No specs exist yet for the
other clients. See also §1 (geo), §2 (extension/userscript outside-boundary) and §6 (popup).

- [ ] Master toggle and per-feature switches (location, boundary, photos) persist across reload and
      re-open in the popup (§6), the userscript FAB panel (§10) and the extension.
  - [x] Userscript, including master off disabling the per-feature switches — `e2e/tests/userscript/premium-panel.spec.ts`.
  - [x] Bookmarklet, master switch only — `e2e/tests/bookmarklet/profile-border.spec.ts`.
  - [ ] Chrome extension popup.
- [ ] "You don't need these" Plus notice: shown when the mocked `POST /api/authenticate/current`
      returns an active `appstoreMembership`, hidden when it is absent. A free account has no
      `appstoreMembership` key at all (confirmed from a free-account HAR). The paid shape (`name`,
      `subscriptionStatus: "active"`, future `end`) needs mocking.
  - [x] Userscript, active and free responses (the notice appears from the next load) — `e2e/tests/userscript/premium-panel.spec.ts`.
  - [ ] Chrome extension popup, and the bookmarklet.

## 13. Profile filters — `core/src/profile-filter/`, `core/src/filter-menu/`

Added after this todo was written (gender / height / weight / last-online in #65, the stat takeover
since). The filters are applied to Sniffies' own network traffic, so they are testable the same way
as §3. See `featureTODOs/Unspecified_Stat_Filters_TODO.md` §5 for what the stat takeover does and
its manual checklist.

Position / Body Type / Sexuality / Endowment are ours while the profile filters are on:

- [x] The map request leaves without those stats, and Sniffies' own stats (age…) still go through —
      `e2e/tests/{extension,userscript}/stat-takeover.spec.ts`.
- [x] The saved filters Sniffies restores on login (`authenticate/current`) load with those stats
      off.
- [x] A profile with none listed is kept on the map when "none listed" is on, and hidden when off.
- [x] Nothing is stripped or rewritten while the profile filters are off (extension).
- [ ] Off for the userscript too.
- [ ] The first request after a reload uses the filters mirror (`snp-applied-profile-filters`)
      before the extension's message arrives — same ordering problem as the §3 race item.
- [ ] Menu: our four rows replace Sniffies' (its own hidden and forced off), the sheets open (a wheel
      with check marks for Position / Body Type / Sexuality; a range and cut / uncut for
      Endowment), and picks survive a reload. Needs the Cruiser Stats menu markup in
      `sniffies-mock.html` (copy it from `core/src/filter-menu/test-kit.ts`).
- [ ] Sniffies' Cruiser Stats switch shows on while a pick is set, and Height / Weight stay enabled.

The other filters:

- [x] Gender, Height, Weight and Last Online hide the right profiles in the map init, a live
      `userJoined` frame and an Apply (`advanced-filter/search`) result; "include unspecified"
      keeps the ones with no value; the filters combine; the master switch off filters nothing —
      `e2e/tests/{extension,userscript}/profile-filters.spec.ts` (a table of cases in
      `e2e/fixtures/profile-filters.ts`).
- [ ] "Reload to apply" appears when the filters differ from what the page loaded with, and a reload
      clears it.
- [ ] The master Profile filters switch (popup / userscript panel) turns every filter, and the
      stat takeover, off and on. Off is checked through storage (`profile-filters.spec.ts`,
      `stat-takeover.spec.ts`); clicking the real switch in the popup / panel is not.

Drift (not part of the automated run): `site-contract.ts` doesn't list the markup these depend on yet
(`label[for="stats.*"]`, `input#CRUISER_STATS`, `.smart-options-container`, `ui-menu-item-group`), and
`check-har-schema.mjs` doesn't check the saved-filter shape
(`user.private.options.filters.USERS[].enabledValues`).

## 14. Features added since this was written, with no e2e coverage yet

Each is a hook or UI under `core/src/` that already has unit tests; none has a spec here.

- [ ] **Read receipts** — `read-receipt-hook.ts` (#86), wired in the extension's chat-view hook and the userscript. Needs
      a fake chat thread and the read-receipt request surface.
- [ ] **Hide sent photos** — `hide-photo-click-hook.ts`, `hide-photo-menu-hook.ts`, `sent-photos.ts`
      (#69). The fixture page has the Hide Photo button's markup only in the canary's contract.
- [ ] **Update prompt and version badge** — `update-check.ts`, `update-banner.ts`,
      `version-badge.ts` (#16). Stub `api.github.com/**` with a newer release and assert the banner;
      with an older one, none.
- [ ] **Travel mode capture** — `city-search-hook.ts`, `city-search-status-hook.ts`,
      `travel-capture-hook.ts`.
- [ ] **Own-id and user-id logging** — `own-id-hook.ts`, `user-id-hook.ts`, `log-init.ts`
      (the userscript's `logInit` ping), and the extension's relay for it.
- [ ] **Selection limit override** — `selection-limit-hook.ts` (Position's four-pick cap lifted
      while the profile filters are on). Unit-tested; no page-level check that Sniffies' picker model
      is the shape it looks for.
- [ ] **Plus hook** — `plus-hook.ts`; only the userscript's notice is covered (§12).
- [ ] **Usage dashboard** — `server/` (#81, #84). Out of scope for these browser suites; it has its
      own `server/tests`.

---

## Notes / open questions

- Bot-blocking (§3) and the injection-retry logic (§4) are the highest-value areas — both are
  integration-shaped, hard to unit-test, and the source comments admit they only get manual
  verification today.
- Suggested starting point: scaffold the harness (§0), then do bot-blocking against the Chrome
  extension first.
