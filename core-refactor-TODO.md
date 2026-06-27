# TODO: Finish profile border refactor

## Context
Core files for the "Open Profiles Outside Boundary" feature have been extracted
into `core/` but the Chrome extension wiring was reverted. Resume here.

## Core files already in place (do not recreate)
- `core/src/profile-border.ts` — `ProfileBorderOpen`, `DEFAULT_PROFILE_BORDER_OPEN`, `installProfileBorderHook`
- `core/src/profile-border.html` — form HTML
- `core/src/profile-border.css` — scoped styles for `#snp-profile-border-root`
- `core/src/profile-border-ui.ts` — `wireProfileBorderForm`, `PROFILE_BORDER_HTML`, `PROFILE_BORDER_CSS`

## Steps remaining

### 1. Re-add exports to `core/src/index.ts`
Add:
```ts
export { installProfileBorderHook, DEFAULT_PROFILE_BORDER_OPEN } from "./profile-border.js";
export type { ProfileBorderOpen } from "./profile-border.js";
export { PROFILE_BORDER_HTML, PROFILE_BORDER_CSS, wireProfileBorderForm } from "./profile-border-ui.js";
export type { ProfileBorderFormContract } from "./profile-border-ui.js";
```

### 2. Update `client/src/shared/settings.ts`
Import `ProfileBorderOpen` and `DEFAULT_PROFILE_BORDER_OPEN` from core instead of
defining them locally. Re-export so the rest of the client still compiles unchanged.

### 3. Update `client/src/content/sniffies-profile-id.ts`
- Import `installProfileBorderHook` from `@sniffies-projects/core`
- Remove the inline click handler block that checks `currentProfileBorderOpen.enabled`
- Call `installProfileBorderHook(() => currentProfileBorderOpen)` at the top level

### 4. Update `client/src/popup/popup.html`
Replace the inline `<details id="profile-border-details">` block with:
```html
<div id="snp-profile-border-root"></div>
```

### 5. Update `client/src/popup/popup.ts`
- Import `PROFILE_BORDER_HTML`, `PROFILE_BORDER_CSS`, `wireProfileBorderForm` from core
- Inject `PROFILE_BORDER_CSS` into `document.head`
- In `init()`: set `profileBorderRoot.innerHTML = PROFILE_BORDER_HTML` and call `wireProfileBorderForm`
- Remove all the manual DOM refs and event listeners for profile border
- **Decision point**: the old popup had "saved" label behavior (`applyProfileBorderLabels`,
  separate Save button for tab selection). `wireProfileBorderForm` saves immediately on
  any change. Confirm with user whether to keep or drop the saved-label behavior before
  doing this step.

### 6. Verify userscript still compiles
The userscript already has the profile border hook and form wired up, but it imports
from core. After step 1, the imports should resolve. Do a build (`npm run build:prod`
in `userscript/`) and confirm no errors.

### 7. Push and test
- Push to `main` to trigger the release workflow
- Install the updated userscript
- Verify the 📍 FAB appears in the Sniffies nav
- Open the panel, enable "Open Profiles Outside Boundary", tap a marker outside the
  boundary, confirm it navigates to the profile URL
