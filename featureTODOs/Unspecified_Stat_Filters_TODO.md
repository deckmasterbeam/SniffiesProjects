# Show Unspecified Profiles in Native Stat Filters — TODO

Feature: for four native Cruiser Stats filters, **Position** (`sexuality.attitude`), **Endowment**,
**Body Type** and **Sexuality**, add an "Also show profiles that don't list this" option, like
`includeUnspecified` on Height / Weight. Other native filters are out of scope for now.

**Feasibility: likely, not yet verified.** The request and profile shapes for these stats are
unknown (see Open questions), so the first step is capturing them.

---

## Problem

Height / Weight / Gender are filtered **client-side** (`core/src/profile-filter.ts`): Sniffies sends the
profiles and we hide some, so `includeUnspecified` works.

The native stat filters are applied **by Sniffies' server**. With Position = Top, the
`softReload` / map requests carry `CRUISER_STATS.value["sexuality.attitude"] = ["top"]` and the
server never sends profiles without a position. They are not in the response, so we can't un-hide
them. A client-side toggle layered on the native filter does nothing on its own.

## Approach

When the user turns on "include unspecified" for a stat, take that stat over on the client:

1. **Strip** the stat from the outgoing request, so the server sends everyone for that stat.
2. **Match client-side** against each profile's own field, using the values the user picked in
   Sniffies' native row, plus the unspecified ones.

With the toggle **off**, nothing changes: the native filter runs on the server as today. We only
take over a stat while its toggle is on.

Native rows stay as the way the user picks values. We read the picks out of the request body
(before stripping) and add only the toggle. Building our own pickers is rejected as much more code.

### Where to apply it

Same request-rewrite pattern as `Auto_Age_Filter_TODO.md`: patch `XMLHttpRequest.send` in
`core/src/profile-filter-hook.ts` for

- `POST /api/softReload` and the map request (the `filters` object)
- `PUT .../visitor/current/options` only if needed (see Open questions: reload persistence)

For each stat whose toggle is on: copy its values out of `CRUISER_STATS.value` into our own
selection, then delete the entry from the outgoing body. If that empties `CRUISER_STATS.value`,
follow whatever the capture shows Sniffies sends for "no stats".

### Matching rule (new rule per stat, in `profile-filter.ts`)

- Profile lists the stat: hide unless one of its values is in the picked set (same semantics as
  Sniffies' multi-select; confirm OR vs AND per stat).
- Profile lists nothing: hide unless `includeUnspecified`.
- Reuse `ProfileFilterRule` with `mapOnly: true`, like `rangeRule`. One generic `listRule(name,
  getFilter, read)` next to `rangeRule` covers all four stats.

### UI

A switch row under each of the four native stat rows ("Include profiles with none listed"), mounted
via `ROWS` in `core/src/filter-menu/menu.ts` like Height / Weight. Disabled until the native stat has
a pick. Persisted in `ProfileFilters` next to `height` / `weight` (`parseProfileFilters` and
`gateProfileFilters` already handle the pattern).

## Risks

- **Reload persistence (real, to investigate).** We copy the picks from the request, so we hold
  them ourselves. But if Sniffies persists the pick via the `options` PUT and we strip it there,
  the native row would come back empty after reload. If Sniffies doesn't restore state from the
  PUT, or we only strip `softReload` and the map request, the native row stays correct and nothing
  extra is needed. If it does, workaround: store our own copy of the picks (we have them from the
  request) and re-apply them to the row on load, or leave the PUT alone and strip only from the
  map requests. The capture decides which.
- **Sniffies format changes.** Add `expectShape` / `EXPECTED_PROFILE_PATHS` entries for the new
  profile fields so a change is visible in logs.
- **Bookmarklet** can't hook requests, so out of scope there (as with the radius override).

Accepted, not risks: a result cap just means the user pans and uses "Cruise here" to load more, and
none of these four filters is Plus-gated.

---

## Open questions

- **Request shape.** Exact keys and value format for each of the four stats in
  `CRUISER_STATS.value` (known: `"sexuality.attitude": ["vers", "top"]`).
- **Profile shape.** Which `data.profile.extended.*` field holds each stat on a profile, and what
  does "not specified" look like (missing, `null`, `[]`, `""`)? Do the profile values match the
  request values 1:1?
- **Reload persistence.** Which request restores state on reload: the `options` PUT or `softReload`?
- **Multi-value stats.** Position and Body Type allow several picks. Does a profile hold one value
  or several, and does Sniffies match any or all?
- **Toggle with no pick.** Include-unspecified with nothing picked is a no-op (filter inactive).
  Confirm that's wanted.

## Needed from the user (capture, ~5 min)

In DevTools → Network on sniffies.com, signed in:

1. Set only **Position = Top** → copy the `softReload` request body and the `options` PUT body.
2. Reload the page → note whether the Position pick is still on, and which request ran.
3. In the `post-authentication` or `softReload` **response**, copy the JSON of 2–3 visitors: one
   with Position set, one with it blank. Strip names and photos.
4. Repeat 1–3 for Endowment, Body Type and Sexuality (a request body with all four set at once is
   fine, plus a visitor showing each field).

---

## Test plan

### 1. Capture
- [x] Captured (HAR). Apply sends `POST /api/advanced-filter/search` (`result.nearbyUsers`); `softReload` / `post-authentication` only on load. The `options` PUT is left alone, so the native picks survive reload.

### 2. Implement
- [x] Add the request keys and profile fields to `core/src/sniffies-api.ts`.
- [x] `statTakeover` (list rules + endowment rule) in `profile-filter.ts` + four stat filters in `core/src/profile-filter.ts` (`ProfileFilters`, parse, gate, rules).
- [x] Request rewrite in `core/src/profile-filter-hook.ts`, with a getter for "which stats we own",
      wired like `raiseRadius` in the extension relay and userscript.
- [x] Toggle rows (not disabled without a pick: no-op then) in `core/src/filter-menu/stat-row.ts`.
- [x] Reload-persistence workaround: not needed.
- [ ] `expectShape` warning when `filters.CRUISER_STATS` is missing from a request that should have it.

### 3. Automated tests
- [x] Unit: picked + include off → unspecified profile hidden; on → shown.
- [x] Unit: profile with a non-matching value is hidden either way.
- [x] Unit: nothing picked → rule inactive.
- [x] Unit: request body has a stat stripped only when its toggle is on; other stats and malformed
      bodies pass through untouched.
- [x] Unit: toggle off → request body unchanged (native server filter still applies).
- [ ] Unit: chat lists are not filtered (`mapOnly`).

### 4. Manual check
- [ ] Pick Position = Top, toggle on: top profiles and no-position profiles show, bottoms don't.
- [ ] Toggle off: only tops show, as native.
- [ ] Same for Endowment, Body Type, Sexuality.
- [ ] Reload keeps the native pick and our toggle.
- [ ] Userscript (iOS Safari) behaves the same as the extension.

### 5. Own rows for the four stats (manual check)

Sniffies also filters the map in the browser (`passesCruiserStats` in its bundle) and hides anyone
with no value for a stat it has on, so "include profiles with none listed" can't work on its row.
So, while the profile filters are on, the four stats are **always** ours:

- Sniffies' own rows are hidden and forced off; ours (`core/src/filter-menu/stat-row.ts`) stand in.
  Picks live in `ProfileFilters.picks`, the "none listed" switch in `ProfileFilters.unlisted`.
- The stats are stripped from every map request and matched client-side (`statTakeover`), so
  Sniffies' server no longer pre-filters them.
- Sniffies' saved filters (the `authenticate/current` response) are rewritten to load the stats as
  off. What it had saved is kept once, to start our row from (Endowment is cm there, inches here).
- The page hook reads `{ enabled, filters }` from `localStorage` (`snp-applied-profile-filters`),
  which the extension keeps up to date, so it knows before its first request.

Checks:

- [ ] Open the menu: all four stats show our row, in Sniffies' style (white value text, check icon), and its own row for them is hidden.
- [ ] Pick Body Type and Sexuality: the sheet is a wheel with "-" on top, check marks, "Choose up to 99: ..." and the none-listed switch.
- [ ] Endowment sheet: range in inches (half-inch steps), cut / uncut, none-listed switch.
- [ ] A profile with no endowment listed shows with "none listed" on, and is hidden with it off.
- [ ] Reload: rows come back with their picks; the request has no `CRUISER_STATS` stats of ours; the Cruiser Stats switch shows on while a pick is set.
- [ ] A pick Sniffies had saved before shows up in our row the first time only; clearing it stays cleared after a reload.
- [ ] Clicking a row's checkbox clears its pick; clicking an empty one opens its sheet.
- [ ] Age and the other native lines still work.
- [ ] Profile filters off in the popup: Sniffies' own rows come back and nothing is stripped.
- [ ] Userscript (iOS Safari) behaves the same as the extension.
