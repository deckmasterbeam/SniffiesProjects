# Sniffies Tools — Chrome Extension

Chrome extension that enhances sniffies.com with additional features.

Supported features:
- Location spoofing
- Opening profiles outside geofence
- Profile online notification service *(in progress)*
- Bot reporting and blocking *(in progress)*

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

| Variable                        | Description                                                              |
| ------------------------------- | ------------------------------------------------------------------------ |
| `SERVER_BASE`                   | Base URL of the deployed server (no trailing slash)                      |
| `CLIENT_SECRET`                 | Bearer token for client-facing API endpoints. Baked into the bundle.     |
| `DEBUG`                         | Set to `true` to enable debug overlays on sniffies.com                   |
| `FAVORITES_NOTIFICATIONS_ENABLED` | Set to `true` to enable favorites/notification features (not yet shipped) |
| `REPORTING_ENABLED`             | Set to `true` to enable bot reporting (report button + blocked-bots fetch; not yet shipped) |
