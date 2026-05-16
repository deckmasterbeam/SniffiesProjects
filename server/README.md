# Sniffies Server

Vercel serverless API. Handles phone registration, favorites sync, and SMS notifications via Textbelt.

## Setup

```
yarn install
vercel dev        # local — binds to http://localhost:3000
vercel deploy     # production
```

## Environment variables

| Variable          | Required | Description                                            |
| ----------------- | -------- | ------------------------------------------------------ |
| `POSTGRES_URL`    | Yes      | Neon connection string                                 |
| `TEXTBELT_KEY`    | Yes      | Textbelt API key                                       |
| `CLIENT_SECRET`   | Yes      | Bearer token baked into the client extension dist      |
| `WATCHER_SECRET`  | Yes      | Bearer token baked into the watcher extension dist     |
| `ALLOWED_ORIGINS` | No       | Comma-separated allowed CORS origins. Defaults to all. |
| `DAILY_SMS_LIMIT` | No       | Max SMS per phone per 24 h (default: `10`)             |

### Two-secret model

There are two bearer tokens with different trust levels:

**`CLIENT_SECRET`** is used by the public-facing client extension (`save-number`, `favorites`, `send-guid`, `notify-test`). Because it gets compiled into the distributed extension bundle it is not truly private — anyone who unpacks the `.crx` can read it. It exists to prevent casual scraping of the API, not to enforce strong security. GUID-based ownership is the real access control for favorites data.

**`WATCHER_SECRET`** is used by the watcher extension (`watched-users`, `notify`). The watcher is sideloaded and never distributed publicly. Keep this secret private — it authorises sending SMS to all subscribers.

Set `SERVER_BASE` in the client and watcher builds to point at the deployed URL (e.g. `https://your-app.vercel.app`). Set `CLIENT_SECRET` in the client build and `WATCHER_SECRET` in the watcher build.

## Database

Run [`schema.sql`](./schema.sql) against your Neon database to create all tables.

| Table                 | Purpose                                               |
| --------------------- | ----------------------------------------------------- |
| `phone_registrations` | One row per phone; holds the GUID used as auth token  |
| `favorites`           | `(guid, user_id)` pairs; one row per favorited user   |
| `notify_log`          | Record of every SMS sent, used for rate-limiting      |
| `priority_numbers`    | Phones exempt from the daily SMS limit                |

---

## Endpoints

### `POST /api/save-number`

Registers a phone number and returns its GUID. If the phone is already registered the existing GUID is returned unchanged. The GUID is the client's auth token for all subsequent calls — it should be stored locally.

**Auth:** `Authorization: Bearer <CLIENT_SECRET>`

**Request**
```json
{ "phone": "+15551234567" }
```

**Response**
```json
{ "ok": true, "guid": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" }
```

**Errors**

| Status | `error`         | Meaning                      |
| ------ | --------------- | ---------------------------- |
| 400    | `invalid_phone` | Not a valid E.164 number     |
| 500    | `db_error`      | Database failure             |

---

### `GET /api/favorites?guid=<guid>`

Returns the favorites list for the given GUID.

**Auth:** `Authorization: Bearer <CLIENT_SECRET>` (GUID in query param is the ownership credential)

**Response**
```json
{
  "ok": true,
  "favorites": [
    {
      "user_id": "abc123",
      "profile_pic_url": "https://...",
      "favorited_at": "2026-01-01T00:00:00Z"
    }
  ]
}
```

**Errors**

| Status | `error`         | Meaning                      |
| ------ | --------------- | ---------------------------- |
| 400    | `guid_required` | `guid` query param missing   |
| 500    | `db_error`      | Database failure             |

---

### `POST /api/favorites`

Adds or removes a favorite. Called when the user taps the star on a cruiser's profile.

**Auth:** `Authorization: Bearer <CLIENT_SECRET>` (GUID in body is the ownership credential)

**Request**
```json
{
  "guid": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "userId": "abc123",
  "profilePicUrl": "https://...",
  "favorite": true
}
```

Set `"favorite": false` to remove. `profilePicUrl` is optional and only used when adding.

**Response**
```json
{ "ok": true }
```

**Errors**

| Status | `error`                    | Meaning                       |
| ------ | -------------------------- | ----------------------------- |
| 400    | `guid_and_userId_required` | Missing required fields       |
| 500    | `db_error`                 | Database failure              |

---

### `POST /api/send-guid`

Texts the GUID to the registered phone number. Used for the recovery flow when the user switches devices.

**Auth:** `Authorization: Bearer <CLIENT_SECRET>` (phone ownership is verified by SMS delivery)

**Request**
```json
{ "phone": "+15551234567" }
```

**Response**
```json
{ "ok": true }
```

**Errors**

| Status | `error`                 | Meaning                              |
| ------ | ----------------------- | ------------------------------------ |
| 400    | `invalid_phone`         | Not a valid E.164 number             |
| 404    | `phone_not_registered`  | Phone has no registration record     |
| 502    | `textbelt_failed`       | Textbelt rejected the send           |

---

### `GET /api/watched-users`

Returns the distinct set of all user IDs that at least one registered phone has favorited. The watcher extension polls this on startup (and periodically) to know which users to watch.

**Auth:** `Authorization: Bearer <WATCHER_SECRET>`

**Response**
```json
{ "ok": true, "userIds": ["abc123", "def456"] }
```

**Errors**

| Status | `error`        | Meaning                          |
| ------ | -------------- | -------------------------------- |
| 401    | `unauthorized` | Missing or wrong bearer token    |
| 500    | `db_error`     | Database failure                 |

---

### `POST /api/notify`

Fans out an SMS to every phone subscribed to a given user ID. Called by the watcher when a watched user comes online. Respects the per-phone daily SMS limit; phones in `priority_numbers` bypass the limit.

**Auth:** `Authorization: Bearer <WATCHER_SECRET>`

**Request**
```json
{ "userId": "abc123" }
```

**Response**
```json
{ "ok": true, "sent": 2, "total": 2 }
```

`sent` is the number of SMS actually dispatched. `total` is the number of subscribers found. An optional `errors` array is included if any sends failed or were rate-limited.

A 200 with `"sent": 0, "detail": "no_subscribers"` means no one has favorited that user ID.

**Errors**

| Status | `error`               | Meaning                          |
| ------ | --------------------- | -------------------------------- |
| 400    | `userId_required`     | Missing `userId` field           |
| 401    | `unauthorized`        | Missing or wrong bearer token    |
| 500    | `server_misconfigured`| `TEXTBELT_KEY` not set           |
| 500    | `db_error`            | Database failure                 |
