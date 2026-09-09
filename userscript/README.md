# Sniffies Tools — Userscript

Location spoofing for Sniffies, packaged as an iOS userscript.

Supported features:
- Location spoofing
- Bot reporting/blocking

## Usage

Open [sniffies.com](https://sniffies.com) in Safari. A 📍 button will appear in the nav bar — tap it to open features panel. 

Location spoofing: Enable, enter coordinates, and save. It may take a moment for Sniffies to pick up the location change. If it takes longer than a moment, reload the sniffies site, the location change should be picked up on reload.

Bot reporting/blocking: a 🚩 button is injected next to the pin button on any open profile — tap it to flag the profile as a suspected bot (reports go to manual review, same as the Chrome client). The "Block Bot Accounts" section in the panel hides confirmed bots from the map, chat, and live updates — toggle it on/off; the blocked-account list itself is fetched from the server automatically and isn't editable from the panel.

Settings are persisted to `localStorage` under keys prefixed `sniffies-` (e.g. `sniffies-geo`, `sniffies-blocked-bots`) and survive page reloads.

## Requirements

- [Userscripts](https://apps.apple.com/us/app/userscripts/id1463298887) app on iOS, or
  [Tampermonkey](https://www.tampermonkey.net/) if running on desktop Chrome instead of the
  `client/` extension.

## Installing

Every push to `main` builds this package and publishes it as a GitHub release tagged
`userscript-<version>`, with `dist/sniffies-tools.user.js` attached — check the
[releases page](https://github.com/deckmasterbeam/SniffiesProjects/releases) for the latest one.

Don't download that release asset directly, though — Safari/Tampermonkey detect a userscript by
navigating *to* it as a page (raw JS, not a forced download), which a GitHub release asset doesn't
do. Instead, open the tagged version straight from `raw.githubusercontent.com`, substituting the
tag from the releases page:

```
https://raw.githubusercontent.com/deckmasterbeam/SniffiesProjects/userscript-<version>/dist/sniffies-tools.user.js
```

**iOS (Safari):** install the [Userscripts](https://apps.apple.com/us/app/userscripts/id1463298887)
app and enable it in **Settings → Safari → Extensions**. Open the URL above in Safari, tap the
page-settings button in the address bar, then tap the Userscripts extension — it'll detect the
script and offer to install (or update) it.

**Desktop (Tampermonkey):** install the [Tampermonkey](https://www.tampermonkey.net/) extension,
then open the URL above — Tampermonkey will prompt to install (or update) it automatically.

To update later, just repeat the same steps once a newer `userscript-<version>` tag exists — both
extensions show **Update** instead of **Install** for a script you already have.

## Building

Install dependencies:

```bash
npm install
```

| Command | Output |
|---|---|
| `npm run build` | Unminified — use while developing |
| `npm run build:prod` | Minified — use when copying to your phone |
| `npm run watch` | Unminified, rebuilds on file change |

The output file is `dist/sniffies-tools.user.js`.

## Installing a local dev build

To test an unreleased change instead of the latest tagged release:

1. Run `npm run build:prod`
2. Copy `dist/sniffies-tools.user.js` to **iCloud Drive → Userscripts** (or wherever your userscript
   manager watches for local files) — the "navigate to it as a page" trick above only works for a
   URL, not a local file, so this has to go through the manager's own file-import flow instead.
