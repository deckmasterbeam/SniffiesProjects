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

- [Userscripts](https://apps.apple.com/us/app/userscripts/id1463298887) app on iOS

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

## Dev Installing on iPhone

TODO: update this section when I have my site picking up the release and dev builds from github

1. Run `npm run build:prod`
2. Copy `dist/sniffies-tools.user.js` to userscripts folder on device
