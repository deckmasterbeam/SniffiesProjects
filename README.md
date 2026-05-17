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

## SMS notifications

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

6. I want to be able to click on profiles outside the boundary without going to the payment screen
   - attribute: data-within-radius T/F (prefer to use this)
   - Inside: marker-level-6, Outside: marker-level-5
   - Make this toggleable in the control panel
   - When true, clicking on a profile outside of the radius will open that profile in a new tab

7. Split the code between a consumer client extension that users will actually click on and a watcher extension that will just watch for online activity

8. Safari extension
   - mostly to plug into ios safari

9. Chrome mobile extension

10. Privacy policy

11. Map based location selection

- review what kind of data is saved on the client, watcher
- make the tables in the schema, think I need to remake
- do manual test of favoriting path
- do manual test of watcher running, getting favorites, triggering a notification
- can some of the event watchers be unified? Worried if the extension is part of what causes massive chrome consumption
- look into how I can use bookmarks in safari to load a content script