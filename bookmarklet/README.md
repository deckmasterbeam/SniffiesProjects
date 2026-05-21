# Sniffies Bookmarklet

Injects location spoofing into sniffies.com on browsers where extensions aren't available (e.g. iOS Safari).

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

The easiest way to get the code onto your phone is to send it to yourself via Notes or iMessage, then copy-paste it into the URL field in step 4.

**To use:** navigate to sniffies.com in Safari, open your bookmarks, and tap "Sniffies Tools". A FAB button will appear on the page.
