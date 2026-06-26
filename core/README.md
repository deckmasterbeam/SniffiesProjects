# Sniffies Projects — Core

Shared TypeScript source for the geo-override UI and logic. Used by `client/`, `bookmarklet/`, and `userscript/` at build time via a path alias — not published to npm.

## Exports

| Export | Description |
|---|---|
| `installGeoHook` | Intercepts the browser's geolocation API and returns spoofed coordinates |
| `wireGeoOverrideForm` | Wires up the geo override panel UI to the hook |
| `GEO_OVERRIDE_HTML` / `GEO_OVERRIDE_CSS` | Panel markup and styles, inlined as strings at build time |
| `DEFAULT_GEO_OVERRIDE` / `GeoOverride` | Default settings shape and type |

## Tests

```bash
yarn install   # one time
yarn test
```
