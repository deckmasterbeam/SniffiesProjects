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

## 2. Server (`server/api`)

- [ ] `report.ts` — `POST` only:
  - `applyCors`, `requireFeatureFlag(res, "REPORTING_ENABLED")`, `requireClientAuth`, `requireDb`.
  - Validate `reportType` against the enum allow-list, require `reportedUserId` + `reporterUserId` (Sniffies ids), trim + length-cap optional `message`.
  - Look up `reporterUserId` in `blocked_reporters` **first**. If present: return `{ ok: true }` (200) and do nothing else — no insert, no log line that could leak into server logs/monitoring in a way that tips off the abuser.
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
    (First insert seeds `reporting_user_ids` with the single new reporter id, so `EXCLUDED.reporting_user_ids` is always just that one id — the dedupe check works whether the row is new or existing.)
  - Same reporter reporting the same profile twice is a no-op (already covered by the `LIKE` dedupe check) rather than inflating the count.
- [ ] `blocked-bots.ts` — `GET` only:
  - `applyCors`, `requireClientAuth`, `requireDb`.
  - `SELECT reported_user_id FROM validated_reports`, return `{ ok: true, userIds: [...] }`.
- [ ] Add `REPORTING_ENABLED` to `server/.env.example`.
- [ ] Tests: `server/tests/report.test.ts` (including the blocked-reporter silent-drop path and the consolidation/dedupe path) and `server/tests/blocked-bots.test.ts`, mirroring `favorites.test.ts` / `watched-users.test.ts`.
- [ ] Managing `blocked_reporters` and promoting `pending_reports` → `validated_reports` stays manual (direct DB access) — no admin UI in scope. Note the workflow in `server/README.md`.

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
- [ ] `bot-block-hook.ts` — still section 5 below; not started.

## 4. Client (`client/src`) — done except userscript mirroring

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
  - `reporterUserId` comes from `settings.sniffiesUserId` (tracked in module state, kept in sync
    via `chrome.storage.onChanged`, same pattern as `currentGuid`) — **not** `guid`, per the
    identity decision above. If it's empty (hook hasn't observed it yet), the button no-ops with a
    console warning instead of sending a blank id.
  - Report modal is lazily mounted once (`ensureReportModal`) into `document.body`; submit calls
    `POST /api/report` with `reportType: "bot_suspected"`.
  - `fetchBlockedBots` / `refreshBlockedBotsIfStale` added, called from the existing init flow
    (mirrors `fetchFavorites`'s "fetch on init" pattern) — gated on `REPORTING_ENABLED`, staleness
    check is `Date.now() - blockedBotsFetchedAt > 24h`.
  - **Not yet consumed anywhere** — the fetched list is cached but nothing filters against it yet;
    that's section 5.
- [x] Popup: "Block Bot Accounts" collapsible section, same disabled/"Coming soon!" gating as
      Favorites when `REPORTING_ENABLED` is false. Toggle only persists the preference for now —
      it has nothing to propagate to yet since the section 5 hook doesn't exist.
- [x] Tests: extended `popup.test.ts` with a "bot blocking" describe block (gated-state assertions
      + section-open persistence), mirroring the favorites tests.
- [ ] Mirror the report button into `userscript/src/userscript.ts` — still unstarted, scope
      unconfirmed.
- [ ] The actual POST to `/api/report` and GET from `/api/blocked-bots` can't be exercised
      end-to-end yet since section 2 (the server endpoints) isn't built — client code was written
      against the contract agreed in section 2's TODO, not verified against a live server.

## 5. Core + Client: Bot-Block Hook (MAIN world) — filtering Sniffies' own data

This is the part of the feature with the most technical risk and the least existing precedent in
the codebase, so treat it as a spike first, implementation second.

- [ ] **Investigate before building anything:**
  - What does the "init" call actually look like? (Likely a `fetch`/`XHR` request on page load that seeds nearby cruisers before the WebSocket takes over — needs to be found via the Network tab, not guessed.) Capture its endpoint, request/response shape, and where the user id lives in each entry.
  - What does a live WebSocket update look like? `installUserIdHook` only reads the *connect URL*, never the message payload — this feature needs the actual message format (does each `message` event carry one user's data or a batch? is it JSON, or something else?).
  - Confirm whether removing/mutating entries from these payloads before the Sniffies app parses them actually hides the user from the map/UI, or whether the app also correlates data some other way (e.g. a separate profile-fetch call) that would leak the blocked user back in.
- [ ] Design the hook (`core/src/bot-block-hook.ts`) once the above is known:
  - Likely needs to patch `window.fetch`/`XMLHttpRequest` for the init call, **and** wrap the WebSocket *instance* returned by the constructor (intercepting `onmessage`/`addEventListener('message', ...)`, not just reading the connect URL like `installUserIdHook` does) to filter or rewrite incoming payloads before dispatching them to the page's real listeners.
  - Needs a live-updatable blocklist (`Set<string>`) and an enabled/disabled flag, both settable after install — mirror `installGeoHook`'s `getOverride()` callback pattern rather than baking the list in at install time.
  - Race condition to handle: this hook runs at `document_start`, before the isolated-world content script has read `chrome.storage` and relayed the blocklist over. Buffer or pass through unfiltered until the first blocklist relay arrives; document that early messages may not be filtered.
- [ ] `client/src/content/sniffies-bot-block-hook.ts` (MAIN world, `document_start`) — installs the hook, mirrors `sniffies-user-id-hook.ts`.
- [ ] `client/src/content/sniffies-bot-block-relay.ts` (isolated world, `document_start`) — reads `blockedBots` + `botBlockingEnabled` from storage, posts them to the MAIN-world hook on load and on `chrome.storage.onChanged`, mirrors `sniffies-geo-relay.ts`.
- [ ] Register both in `client/manifest.json` alongside the existing MAIN/isolated pairs.
- [ ] This is inherently fragile — it depends on reverse-engineered wire formats that Sniffies can change without notice. Note that explicitly somewhere visible (README or a code comment on the hook) so a future silent breakage isn't a mystery.
- [ ] No automated test coverage is realistic for the actual filtering logic against live Sniffies traffic — plan for manual verification only, and say so rather than claiming test coverage that doesn't exist.

## 6. Docs

- [ ] `client/README.md` / `server/README.md`: document `REPORTING_ENABLED`, the new endpoints, the manual `blocked_reporters` / `validated_reports` promotion workflow, and the bot-blocking toggle.

---

## Future TODO (explicitly out of scope for now)

- Normalize `pending_reports` off comma-separated `reporting_user_ids` / JSONB `messages` into a
  proper `report_events` join table once report volume or review tooling makes the denormalized
  version painful to query.
- Build an actual admin review UI for promoting `pending_reports` → `validated_reports` instead of
  manual DB access.
- Harden abuse prevention beyond the manual `blocked_reporters` list — e.g. rate limiting, repeat-offender
  auto-detection — if manual blocking turns out to be too slow to react.
- Background-driven (not page-load-triggered) refresh of the blocked-bots cache using
  `chrome.alarms`, so it stays fresh even without a Sniffies tab open. Needs a new `alarms`
  manifest permission.
- Migrate `favorites.ts` off `guid` onto the Sniffies user id for consistency with the rest of the
  identity model — not required for this feature, but the same bad pattern this feature is
  deliberately avoiding.
- Revisit whether validated reports ever need to be un-blocked / expired (currently a one-way
  promotion with no reversal path beyond manual `DELETE`).
- As reports scale, I'm curious if I may need to change the way the fetching of suspected bots works. There are 2 kinds of bots, ones that message you from far away and ones that sit on the map always online. The ones that sit on the map could be sent to the user based on proximity. The ones that message you don't live very long, they could be blocked for a week before they're no longer of concern and don't need to be sent to the user.


- Shouldn't the client settings file live in core? The structure of the settings should be the same between userscript and client, its just a matter of which set of settings each one picks
- add this to the userscript too