ALTER TABLE {{schema}}.events
  ADD COLUMN version integer NOT NULL DEFAULT 1 CHECK (version > 0);

CREATE TABLE {{schema}}.event_revisions (
  id uuid PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES {{schema}}.events(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES {{schema}}.users(id),
  version integer NOT NULL CHECK (version > 0),
  operation varchar(24) NOT NULL CHECK (operation IN ('created', 'updated', 'deleted')),
  snapshot jsonb NOT NULL,
  changed_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, version)
);

CREATE INDEX event_revisions_owner_created_idx
  ON {{schema}}.event_revisions (owner_user_id, created_at DESC);
