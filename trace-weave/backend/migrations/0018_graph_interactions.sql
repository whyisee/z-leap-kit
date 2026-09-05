CREATE TABLE {{schema}}.graph_action_contexts (
  id uuid PRIMARY KEY,
  owner_user_id uuid NOT NULL REFERENCES {{schema}}.users(id) ON DELETE CASCADE,
  scope varchar(16) NOT NULL CHECK (scope IN ('world', 'personal')),
  mode varchar(24) NOT NULL CHECK (mode IN ('relationships', 'evidence')),
  gesture_type varchar(32) NOT NULL CHECK (gesture_type IN ('node_context', 'node_drop')),
  source_node_id text NOT NULL,
  target_node_id text,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX graph_action_contexts_owner_expiry_idx
  ON {{schema}}.graph_action_contexts (owner_user_id, expires_at DESC);

CREATE TABLE {{schema}}.graph_interaction_audits (
  id uuid PRIMARY KEY,
  owner_user_id uuid NOT NULL REFERENCES {{schema}}.users(id) ON DELETE CASCADE,
  gesture_type varchar(32) NOT NULL,
  action_id varchar(100) NOT NULL,
  action_version integer NOT NULL DEFAULT 1 CHECK (action_version > 0),
  scope varchar(16) NOT NULL CHECK (scope IN ('world', 'personal')),
  source_ref text NOT NULL,
  target_ref text,
  idempotency_key uuid,
  status varchar(24) NOT NULL
    CHECK (status IN ('resolved', 'cancelled', 'succeeded', 'failed', 'denied')),
  result_type varchar(48),
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  failure_code varchar(80),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX graph_interaction_audits_idempotency_idx
  ON {{schema}}.graph_interaction_audits (owner_user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX graph_interaction_audits_owner_created_idx
  ON {{schema}}.graph_interaction_audits (owner_user_id, created_at DESC);
