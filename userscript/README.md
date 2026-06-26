# Sniffies Tools — Userscript

Location spoofing for Sniffies, packaged as an iOS userscript.

Supported features:
- Location spoofing

## Usage

Open [sniffies.com](https://sniffies.com) in Safari. A 📍 button will appear in the nav bar — tap it to open features panel. 

Location spoofing: Enable, enter coordinates, and save. It may take a moment for Sniffies to pick up the location change. If it takes longer than a moment, reload the sniffies site, the location change should be picked up on reload.

Settings are persisted to `localStorage` under the key `sniffies-geo` and survive page reloads.

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
