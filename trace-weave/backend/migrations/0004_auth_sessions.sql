CREATE UNIQUE INDEX users_username_lower_unique_idx
  ON {{schema}}.users (lower(username));

CREATE TABLE {{schema}}.user_credentials (
  user_id uuid PRIMARY KEY REFERENCES {{schema}}.users(id) ON DELETE CASCADE,
  password_hash char(128) NOT NULL,
  password_salt char(32) NOT NULL,
  algorithm varchar(32) NOT NULL DEFAULT 'scrypt-v1'
    CHECK (algorithm IN ('scrypt-v1')),
  parameters jsonb NOT NULL DEFAULT '{"N":16384,"r":8,"p":1,"keyLength":64}'::jsonb,
  password_changed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE {{schema}}.user_sessions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES {{schema}}.users(id) ON DELETE CASCADE,
  token_hash char(64) NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  user_agent text,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > created_at)
);

CREATE INDEX user_sessions_active_lookup_idx
  ON {{schema}}.user_sessions (token_hash, expires_at)
  WHERE revoked_at IS NULL;

CREATE INDEX user_sessions_user_idx
  ON {{schema}}.user_sessions (user_id, created_at DESC);
