# Sniffies Bookmarklet

Injects features into sniffies.com on browsers where extensions aren't available (e.g. iOS Safari) without 3rd party apps.

A bookmarklet only runs after the page has loaded, so it can never hook the page's init behavior. Features that need that live in `userscript/` only.

Supported features:

- **Open profiles outside your boundary** — Works independently without location spoofing (bookmarklet-only feature)
- Hide and unhide photos you've sent ("Hide Sent Photos" in the panel). Open the chat after tapping the bookmarklet, so it can see the conversation
- No cap on how many options you can pick in Sniffies' own Sexuality, Body Type and Position filters (enable "Profile Filters" in the panel, then open the filter menu)

Not supported (use the userscript for these):

- **Location spoofing** — Requires hooking the browser's geolocation API at page init time, which a bookmarklet can't do
- **Bot filtering** — Requires intercepting network requests before the page loads
- **Gender, Height, Weight and Online After filters** — Require filtering Sniffies' network responses at init time

See the "Profile filter support" table in the root `README.md` for every build.

## Bookmarklet code

```
Prod:

javascript:(function(){var s=document.createElement('script');s.src='https://sniffies-projects-bookmarklet.vercel.app/inject.js?t='+Date.now();document.head.appendChild(s);})();
```

## Setting it up on iPhone Safari

You can't type a `javascript:` URL directly into Safari on iOS — you have to create a regular bookmark first and then edit its URL:

1. On your iPhone, bookmark any page (Share → Add Bookmark)
2. Open Bookmarks, find it, tap **Edit**
3. Rename it to "Sniffies Tools" (or whatever)
4. Replace the URL with the bookmarklet code above
5. Save

**To use:** navigate to sniffies.com in Safari, open your bookmarks, and tap "Sniffies Tools". A Sniffies Tools button will appear in the map's icon row. You need to tap the bookmark again after every page load.

## Running the local dev version

From `bookmarklet/`, run `yarn watch`. It rebuilds `dist/inject.js` on every save and copies the result to your clipboard.

**Paste into the console:** open sniffies.com, paste into the DevTools console, and press Enter. Reload the page before each paste; running it again on the same page only toggles the panel.

**Load it from localhost:** (run from `bookmarklet/`) this is closer to how the real bookmarklet loads. It may be blocked by Sniffies' CSP, in which case use the console paste above.

```
npx serve dist -p 5000 --cors
```

Then run this in the console:

```
var s=document.createElement('script');s.src='http://localhost:5000/inject.js?t='+Date.now();document.head.appendChild(s);
```

**As a bookmarklet:** serve `dist/` as above and save this as the bookmark's URL (desktop only, same CSP caveat):

```
javascript:(function(){var s=document.createElement('script');s.src='http://localhost:5000/inject.js?t='+Date.now();document.head.appendChild(s);})();
```

On a phone, `localhost` is the phone itself, and an `http://` LAN address is blocked as mixed content on the https site. Expose the server over https instead (for example `npx cloudflared tunnel --url http://localhost:5000`) and use that https URL in place of `http://localhost:5000`, or use the Vercel Preview bookmarklet above.

The usage-logging ping does nothing unless `SERVER_BASE` and `CLIENT_SECRET` are set when building, so dev runs stay out of the usage logs.
