CREATE TABLE {{schema}}.entity_memory_operations (
  id uuid PRIMARY KEY,
  owner_user_id uuid NOT NULL REFERENCES {{schema}}.users(id) ON DELETE CASCADE,
  operation_type varchar(24) NOT NULL CHECK (operation_type IN ('merge', 'split')),
  source_entity_id uuid NOT NULL REFERENCES {{schema}}.user_entities(id),
  target_entity_id uuid NOT NULL REFERENCES {{schema}}.user_entities(id),
  snapshot jsonb NOT NULL,
  status varchar(24) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'undone')),
  created_at timestamptz NOT NULL DEFAULT now(),
  undone_at timestamptz,
  CHECK (source_entity_id <> target_entity_id)
);

CREATE INDEX entity_memory_operations_owner_idx
  ON {{schema}}.entity_memory_operations (owner_user_id, created_at DESC);

CREATE UNIQUE INDEX canonical_entities_active_name_unique_idx
  ON {{schema}}.canonical_entities (entity_type, normalized_name)
  WHERE status = 'active';

CREATE UNIQUE INDEX canonical_entity_redirects_source_unique_idx
  ON {{schema}}.canonical_entity_redirects (source_entity_id);
