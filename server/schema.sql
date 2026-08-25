CREATE TABLE IF NOT EXISTS notify_log (
  id       SERIAL PRIMARY KEY,
  phone    TEXT NOT NULL,
  message  TEXT NOT NULL,
  sent_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS priority_numbers (
  phone      TEXT PRIMARY KEY,
  note       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS phone_registrations (
  phone      TEXT PRIMARY KEY,
  guid       TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  tested     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS favorites (
  guid            TEXT NOT NULL,
  user_id         TEXT NOT NULL,
  profile_pic_url TEXT,
  favorited_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (guid, user_id)
);

CREATE TABLE IF NOT EXISTS client_init_log (
  id          SERIAL PRIMARY KEY,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id     TEXT NOT NULL,
  client_type TEXT NOT NULL,
  version     TEXT NOT NULL
);

-- Sniffies ids of reporters whose /report submissions should be silently
-- dropped (no row written, no error). Managed manually.
CREATE TABLE IF NOT EXISTS blocked_reporters (
  sniffies_user_id TEXT PRIMARY KEY,
  blocked_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason           TEXT
);

-- report_type is TEXT + CHECK rather than a native Postgres ENUM: schema.sql
-- is applied by splitting on the semicolon character (see scripts/migrate.mjs)
-- and re-run on every deploy, which can't safely re-issue a bare `CREATE TYPE`
-- a second time. Add new values to the CHECK list here as they're needed.
--
-- One row per (reported_user_id, report_type) — multiple reports against the
-- same profile consolidate into this row rather than inserting a new one.
-- reporting_user_ids is a deduped comma-separated list of reporter Sniffies
-- ids. messages holds the optional per-reporter message text since the
-- comma-separated id list has nowhere to carry that.
CREATE TABLE IF NOT EXISTS pending_reports (
  id                 SERIAL PRIMARY KEY,
  report_type        TEXT NOT NULL CHECK (report_type IN ('bot_suspected')),
  reported_user_id   TEXT NOT NULL,
  reporting_user_ids TEXT NOT NULL DEFAULT '',
  messages           JSONB NOT NULL DEFAULT '[]',
  report_count       INTEGER NOT NULL DEFAULT 1,
  first_reported_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_reported_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status             TEXT NOT NULL DEFAULT 'pending',
  UNIQUE (reported_user_id, report_type)
);

-- Manually promoted from pending_reports after review. The client fetches
-- this list (as "blocked bots") on init.
CREATE TABLE IF NOT EXISTS validated_reports (
  id                SERIAL PRIMARY KEY,
  reported_user_id  TEXT NOT NULL UNIQUE,
  report_type       TEXT NOT NULL CHECK (report_type IN ('bot_suspected')),
  validated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source_report_id  INTEGER REFERENCES pending_reports(id),
  note              TEXT
);
