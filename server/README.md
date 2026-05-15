# Sniffies Notify Server

A single Vercel serverless function that the Chrome extension calls to send an
SMS via Twilio when a favorited user comes online.

## One-time setup

1. **Twilio**
   - Create an account at <https://www.twilio.com/console>.
   - Note your **Account SID** and **Auth Token** from the console.
   - Buy / claim a phone number capable of sending SMS, note it in E.164 form
     (e.g. `+15551234567`).
2. **Shared secret**
   - Generate a long random string (e.g. `openssl rand -hex 32`). The
     extension will send this in `Authorization: Bearer …`.
3. **Vercel**
   - `vercel login`
   - From this `server/` folder: `vercel link` (create or pick a project).
   - Add the env vars:
     ```
     vercel env add SHARED_SECRET production
     vercel env add TWILIO_ACCOUNT_SID production
     vercel env add TWILIO_AUTH_TOKEN production
     vercel env add TWILIO_FROM_NUMBER production
     ```
     (Repeat for `preview` if you want previews to work too.)
   - Deploy: `vercel --prod`.
   - Note the resulting URL, e.g. `https://sniffies-notify.vercel.app`.
4. **Extension**
   - Open the extension popup.
   - Under "Notifications", enter:
     - Phone number (E.164, e.g. `+15551234567`)
     - Endpoint: `https://<your-deployment>.vercel.app/api/notify`
     - Shared secret: same value as `SHARED_SECRET` above.

## Locking it down (optional)

Once the extension is loaded, copy its origin (something like
`chrome-extension://abcd…`) and set `ALLOWED_ORIGINS=chrome-extension://abcd…`
in Vercel. The function will reject everything else's CORS preflight.

## Local dev

```
yarn install
vercel dev
```

Then point the extension's endpoint at `http://localhost:3000/api/notify`.
