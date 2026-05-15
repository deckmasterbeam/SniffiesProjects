# Sniffies Plug-ins Chrome extension

I have a couple of ideas to plug into sniffies, this extension is intended to explore those ideas

## What does this extension do?

1. Records a log of each unqiue event in wss://prod.ws.sniffies.com/\*
   - this log allowed me to explore the relevant event messages to figure out what to notify on
   - on when env value enableSeenEventsLogging=true

2. Allows the user to favorite or unfavorite profiles from the profile view

3. If a phone number has been saved to the extension, will notify the phone number when a favorited user logs on
   - rate limited to 10 notifications per day

4. View list of favorited profiles
   - also entry point to view record of unqiue events

5. Change the location that Sniffies sees

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

Pre-built (recommended):

1. download `dist.zip` and extract it to get the `dist/` folder

Manual:

1. Run `yarn build` to generate `dist/` folder

2. Open `chrome://extensions`.
3. Toggle **Developer mode** (top right).
4. Click **Load unpacked** and select the generated or downloaded `dist/` folder.
5. The extension icon should appear in the toolbar — click it to open the popup.

## Reload after changes

Rebuild (`yarn build` or keep `yarn watch` running), then click the **reload**
(↻) button on the extension's card in `chrome://extensions`. For content-script
changes, also reload the affected tabs.

## Safari on iOS

Safari supports MV3 web extensions on iOS 15.4+, but they must be shipped as
a native iOS app that hosts the extension. Apple provides
`safari-web-extension-converter` (bundled with Xcode) to generate the
wrapping Xcode project from the same `dist/` folder used for Chrome.

Prerequisites (macOS only):

- Xcode 15+ with Command Line Tools (`xcode-select --install`)
- An Apple Developer account for signing if you want to run on a real device

Steps:

```bash
yarn install
yarn build                  # produces dist/
yarn package:safari-ios     # runs xcrun safari-web-extension-converter
```

Optional flags:

```bash
yarn package:safari-ios --bundle-id com.example.sniffies --app-name "Sniffies" --open
```

The generated Xcode project lands in `safari/`. Open the `.xcodeproj`, set
your signing team, pick an iOS Simulator or device, and Run. On the
device, enable the extension under **Settings → Safari → Extensions** and
grant the sniffies.com host permission.

### iOS caveats

- **Background notifications won't fire when Safari is closed.** The SMS
  flow relies on the service worker staying alive — on iOS, extension
  background pages only run while Safari is the foreground app with a
  sniffies tab open.
- `world: "MAIN"` content scripts (the WS / geo / events hooks) require
  **Safari 17+ (iOS 17+)**. On older iOS those injections silently no-op.
- `<all_urls>` host access must be granted per-site by the user in
  Safari's site settings; there is no blanket "all sites" toggle.
- `chrome.storage.sync` is backed by iCloud on Safari and may be
  unavailable when the user is signed out of iCloud — code already falls
  back to `storage.local` where it matters.

## SMS notifications (Twilio backend)

The extension can text you when a favorited cruiser comes online. SMS goes
through a tiny Vercel API that plugs into Textbelt (https://docs.textbelt.com/)

## TODO:

4. Figure out how to containerize this, ideally in one script to:
   - start a VM
   - start up chrome
   - load an extension
   - get the list of favorites
   - watch polling and notify on a favorite showing up

5. Create a cache of images for favorited accouts?
