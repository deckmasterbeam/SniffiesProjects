# Auto Age Filter for Height / Weight — TODO

Feature: when Height and/or Weight is switched on and no native Cruiser Stats filter is on, turn on
Sniffies' own Age filter at 18–90+ so the choice survives a page reload.

**Feasibility: likely, not yet verified.** The request shape for the Age filter is unknown (see
Open questions), so the first step is capturing it.

---

## Problem

Height and Weight are our filters, not Sniffies'. `buildStatRow` (`core/src/filter-menu-ui.ts`) only
enables them while Sniffies' native Cruiser Stats list is active (`parent-enabled`), because Sniffies
treats Cruiser Stats as on only when at least one native stat filter has a value.

If the user selects only Height and/or Weight and reloads:

1. Our filters are saved locally, so the choice is stored.
2. The `PUT .../visitor/current/options` and `POST /api/softReload` requests go out with
   `filters.CRUISER_STATS.value` empty, because Sniffies knows of no native stat.
3. On reload Sniffies sees no Cruiser Stats and turns the filter off. Height/Weight lose their
   parent switch and are dropped (the `followCruiserStats` observer sets `filter.enabled = false`).

From the softReload HAR, the request carries (shape only):

```json
{ "filters": { "CRUISER_STATS": { "filterType": "CRUISER_STATS", "enabled": true,
    "value": { "sexuality.attitude": ["vers", "top"] }, "assignmentType": "EQ" },
  "BASIC_FILTERS": {} } }
```

---

## Proposed behaviour

- Trigger: Height or Weight becomes enabled (a range is picked) **and** no native stat filter has a
  value.
- Action: add the Age entry to `CRUISER_STATS.value` at 18–90+ (the full range, so it excludes
  nobody), and make sure `CRUISER_STATS.enabled` is true.
- If any native stat filter already has a value, change nothing.
- Leave the Age filter on when Height/Weight are switched off again. We can't tell whether the user
  or we turned it on, and it filters nobody at 18–90+.

### Where to apply it

Rewrite the **outgoing** requests rather than driving Sniffies' menu from the DOM:

- `PUT .../visitor/current/options` (the persisted filter state that a reload restores)
- `POST /api/softReload` (the map request, same `filters` object)

This follows the existing pattern: `profile-filter-hook.ts` already patches `XMLHttpRequest` for the
responses. Add a request-body rewrite in `send`, gated on the Height/Weight filters being on, so it
covers the extension and the userscript. The bookmarklet can't hook these requests, so it is out of
scope there (as with the radius override).

Clicking the Age control in the menu was rejected: Angular markup is fragile and the rest of this
project avoids driving it.

---

## Open questions

- **Age entry shape.** What key and value does Sniffies send for Age? Capture a request with only
  Age set to 18–90+ (for example `"stats.age": { "min": 18, "max": 90 }` or an array). The "90+"
  end may be encoded as a sentinel or an open bound; copy it exactly.
- **Empty stats.** When no stat is on, is `CRUISER_STATS` sent with an empty `value`, or omitted?
  This decides whether we add the entry or create the whole object.
- **Which request restores state on reload.** Confirm the `PUT .../options` body is what Sniffies
  reads back, not only the softReload request.
- **Menu display.** After a reload, Age should appear on in Sniffies' own menu at 18–90+. Confirm.
- **Plus accounts.** Does a Plus account with its own Age setting ever get overwritten? The rule
  "any native stat on means do nothing" should prevent it.

---

## Test plan

### 1. Capture (browser DevTools, signed in)

- [ ] Turn on only Age at 18–90+, reload, and copy the `options` PUT and a `softReload` request
      body. Note the exact Age key and value, and whether turning Age off empties or omits
      `CRUISER_STATS`.
- [ ] With no native stat on, turn on Height only, reload, and confirm the bug: Height is dropped.

### 2. Implement

- [ ] Add the Age key/value shape to `core/src/sniffies-api.ts` (the `filters` request type).
- [ ] In `core/src/profile-filter-hook.ts` (or a small sibling), rewrite the request body of the
      `options` PUT and `softReload` when Height or Weight is enabled and `CRUISER_STATS.value` has
      no entry.
- [ ] Give the rewrite a getter for "Height/Weight on", the way `raiseRadius` is passed to
      `installProfileFilterHook`, and wire it in the extension relay and the userscript `report.ts`.
- [ ] `expectShape` warning if `filters.CRUISER_STATS` is missing from a request that should have
      it, so a Sniffies API change is visible.

### 3. Automated tests

- [ ] Unit: Height or Weight on and no native stat, so the Age entry at 18–90+ is added.
- [ ] Unit: any native stat already set, so the body is unchanged.
- [ ] Unit: Height and Weight both off, so the body is unchanged.
- [ ] Unit: `CRUISER_STATS` missing or `enabled: false`, so it is created or enabled as decided
      above, and malformed bodies pass through without throwing.
- [ ] Unit: non-JSON or non-target request bodies are untouched.

### 4. Manual check

- [ ] Pick only Height, reload: Height is still on and Sniffies shows Age 18–90+ on.
- [ ] Pick Height with another native stat on: no Age filter is added.
- [ ] Userscript (iOS Safari) behaves the same as the extension.
