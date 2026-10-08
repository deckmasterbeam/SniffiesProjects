# Sniffies Tools

A monorepo of tools to recreate and expand functionality for [sniffies.com](https://sniffies.com)

## Features

- **Location spoofing** — Override the GPS coordinates Sniffies sees, letting you browse any location on the map.

- **Opening profiles outside geofence** — Click profiles outside the free radius to view them without hitting the paywall.

- **Profile online notification service** *(In progress)* — Favorite profiles and receive an SMS when they come online.

- **Bot reporting/blocking** — Flag a profile as a suspected bot from its profile screen; confirmed reports get hidden from the map, chat, and live updates for everyone with blocking enabled.

- **Profile filters** — Extra filters in the Cruisers section of Sniffies' Map Layers menu, and no cap on how many options you can pick in some of Sniffies' own.

### Profile filter support

| Filter       | What it does                                                                        | Chrome extension | Userscript | Bookmarklet |
| ------------ | ----------------------------------------------------------------------------------- | ---------------- | ---------- | ----------- |
| Gender       | New row with an on/off switch and Male / Female / Nonbinary / Not specified buttons | Yes              | Yes        | No          |
| Last Online  | Row under Cruising Now: Now / 30 min / 1 hr; people stay after going offline        | Yes              | Yes        | No          |
| Height       | New line under Cruiser Stats that opens a min/max range sheet                       | Yes              | Yes        | No          |
| Weight       | New line under Cruiser Stats that opens a min/max range sheet                       | Yes              | Yes        | No          |
| Sexuality    | Sniffies' own filter; "Choose up to 3" raised to 99                                 | Yes              | Yes        | Yes         |
| Body Type    | Sniffies' own filter; "Choose up to 3" raised to 99                                 | Yes              | Yes        | Yes         |
| Position     | Sniffies' own filter; "Choose up to 4" raised to 99                                 | Yes              | Yes        | Yes         |
| Blocked bots | Hides confirmed bot accounts from the map, chat, and live updates                   | Yes              | Yes        | No          |

Everything except Blocked bots is switched on by the "Profile Filters" section of the popup (Chrome extension) or panel (userscript, bookmarklet). It is off by default.

Gender, Height, Weight, Last Online and Blocked bots work by filtering Sniffies' network responses as the page loads, which a bookmarklet is too late for. Changing them needs a page reload to take effect.

## Packages

### `client/` — Chrome Extension

The main user-facing Chrome extension. Lets users spoof their GPS location and click on profiles outside of the free geofence.

**User Install:** Download `sniffies-chrome.zip` from the most recent `chrome-*` entry on the [releases page](https://github.com/deckmasterbeam/SniffiesProjects/releases), extract it, then load the `dist/` folder as an unpacked extension in `chrome://extensions` (Developer mode on).

**Dev Install:** See `client/README.md` for build instructions.

---

### `watcher/` — Watcher Chrome Extension

A separate Chrome extension that runs alongside the client. It hooks into the Sniffies WebSocket connection to detect when watched users come online, then calls `server/api/notify` to fan out SMS alerts to all subscribers. Never distributed publicly — sideloaded only.

**User Install:** This build is intended to support user functionality but not intended to be touched by the user.

**Dev Install:** Same as the client extension — load `dist/` as an unpacked extension. Requires its own build with `WATCHER_SECRET` and `SERVER_BASE` baked in.

---

### `userscript/` — iOS Userscript

Location spoofing packaged as a userscript for the [Userscripts](https://apps.apple.com/us/app/userscripts/id1463298887) iOS app. Preferred path for iOS install, installs once and runs automatically on sniffies.com.


**User Install:** Install the [Userscripts](https://apps.apple.com/us/app/userscripts/id1463298887) iOS app, then open the `dist/sniffies-tools.user.js` file from the most recent `userscript-*` entry on the [releases page](https://github.com/deckmasterbeam/SniffiesProjects/releases) directly in Safari (not as a downloaded file — see `userscript/README.md` for the exact URL and why that distinction matters) to trigger the install prompt.

**Dev Install:** See `userscript/README.md` for build instructions.

---

### `bookmarklet/` — iOS Safari Bookmarklet

Reduced-feature version for iOS Safari with no app required. A bookmarklet can't hook the page's init behavior, so it supports opening profiles outside your boundary and the raised selection caps on Sniffies' own stat filters, but not location spoofing, bot filtering, or the Gender / Height / Weight / Last Online filters — use the userscript for those.

**Install:** Create a Safari bookmark and replace its URL with the bookmarklet code from `bookmarklet/README.md`.

---

### `server/` — Vercel API

Serverless backend deployed on Vercel. Handles phone registration, favorites storage (Neon Postgres), and SMS delivery via Textbelt. Uses a two-secret model: `CLIENT_SECRET` for the public client extension, `WATCHER_SECRET` for the private watcher.

See `server/README.md` for environment variables, database setup, and endpoint docs.

---

### `core/` — Shared Library

Shared TypeScript source for the geo-override UI and logic. Used by `client/`, `bookmarklet/`, and `userscript/` via a build-time path alias.

---

### `scripts/` — Root Build Scripts

Root-level helpers. `build.mjs` delegates to a specific package's build script (`yarn build client`, `yarn build bookmarklet`). `test-all.mjs` runs tests across all packages.

---

## TODO:

- Privacy policy

- Map based location selection