CREATE TABLE {{schema}}.web_push_subscriptions (
  id uuid PRIMARY KEY,
  owner_user_id uuid NOT NULL REFERENCES {{schema}}.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth_secret text NOT NULL,
  user_agent text,
  status varchar(24) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked')),
  failure_count integer NOT NULL DEFAULT 0 CHECK (failure_count >= 0),
  last_success_at timestamptz,
  last_failure_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_user_id, endpoint)
);

CREATE TABLE {{schema}}.web_push_deliveries (
  id uuid PRIMARY KEY,
  notification_id uuid NOT NULL REFERENCES {{schema}}.notifications(id) ON DELETE CASCADE,
  subscription_id uuid NOT NULL REFERENCES {{schema}}.web_push_subscriptions(id) ON DELETE CASCADE,
  status varchar(24) NOT NULL CHECK (status IN ('pending', 'delivered', 'failed', 'expired')),
  response_status integer,
  error_message text,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  UNIQUE (notification_id, subscription_id)
);

CREATE INDEX web_push_subscriptions_owner_active_idx
  ON {{schema}}.web_push_subscriptions (owner_user_id) WHERE status = 'active';
