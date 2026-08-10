CREATE TABLE {{schema}}.notification_preferences (
  owner_user_id uuid PRIMARY KEY REFERENCES {{schema}}.users(id) ON DELETE CASCADE,
  browser_notifications_enabled boolean NOT NULL DEFAULT false,
  draft_reminder_delay_minutes integer NOT NULL DEFAULT 1440
    CHECK (draft_reminder_delay_minutes BETWEEN 5 AND 43200),
  quiet_hours jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE {{schema}}.notifications (
  id uuid PRIMARY KEY,
  owner_user_id uuid NOT NULL REFERENCES {{schema}}.users(id) ON DELETE CASCADE,
  notification_type varchar(60) NOT NULL,
  resource_type varchar(60) NOT NULL,
  resource_id uuid NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  status varchar(24) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'delivered', 'read', 'dismissed', 'failed')),
  scheduled_at timestamptz NOT NULL,
  delivered_at timestamptz,
  read_at timestamptz,
  delivery_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_user_id, notification_type, resource_type, resource_id)
);

CREATE INDEX notifications_owner_status_created_idx
  ON {{schema}}.notifications (owner_user_id, status, created_at DESC);

CREATE TABLE {{schema}}.push_subscriptions (
  id uuid PRIMARY KEY,
  owner_user_id uuid NOT NULL REFERENCES {{schema}}.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth_secret text NOT NULL,
  user_agent text,
  status varchar(24) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'revoked', 'failed')),
  failure_count integer NOT NULL DEFAULT 0 CHECK (failure_count >= 0),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX push_subscriptions_owner_status_idx
  ON {{schema}}.push_subscriptions (owner_user_id, status);
