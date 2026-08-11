CREATE TABLE {{schema}}.canonical_entity_sources (
  id uuid PRIMARY KEY,
  canonical_entity_id uuid NOT NULL REFERENCES {{schema}}.canonical_entities(id) ON DELETE CASCADE,
  source_key varchar(80) NOT NULL,
  external_id varchar(240) NOT NULL,
  source_url text,
  source_version varchar(80),
  raw_checksum char(64),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_key, external_id)
);

CREATE INDEX canonical_entity_sources_entity_idx
  ON {{schema}}.canonical_entity_sources (canonical_entity_id, source_key);

CREATE TABLE {{schema}}.canonical_entity_aliases (
  id uuid PRIMARY KEY,
  canonical_entity_id uuid NOT NULL REFERENCES {{schema}}.canonical_entities(id) ON DELETE CASCADE,
  alias text NOT NULL,
  normalized_alias text NOT NULL,
  locale varchar(35) NOT NULL DEFAULT 'zh-CN',
  source_key varchar(80) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (canonical_entity_id, normalized_alias, locale)
);

CREATE INDEX canonical_entity_aliases_lookup_idx
  ON {{schema}}.canonical_entity_aliases (normalized_alias, locale, canonical_entity_id);

CREATE TABLE {{schema}}.public_event_projections (
  event_id uuid PRIMARY KEY REFERENCES {{schema}}.events(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES {{schema}}.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  event_type varchar(80) NOT NULL,
  factual_status varchar(24) NOT NULL,
  occurred_day date,
  created_day date NOT NULL,
  policy_version integer NOT NULL CHECK (policy_version > 0),
  projected_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX public_event_projections_time_idx
  ON {{schema}}.public_event_projections (occurred_day DESC NULLS LAST, created_day DESC, event_id);

CREATE INDEX public_event_projections_owner_idx
  ON {{schema}}.public_event_projections (owner_user_id, occurred_day DESC NULLS LAST);

CREATE TABLE {{schema}}.public_event_entity_projections (
  event_id uuid NOT NULL REFERENCES {{schema}}.public_event_projections(event_id) ON DELETE CASCADE,
  canonical_entity_id uuid NOT NULL REFERENCES {{schema}}.canonical_entities(id) ON DELETE CASCADE,
  relation_role varchar(60) NOT NULL,
  projected_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, canonical_entity_id, relation_role)
);

CREATE INDEX public_event_entity_projection_entity_idx
  ON {{schema}}.public_event_entity_projections (canonical_entity_id, relation_role, event_id);

CREATE TABLE {{schema}}.world_sync_state (
  source_key varchar(80) PRIMARY KEY,
  cursor jsonb,
  last_started_at timestamptz,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE {{schema}}.world_sync_runs (
  id uuid PRIMARY KEY,
  source_key varchar(80) NOT NULL,
  run_kind varchar(32) NOT NULL
    CHECK (run_kind IN ('entity_seed', 'projection_reconcile', 'external_incremental')),
  status varchar(24) NOT NULL
    CHECK (status IN ('running', 'succeeded', 'failed', 'skipped')),
  cursor_before jsonb,
  cursor_after jsonb,
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  worker_id varchar(160),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX world_sync_runs_source_started_idx
  ON {{schema}}.world_sync_runs (source_key, started_at DESC);
