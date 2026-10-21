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

Preview:

javascript:(function(){var s=document.createElement('script');s.src='https://sniffies-projects-bookm-git-eb641a-joshbarnettcs-5719s-projects.vercel.app/inject.js?t='+Date.now();document.head.appendChild(s);})();
```

## Setting it up on iPhone Safari

You can't type a `javascript:` URL directly into Safari on iOS — you have to create a regular bookmark first and then edit its URL:

1. On your iPhone, bookmark any page (Share → Add Bookmark)
2. Open Bookmarks, find it, tap **Edit**
3. Rename it to "Sniffies Tools" (or whatever)
4. Replace the URL with the bookmarklet code above
5. Save

**To use:** navigate to sniffies.com in Safari, open your bookmarks, and tap "Sniffies Tools". A Sniffies Tools button will appear in the map's icon row. You need to tap the bookmark again after every page load.
