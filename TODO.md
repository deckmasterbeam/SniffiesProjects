# Bot Reporting Feature — TODO

Feature: users can flag a profile as a suspected bot from the profile screen. Reports land in
`pending_reports`; you manually promote confirmed ones into `validated_reports`. The client fetches
`validated_reports` (as "blocked bots") on init, caches it for 24h, and — if enabled — filters
blocked accounts out of what Sniffies shows the user entirely (map, WS, init payload).

Decisions locked in from discussion:
- Identity key throughout is the **Sniffies user id** (captured today via `installUserIdHook` /
  `setSniffiesUserId`), **not** the extension's `guid`. `favorites.ts` uses `guid` — that's an
  existing bad pattern, not something to copy. Not fixing `favorites` now (see Future TODO).
- Abuse handling for now: a manually-maintained block list of *reporter* Sniffies ids. Requests
  from a blocked reporter get a normal-looking success response but are **silently dropped** —
  no row written, no error, no indication to the client that anything was suppressed.
- `report_type` is a Postgres enum, sized for more values later.
- Multiple reports against the same profile **consolidate into one row** in `pending_reports`
  (comma-separated reporter ids), not one row per report.
- Deep scaling concerns (normalized schema, admin review UI, etc.) are explicitly out of scope —
  parked in "Future TODO" below.
- Bot-list enforcement extends beyond the report button: blocked accounts should be filtered out
  of Sniffies' init payload and live WebSocket stream, with a popup toggle to turn this on/off.

---

## 1. Database (`server/schema.sql`) — done

- [x] `report_type` implemented as `TEXT` + `CHECK (report_type IN ('bot_suspected'))`, **not** a
      native Postgres `ENUM`. Reason: `scripts/migrate.mjs` applies `schema.sql` by naively
      splitting the file on `;` and re-running every statement on every deploy — a bare
      `CREATE TYPE` would fail the second time it runs, and a `DO $$ ... $$` guard block would
      itself get shredded by that same naive split (it contains internal semicolons). `CHECK`
      lives inline in the idempotent `CREATE TABLE IF NOT EXISTS`, so it fits the existing
      migration mechanism without changes to `migrate.mjs`. Add new report types by editing the
      `CHECK (... IN (...))` list.
- [x] `blocked_reporters` table (the abuse list): `sniffies_user_id TEXT PRIMARY KEY`,
      `blocked_at`, `reason TEXT` (manual notes).
- [x] `pending_reports` table (consolidated, one row per `(reported_user_id, report_type)`):
      `reporting_user_ids TEXT` (deduped comma-separated Sniffies ids), `messages JSONB`
      (`[{ reporterId, message, reportedAt }]` — comma-joined ids have nowhere to carry
      per-reporter messages, so those get their own column), `report_count`,
      `first_reported_at` / `last_reported_at`, `status`, `UNIQUE (reported_user_id, report_type)`.
- [x] `validated_reports` table: `reported_user_id TEXT UNIQUE` (the unique constraint doubles as
      the lookup index the `blocked-bots` endpoint needs — no separate index required),
      `report_type`, `validated_at`, `source_report_id REFERENCES pending_reports(id)`, `note`.
- [x] Documented the three new tables in `server/README.md`'s Database table.

## 2. Server (`server/api`) — done

- [x] `report.ts` — `POST` only:
  - `applyCors`, `requireFeatureFlag(res, "REPORTING_ENABLED")`, `requireClientAuth`, `requireDb`.
  - Validate `reportType` against the enum allow-list, require `reportedUserId` + `reporterUserId`
    (Sniffies ids), trim + length-cap optional `message`.
  - Look up `reporterUserId` in `blocked_reporters` **first**. If present: return `{ ok: true }`
    (200) and do nothing else — no insert, no log line that could leak into server logs/monitoring
    in a way that tips off the abuser.
  - Otherwise, upsert into `pending_reports`:
    ```sql
    INSERT INTO pending_reports (report_type, reported_user_id, reporting_user_ids, messages, report_count)
    VALUES (${reportType}, ${reportedUserId}, ${reporterUserId}, ${messageJson}, 1)
    ON CONFLICT (reported_user_id, report_type) DO UPDATE SET
      reporting_user_ids = CASE
        WHEN (',' || pending_reports.reporting_user_ids || ',') LIKE ('%,' || EXCLUDED.reporting_user_ids || ',%')
          THEN pending_reports.reporting_user_ids
        ELSE pending_reports.reporting_user_ids || ',' || EXCLUDED.reporting_user_ids
      END,
      messages = CASE
        WHEN (',' || pending_reports.reporting_user_ids || ',') LIKE ('%,' || EXCLUDED.reporting_user_ids || ',%')
          THEN pending_reports.messages
        ELSE pending_reports.messages || EXCLUDED.messages
      END,
      report_count = CASE
        WHEN (',' || pending_reports.reporting_user_ids || ',') LIKE ('%,' || EXCLUDED.reporting_user_ids || ',%')
          THEN pending_reports.report_count
        ELSE pending_reports.report_count + 1
      END,
      last_reported_at = NOW()
    ```
    (First insert seeds `reporting_user_ids` with the single new reporter id, so
    `EXCLUDED.reporting_user_ids` is always just that one id — the dedupe check works whether the
    row is new or existing.)
  - Same reporter reporting the same profile twice is a no-op (already covered by the `LIKE` dedupe
    check) rather than inflating the count.
- [x] `blocked-bots.ts` — `GET` only:
  - `applyCors`, `requireClientAuth`, `requireDb`.
  - `SELECT reported_user_id FROM validated_reports`, return `{ ok: true, userIds: [...] }`.
- [x] Add `REPORTING_ENABLED` to `server/.env.example`.
- [x] Tests: `server/tests/report.test.ts` (including the blocked-reporter silent-drop path and the
      consolidation/dedupe path) and `server/tests/blocked-bots.test.ts`, mirroring
      `favorites.test.ts` / `watched-users.test.ts`. (25 new tests, 104 total passing.)
- [x] Managing `blocked_reporters` and promoting `pending_reports` → `validated_reports` stays
      manual (direct DB access) — no admin UI in scope. Documented as a "Manual review workflow"
      section in `server/README.md`.
  - Note: `blocked-bots.ts` is intentionally **not** gated behind `REPORTING_ENABLED` (per this
    TODO's own spec, which lists only `applyCors`/`requireClientAuth`/`requireDb` for it) — the
    client already gates fetching it behind the flag, and the endpoint itself has no abuse surface
    (read-only, no PII beyond ids already public on the map).

## 3. Core (`core/src`) — done

- [x] `report-modal.html` / `report-modal.css` / `report-form-contract.ts` / `report-ui.ts`
      (`wireReportModal`), following the `geo-override-ui.ts` shape: a backdrop + modal with an
      optional message field and cancel/submit buttons. `report_type` isn't a form field — it's
      fixed to `"bot_suspected"` by the caller, since there's only one type today.
      `wireReportModal` returns an `{ open, close }` handle; the caller (client) owns *when* to
      open it and *which* profile it's reporting.
- [x] Exported `REPORT_MODAL_HTML`, `REPORT_MODAL_CSS`, `wireReportModal`, `ReportFormContract`,
      `ReportModalHandle` from `core/src/index.ts`.
- [x] Tests: `report-ui.test.ts` (12 tests — open/close, cancel, backdrop-click-to-close, submit
      with trimmed message, pending/success/error states).
- [x] `bot-block-hook.ts` — done, see section 5 below.

## 4. Client (`client/src`) — done

- [x] **Fetch the blocked-bots list on init**, not just as a side effect of using the report button —
      this is the mechanism that keeps a returning user's block list warm without them ever touching
      the report flow. Both consumers call the same `fetchBlockedBots` (network call to
      `GET /api/blocked-bots`, writes the result + a fresh `blockedBotsFetchedAt` to storage) /
      `refreshBlockedBotsIfStale` (only calls the above when `Date.now() - blockedBotsFetchedAt >
      24h`) pair, gated on `REPORTING_ENABLED`:
  - Chrome extension: `content/sniffies-profile-id.ts`'s init block (`void getLocalSettings().then(...)`
    near the bottom of the file) calls `refreshBlockedBotsIfStale(blockedBotsFetchedAt)`.
  - Userscript: `userscript.ts`'s `installHooks()` calls `refreshBlockedBotsIfStale(reportState)`
    right after `installReportFeature()` (see the "Userscript mirror" entry below).
- [x] `shared/settings.ts`: added `blockedBots`, `blockedBotsFetchedAt`, `botBlockingEnabled`
      (default `true`), `botBlockingSectionOpen`, plus `setBlockedBots` / `setBotBlockingEnabled`.
- [x] `shared/env.ts` + `scripts/build.mjs` + `scripts/build-prod.mjs`: added `REPORTING_ENABLED`
      build flag, same on/off convention as `FAVORITES_NOTIFICATIONS_ENABLED` (defaults to
      enabled unless explicitly `"false"`; `.env`/`.env.example`/prod build force it `false` until
      the feature is ready to ship).
- [x] `content/sniffies-profile-id.ts`:
  - Report button anchored off `[data-testid="pinUserButton"]`'s parent, `prepend`ed as first child.
  - The `MutationObserver` that used to only watch for the name label now also watches for the pin
    button, and `tryInjectIntoScreen` injects both — reused rather than duplicated.
  - **Bug found and fixed:** clicking profile A then profile B (panel already open) wouldn't show
    the flag on B until clicking B's marker a second time. Root cause: the click listener runs in
    the capture phase, before Sniffies' own click handling switches the panel — so the immediate
    `tryInjectIntoScreen` call queries stale DOM (still A's) and mis-injects a B-attributed button
    into A's container. The `MutationObserver` is supposed to correct this once the real DOM
    updates, but if Sniffies updates the existing panel nodes in place for a same-panel profile
    switch (rather than replacing them), no `childList` mutation fires to trigger a second attempt.
    A single `requestAnimationFrame` retry wasn't enough either — confirmed live: the panel switch
    is animated, and the outgoing profile's DOM stays in place (as the first `querySelector` match)
    through the whole transition, so a same-frame retry still injects into the profile animating
    *out*. First attempt at fixing that added an `isInjectionCurrentFor` early-exit to the retry
    loop, which was itself wrong — `injectReportButton` always stamps whatever container it finds
    with the current selection's id, so checking our own just-written attribute afterward is
    circular: it reports "done" on frame one, into the outgoing panel, before the transition even
    finishes. `scheduleReinjectionRetries` now just reruns `tryInjectIntoScreen` unconditionally,
    `setTimeout`-driven (not `requestAnimationFrame`) — confirmed working live, then dialed back
    from rAF's ~60/sec, first to 200ms/2s per request, then user-tuned further to
    `CLICK_REINJECT_RETRY_INTERVAL_MS`/`_WINDOW_MS` = 100ms/1s, to cut the CPU cost of polling after
    every single marker click. `scheduleReinjectionRetries` now takes the window/interval as optional
    params (defaulting to the click-path constants above) since the deep-link init call (below) needs
    its own, more relaxed cadence — `INITIAL_LOAD_REINJECT_RETRY_INTERVAL_MS`/`_WINDOW_MS` = 300ms/3s,
    slower and longer than the click case since page load has no interactive urgency but can take
    longer to settle (full data fetch + app bootstrap, not just a panel swap). All four are named
    constants next to each other if the rates need tuning again. Idempotent and cheap regardless of
    rate, so there's no cost to not short-circuiting, and it self-corrects the moment the outgoing
    DOM is actually removed and the incoming panel becomes the match. Still bails immediately if a
    newer selection has superseded it (`lastSelection` reassigned). Lives right above the click
    handler in
    `sniffies-profile-id.ts`. No test coverage (this file has none, like the other content scripts —
    DOM-heavy IIFE-style side effects at import time); needs manual verification: click through
    several profiles in a row with the panel already open and confirm the flag shows on the
    *incoming* profile once its animation settles, not the outgoing one.
  - **Deep-link injection.** Landing directly on `https://sniffies.com/profile/<id>` (hard
    refresh, direct link) shows that profile's panel without any marker click ever firing, so
    nothing set `lastSelection` for the observer/injection logic to act on. Added
    `extractUserIdFromProfilePath` (matches `/profile/<id>` and subpaths like `/profile/<id>/chat`)
    and an init-time check right after `startObserving()`: if the initial `location.pathname`
    matches, sets `lastSelection` from the URL (with `profilePicUrl: null` — unknown until the DOM
    renders) and runs the same immediate-attempt + `scheduleReinjectionRetries` pattern the click
    handler uses, since the initial panel render is async (data fetch) and may not be ready yet.
    Only handles a fresh page load, not SPA-internal navigation to a profile URL outside of a
    marker click — not something this request covered. Needs manual verification (not yet
    confirmed live): hard-load `sniffies.com/profile/<id>` directly and confirm the flag appears.
  - **Bug found and fixed: wrong-account attribution for no-photo profiles.** Reported live,
    confirmed against real DOM from a no-photo profile's header (Angular, not React —
    `_ngcontent-ng-*` attrs — worth knowing for future DOM-shape assumptions in this file).
    `extractFromMarker` returns `null` when a marker has no `background-image` (accounts with no
    profile photo render a generic icon instead), and the click handler used to `return` immediately
    in that case — never updating `lastSelection`, never scheduling a retry. But the
    `MutationObserver` doesn't know the click "failed": it still fires once Sniffies renders the new
    panel, and it used to require `lastSelection` truthy before doing anything — so it would inject
    using whatever profile was *last successfully read from a marker image*, attributing the report
    button to the **wrong account**. Not just missing — actively wrong, which matters for a
    report-as-bot feature. Fixed by making the URL authoritative: `tryInjectIntoScreen` now calls
    `extractUserIdFromProfilePath(location.pathname)` (reusing the deep-link helper above) on *every*
    invocation and overrides `lastSelection` whenever it disagrees, rather than trusting a value
    captured once at click time. The click handler no longer bails out when the marker yields no id —
    it still schedules `scheduleReinjectionRetries` so the URL-resolution above gets polled until
    routing catches up. `scheduleReinjectionRetries` had to switch from comparing a captured
    `ProfileSelection` object to a `selectionGeneration` counter bumped on every click/load, since a
    no-photo click no longer produces a `ProfileSelection` to compare against. The observer's
    `if (!lastSelection) return` guard was also removed, since it could otherwise refuse to act on
    the very first profile ever viewed if that one happened to have no photo. Needs manual
    verification (not yet confirmed live): click a no-photo profile (or several in a row, mixing
    photo/no-photo) and confirm the flag is attributed to the one actually on screen, not a
    previous one.
  - `reporterUserId` comes from `settings.sniffiesUserId` (tracked in module state, kept in sync
    via `chrome.storage.onChanged`, same pattern as `currentGuid`) — **not** `guid`, per the
    identity decision above. If it's empty (hook hasn't observed it yet), the button no-ops with a
    console warning instead of sending a blank id.
  - Report modal is lazily mounted once (`ensureReportModal`) into `document.body`; submit calls
    `POST /api/report` with `reportType: "bot_suspected"`.
  - `fetchBlockedBots` / `refreshBlockedBotsIfStale` added, called from the existing init flow
    (mirrors `fetchFavorites`'s "fetch on init" pattern) — gated on `REPORTING_ENABLED`, staleness
    check is `Date.now() - blockedBotsFetchedAt > 24h`.
  - Now consumed by `sniffies-bot-block-relay.ts` (section 5), which reads the cached list straight
    out of `chrome.storage` rather than this module relaying it directly.
- [x] Popup: "Block Bot Accounts" collapsible section, same disabled/"Coming soon!" gating as
      Favorites when `REPORTING_ENABLED` is false. The toggle now propagates live: it writes
      `botBlockingEnabled` to storage, which `sniffies-bot-block-relay.ts` picks up via
      `chrome.storage.onChanged` and forwards to the MAIN-world hook.
- [x] Tests: extended `popup.test.ts` with a "bot blocking" describe block (gated-state assertions
      + section-open persistence), mirroring the favorites tests.
- [x] The actual POST to `/api/report` and GET from `/api/blocked-bots` — verified manually against
      a local server + real Neon DB this session (see the report/consolidation/dedupe walkthrough
      in this conversation): submitted reports land in `pending_reports` with the right
      `reporting_user_ids`/`messages`/`report_count` semantics, including the blocked-reporter
      silent-drop path and the same-reporter no-op path. Not yet exercised through the actual
      client/userscript UI end-to-end (only via direct API calls), so still worth a real
      click-through before shipping.
- [x] **Userscript mirror**, scope resolved as full parity with the Chrome client's bot-report/block
      feature (not the pre-existing, unrelated favorites feature, which the userscript still doesn't
      have). The userscript's architecture differs enough from the client that this wasn't a
      copy-paste: it runs single-world (no MAIN/isolated split, no `postMessage` relay — hooks
      install directly, mirroring how `installGeoHook`/`installProfileBorderRedirect` already work
      there) and has no popup/settings pages, just one floating panel, so the client's popup toggle
      became the userscript's "Block Bot Accounts" panel section — toggle + 24h-blocked-count stat
      only (originally a local `wireBotBlockForm`, later moved into core — see the "Core
      consolidation" entry below, which is where this now actually lives). Initially also ported the
      settings page's manual blocked-id-editing textarea, but dropped it after user feedback that a
      big freeform textarea broke the pattern of the userscript's other sections (all toggle/field,
      no manual list editing). The server-fetched list (`fetchBlockedBots`/`refreshBlockedBotsIfStale`
      in `report.ts`) remains the only way `blockedBots` gets populated here.
  - `user-id-logger.ts`: `installUserIdLogging` now takes an optional `onUserId` callback (in
    addition to its existing init-telemetry behavior) — needed since `installUserIdHook` patches a
    global and can only be installed once, so the reporter id has to piggyback on the existing
    install rather than getting a second one.
  - `report.ts` (new): MAIN-world port of the client's `sniffies-profile-id.ts` report-button half
    (favorites/star injection excluded) + `sniffies-bot-block-hook.ts`. `installReportFeature()`
    always installs the bot-block XHR/WS hook (matching the client's MAIN-world hook, which is also
    unconditional — the flag only gates whether `blockedBots` ever gets populated), and additionally
    wires the report-button injection/observer/deep-link/no-photo-fix machinery when
    `REPORTING_ENABLED`. Ported the click-capture-phase/panel-switch race handling verbatim from the
    client rather than re-deriving it — see this file's section above for the debugging history
    behind `scheduleReinjectionRetries`, the URL-as-authority fix, etc. Returns a mutable
    `ReportFeatureState` (`currentSniffiesUserId`, `botBlockState`) that `userscript.ts` wires
    `installUserIdLogging`'s callback into, and that the panel's bot-blocking section mutates
    directly on toggle/save (no `chrome.storage.onChanged`-style relay needed — same process).
  - `shared/settings.ts`: added `localStorage`-backed getters/setters for `blockedBots`,
    `blockedBotsFetchedAt`, `botBlockingEnabled` (default `true`), `botBlockingSectionOpen`, and
    `blockedBotEventsByDay` (via core's `recordBlockedBotIds`), following this file's existing
    per-key convention (own `sniffies-*` localStorage keys) rather than switching to core's
    chrome-extension-shaped `SETTINGS_KEYS`/`getLocalSettings()`.
  - `shared/env.ts` + `scripts/build.mjs`: added `REPORTING_ENABLED`, same
    `String(!prod && process.env.REPORTING_ENABLED !== "false")` convention as the client.
  - `tsconfig.json`: added `DOM.Iterable` to `lib` (was missing; needed for `for..of NodeList`,
    which the ported observer code uses — the client's tsconfig already had it).
  - Tests: `report.test.ts` (6 — state seeding from persisted settings, `refreshBlockedBotsIfStale`'s
    staleness check and persistence), `shared/settings.test.ts` (10), plus one added to
    `user-id-logger.test.ts` for the new `onUserId` callback. Same scope limit as the client's
    identical logic: the DOM injection/observer/retry machinery itself has no test coverage (matches
    the established precedent for this kind of DOM-heavy code in this repo) and needs manual
    verification in Safari — click through several profiles (including a no-photo one) and a direct
    profile deep-link, confirm the 🚩 button attributes to the right account, and confirm the "Block
    Bot Accounts" panel section blocks/unblocks live.
- [x] **Core consolidation.** User feedback after the first pass: the userscript's bot-blocking panel
  (by then just toggle + stat, manual editing already dropped per the note above) was structurally
  identical to the client popup's `#bot-blocking-details` section, which was hand-rolled directly in
  `popup.html`/`popup.ts` rather than sourced from core — unlike geo-override and profile-border,
  which both consumers already share via core. That asymmetry wasn't intentional, just a byproduct of
  the userscript's version briefly having a manual-edit textarea the popup's never had. Fixed by
  extracting the shared piece into core, matching the `wireProfileBorderForm` pattern exactly:
  - `core/src/bot-block.html` / `bot-block.css` / `bot-block-form-contract.ts` / `bot-block-ui.ts`
    (`wireBotBlockForm`) — toggle + 24h-blocked stat + "Coming soon!" gating, scoped under
    `#snp-bot-block-root` like the other two. Exported from `core/src/index.ts`.
    `bot-block-ui.test.ts` (9 tests) moved into core, mirroring `profile-border-ui.test.ts`.
  - `userscript/src/userscript.ts` now imports `BOT_BLOCK_HTML`/`BOT_BLOCK_CSS`/`wireBotBlockForm`
    from `@sniffies-projects/core` instead of local files; deleted the now-redundant
    `userscript/src/bot-block-panel.html`/`.css`/`bot-block-ui.ts`/`bot-block-ui.test.ts`.
  - `client/src/popup/popup.html`: replaced the inline `#bot-blocking-details` markup with
    `<div id="snp-bot-block-root"></div>`, matching the geo/profile-border pattern.
  - `client/src/popup/popup.ts`: injects `BOT_BLOCK_CSS`, mounts `BOT_BLOCK_HTML` into the new root,
    and wires it with `wireBotBlockForm` — replacing ~25 lines of manual element lookups and
    duplicated enable/hint/count/toggle logic that's now in core instead.
  - `client/src/popup/popup.css`: removed `.stat`/`.stat:empty` — dead after the bot-blocking markup
    moved out of `popup.html` (nothing else in `popup.html` used `.stat`).
  - `client/src/popup/popup.test.ts`: updated the HTML fixture and element ids from
    `bot-blocking-*` to `bot-block-*` (core's naming) — all 5 existing bot-blocking describe blocks
    kept their assertions, just retargeted at the new ids.
  - Full suite after consolidation: core 130 (was 121, +9), userscript 23 (was 31, -8 — the moved
    file), client 57 (unchanged, same tests against the new markup), server 104 (untouched) — 314
    total, all passing. Both `client/scripts/build.mjs` and `userscript/scripts/build.mjs` builds
    verified to still produce the expected markup.

## 5. Core + Client: Bot-Block Hook (MAIN world) — filtering Sniffies' own data — done

This is the part of the feature with the most technical risk and the least existing precedent in
the codebase, so treat it as a spike first, implementation second.

- [x] **Investigate before building anything:** (findings from a HAR capture of page load + live
      session, 2026-08-31)
  - Map init: `POST https://uswapi2.sniffies.com/api/post-authentication` — one large JSON response.
    User ids to filter live at `nearbyVisitors.visitors[]._id` (the map pins; each entry is
    `{ _id, data: { location, profile, ... }, initialTTLSeconds, distance, activeVisits }`), and
    also at `partialVisitorData[]._id` (lighter partial profile records), `places.activeVisits[].userId`
    (place check-ins), and `globalMessages.messages[].author` (public map chat wall) — those last two
    are lower priority, not confirmed as in-scope.
  - Chat init: `GET https://uswapi2.sniffies.com/api/v2/post-authentication/chat-data` — user ids
    live at `conversationData.conversations[].participants`, `.author1`, `.author2`,
    `.lastSentMessage.author`, the flat `conversationData.userIds[]` array, and
    `partialVisitorData[]._id` (the profile card shown in the conversation list).
  - Live WebSocket (`wss://prod.ws.sniffies.com/?userId=...`): plain JSON text frames shaped
    `{"eventName": ..., "data": ...}`. Confirmed event shapes: `userJoined` and `userUpdated` carry
    `data._id` + a full profile at `data.data`; `userAwake` and `userDisconnected` carry a bare
    user-id string as `data` (no `_id` wrapper). **Gap:** no live chat message arrived during the
    capture, so the WS event for an incoming chat message is still unconfirmed — needs a fresh HAR
    capture that includes someone sending a message.
  - Leak risk confirmed: `POST https://uswapi2.sniffies.com/api/user/full` with body
    `{"userId": "<id>"}` returns one user's full profile on demand. If anything in the client still
    holds a blocked id after the lists above are filtered (e.g. stale chat history, a "visited you"
    list) and re-requests it via this endpoint, the profile comes back unfiltered — this endpoint
    itself has no way to know a user is blocked, so filtering must also happen wherever its response
    is consumed, not just on the three list endpoints above.
- [x] Design the hook (`core/src/bot-block-hook.ts`):
  - Patches `XMLHttpRequest` (confirmed via the HAR — Sniffies uses XHR, not `fetch`, for both init
    calls), shadowing `responseText`/`response` as instance-level accessor properties so the app
    gets the filtered payload no matter when it reads the response, rather than racing its own
    `load`/`readystatechange` listeners. Wraps the WebSocket *instance* returned by the constructor
    (`addEventListener('message', ...)` and the `onmessage` property, both shadowed) to drop
    blocked-account frames before they reach the page's real listeners.
  - Filtering scope, per the investigation findings above: `nearbyVisitors.visitors` +
    `partialVisitorData` (post-authentication), `conversationData.conversations` +
    `.userIds` + `partialVisitorData` (chat-data), and `userJoined`/`userUpdated`/`userAwake`/
    `userDisconnected` WS frames. `places.activeVisits`, `globalMessages`, and the `/api/user/full`
    leak path are **not** filtered — explicitly out of scope, noted in the investigation findings.
  - Live-updatable blocklist + enabled flag via a `getState()` callback, mirroring
    `installGeoHook`'s `getOverride()` pattern.
  - Race condition handled as planned: `sniffies-bot-block-hook.ts` starts with
    `{ blockedIds: new Set(), enabled: false }` until the relay's first `postMessage` arrives, so
    early responses pass through unfiltered rather than guessing.
  - Pure filter/decision functions (`filterPostAuthenticationPayload`, `filterChatDataPayload`,
    `shouldFilterWebSocketFrame`) are unit tested in `bot-block-hook.test.ts` (17 tests), including
    end-to-end instance-level XHR/WS filtering against mock constructors mirroring
    `user-id-hook.test.ts`'s pattern.
- [x] `client/src/content/sniffies-bot-block-hook.ts` (MAIN world, `document_start`) — installs the
      hook, mirrors `sniffies-user-id-hook.ts`.
- [x] `client/src/content/sniffies-bot-block-relay.ts` (isolated world, `document_start`) — reads
      `blockedBots` + `botBlockingEnabled` from storage, posts them to the MAIN-world hook on load
      and on `chrome.storage.onChanged`, mirrors `sniffies-geo-relay.ts`.
- [x] Registered both in `client/manifest.json` alongside the existing MAIN/isolated pairs, and
      added both entry points to `client/scripts/build.mjs`'s `tsEntries`.
- [x] Fragility noted in a header comment on both `core/src/bot-block-hook.ts` and
      `client/src/content/sniffies-bot-block-hook.ts` — not yet in a README.
- [x] The pure filter/decision functions and the instance-level XHR/WS wiring have unit test
      coverage (above). What's still unverified: the hook's actual behavior against **live**
      Sniffies traffic — that needs manual testing in the browser (load the extension, report/add a
      test account to `blockedBots`, confirm it disappears from the map, chat list, and live WS
      updates) before shipping.
- [x] **Real-world regression found and fixed** (from a second HAR capture, ~1hr after the first,
      while manually testing with `blockedBots` seeded via `chrome.storage.local`):
  - The blocked chat account was still showing up. Root cause: every `/api/*` call had moved hosts
    between the two captures — `uswapi2.sniffies.com` → `usw.api.sniffies.com` — and XHR matching
    was hardcoded to the first hostname, so `classifyXhrUrl` silently returned `null` for
    everything and nothing was ever filtered. Fixed by matching on **path only** against any
    `*.sniffies.com` host (`isSniffiesApiHost`), not a fixed hostname. Regression test added.
  - While investigating, found a fourth surface this session's traffic exercised that wasn't
    covered: `GET /api/messages?conversationId=...` (fetched when a conversation is actually
    opened), returning `{ messages: [{ author, ... }], partialUsers: [{ _id, ... }] }`. Added
    `filterMessagesPayload` for it — filters `messages[]` by `.author` and `partialUsers[]` by
    `._id`. This is defense-in-depth: if `chat-data` filtering works, the conversation shouldn't be
    reachable from the inbox in the first place, but a stale/cached/bookmarked thread could still
    hit this endpoint directly.
  - Added logging per user request: every successful filter now calls `log.warn` (always visible,
    not gated behind `__DEBUG__`) naming exactly which blocked id(s) were removed and from which
    endpoint/WS event — `[sniffies-bot-block] filtered blocked account(s) from <kind> response: [...]`
    or `... from WS <eventName> frame: <id>`. Check the console with this filter if blocking seems
    to not be working.
  - `places.activeVisits`, `globalMessages`, and the `/api/user/full` leak path (confirmed hit again
    in this second capture — the user navigated directly to the blocked account's `/profile/<id>`
    page) remain **unaddressed**, same as noted in the original investigation findings above.

## 5b. Popup stat + manual editing — done

- [x] **"N bots blocked in the last 24 hours" popup stat.** `core/src/blocked-bot-log.ts`:
  day-bucketed log (`BlockedBotDailyLog = { [dateKey]: string[] }`, UTC calendar day). `recordBlockedBotIds`
  merges newly-filtered ids into today's bucket and drops every bucket except today + yesterday (so it
  can't grow unbounded); `countDistinctBlockedBotsLast24h` unions those two buckets — an approximation
  of a rolling 24h window using day buckets, not an exact timestamp cutoff, per the original ask.
  - `installBotBlockHook` (`core/src/bot-block-hook.ts`) takes an optional second `onFiltered?: (ids:
    string[]) => void` param, fired alongside the existing `log.warn` every time a filter actually
    removes something (both XHR and WS paths).
  - `sniffies-bot-block-hook.ts` (MAIN world) wires `onFiltered` to `window.postMessage({ source:
    "sniffies-bot-block-hook", kind: "filtered", ids })`. `sniffies-bot-block-relay.ts` (isolated
    world) listens for it and calls `recordBlockedBotEvent` (`client/src/shared/settings.ts`), which
    reads/merges/writes the `blockedBotEventsByDay` storage key — same MAIN→isolated round-trip
    pattern `sniffies-geo-hook.ts`/`sniffies-geo-relay.ts` already uses for observed positions.
  - Popup renders `countDistinctBlockedBotsLast24h(settings.blockedBotEventsByDay)` on open — a
    static read, not live-updating while the popup is open (popups are short-lived; not worth the
    `chrome.storage.onChanged` wiring for that). Hidden when the count is 0 or `REPORTING_ENABLED` is
    false. (Originally its own `bot-blocking-count` element/`.stat:empty` CSS directly in `popup.ts`;
    now rendered by core's `wireBotBlockForm` — see section 4's "Core consolidation" entry.)
  - Tests: `core/src/blocked-bot-log.test.ts` (8 tests, pure functions with an injectable `now`),
    2 new `installBotBlockHook` tests for `onFiltered`, 3 new popup tests (the enabled branch needs
    `vi.doMock("../shared/env.js", ...)` since `__REPORTING_ENABLED__` is baked in `false` at the
    `vitest.config.ts` level — remember `vi.doMock` survives `vi.resetModules()`, so that describe
    block explicitly `vi.doUnmock`s in `afterEach` or the mock leaks into every later describe block
    in the file).
- [x] **Manual editing of the blocklist in the settings page.** New `.blocked-bots-section` in
  `client/src/settings/settings.html`/`.ts`/`.css`: a textarea (one Sniffies id per line), populated
  from `blockedBots` on load, validated against `SNIFFIES_USER_ID_REGEX` (`core/src/settings.ts` —
  24-char hex Mongo ObjectId, confirmed via HAR) on save. Invalid input shows which id(s) failed and
  does not save (mirrors the existing phone-number validation UX). Saving reuses `setBlockedBots`
  (the same setter `fetchBlockedBots` uses), so it also refreshes `blockedBotsFetchedAt` — a manual
  edit won't immediately get overwritten by the next staleness-triggered auto-refresh. Section hidden
  when `REPORTING_ENABLED` is false, same gating convention as the other feature-flagged sections.
  Tests: `settings.test.ts` (4 new tests — populate, save with dedupe/trim, reject invalid, clear
  invalid state on edit).

## 5c. Live chat message leak — found and fixed

User report: reloading with bot-blocking on was still causing the blocked test account to see its
messages marked as read. Investigated via a fresh HAR (`sniffiesChatRead.har`) captured with
Preserve Log on and DevTools open from before reload.

- [x] **Root cause: the `newMsg` WebSocket event was completely unfiltered.** It's the live 1:1
  chat-message event — unconfirmed in the original investigation (no message arrived during that
  capture), now confirmed: `{"eventName":"newMsg","data":{"message":{author,body,conversationId,
  userIdFrom,userIdTo,...},"conversation":{...}}}`. In the HAR, each `newMsg` frame from the blocked
  account is followed **~1ms later** by a `GET /api/conversation/visitor?visitorId=<author>` — proving
  the app reacts to the WS frame by immediately fetching full conversation details, which is almost
  certainly what causes the read-receipt-like effect on the counterpart's side.
  - This is a case response-filtering fundamentally can't fix: `newMsg` isn't an XHR response we
    rewrite after the fact, it's a WS push. Once it reaches the app, whatever side effect it triggers
    (here, the `/api/conversation/visitor` fetch) has already happened. Dropping the frame itself —
    which the WS hook already does for other event types — is what actually stops the chain.
  - Fixed in `parseWsFrame` (`core/src/bot-block-hook.ts`): added `newMsg` (extracts
    `data.message.author`) alongside the existing event types. Also added `userRemoved` — another
    bare-string-id presence event, sibling to `userDisconnected`, found unfiltered in the same HAR's
    event-name census, fixed the same way (low-risk, same code path already handles this shape).
  - Investigation note for future reference: the full event-name census (grep `_webSocketMessages`
    for `eventName`) is a cheap, thorough way to catch this class of gap — better than waiting on a
    live capture to happen to include the specific event. Worth doing again if new symptoms show up:
    `activeVisitUpdated`, `globalChatMessageDeleted`, `newGlobalMsg` also turned up unfiltered but are
    the already-noted-out-of-scope place-visit/global-chat-wall surfaces, not touched.
  - Tests: 3 new (`shouldFilterWebSocketFrame` for `newMsg` and `userRemoved`, plus one end-to-end
    `installBotBlockHook` test dispatching a `newMsg` MessageEvent through the WS instance).

## 5d. New-conversation leak — found and fixed

Found via the new `e2e/scripts/check-har-schema.mjs` payload/schema canary (see
`PLAYWRIGHT_TESTING_TODO.md` §0b), run against 7 real HAR captures — not a user report this time,
the tool caught it directly by census-ing every WS `eventName` seen and flagging ones our filter
doesn't recognize.

- [x] **Root cause: the `newConversation` WebSocket event was completely unfiltered.** Same class of
  bug as the `newMsg` leak in §5c, just for the *first* message of a brand-new thread instead of one
  in an existing conversation: `{"eventName":"newConversation","data":{"conversation":{_id,
  participants,author1,...},"submittedMessage":{_id,author,body,conversationId,userIdFrom,userIdTo,
  ...},"partialUser":{_id,data}}}`. `data.partialUser._id` is the counterpart's id (same shape as
  `partialVisitorData`/`partialUsers` elsewhere) — used as the definitive id rather than parsing
  `conversation.participants`/`.author1`, since it doesn't require knowing which side of the
  conversation the blocked account is on.
  - Fixed in `parseWsFrame` (`core/src/bot-block-hook.ts`): added `newConversation`, extracting
    `data.partialUser._id`, alongside the existing event types.
  - `check-har-schema.mjs` updated to expect `newConversation` and validate its shape too, instead of
    flagging it as an unknown event — re-verified against the same 7 HAR captures, all passing.
  - `activeVisitUpdated`/`globalChatMessageDeleted`/`newGlobalMsg` still turn up unfiltered across
    captures — same already-noted-out-of-scope place-visit/global-chat-wall surfaces from §5c, not
    new findings, not touched.
  - Tests: 2 new (`shouldFilterWebSocketFrame` for `newConversation`, plus one end-to-end
    `installBotBlockHook` test dispatching a `newConversation` MessageEvent through the WS instance).

## 6. Docs — done

- [x] `server/README.md`: documents `REPORTING_ENABLED`, `POST /api/report`, `GET /api/blocked-bots`,
      and the manual `blocked_reporters` / `validated_reports` promotion workflow (added this
      session, alongside section 2). `client/README.md` already listed the feature and its
      `REPORTING_ENABLED` flag before this session; `userscript/README.md` now documents its own
      usage (the 🚩 button and the panel's "Block Bot Accounts" toggle) as of the userscript mirror
      work above.

## 7. Code review follow-ups (PR #17) — done

Findings from a review pass over this PR's diff. Ranked most-severe first within each group.

### Correctness — done

- [x] `server/api/report.ts` (~line 47-57): validate `reportedUserId`/`reporterUserId` against
      `SNIFFIES_USER_ID_REGEX` (`core/src/settings.ts`) instead of only checking non-empty.
      `CLIENT_SECRET` is baked into the public extension/userscript bundle (not a real per-user
      secret — see `server/api/_shared.ts`), so today anyone can POST fabricated `reporterUserId`
      values straight to the endpoint and inflate `report_count`/`reporting_user_ids` for any
      target without any real distinct reporters involved, making report-brigading trivial.
      Fixed: added the regex check (`server/api/report.ts`), which as a side effect also closes the
      LIKE-pattern injection below (hex-only ids can't contain `,`/`%`/`_`). Deeper abuse hardening
      (rate limiting, repeat-offender detection) is still explicitly out of scope — see Future TODO.
      Tests: 2 new in `server/tests/report.test.ts`.
- [x] `server/api/report.ts` (~line 80): the dedupe `LIKE` pattern
      (`(',' || reporting_user_ids || ',') LIKE ('%,' || EXCLUDED.reporting_user_ids || ',%')`) is
      built from the raw, unescaped `reporterUserId`. A comma in the id corrupts the
      comma-delimited list (breaks a later legitimate report from the split-off id); a `%` turns it
      into a wildcard that spuriously matches existing lists. Fixed by the regex validation above —
      not touching the `TEXT`/comma-list schema itself given the migration script only supports
      idempotent `CREATE TABLE IF NOT EXISTS` statements (see `scripts/migrate.mjs`'s header
      comment); a column-type change would need real `ALTER TABLE` migration support this repo
      doesn't have yet, so left as-is rather than risking a one-way schema change for a stylistic win.
- [x] `core/src/report-ui.ts` (`wireReportModal`, ~line 62-74): the submit handler has no
      request-generation guard, but `ensureReportModal()` in both `client/src/content/
      sniffies-profile-id.ts` and `userscript/src/report.ts` memoizes one shared modal instance
      reused across every profile. Submit for profile A, cancel before the fetch resolves, open the
      modal for profile B — A's stale response then closes/clears B's modal with a false "Reported.
      Thanks." Fixed: `wireReportModal` now bumps a `generation` counter on every `open()` and
      ignores a stale `.then()`/`.catch()` whose generation has moved on. Tests: 2 new in
      `core/src/report-ui.test.ts`.
- [x] `core/src/geo-override-ui.ts` (~line 99-114): unchecking "spoof location" used to call
      `commitSave()` synchronously before also fetching the real position; that immediate save was
      dropped, so disabling now only persists once the async geolocation call resolves (success or
      the ~10s timeout). Closing the popup in that window leaves spoofing enabled in storage even
      though the UI showed it unchecked. Fixed: restored the immediate `commitSave()` call before
      `fillWithCurrentPosition`. Found in the process: `geo-override-ui.test.ts`'s "cancels pending
      location fetch when re-enabled" test predates this PR and was already asserting the wrong
      thing (`onSave` never called) — confirmed it already failed against `origin/main`'s version of
      the source too, so it wasn't this PR's regression, just a stale assertion. Corrected it to
      expect one call (the immediate disable-time save) and no second call from the aborted late
      response, and added a new test for the actual bug (save fires even if the position fetch never
      resolves).
- [x] `client/src/shared/settings.ts` (`recordBlockedBotEvent`, ~line 54): non-atomic
      read-modify-write against `chrome.storage.local` (get → compute → set). `onFiltered` can fire
      more than once in quick succession (e.g. map-init and chat-init responses resolving close
      together), and concurrent calls race — last write wins, silently dropping ids from that day's
      blocked-bot log that feeds the popup's "N blocked in the last 24h" stat. Fixed by chaining
      calls through a module-level promise so each call's read waits for the previous call's write.
      New test file `client/src/shared/settings.test.ts` (this module had no test coverage before);
      confirmed the added "merges ids from overlapping concurrent calls" test actually fails against
      the pre-fix code (lost update reproduced) before verifying it passes against the fix.

### Reuse / architecture — done

- [x] `userscript/src/report.ts` vs `client/src/content/sniffies-profile-id.ts`: ~250 lines of
      report-button DOM injection (id extraction, button building, the panel-switch race handling
      via a generation counter, `MutationObserver` + retry scheduling) is duplicated near-verbatim
      instead of living in `core/`, unlike every other hook in this feature (`installBotBlockHook`,
      `installGeoHook`, `installProfileBorderRedirect` all live in core and are thinly wired by each
      consumer). The panel-switch race fix documented in §4 above lives in two files with no shared
      test coverage — a future timing fix applied to one and forgotten in the other silently
      reintroduces the mis-attributed-report-button bug in only one client. Fixed: extracted
      `installReportButtonInjection` into new `core/src/report-button-hook.ts` — id extraction
      (`extractUserIdFromUrl`/`extractUserIdFromProfilePath`/marker parsing), the report modal
      wiring (`ensureReportModal`/`submitReport`), the button itself, and the full panel-switch
      race/retry/deep-link/no-photo machinery now live in exactly one place. The one real
      difference (the client's favorites star, which shares the same panel-resolution/retry
      machinery independent of `REPORTING_ENABLED`) is handled via two callbacks:
      `onProfileResolved(screen, userId)` (fires whenever the current panel is (re-)resolved, so a
      consumer can inject additional per-profile UI into it) and `onMarkerClick(marker, selection)`
      (fires on every marker click with the already-parsed `{userId, profilePicUrl}`, so a consumer
      can use data the shared hook itself doesn't need — the client uses `profilePicUrl` for the
      favorite payload). `client/src/content/sniffies-profile-id.ts` now only keeps the
      favorites-specific code (`buildInjection`/star, `injectIntoNameLabel`, `fetchFavorites`);
      `userscript/src/report.ts` is now a thin `installReportFeature`/`refreshBlockedBotsIfStale`
      wrapper around the core hook and `installBotBlockHook`.
  - Same root cause, smaller scope: `fetchBlockedBots`/`refreshBlockedBotsIfStale` (the 24h
    staleness check + `GET /api/blocked-bots` fetch) is also duplicated line-for-line between the
    two files, differing only in the storage backend (`chrome.storage` vs the userscript's local
    state). Fixed: folded into the same core module as `fetchBlockedBots`/`refreshBlockedBotsIfStale`,
    parameterized by an `onResult(userIds, fetchedAt)` callback — the client's callback just calls
    `setBlockedBots`; the userscript's also updates its in-memory `ReportFeatureState.botBlockState`
    (its bot-block hook has no separate relay to pick up a storage write, unlike the client).
  - Verification: full monorepo unit suite (`node scripts/test-all.mjs`, 329 tests across core/
    client/bookmarklet/userscript/server) passes; `yarn typecheck` and `yarn build` pass in both
    `client/` and `userscript/`; and — since this is exactly the DOM-injection code path noted
    throughout this TODO as having no unit coverage and needing manual verification — ran the real
    Playwright e2e suites against the actual built extension and userscript
    (`e2e/tests/extension/smoke.spec.ts`, `e2e/tests/userscript/smoke.spec.ts`, both marker-click →
    report-button-injection and the profile-border redirect), all 4 passing.

### Simplification / efficiency — done

- [x] `core/src/bot-block-hook.ts` (`collectBlockedIdsPresent` + `applyFilter`, ~line 147-197 /
      352-357): every filtered response is traversed twice — once to find which blocked ids are
      present (for the log line), once to actually remove them — with the three payload shapes'
      structure duplicated across both functions. Fixed: kept the `filter*Payload` functions'
      existing return shape (still just the filtered payload — they're part of core's public API
      and their tests assert on that return value directly) but gave `filterById` and the three
      `filter*Payload` functions an optional `removed?: Set<string>` accumulator they populate as
      they filter, in the same pass. `installXhrFilter` now calls `applyFilter` once with a fresh
      `Set`, and `collectBlockedIdsPresent` is deleted entirely. Tests: existing 30
      `bot-block-hook.test.ts` cases unaffected (the optional param defaults to unused).
- [ ] `server/schema.sql` (`pending_reports.reporting_user_ids`) + `server/api/report.ts` (~line
      79-93): the reporter set is a comma-joined `TEXT` column with the same LIKE-based
      "already reported?" check repeated across three independent `CASE` branches
      (`reporting_user_ids`/`messages`/`report_count`), and `report_count` is a separate counter
      that's fully derivable from `reporting_user_ids`. Not done: the LIKE-injection half of this
      (a comma/`%`/`_` in `reporterUserId` corrupting the check) is already closed by the id-format
      validation added above, since a validated 24-char hex id structurally can't contain those
      characters — so the remaining ask here is purely stylistic (a `TEXT[]` column instead of
      triplicated `CASE` branches), and `scripts/migrate.mjs` only supports idempotent
      `CREATE TABLE IF NOT EXISTS` statements re-run on every deploy, not `ALTER TABLE` column-type
      changes — doing this safely needs real migration tooling this repo doesn't have yet. Left as a
      style-only cleanup, not worth a one-way schema change to chase.
- [x] `core/src/bot-block-hook.ts` (~line 328-365, the XHR `send` patch): `JSON.parse` of text-mode
      response bodies runs unconditionally to compute the cached `json` value, even though the
      filtering step that uses it is gated behind `state.enabled && state.blockedIds.size > 0`.
      When bot-blocking is disabled or the blocklist is empty, every intercepted response still
      pays a parse it wouldn't otherwise incur, for a result that's immediately discarded. Fixed:
      the parse (and the filter pass) are now both gated on a single `shouldFilter` check computed
      up front. Tests: 2 new, spying on `JSON.parse` to confirm it's not called when disabled or
      when the blocklist is empty.

---

## Future TODO (explicitly out of scope for now)

- Normalize `pending_reports` off comma-separated `reporting_user_ids` / JSONB `messages` into a
  proper `report_events` join table once report volume or review tooling makes the denormalized
  version painful to query.
- Build an actual admin review UI for promoting `pending_reports` → `validated_reports` instead of
  manual DB access.
- Harden abuse prevention beyond the manual `blocked_reporters` list — e.g. rate limiting,
  repeat-offender auto-detection — if manual blocking turns out to be too slow to react.
- Background-driven (not page-load-triggered) refresh of the blocked-bots cache, so it stays fresh
  even without a Sniffies tab open. Same limitation in both consumers now, since the userscript
  mirror (`refreshBlockedBotsIfStale` in `userscript/src/report.ts`) copied the client's
  page-load-only pattern: `chrome.alarms` (needs a new `alarms` manifest permission) would cover the
  Chrome extension, but userscripts have no background-execution API at all, so this one would need
  a different mechanism there — possibly nothing better than "next tab load" is realistically
  available for the userscript side.
- Migrate `favorites.ts` off `guid` onto the Sniffies user id for consistency with the rest of the
  identity model — not required for this feature, but the same bad pattern this feature is
  deliberately avoiding.
- Revisit whether validated reports ever need to be un-blocked / expired (currently a one-way
  promotion with no reversal path beyond manual `DELETE`).
- As reports scale, may need to change how fetching suspected bots works. There are 2 kinds of bots:
  ones that message you from far away, and ones that sit on the map always online. The map-sitting
  ones could be sent to the user based on proximity. The ones that message you don't live very long —
  they could be blocked for a week before they're no longer a concern and don't need to be sent to
  the user at all.