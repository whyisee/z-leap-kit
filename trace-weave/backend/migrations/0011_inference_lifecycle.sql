ALTER TABLE {{schema}}.user_assertions
  ADD COLUMN confidence numeric(5,4) NOT NULL DEFAULT 1 CHECK (confidence BETWEEN 0 AND 1),
  ADD COLUMN evidence_event_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE {{schema}}.inferred_relations
  ADD COLUMN last_evaluated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN decay_half_life_days integer NOT NULL DEFAULT 90 CHECK (decay_half_life_days > 0),
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX inferred_relations_version_target_unique_idx
  ON {{schema}}.inferred_relations (owner_user_id, relation_type, target_user_entity_id, inference_version)
  WHERE target_user_entity_id IS NOT NULL;

CREATE INDEX inferred_relations_owner_status_idx
  ON {{schema}}.inferred_relations (owner_user_id, status, confidence DESC);
