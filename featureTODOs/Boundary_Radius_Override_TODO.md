# Boundary Radius Override — TODO

Feature: make Sniffies treat out-of-boundary profiles as inside it, so its own click handling opens
them normally. This would replace the `profile-border-hook.ts` redirect (which navigates away or
opens a new tab). Hand-editing `data-within-radius="true"` on a marker does nothing, because the
attribute is only an output of app state. The change has to feed the app different state.

**Feasibility: promising, not yet verified live.** From `radius.har` (a capture with a stat filter
active), the boundary is a client-side check against a single number the server sends. The locked
profiles arrive with full data.

---

## What the HAR shows

### The radius check is client-side

Read from the shipped bundle (`chunk-EZSNAP5S.js`, class `CruiserMonetizationRadiusFacade`):

```js
isUserWithinCruisingRadius(user) {
  const coords = user.data.location?.coordinates;
  if (!coords) return false;
  const d = this.getDistance(coords);          // haversine(circleCenterCoordinates, coords), miles
  return d !== null && d <= this.store.radiusInMiles();
}

isRadiusActive = computed(() => {
  if (auth.hasActiveUpgrade()) return false;   // paid users: no radius at all
  const { circleData, circleCenterCoordinates, radiusInMiles, hasUserFiltersApplied } = store;
  return circleData() != null && circleCenterCoordinates()?.length === 2
      && radiusInMiles() != null
      && (hasUserFiltersApplied() || cruiseThisArea.isCruiseThisAreaActive());
});
```

- Marker `data-within-radius` (`chunk-Z2WS5UEE.js`) is `isWithinRadius()`, which calls the facade
  above. The card-level gate `isBlockedByRadius` (`chunk-LEXHWSO5.js`) adds: not upgraded, radius
  active, **and no existing conversation with the user** (conversations bypass the lock).
- `radiusInMiles` is set by `setCruiserMonetizationRadius(nearbyVisitors.emitRadiusInMiles)` in every
  map-data loader: post-authentication, soft reload, and the init path in `chunk-UK4NFRKU.js`.
- `circleCenterCoordinates` is set in `setCircleData()` (`chunk-35GAHT4D.js`) from
  `auth.user().data.location.coordinates ?? window.preAuthCoordinates`. It also builds the circle
  polygon from the radius, but only when there is no active upgrade.
- The radius only applies while a user filter is applied or Cruise This Area is active. The
  unfiltered `post-authentication` capture had every visitor inside the radius.

### What the server sends

| Response | `emitRadiusInMiles` | `maxRadiusInMiles` | `minLockingDistance` | Visitors |
|---|---|---|---|---|
| `POST /api/post-authentication` (no filters) | 0.554 | 0.554 | absent | 200, all within emit |
| `POST /api/softReload` (filters on) | 0.585 | 0.817 | 0.615 | 200: 120 within emit, **80 beyond** |

- In the soft reload, the 80 beyond-radius visitors have the same fields as the others (full
  `data.profile`, `location`, photos metadata). The only difference was an extra
  `data.profile.hideSupport` on some. The server does not strip them, so the lock is purely a
  client-side decision.
- `emitRadiusInMiles` changes between responses (0.554 vs 0.585). It is a server-chosen, dynamic
  "free" radius, not a fixed constant.
- Each visitor already carries `distance` (miles from you) and `data.location.coordinates`.
- `minLockingDistance` feeds Cruise This Area (`minLockingDistance ?? maxRadiusInMiles`). It is a
  separate value from the marker lock.

### Other requests seen

| Request | Notes |
|---|---|
| `PUT https://uswapi.sniffies.com/api/visitor/current/location` | Body `{virtualLocation, physicalLocation, homeDistanceInMiles}`. Response `{location:{coordinates,type:"Point"},countryCode}`. **No radius in either direction.** The API host is `uswapi.sniffies.com`. |
| `PUT .../visitor/current/options` | Filters/layers. Returns `OK`. Filters on is what activates the radius. |
| `GET .../v2/post-authentication/chat-data` | No radius fields. |
| WebSocket `wss://prod.ws.sniffies.com/?userId=...&lat=...` | 420 frames captured. Not yet inspected for radius fields. |

---

## Hypothesis

Raising `nearbyVisitors.emitRadiusInMiles` in the response before Sniffies reads it makes every
returned visitor satisfy `d <= radiusInMiles`. `isWithinRadius()` flips to `true` for everyone,
`isBlockedByRadius` becomes `false`, and Sniffies' own click handling runs as for a paid user.

We already rewrite these exact payloads in `profile-filter-hook.ts`
(`filterPostAuthenticationPayload`, soft-reload handler), so this would be one more line there, not a
new interception point.

### Proposed value

`emitRadiusInMiles = Math.max(emitRadiusInMiles, maxRadiusInMiles)`

- `maxRadiusInMiles` is the distance of the farthest returned visitor, so everyone is covered.
- Do not use `Infinity` or a huge number. `setCircleData()` computes a 512-point polygon from
  `radius / earthRadius`, and an absurd radius could produce invalid latitudes or break the map layer.
- Keep it as a settings toggle, replacing or sitting beside `ProfileBorderOpen`.

### Known gaps to expect

1. Profiles that arrive later over the WebSocket (`userJoined`) and sit beyond `maxRadiusInMiles` stay
   locked. They would need the radius re-raised, or a hook on whatever calls
   `setCruiserMonetizationRadius`.
2. The circle overlay on the map will grow to the new radius. Cosmetic, but verify it still renders.
3. `advanced-filter/search` responses return `maxRadiusInMiles` and `minLockingDistance` but never set
   `radiusInMiles`, so the raised value should persist. Confirm.
4. Anything server-enforced (a 403 on opening a profile or sending a message) is unaffected by this.
   Confirm there is none.

---

## Test plan

Do the HAR-based checks first. They need no network. Never commit `radius.har` (it holds the account's
user id, location and blocked-user list).

### 0. Baseline (done from the HAR)

- [x] Locate the check: `isUserWithinCruisingRadius`, `radiusInMiles` store value
- [x] Confirm the source of `radiusInMiles`: `emitRadiusInMiles` of map-data responses
- [x] Confirm beyond-radius visitors arrive with full data (softReload, 80 of 200)
- [x] Confirm the location PUT carries no radius

### 1. Live investigation (browser DevTools, signed in, a stat filter on)

Filters must be on, or the radius is inactive and nothing is locked.

- [ ] **Capture the number.** After a soft reload, record `emitRadiusInMiles`, `maxRadiusInMiles` and
      the count of visitors with `distance > emitRadiusInMiles`. Reload a few times and note how the
      emit value varies.
- [ ] **Match the DOM.** Count markers with `data-within-radius="false"` and compare it to the
      beyond-radius count above. They should be equal.
- [ ] **Local override first.** In the Network panel, use *Override content* (or a Local Override) on
      the `softReload` response to set `emitRadiusInMiles` to `maxRadiusInMiles`. Reload.
  - [ ] All markers show `data-within-radius="true"`
  - [ ] Clicking a formerly locked marker opens the normal profile card with no paywall
  - [ ] The map circle overlay renders (and how it looks)
  - [ ] Console shows no errors
- [ ] **Repeat on the first-load path.** Override `post-authentication` the same way. Filters have to be
      active at load for any lock to show, so apply a filter, then do a full page refresh.
- [ ] **Check the WebSocket gap.** Leave the map open and watch for a `userJoined` marker beyond the
      raised radius. Does it come in locked?
- [ ] **Check server enforcement.** On a formerly locked profile, open the full profile and try
      messaging. Note any 4xx from the API.
- [ ] **Conversation bypass.** Confirm a user you already chat with is never locked
      (`hasConversationWithUser`), as a sanity check of the model.

### 2. Implement (only if step 1 passes)

- [ ] In `core/src/profile-filter-hook.ts`, raise `emitRadiusInMiles` in the post-authentication and
      soft-reload payload handlers. Add `emitRadiusInMiles`, `maxRadiusInMiles` and
      `minLockingDistance` to `NearbyVisitorsPayload` in `core/src/sniffies-api.ts`.
- [ ] Add a settings toggle (default off) in `core/src/settings.ts`, with the matching UI in
      `profile-border.html` / `profile-border-ui.ts`.
- [ ] Keep `profile-border-hook.ts` as the fallback for profiles the override doesn't cover (WebSocket
      arrivals).
- [ ] `expectShape` warnings for the new fields, so a Sniffies API change is visible, as the other
      filters do.

### 3. Automated tests

- [ ] Unit (`profile-filter-hook.test.ts`): with the toggle on, `emitRadiusInMiles` is raised to
      `maxRadiusInMiles`. With it off, the payload is unchanged. Both handlers.
- [ ] Unit: payload with no `nearbyVisitors`, or missing radius fields, passes through without
      throwing.
- [ ] Unit: never lowers an already-larger `emitRadiusInMiles`.
- [ ] E2E (`e2e/fixtures/sniffies-mock.html`): mock a soft reload with a visitor beyond the radius.
      Assert the marker ends up `data-within-radius="true"` with the toggle on.

### 4. Platform check

- [ ] Userscript (iOS Safari): response rewrite works the same as the other payload filters.
- [ ] Bookmarklet: **not feasible.** It cannot rewrite the init responses. Keep the existing
      click-redirect there.

---

## Open questions

- Does Sniffies enforce the radius server-side on any action (profile fetch, chat send)? The HAR
  shows no 4xx, but it never exercised a locked profile.
- What decides the server's `emitRadiusInMiles` (user density? account type?). It is not needed for
  this change, but it explains the 0.554 vs 0.585 difference.
- Does the unfiltered `post-authentication` response ever carry beyond-radius visitors? In this
  capture it did not, so the lock may only appear once a filter is applied.
