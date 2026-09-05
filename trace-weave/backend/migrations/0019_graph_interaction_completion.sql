ALTER TABLE {{schema}}.graph_action_contexts
  ADD COLUMN node_ids jsonb NOT NULL DEFAULT '[]'::jsonb
  CHECK (jsonb_typeof(node_ids) = 'array');

ALTER TABLE {{schema}}.graph_action_contexts
  DROP CONSTRAINT graph_action_contexts_gesture_type_check;

ALTER TABLE {{schema}}.graph_action_contexts
  ADD CONSTRAINT graph_action_contexts_gesture_type_check
  CHECK (gesture_type IN ('node_context', 'node_drop', 'multi_select'));

CREATE TABLE {{schema}}.graph_action_undos (
  id uuid PRIMARY KEY,
  owner_user_id uuid NOT NULL REFERENCES {{schema}}.users(id) ON DELETE CASCADE,
  audit_id uuid NOT NULL REFERENCES {{schema}}.graph_interaction_audits(id) ON DELETE CASCADE,
  undo_type varchar(48) NOT NULL
    CHECK (undo_type IN ('event_participant', 'event_entity', 'event_location', 'event_relation', 'occurrence_link', 'entity_operation')),
  payload jsonb NOT NULL,
  status varchar(24) NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'used', 'expired', 'invalid')),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX graph_action_undos_owner_status_idx
  ON {{schema}}.graph_action_undos (owner_user_id, status, expires_at DESC);
