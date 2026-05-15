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
