# Sniffies Tools — Chrome Extension

Chrome extension that enhances sniffies.com with additional features.

Supported features:

- Location spoofing
- Opening profiles outside geofence
- Profile online notification service _(in progress)_
- Bot reporting and blocking _(in progress)_

## Building

Copy `.env.example` to `.env` and fill in the values, then:

```bash
yarn install   # one time
yarn build     # dev build — reads .env for config
yarn build:prod  # prod build — reads version from package.json, requires SERVER_BASE/CLIENT_SECRET
yarn watch     # dev build, rebuilds on save
```

Output goes to `dist/`.

## Load in Chrome

1. Open `chrome://extensions`
2. Toggle **Developer mode** (top right)
3. Click **Load unpacked** and select the `dist/` folder

After rebuilding, click the **reload** (↻) button on the extension card. For content script changes, also reload any open sniffies.com tabs.

## Environment variables

| Variable                          | Description                                                                                 |
| --------------------------------- | ------------------------------------------------------------------------------------------- |
| `SERVER_BASE`                     | Base URL of the deployed server (no trailing slash)                                         |
| `CLIENT_SECRET`                   | Bearer token for client-facing API endpoints. Baked into the bundle.                        |
| `DEBUG`                           | Set to `true` to enable debug overlays on sniffies.com. Always off in `--prod`, regardless of this value. |
| `FAVORITES_NOTIFICATIONS_ENABLED` | Set to exactly `true` to enable favorites/notification features (not yet shipped); anything else (including unset) is off. |
| `REPORTING_ENABLED`               | Set to exactly `true` to enable bot reporting (report button + blocked-bots fetch; not yet shipped); anything else (including unset) is off. |

`FAVORITES_NOTIFICATIONS_ENABLED`/`REPORTING_ENABLED` are read the same way in dev and `--prod` builds — always set them explicitly. In CI, the `--prod` build (`.github/workflows/release-chrome.yml`) reads them from the repo's Actions **variables** (Settings → Secrets and variables → Actions → Variables tab), not secrets — they aren't sensitive, just toggles. Set them there to turn a feature on for the published extension.
