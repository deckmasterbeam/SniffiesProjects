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

#TODO[Josh]: these tables need to get updated

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
