# Sniffies Projects

A monorepo of tools to recreate and expand functionality for [sniffies.com](https://sniffies.com)

## Features

- **Location spoofing** — Override the GPS coordinates Sniffies sees, letting you browse any location on the map.

- **Opening profiles outside geofence** — Click profiles outside the free radius to view them without hitting the paywall.

- **Profile online notification service** *(In progress)* — Favorite profiles and receive an SMS when they come online.

## Packages

### `client/` — Chrome Extension

The main user-facing Chrome extension. Lets users spoof their GPS location and click on profiles outside of the free geofence.

**User Install:** Download `sniffies-chrome.zip` from the [latest release](https://github.com/deckmasterbeam/SniffiesProjects/releases/latest-chrome), extract it, then load the `dist/` folder as an unpacked extension in `chrome://extensions` (Developer mode on).

**Dev Install:** See `client/README.md` for build instructions.

---

### `watcher/` — Watcher Chrome Extension

A separate Chrome extension that runs alongside the client. It hooks into the Sniffies WebSocket connection to detect when watched users come online, then calls `server/api/notify` to fan out SMS alerts to all subscribers. Never distributed publicly — sideloaded only.

**User Install:** This build is intended to support user functionality but not intended to be touched by the user.

**Dev Install:** Same as the client extension — load `dist/` as an unpacked extension. Requires its own build with `WATCHER_SECRET` and `SERVER_BASE` baked in.

---

### `userscript/` — iOS Userscript

Location spoofing packaged as a userscript for the [Userscripts](https://apps.apple.com/us/app/userscripts/id1463298887) iOS app. Preferred path for iOS install, installs once and runs automatically on sniffies.com.


**User Install:** Install the [Userscripts](https://apps.apple.com/us/app/userscripts/id1463298887) iOS app. Then TODO: set up release pipeline for userscript and put that info here

**Dev Install:** Build with `npm run build:prod`, then copy `dist/sniffies-tools.user.js` to **iCloud Drive → Userscripts**. See `userscript/README.md` for details.

---

### `bookmarklet/` — iOS Safari Bookmarklet

Failed attempt to do location spoofing for iOS Safari without any app required. While this path could've been viable, it had unique engineering challenges from the chrome extension (which is what I first built this functionality for). Rather than rewrite the location spoofing from scratch, and in an attempt to give the user an easier install/startup experience, I pivoted to the userscript approach. Keeping this version around just in case I want to come back to this for some reason

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

- Figure out how to containerize the watcher, ideally in one script to:
   - start a VM
   - start up chrome
   - load an extension
   - get the list of favorites
   - watch polling and notify on a favorite showing up

- Create a cache of images for favorited accouts?

- Android Chrome mobile extension? Does Android Chrome mobile just consume chrome extensions?

- Privacy policy

- Map based location selection

- review what kind of data is saved on the client, watcher

- make the tables in the schema, think I need to remake

- do manual test of favoriting path

- do manual test of watcher running, getting favorites, triggering a notification

- update the blog project to serve the userscript from the stable GitHub Releases URL: `https://github.com/deckmasterbeam/SniffiesProjects/releases/latest/download/sniffies-tools.user.js`

- add a GitHub Actions workflow that publishes a dev (non-minified) build to a `dev` release tag on push to the dev branch, then add a dev install page to the blog pointing at `https://github.com/deckmasterbeam/SniffiesProjects/releases/download/dev/sniffies-tools.user.js`
