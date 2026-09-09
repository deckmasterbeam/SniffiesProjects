# Sniffies Tools — Playwright E2E

Two things live here, tracked in the root [`PLAYWRIGHT_TESTING_TODO.md`](../PLAYWRIGHT_TESTING_TODO.md):

1. **Fixture-based extension/userscript tests** (§0–§11 of the TODO) — harness + a first smoke test
   exist for both the Chrome extension (`extension` project) and the userscript (`userscript`
   project, below); most feature coverage (§1–§11) doesn't yet.
2. **A drift canary against live sniffies.com** (§0b) — done, both the selector half (Playwright,
   below) and the payload/schema half (`check-har-schema.mjs`, below).

Neither is wired into `yarn test` at the repo root. The fixture suites will be, once they cover more
than a smoke test; the canary never should be — it depends on a live third-party site and a real
account, so it's run by hand. `yarn test:all` runs every automated suite (`canary` + `extension` +
`userscript`) in one go — see [Running everything](#running-everything) below.

## Setup

```bash
cd e2e
yarn install
npx playwright install chromium
```

## Fixture-based extension tests

```bash
yarn test:extension
```

Loads the real Chrome extension from `client/dist` (rebuild it first if you've changed `client/` or
`core/` source — `cd client && yarn build`) into a persistent Chromium context, and routes any
navigation to `https://sniffies.com/**` to a local fixture page
([`fixtures/sniffies-mock.html`](fixtures/sniffies-mock.html)) instead — the browser still sees a
real `sniffies.com` origin (so the extension's content scripts inject exactly as they would on the
live site), but no request ever leaves the machine. Server endpoints (`report`, `favorites`, etc.)
are stubbed the same way via [`fixtures/server-mocks.ts`](fixtures/server-mocks.ts).

See [`fixtures/extension.ts`](fixtures/extension.ts) for the `context`/`extensionId` test fixtures,
and [`fixtures/storage.ts`](fixtures/storage.ts) for seeding/reading `chrome.storage.local` directly
in a test instead of clicking through the popup/settings UI.

## Fixture-based userscript tests

```bash
yarn test:userscript
```

Loads the built `userscript/dist/sniffies-tools.user.js` via **direct injection**
(`page.addInitScript`) against the same shared fixture page the extension tests use — this is what a
real userscript manager would run at `@run-at document-start`, just without an actual manager
runtime in between. Rebuild first if you've changed `userscript/` or `core/` source
(`cd userscript && yarn build`).

Safe to treat as a faithful stand-in because the userscript declares `@grant none` and only touches
plain `localStorage`/DOM/`fetch`/geolocation — no `GM_*` APIs a manager would need to polyfill. See
[`fixtures/userscript.ts`](fixtures/userscript.ts) for `injectUserscript`/`mockSniffiesPage`/
`seedUserscriptStorage`.

**Not yet covered:** a real userscript-manager-based test (e.g. Tampermonkey loaded into a
persistent context, installing the `.user.js` through it) — tracked as a follow-up in
[`PLAYWRIGHT_TESTING_TODO.md`](../PLAYWRIGHT_TESTING_TODO.md) §0. Direct injection is the primary
strategy for actual feature testing either way; the manager-based test exists to catch drift in the
install/match/run-at pipeline itself, which direct injection can't.

## Running everything

```bash
yarn test:all
```

Runs `canary` + `extension` + `userscript` together (not `setup` — that's the manual login step, not
a test). Still needs `yarn auth:capture` run at least once first, same as `test:canary` alone.

## The drift canary

Checks whether real sniffies.com still has the DOM shapes our extension/userscript code depends on
(listed in [`site-contract.ts`](site-contract.ts)). It never asserts behavior — only "does this
selector still exist" — so a failure means either the site changed or a selector genuinely isn't
present right now (e.g. no visitors nearby), not that our extension is broken.

**Use a dedicated test account**, not your personal one. Sniffies has its own anti-bot detection —
the very thing the bot-blocking feature filters around — and repeated automated visits risk a real
account getting flagged.

### 1. Capture a session (once, or whenever it expires)

```bash
yarn auth:capture
```

This opens a headed, paused browser. Log in yourself in that window, then click **Resume** in the
Playwright Inspector toolbar. The session is saved to `.auth/user.json` (gitignored — it's real
session cookies, never commit it). No password is ever typed by test code.

### 2. Run the canary

```bash
yarn test:canary
```

Run this manually — before a release, or when a feature that depends on Sniffies' DOM/network shape
(profile injection, bot blocking, profile-border redirect) mysteriously stops working — not on
every push.

### If it fails

Check whether it's real drift (the selector/shape actually changed) or a flaky live-data issue (no
visitors nearby right now). If it's real drift: the corresponding source file(s) need updating (see
the `source` field on the failing entry in `site-contract.ts`), and the fixture in the main suite
(once built) should be updated to match the new shape too.

### Debugging a run

```bash
yarn test:canary:debug   # step through with the Playwright Inspector
yarn report               # open the last HTML report (trace/screenshot/video per failure)
```

**If the browser opens to a blank tab and just sits there:** that's not stuck — `--debug` always
pauses _before the first action of a test_ so you can inspect state before anything happens. Look
for the separate **Playwright Inspector** window (not the browser tab) and click **Resume** (▶) or
**Step over**. Reloading the browser tab yourself doesn't advance Playwright's own paused state —
it just puts your manual navigation out of sync with what the script is about to do.

The `canary` project intentionally does **not** depend on `setup` in `playwright.config.ts` — a
Playwright project re-runs its `dependencies` on every invocation, which would force `setup`'s
manual, `page.pause()`-gated login through on every single canary run. Run `yarn auth:capture`
yourself whenever `.auth/user.json` is missing or stale; `test:canary`/`test:canary:debug` just load
it. If that file doesn't exist, you'll get a clear `ENOENT` on that path — that's the signal to run
`auth:capture`, not a bug.

## The payload/schema canary

The selector canary above only checks DOM shape. This checks the _network_ shapes
`core/src/bot-block-hook.ts` depends on — the four surfaces it filters (`post-authentication`,
`chat-data`, `messages`, and the live WebSocket) — against a manually-captured HAR file.

```bash
yarn check-har <path-to-har>
```

**Capturing a HAR:** DevTools → Network tab → turn on "Preserve log" → browse Sniffies normally
(view the map, open a chat, send/receive a message) → right-click any request → "Save all as HAR
with content". WebSocket frames are only included if "Preserve log" was on _before_ the WS connection
was made, so do that first.

**Never commit a captured HAR to the repo** — it contains another real session's private data
(profile photos, messages, precise locations). Keep it outside the repo (e.g. `~/Downloads`) and
point `check-har` at it from there. The script itself only ever prints field-presence booleans and
array lengths, never raw content, so its own output is safe to share/paste.

Run this whenever the bot-blocking feature's behavior seems off, or periodically as a sanity check —
same non-gating, manual cadence as the selector canary. See `scripts/check-har-schema.mjs`'s header
comment for exactly which field paths it checks and why.
