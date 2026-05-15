# Sniffies Plug-ins Chrome extension

I have a couple of ideas to plug into sniffies, this extension is intended to explore those ideas

## Build

Sources live in `src/` as TypeScript. The build bundles them with esbuild and
copies `manifest.json` plus static assets into `dist/`.

```powershell
yarn install   # one time
yarn build     # produces dist/
yarn watch     # rebuilds on save
yarn typecheck # tsc --noEmit
```

## Load the extension in Chrome

1. Add icon PNGs in `icons/` at sizes 16, 32, 48, 128 (placeholders are fine).
2. Run `yarn build`.
3. Open `chrome://extensions`.
4. Toggle **Developer mode** (top right).
5. Click **Load unpacked** and select the generated `dist/` folder.
6. The extension icon should appear in the toolbar — click it to open the popup.

## Reload after changes

Rebuild (`yarn build` or keep `yarn watch` running), then click the **reload**
(↻) button on the extension's card in `chrome://extensions`. For content-script
changes, also reload the affected tabs.

## SMS notifications (Twilio backend)

The extension can text you when a favorited cruiser comes online. SMS goes
through a tiny Vercel function in [`server/`](server/) that calls Twilio.

See [`server/README.md`](server/README.md) for one-time setup. After deploying,
open the extension popup and fill in **Phone**, **Endpoint URL**, and
**Shared secret** under "Notifications", then click **Send test** to confirm.

TODO:
1. Create a log of profile online polls
   - need to look into what the online polling event looks like in the network log
   - ask claude to look for those events
   - make an updating table to show these events
2. Create a way to favorite profiles in a way thats saved to the extension
   - and/or saves to a DB
3. Pair the polling events with the list of favorites, send a text when a favorite shows up in the events
4. Figure out how to containerize this, ideally in one script to:
   - start a VM
   - start up chrome
   - load an extension
   - get the list of favorites
   - watch polling and notify on a favorite showing up
5. Create a cache of images for favorited accouts?