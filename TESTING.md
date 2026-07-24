# Manual test checklist: user-id telemetry + feature-flag gating

Covers: the core `installUserIdHook`/`logInit` behavior, its chrome-client
integration, the `/api/logInit` endpoint, and the per-endpoint feature flags
on `save-number`, `send-guid`, `favorites`, and `notify-test`.

## 0. Setup

- [x] `server/.env` has `CLIENT_SECRET` set, `POSTGRES_URL` pointing at a real
      (ideally scratch/dev) Neon DB, and `TEXTBELT_KEY` set (`textbelt` works
      for the free tier).
- [x] Run [schema.sql](server/schema.sql) against that DB — confirms
      `client_init_log` actually gets created, not just that the file has
      valid-looking SQL.
- [ ] `client/.env` has `SERVER_BASE=http://localhost:3000` (or wherever
      `vercel dev` binds), `CLIENT_SECRET` matching the server's exact value,
      and `DEBUG=true` so you get the `[sniffies-*]` console logs. — `SERVER_BASE`
      and `CLIENT_SECRET` are set correctly, but `DEBUG` is currently `false`.
- [x] `cd server && vercel dev` — leave it running.
- [x] `cd client && npm run build`, then load `client/dist` as an unpacked
      extension at `chrome://extensions` (enable Developer mode first).

## 1. User-id hook picks up the real id

- [x] Open `sniffies.com`, log in, open DevTools console (both the page
      console and, separately, the extension's service worker console via
      "Inspect" on `chrome://extensions`).
- [ ] Confirm you see `[sniffies-user-id] user id observed <your-id>` in the
      page console (MAIN world hook).
- [ ] Confirm you see `[sniffies-user-id-relay] persisting user id <same-id>`
      (isolated world relay).
- [ ] Open DevTools → Application → Storage → your extension's
      `chrome.storage.local`, and confirm `sniffiesUserId` matches the id from
      the logs — and matches what you'd see in the network tab for the
      `wss://prod.ws.sniffies.com/?userId=...` connection.
- [ ] Reload the page and confirm it fires again exactly once per reload (not
      repeatedly on every WS reconnect within the same page load — check the
      Network tab's WS frames if Sniffies reconnects, and make sure `logInit`
      doesn't re-fire each time).

## 2. logInit telemetry actually reaches the server

- [x] In the Network tab, find the `POST /api/logInit` request. Confirm status
      `200`, request body has your real `userId`, `clientType:
      "chrome-client"`, and `version` matching the extension's version in
      `chrome://extensions` (which should match `client/manifest.json`, or the
      `EXTENSION_VERSION` value if you built with that env var set).
- [x] Query the DB directly:
      `SELECT * FROM client_init_log ORDER BY id DESC LIMIT 5;` — confirm a
      row landed with the right `user_id`, `client_type`, `version`, and a
      recent `occurred_at`.
- [ ] Failure resilience: stop `vercel dev`, reload the sniffies.com page, and
      confirm the extension doesn't throw/break anything else (geo hook,
      profile-id star, etc. should all still work) — `logInit` is best-effort
      and swallows the failure silently, so you shouldn't see an uncaught
      error, just a failed network request in the Network tab.

## 3. Feature-flag gating on the 4 locked-down endpoints

Do this with `vercel dev` running and none of the four flags set in
`server/.env` yet.

- [ ] For each of `save-number`, `send-guid`, `favorites`, `notify-test`:
      ```
      curl -i -X POST http://localhost:3000/api/<name> \
        -H "Authorization: Bearer <CLIENT_SECRET>" \
        -H "Content-Type: application/json" \
        -d '{}'
      ```
      → expect `404 {"error":"not_found"}`.
- [ ] Repeat one of those calls with **no** `Authorization` header at all →
      still expect `404`, not `401`. This is the important one: it proves the
      gate runs before auth and doesn't leak that the endpoint exists.
- [ ] Set just `SAVE_NUMBER_ENABLED=true` in `server/.env`, restart
      `vercel dev` (env changes need a restart), and re-curl all four:
      `save-number` should now behave normally (e.g. `400 invalid_phone` for
      an empty body, or `200` with a valid phone), while the other three still
      404.
- [ ] Repeat for `SEND_GUID_ENABLED`, `FAVORITES_ENABLED`,
      `NOTIFY_TEST_ENABLED` individually, confirming each only unlocks its own
      endpoint.
- [ ] Turn a flag back off (unset it, restart), confirm that endpoint goes
      back to 404 — confirms it's not a one-way switch or cached somewhere.

## 4. Regression sanity check

- [x] `npm test` in `core/`, `client/`, and `server/` — all should be green
      (the one known pre-existing flaky failure is `geo-override-ui.test.ts`
      in core, unrelated to any of this work).
- [ ] With flags off, confirm the rest of the extension still works normally:
      geo override in the popup, profile-id star injection on marker click —
      nothing in this work should have touched those paths, but worth a quick
      click-through since they share content-script injection points.
