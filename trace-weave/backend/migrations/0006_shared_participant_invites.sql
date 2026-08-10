CREATE TABLE {{schema}}.event_participant_account_invites (
  id uuid PRIMARY KEY,
  owner_user_id uuid NOT NULL REFERENCES {{schema}}.users(id),
  event_participant_id uuid NOT NULL REFERENCES {{schema}}.event_participants(id) ON DELETE CASCADE,
  target_user_id uuid NOT NULL REFERENCES {{schema}}.users(id),
  status varchar(24) NOT NULL DEFAULT 'invited'
    CHECK (status IN ('invited', 'accepted', 'declined', 'revoked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  UNIQUE (event_participant_id, target_user_id),
  CHECK (owner_user_id <> target_user_id)
);

CREATE INDEX event_participant_invites_target_idx
  ON {{schema}}.event_participant_account_invites (target_user_id, status, created_at DESC);

CREATE INDEX event_participant_invites_owner_idx
  ON {{schema}}.event_participant_account_invites (owner_user_id, status, created_at DESC);

CREATE UNIQUE INDEX event_occurrence_links_active_event_unique_idx
  ON {{schema}}.event_occurrence_links (event_id)
  WHERE link_status = 'active';
