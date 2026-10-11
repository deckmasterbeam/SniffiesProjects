# Single "Premium Features" Toggle — Proposal

Status: **proposal, not started.**

Replace the separate controls for the reverse-engineered premium features with one master toggle
and one section, in both the Chrome popup and the userscript panel.

Covered features:

- Location spoofing (`core/src/geo-hook.ts`, `geo-override-ui.ts`)
- Profiles outside boundary (`core/src/profile-border-hook.ts`, `profile-border-ui.ts`)
- Hide sent photos (`core/src/sent-photos.ts`, `hide-photo-click-hook.ts`)

Not covered: bot blocking (depends on server data and the `REPORTING_ENABLED` flag) and profile
filters (a different kind of feature). Both keep their own sections.

---

## Why

- Three sections for features most users want on is clutter.
- "Enabled" is not "in use":
  - Spoofing does nothing until a location is saved (`hasCapturedCoords`).
  - The border redirect only changes a click that would otherwise hit a paywall.
  - Hide sent photos has no UI of its own; it only acts when Sniffies' Hide Photo button is clicked.
- So the per-feature toggles mostly offer granularity nobody is likely to use.

## Trade-off

Users lose the ability to turn on, say, outside-boundary profiles without also enabling
spoofing. That only matters if a saved location exists and the user wants it off, which the master
toggle still covers (off = no spoofing).

---

## Design

### UI

One section, "Premium features", with a master checkbox at the top.

- **On:** show the configuration underneath.
  - Location: lat/long entry, saved-location label, clear-location button.
  - Profile border: the "open in new tab" option.
- **Off:** hide the configuration, and stop taking over Sniffies' own Hide Photo button.

### Behavior when off

- Geo hook stops spoofing, even if a location is saved (the saved location is kept, not cleared).
- Profile border redirect is bypassed; clicks fall through to Sniffies untouched.
- Hide sent photos: Sniffies' own Hide Photo button is left alone (paywall as normal).

### Default

**On.** Defaulting to off would make the features look missing to most users.

### Settings

- One new flag, e.g. `premiumFeaturesEnabled`, in `core/src/settings.ts` (`SETTINGS_KEYS`,
  `ExtensionLocalSettings`, defaults), stored in `chrome.storage.local` for the client and
  `localStorage` for the userscript.
- Keep the existing `geoOverride.enabled` and `profileBorderOpen.enabled` fields rather than
  deleting them, so saved data stays readable. They stop being user-facing.
- The hooks read the master flag in addition to their own state.

### Migration

Existing users have separate saved toggles. On first load after the update:

- Master = on if either `geoOverride.enabled` or `profileBorderOpen.enabled` was on, else the
  default (on) for fresh installs.
- Only run once; don't overwrite a master value the user has already set.

---

## Tasks

- [ ] Add `premiumFeaturesEnabled` to core settings + defaults (client + userscript storage)
- [ ] Migration from the old per-feature toggles, with a unit test for each combination
- [ ] Core UI: new "Premium features" section wrapping the geo and profile-border forms
- [ ] Wire the section into the popup and the userscript panel; remove the old separate sections
- [ ] Geo hook + profile border hook read the master flag (live-updatable, like the other hook
      state)
- [ ] Hide-photo click hook (`installHidePhotoClick`) gated on the master flag
- [ ] Update the existing popup/userscript tests that assume the old sections
- [ ] Bookmarklet: gate its supported features (profile border) on the master toggle
- [ ] Update `client/README.md` and `userscript/README.md`
- [ ] E2E coverage (see `PLAYWRIGHT_TESTING_TODO.md` §1, §2, §6)

## Decisions

- **Bookmarklet:** the master toggle gates whichever of these features the bookmarklet supports
  (today, profiles outside boundary), the same way it gates them in the client and userscript.
- **Saved location:** turning the master off keeps the saved location. This matches current
  behavior (disabling location changes doesn't clear it; the "clear on disable" idea was closed as
  wontfix in issue #57).
- **Name:** "Premium features" is the user-facing name.
