# Bot Reporting Feature — TODO

Feature: users can flag a profile as a suspected bot from the profile screen. Reports land in
`pending_reports`; confirmed ones get manually promoted into `validated_reports`. The client
fetches `validated_reports` (as "blocked bots") on init, caches it for 24h, and — if enabled —
filters blocked accounts out of what Sniffies shows the user entirely (map, chat, WebSocket).

Key decisions:
- Identity key is the **Sniffies user id**, not the extension's `guid`.
- Abuse handling: a manual `blocked_reporters` list; blocked reporters get a silent no-op.
- Multiple reports against the same profile consolidate into one `pending_reports` row.
- Deep scaling concerns (normalized schema, admin review UI, rate limiting) are out of scope —
  see Future TODO.

---

## 1. Database — done

`report_type` (TEXT + CHECK, not a native enum — fits the existing idempotent migration script),
`blocked_reporters`, `pending_reports` (consolidated, comma-separated reporter ids + JSONB
messages), `validated_reports`.

## 2. Server — done

- `POST /api/report`: validates input, silently drops reports from blocked reporters, upserts
  into `pending_reports` with dedupe.
- `GET /api/blocked-bots`: returns confirmed bot ids.
- Manual review/promotion workflow (`pending_reports` → `validated_reports`) stays a
  direct-DB-access process, documented in `server/README.md`.

## 3. Core UI — done

`report-ui.ts` (`wireReportModal`): report modal with an optional message field, shared by
client + userscript.

## 4. Client + userscript — done

- Report button injected next to the pin button on a profile panel; opens the modal; submits to
  `/api/report`.
- Blocked-bots list fetched on init and cached for 24h.
- Popup/panel: "Block Bot Accounts" toggle section, gated behind `REPORTING_ENABLED`.
- Fixed two bugs along the way: the report button getting mis-attributed to the wrong profile
  during a fast panel switch, and wrong attribution for no-photo profiles — both fixed by making
  the profile URL the authoritative source of "who's on screen" instead of a stale click-time
  value.
- Full userscript mirror built for parity (single-world, no popup — a floating panel section
  instead).
- Bot-blocking panel UI later consolidated into one shared `core/src/bot-block-ui.ts` (was
  hand-rolled separately in client and userscript).

## 5. Bot-block hook (network filtering) — done

- Reverse-engineered (via HAR capture) which Sniffies network surfaces carry blocked-account
  data: map init, chat init, an opened thread, and the live WebSocket.
- `core/src/bot-block-hook.ts` patches `XMLHttpRequest` and `WebSocket` to strip blocked ids
  before the page sees them; live-updatable blocklist/enabled flag.
- Bugs found and fixed post-launch: the API hostname changed mid-session (fixed by matching on
  path only); a `newMsg` WS event leaked live chat messages; a `newConversation` WS event leaked
  new threads (caught by the HAR-schema e2e canary).
- "N bots blocked in the last 24h" popup stat, and a manual blocklist-editing textarea in the
  settings page.

## 6. Docs — done

`server/README.md`, `client/README.md`, `userscript/README.md` updated for the new
endpoints/flags/UI.

## 7. Code review follow-ups — done

- Fixed 5 correctness bugs found in review: unvalidated report ids (enabling report-brigading), a
  SQL LIKE-pattern injection, a stale-modal race between profiles, a dropped geo-spoofing save,
  and a storage race in the blocked-bot log.
- Extracted ~250 lines of duplicated report-button injection logic (client + userscript) into a
  shared `core/src/report-button-hook.ts`.
- Two efficiency cleanups in the bot-block hook (single-pass filtering, skip parsing when nothing
  to filter).

---

## Future TODO (explicitly out of scope for now)

- Normalize `pending_reports` into a proper join table if report volume grows.
- Build an admin review UI instead of manual DB access.
- Harden abuse prevention (rate limiting, repeat-offender detection).
- Background-driven refresh of the blocked-bots cache (not just page-load-triggered).
- Migrate `favorites.ts` off `guid` for identity consistency.
- Revisit whether validated reports can be un-blocked/expired.
- Reconsider list-based bot fetching at scale (proximity-based map bots vs. short-lived
  message-only bots).
