# Sniffies Notify Server

A single Vercel serverless function that the Chrome extension calls to send an
SMS via Textbelt when a favorited user comes online.

## One-time setup

TODO

## Locking it down (optional) (TODO)

Once the extension is loaded, copy its origin (something like
`chrome-extension://abcd…`) and set `ALLOWED_ORIGINS=chrome-extension://abcd…`
in Vercel. The function will reject everything else's CORS preflight.

## Local dev

```
yarn install
vercel dev
```

Then point the extension's endpoint at `http://localhost:3000/api/notify`.
