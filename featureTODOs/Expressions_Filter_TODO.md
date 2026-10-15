# Expressions Filter — Proposal

Status: **proposed**.

Add an "Expressions" filter to the Cruiser Stats filters, next to Height and Weight (rows are
added via `ROWS` in `core/src/filter-menu-ui.ts`, mounted after the Endowment line, see
`sniffies-selectors.ts`).

A profile can list 0–2 expressions from: Bear, Biker, Bro, Clean cut, Corporate, Curious, Daddy,
Discreet, Femme, FTM, Gaymer, Geek, Goth, Guy next door, Jock, Leather, Masc, MTF, Nudist, Otter,
Poz, Punk, Pup, Rugged, Skater, Son, Sporty, Surfer, Swinger, Trans, Trendy, Trucker, Twink, U+.

---

## Behavior

The filter is a visibility control: a checklist of what is shown.

- **Off by default.** Turning it on checks every expression plus a "No expressions listed" chip.
  Nothing is hidden until the user unchecks something.
- **A profile is hidden if any of its expressions is unchecked.** Unchecking Skater hides a
  Goth + Skater profile even with Goth checked.
- A profile with no expressions is hidden only when "No expressions listed" is unchecked.
- "Select all" resets everything to checked. Turning the filter off bypasses it; the selection is
  kept so turning it back on restores it.

Why "any unchecked hides": the starting state is "everything on", so unchecking reads as "stop
showing me this". "Show if any checked" would leave an unchecked Skater profile visible whenever
its other tag is checked, which looks broken.

## UI

- Title **"Expressions"**, one hint line: "Profiles with an unchecked expression are hidden." The
  rule is stated once in the UI so the two-tag case isn't a surprise.
- Chip grid, alphabetical, one flat list. Checked chips are filled, unchecked chips are dimmed
  (dimmed = not shown, not struck through or red).
- No grouping, so identity tags are not set apart from style tags.
- **No hidden-count, badge or summary** anywhere ("N hidden" etc.). The control shows only the
  current state of each chip.
- Neutral wording throughout: "Expressions", "Select all", "No expressions listed". Never
  "filter out", "exclude" or "block".
- Reuse the shared `core/src/switch.css` for the on/off switch.

## Storage

New setting `expressionsFilter` `{ enabled: boolean, unchecked: string[], showNone: boolean }`,
default off. Store the **unchecked** set so a new expression Sniffies adds later is shown by
default. Persist the same way as the other filters (`chrome.storage.local` for the client,
`localStorage` for the userscript/bookmarklet).

## Tasks

- [ ] Confirm which field on the profile payload carries expressions (`core/src/sniffies-api.ts`)
      and its exact string values; build the list from those, not from this doc
- [ ] Pure matcher `isHiddenByExpressions(profile, settings)` in core, with unit tests: 0, 1, 2
      expressions; none-chip on/off; multi-tag rule; unknown expression stays shown
- [ ] Add the row to `ROWS` in `filter-menu-ui.ts` and apply the matcher where the other
      cruiser-stats filters are applied
- [ ] Chip UI + CSS, wired to `settings.ts` in popup, userscript panel and bookmarklet panel
- [ ] `contracts.ts` form contract and tests (`popup.test.ts`, panel tests)
- [ ] Update `client/README.md` and `userscript/README.md`
- [ ] Visual check: all chips on/off, keyboard focus, narrow popup width

## Open questions

- **Placement:** inside the Sniffies Cruisers filter menu only, or also a panel section for
  setting it without opening the map menu?
- **"No expressions listed" label:** fine, or prefer "None selected"?
