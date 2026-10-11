# Hide Sent Photos — TODO

Feature: make Sniffies' own paywalled "Hide Photo" button (tooltip, `aria-label="Hide Photo"`) work: the
extension swallows the click and makes the hide call itself. (A bulk "hide all" button was built first,
then cut.)

**Feasibility: yes.** It's a single authenticated JSON POST, and the extension already replays
same-origin API calls with the user's session (see `location-override-controller.ts`, which does
`nativeFetch(..., { credentials: "include" })`). No auth header is involved in the HAR — the
session cookie rides along via `credentials: "include"`.

---

## The API (from `hidePhoto.har`)

```
POST https://usw.api.sniffies.com/api/messages/photo-visibility
Content-Type: application/json
ngsw-bypass: true            (Angular service-worker bypass; CORS-allowed header)
credentials: include         (cookie session; CORS allows credentials from https://sniffies.com)
```

Body:

```json
{
  "conversationId": "<conversation id>",
  "conversationLocation": null,
  "userIdFrom": "<own user id>",
  "userIdTo": "<other participant's user id>",
  "messageId": "<the photo message's _id>",
  "isHidden": true,
  "file": null
}
```

Response: `200`, body `true`. Preceded by a normal CORS preflight (`OPTIONS`) — handled by the
browser, nothing to do.

Notes from the HAR:
- **One request per photo.** The hidden photo was one of a 5-photo multi-send (shared
  `multiPhotoGroupId`, distinct `_id`s, `order` 0–4). Hiding a group = N requests.
- `isHidden: true` hides; `false` should un-hide (the field is the toggle) — **unverified**, not in
  the HAR. Confirm before offering "unhide".
- `file: null` and `conversationLocation: null` were both null in the capture; `file` is the
  filename on the message (`…-chat-pic.jpeg`), so it may be unused. Send `null` as the app does.
- The thread is already visible to us: `GET /api/messages?conversationId=…` (`MESSAGES_PATH`)
  returns `messages[]` with `_id`, `author`, `file` (non-null ⇒ photo), `isHidden`,
  `multiPhotoGroupId`, `order`.

## Where the inputs come from

| Field | Source |
|---|---|
| `userIdFrom` | Own id — already captured by `user-id-hook.ts` (WebSocket `userId` param). |
| `conversationId` | `conversationId` query param of the intercepted `GET /api/messages`. |
| `userIdTo` | The other `author` in that thread's messages (or `Conversation.participants`). |
| `messageId` | Messages in the thread where `author === own id && file != null && !isHidden`. |

## Proposed design (minimal)

1. **Hook** (core): extend the existing `/api/messages` interception to remember the last-loaded
   thread `{ conversationId, otherUserId, messages }`. Add `PHOTO_VISIBILITY_PATH` and a
   `PhotoVisibilityBody` type to `sniffies-api.ts`.
2. **Action**: `hideSentPhotos()` — filter the remembered thread to own, un-hidden photo messages
   and POST them **sequentially** (not parallel — avoid rate-limit/abuse flags), small delay
   between calls, stop on first non-2xx.
3. **UI**: one "Hide all my sent photos" button in the extension panel, acting on the
   currently-open chat. Confirm dialog showing the count. No per-photo UI, no auto-hide.
4. **Refresh**: Sniffies won't re-render hidden state from our calls alone. Either re-fetch the
   thread or tell the user to reopen the chat (decide after trying it).
5. Ship in client + userscript via core; bookmarklet only if the network hook is available there.

## Native "Hide Photo" button takeover

Sniffies paywalls its own per-photo "Hide Photo" button (`aria-label="Hide Photo"`). A capture-phase
click hook (`core/src/hide-photo-click-hook.ts`) swallows that click and makes the
`photo-visibility` call instead. The photo's message `_id` comes from the DOM: the photo container
inside the same `chat-photo-message` has `id="message-<_id>"`.

- [x] Selectors added to `sniffies-selectors.ts` + `e2e/site-contract.ts`
- [x] Click hook + unit test (jsdom, using a real captured bubble)
- [x] Installed in the userscript and the extension's MAIN-world hook
- [ ] Verify in a real chat that the swallowed click actually prevents the paywall (it may trigger
      on `pointerdown`/`mousedown` rather than `click`)
- [x] Bulk "Hide all my sent photos" button cut — the native button is the only entry point
- [x] Reload after a successful hide (Sniffies only shows hidden state on load)
- [ ] Better failure feedback (a swallowed click currently only logs on error)
- [ ] Gate it behind the Premium features toggle once that exists

## Open questions

- Does hiding via API update the recipient's view live (WebSocket event) or only on next load?
- Is there a rate limit? Test with the 5-photo group.
- Is `isHidden:false` accepted for un-hiding?
- Can already-hidden/expired photos return errors we need to skip?

## Tasks

- [ ] Verify the call by hand in devtools (`fetch` with the body above) on one photo, then on a group
- [ ] Verify un-hide (`isHidden: false`)
- [x] Add endpoint constant + body type to `core/src/sniffies-api.ts`
- [x] Capture `{ conversationId, otherUserId, messages }` from `GET /api/messages`
- [x] Implement `hideSentPhotos()` (sequential, stop on error) + unit test with a fake fetch
- [x] ~~Panel button + confirm dialog~~ — superseded by the native-button takeover (bulk UI removed)
- [x] Decide refresh behavior after hiding — status text tells the user to reopen the chat; not yet confirmed that this is enough
