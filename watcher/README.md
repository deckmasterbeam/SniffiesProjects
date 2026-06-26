# Sniffies Watcher — Chrome Extension

Internal Chrome extension that watches the Sniffies WebSocket stream and sends SMS notifications when favorited users come online. Never distributed — sideloaded only.

## How it works

A content script hooks into the page's WebSocket connection and forwards events to the background service worker. The background worker maintains a list of watched user IDs fetched from `server/api/watched-users`, and calls `server/api/notify` when one of them appears online.

## Building

Copy `.env.example` to `.env` and fill in the values, then:

```bash
yarn install   # one time
yarn build     # dev build — reads .env for config
yarn watch     # dev build, rebuilds on save
```

Output goes to `dist/`.

## Load in Chrome

1. Open `chrome://extensions`
2. Toggle **Developer mode** (top right)
3. Click **Load unpacked** and select the `dist/` folder

## Environment variables

| Variable         | Description                                                                 |
| ---------------- | --------------------------------------------------------------------------- |
| `SERVER_BASE`    | Base URL of the deployed server (no trailing slash)                         |
| `WATCHER_SECRET` | Bearer token for watcher-facing API endpoints. Keep private — never distribute. |
