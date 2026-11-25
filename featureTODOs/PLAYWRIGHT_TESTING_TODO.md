# Playwright E2E — TODO

What is still uncovered by the e2e suites in `e2e/` (see `e2e/README.md` for setup and what exists).
Items are open unless noted; nothing here is done.

## Infrastructure

- **Tampermonkey smoke test.** Install the built `.user.js` through a real userscript manager, to
  exercise its install/match/run-at pipeline (direct injection covers feature logic today).
- **Replay a sanitized HAR instead of hand-built mocks.** Strip tokens, cookies, ids, photos and
  messages from a capture and commit only the result. Then:
  - serve its API responses by path only (the API host has changed before), templating ids and
    timestamps so tests can set the data (`routeFromHAR` is the starting point);
  - push WebSocket frames on demand (`userJoined`, `newMsg`, `newConversation`, …), beyond the
    hand-built ones in `fixtures/bot-block.ts`;
  - small builders like `mockSniffies({ visitors, blockedIds, chats })`;
  - decide whether the page layer stays hand-built (`sniffies-mock.html`, `fixtures/filter-menu.ts`)
    or serves real captured HTML/JS, which runs Sniffies' own handlers but pulls in third-party
    scripts that may break offline.
- **Split mocked and live suites in config.** Mocked tests get their own project with no dependency
  on `setup` (manual login), so a plain `npm test` runs only them; the canary stays behind `setup`.
  Then migrate the extension, userscript and bookmarklet specs onto it.
- **Keep the mock honest.** Extend the canary to diff real responses and DOM against the mock's
  assumptions (builds on `scripts/check-har-schema.mjs` and `site-contract.ts`); run by hand.
- **Drift coverage for the filters.** `site-contract.ts` doesn't list `label[for="stats.*"]`,
  `input#CRUISER_STATS`, `.smart-options-container`, `ui-menu-item-group` or Cruising Now's
  `.list-item-level-2` click handler; `check-har-schema.mjs` doesn't check
  `user.private.options.filters.USERS[].enabledValues` or `user.private.options.units`.

## Profile filters

Covered: the filters through Sniffies' network traffic, the stat takeover, and the menu mounting,
Gender, Height, Online After and metric units through the mock menu.

- Stat takeover with the filters off, in the userscript (the extension is covered).
- The first request after a reload uses the filters mirror (`snp-applied-profile-filters`) before the
  extension's message arrives. Same ordering problem as the bot-blocking race below.
- The Position / Body Type / Sexuality sheets (a wheel with check marks) and the Endowment sheet
  (range plus cut / uncut) open, and their picks survive a reload.
- Sniffies' Cruiser Stats switch shows on while a pick is set, and every row stays usable with it
  off (needs `input#CRUISER_STATS` in the mock menu).
- "Reload to apply" appears when filters differ from what the page loaded with and a reload clears
  it, for every row (only Gender and Height are checked).
- The master Profile filters switch (popup / userscript panel) turns every filter and the takeover
  off and on. Off is checked through storage; clicking the real switch is not.

## Bot blocking

Mostly covered by `tests/{userscript,extension}/bot-block.spec.ts`.

- Responses pass through unfiltered before the relay delivers state. Needs a request fired before
  the content script's first message, which Playwright can't order reliably; unit-tested only.
- Filtered ids are recorded and the popup's "N bots blocked in the last 24 hours" reflects them,
  including a day-boundary case (`core/src/blocked-bot-log.ts`).
- `newConversation` WebSocket frames (not in the fixture yet).

## Outside-boundary profiles

The extension and userscript raise `nearbyVisitors.emitRadiusInMiles` in `post-authentication` and
`softReload` responses so Sniffies opens out-of-radius profiles itself. Mock a soft reload with a
visitor beyond the radius, deriving `data-within-radius` from `emitRadiusInMiles` the way Sniffies
does, and assert the marker is `"true"` with "Profiles Outside Boundary" on and `"false"` with it
off. Both packages.

## Geo override (`core/src/geo-hook.ts`)

- Enabling the override makes `getCurrentPosition` return the spoofed coords; disabling falls back
  to native.
- `watchPosition` subscribers refresh when the override is saved mid-watch (`refreshWatches`).
- "Fill with current position" uses the native (unpatched) geolocation call.
- Userscript: spoofed coords are patched into the `/api/visitor/current/location` fetch body, both
  the re-sent last request and the proactive PUT.
- Persists across reload and updates live in an open tab (extension: `storage.onChanged` → relay →
  `postMessage`).

## Report button (`core/src/report-ui.ts`, `client/src/content/sniffies-profile-id.ts`)

- The 🚩 button is injected next to Pin once, not again on repeated mutation-observer fires.
- It does nothing until `currentSniffiesUserId` has been observed.
- Submit posts `{reportType: "bot_suspected", reportedUserId, reporterUserId, message}` to
  `/api/report`, shows "Reported. Thanks." and auto-closes.
- A failed submit (mocked 500) shows "Failed to submit report" and re-enables the button.
- Cancel / backdrop click closes without submitting and clears `reportTarget`; switching profiles
  doesn't leak the previous target.

## Extension pages and background (`client/src/`)

Popup:

- Geo, profile-border, favorites and bot-blocking sections remember open/closed across reopen.
- `FAVORITES_NOTIFICATIONS_ENABLED` off disables its checkbox with a "Coming soon!" hint.
- The bot-blocking checkbox toggles `botBlockingEnabled`; "Open settings" opens the settings page
  in a new tab and closes the popup; the version badge matches the manifest.
- Premium Features: the master toggle and per-feature switches (location, boundary, photos) persist
  across reload and reopen.
- The "You don't need these" Plus notice appears for an active `appstoreMembership` in the mocked
  `POST /api/authenticate/current` and not for a free account (which has no such key). Also
  needed for the bookmarklet.

Settings page:

- Blocked-bot textarea round-trips a newline-separated list to `chrome.storage.local`; an invalid
  (non-24-char-hex) id blocks the save and is listed; valid ids are deduped.
- The server blocklist (`/api/blocked-bots`) populates storage on first load and when stale
  (>24h, `refreshBlockedBotsIfStale`); "Reset to defaults" clears it; the storage inspector table
  follows both.
- Phone save rejects non-E.164 input inline; valid input POSTs to `/api/save-number`, stores phone
  and guid, then loads favorites. "Text me my code" needs a valid phone.
- A pasted recovery code is saved as the guid and reloads favorites; the favorites grid renders
  `/api/favorites`, shows an empty state, and "Remove" unfavorites. Network failures show the error
  text, not silence.

Options page and background:

- `options.ts` loads, toggles and saves `chrome.storage.sync.enabled` ("Saved."). Also confirm
  `sync` is still intentionally separate from `.local` and not dead.
- `onInstalled` seeds `enabled` / `installedAt` into `storage.sync` without clobbering existing
  values; `GET_SETTINGS` returns the sync settings; a content-script `PING` gets a `PONG`.

## Userscript panel (`userscript/src/userscript.ts`)

- The FAB mounts via `MutationObserver` when the icon row appears after load.
- The panel's geo-override and profile-border forms work against userscript-local storage.
- If `installHooks()` throws, `mountUI` still renders a usable panel.
- User-id logging (`user-id-logger.ts`) fires independently of the UI.

## Cross-cutting

- Extension reload/update keeps existing `chrome.storage.local` settings.
- The extension gets `geolocation`, `storage` and `<all_urls>` in the test browser.
- Extension: every MAIN-world hook (geo, user-id, bot-block) guards against double-install; load
  the content scripts twice and assert no duplicate patching or errors.
- Extension: no uncaught console errors across "load fixture → click marker → open profile →
  toggle every feature". Stub `api.github.com` and the userscript's `logInit` ping, as the other
  packages' passes do, so a GitHub 403 or CORS failure doesn't count.

## Features with unit tests but no spec

- **Read receipts** (`read-receipt-hook.ts`, #86): needs a fake chat thread and the receipt request.
- **Hide sent photos** (`hide-photo-click-hook.ts`, `hide-photo-menu-hook.ts`, `sent-photos.ts`,
  #69): the mock page lacks the Hide Photo button markup.
- **Update prompt and version badge** (`update-check.ts`, `update-banner.ts`, `version-badge.ts`,
  #16): stub `api.github.com/**` with a newer release and assert the banner, an older one and
  assert none.
- **Travel mode capture** (`city-search-hook.ts`, `city-search-status-hook.ts`,
  `travel-capture-hook.ts`).
- **Own-id and user-id logging** (`own-id-hook.ts`, `user-id-hook.ts`, `log-init.ts`, and the
  extension's relay).
- **Selection limit override** (`selection-limit-hook.ts`): no page-level check that Sniffies'
  picker model is the shape it looks for.
- **Plus hook** (`plus-hook.ts`): only the userscript notice is covered.
- The usage dashboard (`server/`, #81, #84) has its own `server/tests` and is out of scope here.

Highest value first: bot blocking and the profile-filter flows. Both are integration-shaped, hard to
unit-test, and today get mostly manual verification.
