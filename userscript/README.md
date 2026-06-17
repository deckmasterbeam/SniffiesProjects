# Sniffies Tools — Userscript

Location spoofing for Sniffies, packaged as an iOS userscript.

## Usage

Open [sniffies.com](https://sniffies.com) in Safari. A 📍 button will appear in the nav bar — tap it to open the location panel. Enter coordinates, enable spoofing, and save.

Settings are persisted to `localStorage` under the key `sniffies-geo` and survive page reloads.

## Requirements

- [Userscripts](https://apps.apple.com/us/app/userscripts/id1463298887) app on iOS
- iCloud Drive enabled

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

## Installing on iPhone

1. Run `npm run build:prod`
2. Copy `dist/sniffies-tools.user.js` to **iCloud Drive → Userscripts**
3. The Userscripts app picks it up automatically — no reload needed

On subsequent updates, just overwrite the file in iCloud Drive with a new build.
