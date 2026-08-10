CREATE TABLE {{schema}}.users (
  id uuid PRIMARY KEY,
  username varchar(80) NOT NULL UNIQUE,
  display_name varchar(160) NOT NULL,
  status varchar(24) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'deleted')),
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE {{schema}}.raw_entries (
  id uuid PRIMARY KEY,
  owner_user_id uuid NOT NULL REFERENCES {{schema}}.users(id),
  status varchar(32) NOT NULL
    CHECK (status IN ('parsing', 'awaiting_confirmation', 'confirmed', 'failed', 'deleted')),
  input_locale varchar(35) NOT NULL DEFAULT 'zh-CN',
  client_timezone varchar(80) NOT NULL DEFAULT 'Asia/Shanghai',
  client_created_at timestamptz,
  draft_reminder_after timestamptz,
  failure_code varchar(80),
  failure_message text,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  confirmed_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX raw_entries_owner_status_created_idx
  ON {{schema}}.raw_entries (owner_user_id, status, created_at DESC);

CREATE TABLE {{schema}}.media_attachments (
  id uuid PRIMARY KEY,
  raw_entry_id uuid NOT NULL REFERENCES {{schema}}.raw_entries(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES {{schema}}.users(id),
  media_kind varchar(24) NOT NULL
    CHECK (media_kind IN ('voice', 'image', 'screenshot', 'video')),
  storage_key text NOT NULL UNIQUE,
  original_filename text,
  mime_type varchar(160) NOT NULL,
  byte_size bigint NOT NULL CHECK (byte_size >= 0),
  sha256 char(64),
  width integer CHECK (width IS NULL OR width > 0),
  height integer CHECK (height IS NULL OR height > 0),
  duration_ms bigint CHECK (duration_ms IS NULL OR duration_ms >= 0),
  encryption_key_ref text,
  technical_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX media_attachments_entry_idx
  ON {{schema}}.media_attachments (raw_entry_id, created_at);

CREATE TABLE {{schema}}.raw_entry_contents (
  id uuid PRIMARY KEY,
  raw_entry_id uuid NOT NULL REFERENCES {{schema}}.raw_entries(id) ON DELETE CASCADE,
  position integer NOT NULL CHECK (position >= 0),
  content_kind varchar(24) NOT NULL
    CHECK (content_kind IN ('text', 'voice', 'image', 'screenshot', 'video')),
  text_content text,
  media_attachment_id uuid REFERENCES {{schema}}.media_attachments(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (raw_entry_id, position),
  CHECK (
    (content_kind = 'text' AND text_content IS NOT NULL AND media_attachment_id IS NULL)
    OR
    (content_kind <> 'text' AND text_content IS NULL AND media_attachment_id IS NOT NULL)
  )
);

CREATE TABLE {{schema}}.speech_transcripts (
  id uuid PRIMARY KEY,
  raw_entry_content_id uuid NOT NULL REFERENCES {{schema}}.raw_entry_contents(id) ON DELETE CASCADE,
  transcript_text text NOT NULL,
  language varchar(35),
  confidence numeric(5,4) CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1),
  segments jsonb NOT NULL DEFAULT '[]'::jsonb,
  provider varchar(80) NOT NULL,
  model_version varchar(120),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (raw_entry_content_id)
);

CREATE TABLE {{schema}}.event_candidates (
  id uuid PRIMARY KEY,
  raw_entry_id uuid NOT NULL REFERENCES {{schema}}.raw_entries(id) ON DELETE CASCADE,
  candidate_index integer NOT NULL CHECK (candidate_index >= 0),
  status varchar(24) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected', 'superseded')),
  payload jsonb NOT NULL,
  overall_confidence numeric(5,4) CHECK (overall_confidence IS NULL OR overall_confidence BETWEEN 0 AND 1),
  field_confidences jsonb NOT NULL DEFAULT '{}'::jsonb,
  schema_version varchar(32) NOT NULL,
  parser_provider varchar(80) NOT NULL,
  parser_model_version varchar(120),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (raw_entry_id, candidate_index)
);

CREATE TABLE {{schema}}.events (
  id uuid PRIMARY KEY,
  owner_user_id uuid NOT NULL REFERENCES {{schema}}.users(id),
  raw_entry_id uuid NOT NULL REFERENCES {{schema}}.raw_entries(id),
  accepted_candidate_id uuid REFERENCES {{schema}}.event_candidates(id),
  parent_event_id uuid REFERENCES {{schema}}.events(id),
  event_type varchar(80) NOT NULL,
  event_schema_version varchar(32) NOT NULL,
  title text NOT NULL,
  factual_status varchar(24) NOT NULL
    CHECK (factual_status IN ('occurred', 'ongoing', 'planned', 'cancelled', 'negated', 'uncertain', 'inferred')),
  occurred_start timestamptz,
  occurred_end timestamptz,
  time_precision varchar(32) NOT NULL DEFAULT 'unknown',
  timezone varchar(80),
  source_time_expression text,
  overall_confidence numeric(5,4) CHECK (overall_confidence IS NULL OR overall_confidence BETWEEN 0 AND 1),
  subjective_experience jsonb NOT NULL DEFAULT '{}'::jsonb,
  extensions jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CHECK (occurred_end IS NULL OR occurred_start IS NULL OR occurred_end >= occurred_start)
);

CREATE INDEX events_owner_time_idx
  ON {{schema}}.events (owner_user_id, occurred_start DESC NULLS LAST, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE TABLE {{schema}}.event_relations (
  id uuid PRIMARY KEY,
  owner_user_id uuid NOT NULL REFERENCES {{schema}}.users(id),
  source_event_id uuid NOT NULL REFERENCES {{schema}}.events(id) ON DELETE CASCADE,
  target_event_id uuid NOT NULL REFERENCES {{schema}}.events(id) ON DELETE CASCADE,
  relation_type varchar(40) NOT NULL
    CHECK (relation_type IN ('contains', 'before', 'after', 'simultaneous', 'causes', 'interrupts', 'continues', 'references', 'repeats')),
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_event_id, target_event_id, relation_type),
  CHECK (source_event_id <> target_event_id)
);

CREATE TABLE {{schema}}.canonical_entities (
  id uuid PRIMARY KEY,
  entity_type varchar(60) NOT NULL,
  canonical_name text NOT NULL,
  normalized_name text NOT NULL,
  status varchar(24) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'merged', 'split', 'deprecated')),
  sensitivity varchar(24) NOT NULL DEFAULT 'normal'
    CHECK (sensitivity IN ('normal', 'sensitive', 'prohibited')),
  match_eligible boolean NOT NULL DEFAULT true,
  external_ids jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX canonical_entities_lookup_idx
  ON {{schema}}.canonical_entities (entity_type, normalized_name)
  WHERE status = 'active';

CREATE TABLE {{schema}}.canonical_entity_redirects (
  id uuid PRIMARY KEY,
  source_entity_id uuid NOT NULL REFERENCES {{schema}}.canonical_entities(id),
  target_entity_id uuid NOT NULL REFERENCES {{schema}}.canonical_entities(id),
  redirect_type varchar(24) NOT NULL CHECK (redirect_type IN ('merge', 'split', 'replace')),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (source_entity_id <> target_entity_id)
);

CREATE TABLE {{schema}}.user_entities (
  id uuid PRIMARY KEY,
  owner_user_id uuid NOT NULL REFERENCES {{schema}}.users(id),
  canonical_entity_id uuid REFERENCES {{schema}}.canonical_entities(id),
  entity_type varchar(60) NOT NULL,
  display_name text NOT NULL,
  normalized_name text NOT NULL,
  private_notes text,
  visibility varchar(24) NOT NULL DEFAULT 'private'
    CHECK (visibility IN ('private', 'friends', 'circle', 'public')),
  match_eligible boolean NOT NULL DEFAULT false,
  sensitivity varchar(24) NOT NULL DEFAULT 'normal'
    CHECK (sensitivity IN ('normal', 'sensitive', 'prohibited')),
  status varchar(24) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'merged', 'deleted')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX user_entities_name_unique_idx
  ON {{schema}}.user_entities (owner_user_id, entity_type, normalized_name)
  WHERE status = 'active';

CREATE TABLE {{schema}}.entity_aliases (
  id uuid PRIMARY KEY,
  user_entity_id uuid NOT NULL REFERENCES {{schema}}.user_entities(id) ON DELETE CASCADE,
  alias text NOT NULL,
  normalized_alias text NOT NULL,
  confirmation_status varchar(24) NOT NULL DEFAULT 'confirmed'
    CHECK (confirmation_status IN ('candidate', 'confirmed', 'rejected')),
  source varchar(32) NOT NULL DEFAULT 'user_confirmation',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_entity_id, normalized_alias)
);

CREATE TABLE {{schema}}.event_participants (
  id uuid PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES {{schema}}.events(id) ON DELETE CASCADE,
  account_user_id uuid REFERENCES {{schema}}.users(id),
  user_entity_id uuid REFERENCES {{schema}}.user_entities(id),
  participant_role varchar(60) NOT NULL,
  identity_confirmed boolean NOT NULL DEFAULT false,
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (account_user_id IS NOT NULL OR user_entity_id IS NOT NULL)
);

CREATE TABLE {{schema}}.event_entity_relations (
  id uuid PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES {{schema}}.events(id) ON DELETE CASCADE,
  user_entity_id uuid NOT NULL REFERENCES {{schema}}.user_entities(id),
  canonical_entity_id uuid REFERENCES {{schema}}.canonical_entities(id),
  relation_role varchar(60) NOT NULL,
  quantity numeric,
  unit varchar(40),
  amount numeric,
  currency char(3),
  confidence numeric(5,4) CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1),
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX event_entity_relations_canonical_idx
  ON {{schema}}.event_entity_relations (canonical_entity_id, relation_role)
  WHERE canonical_entity_id IS NOT NULL;

CREATE TABLE {{schema}}.shared_occurrences (
  id uuid PRIMARY KEY,
  status varchar(24) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'closed', 'deleted')),
  occurred_start timestamptz,
  occurred_end timestamptz,
  time_precision varchar(32) NOT NULL DEFAULT 'unknown',
  shared_facts jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1,
  created_by_user_id uuid NOT NULL REFERENCES {{schema}}.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE {{schema}}.occurrence_memberships (
  id uuid PRIMARY KEY,
  occurrence_id uuid NOT NULL REFERENCES {{schema}}.shared_occurrences(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES {{schema}}.users(id),
  membership_status varchar(24) NOT NULL
    CHECK (membership_status IN ('invited', 'accepted', 'declined', 'left', 'removed')),
  shared_fact_permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  invited_by_user_id uuid REFERENCES {{schema}}.users(id),
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (occurrence_id, user_id)
);

CREATE TABLE {{schema}}.event_occurrence_links (
  id uuid PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES {{schema}}.events(id) ON DELETE CASCADE,
  occurrence_id uuid NOT NULL REFERENCES {{schema}}.shared_occurrences(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES {{schema}}.users(id),
  link_status varchar(24) NOT NULL DEFAULT 'active'
    CHECK (link_status IN ('active', 'withdrawn')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, occurrence_id)
);

CREATE TABLE {{schema}}.person_account_links (
  id uuid PRIMARY KEY,
  owner_user_id uuid NOT NULL REFERENCES {{schema}}.users(id),
  person_entity_id uuid NOT NULL REFERENCES {{schema}}.user_entities(id),
  linked_account_user_id uuid NOT NULL REFERENCES {{schema}}.users(id),
  status varchar(24) NOT NULL
    CHECK (status IN ('invited', 'accepted', 'declined', 'revoked')),
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_user_id, person_entity_id, linked_account_user_id)
);

CREATE TABLE {{schema}}.user_assertions (
  id uuid PRIMARY KEY,
  owner_user_id uuid NOT NULL REFERENCES {{schema}}.users(id),
  source_event_id uuid REFERENCES {{schema}}.events(id) ON DELETE SET NULL,
  predicate varchar(80) NOT NULL,
  target_user_entity_id uuid REFERENCES {{schema}}.user_entities(id),
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  status varchar(24) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'retracted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  retracted_at timestamptz
);

CREATE TABLE {{schema}}.inferred_relations (
  id uuid PRIMARY KEY,
  owner_user_id uuid NOT NULL REFERENCES {{schema}}.users(id),
  relation_type varchar(80) NOT NULL,
  target_user_entity_id uuid REFERENCES {{schema}}.user_entities(id),
  confidence numeric(5,4) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  evidence_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  inference_version varchar(80) NOT NULL,
  status varchar(24) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'confirmed', 'rejected', 'expired', 'hidden')),
  generated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);

CREATE TABLE {{schema}}.privacy_policies (
  id uuid PRIMARY KEY,
  owner_user_id uuid NOT NULL REFERENCES {{schema}}.users(id),
  policy_level varchar(32) NOT NULL
    CHECK (policy_level IN ('user_default', 'activity_category', 'entity', 'event')),
  subject_key text NOT NULL,
  content_visibility varchar(24)
    CHECK (content_visibility IS NULL OR content_visibility IN ('private', 'friends', 'circle', 'public', 'isolated')),
  allow_anonymous_stats boolean,
  allow_matching boolean,
  allow_identity_disclosure boolean,
  allow_shared_occurrence boolean,
  version integer NOT NULL CHECK (version > 0),
  effective_from timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_user_id, policy_level, subject_key)
);

CREATE TABLE {{schema}}.social_projections (
  id uuid PRIMARY KEY,
  owner_user_id uuid NOT NULL REFERENCES {{schema}}.users(id),
  source_event_id uuid NOT NULL REFERENCES {{schema}}.events(id) ON DELETE CASCADE,
  canonical_entity_id uuid NOT NULL REFERENCES {{schema}}.canonical_entities(id),
  feature_type varchar(60) NOT NULL,
  coarse_time_bucket date,
  weight numeric(8,4) NOT NULL DEFAULT 1,
  policy_version integer NOT NULL,
  opaque_evidence_ref uuid NOT NULL,
  status varchar(24) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'revoked', 'expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE INDEX social_projections_match_idx
  ON {{schema}}.social_projections (canonical_entity_id, feature_type, coarse_time_bucket)
  WHERE status = 'active';

CREATE TABLE {{schema}}.social_matches (
  id uuid PRIMARY KEY,
  user_low_id uuid NOT NULL REFERENCES {{schema}}.users(id),
  user_high_id uuid NOT NULL REFERENCES {{schema}}.users(id),
  score numeric(8,4) NOT NULL,
  status varchar(24) NOT NULL DEFAULT 'anonymous_candidate'
    CHECK (status IN ('anonymous_candidate', 'contact_pending', 'connected', 'dismissed', 'revoked')),
  reason_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_low_id, user_high_id),
  CHECK (user_low_id::text < user_high_id::text)
);

CREATE TABLE {{schema}}.match_consents (
  id uuid PRIMARY KEY,
  match_id uuid NOT NULL REFERENCES {{schema}}.social_matches(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES {{schema}}.users(id),
  consent_type varchar(32) NOT NULL
    CHECK (consent_type IN ('participate', 'reveal_identity', 'connect')),
  status varchar(24) NOT NULL CHECK (status IN ('granted', 'revoked', 'declined')),
  decided_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (match_id, user_id, consent_type)
);

CREATE TABLE {{schema}}.social_connections (
  id uuid PRIMARY KEY,
  match_id uuid NOT NULL UNIQUE REFERENCES {{schema}}.social_matches(id),
  user_low_id uuid NOT NULL REFERENCES {{schema}}.users(id),
  user_high_id uuid NOT NULL REFERENCES {{schema}}.users(id),
  status varchar(24) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'muted', 'blocked', 'ended')),
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  connected_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  CHECK (user_low_id::text < user_high_id::text)
);

CREATE TABLE {{schema}}.user_relation_evidence (
  id uuid PRIMARY KEY,
  match_id uuid NOT NULL REFERENCES {{schema}}.social_matches(id) ON DELETE CASCADE,
  evidence_type varchar(60) NOT NULL,
  opaque_projection_ref uuid,
  contribution numeric(8,4) NOT NULL,
  explanation jsonb NOT NULL DEFAULT '{}'::jsonb,
  status varchar(24) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'invalidated')),
  created_at timestamptz NOT NULL DEFAULT now(),
  invalidated_at timestamptz
);

CREATE TABLE {{schema}}.user_feedback (
  id uuid PRIMARY KEY,
  owner_user_id uuid NOT NULL REFERENCES {{schema}}.users(id),
  raw_entry_id uuid REFERENCES {{schema}}.raw_entries(id) ON DELETE SET NULL,
  feedback_type varchar(60) NOT NULL,
  before_value jsonb,
  after_value jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE {{schema}}.ai_processing_audits (
  id uuid PRIMARY KEY,
  owner_user_id uuid NOT NULL REFERENCES {{schema}}.users(id),
  raw_entry_id uuid REFERENCES {{schema}}.raw_entries(id) ON DELETE SET NULL,
  operation varchar(60) NOT NULL,
  provider varchar(80) NOT NULL,
  model_version varchar(120),
  data_scope jsonb NOT NULL DEFAULT '{}'::jsonb,
  retention_policy varchar(120),
  status varchar(24) NOT NULL CHECK (status IN ('started', 'succeeded', 'failed')),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE {{schema}}.data_access_audits (
  id uuid PRIMARY KEY,
  actor_type varchar(32) NOT NULL,
  actor_id text NOT NULL,
  owner_user_id uuid REFERENCES {{schema}}.users(id),
  purpose varchar(120) NOT NULL,
  resource_type varchar(60) NOT NULL,
  resource_id text NOT NULL,
  result varchar(24) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE {{schema}}.deletion_jobs (
  id uuid PRIMARY KEY,
  owner_user_id uuid NOT NULL REFERENCES {{schema}}.users(id),
  resource_type varchar(60) NOT NULL,
  resource_id text NOT NULL,
  status varchar(24) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  progress jsonb NOT NULL DEFAULT '{}'::jsonb,
  requested_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  error_message text
);

CREATE TABLE {{schema}}.outbox_events (
  id uuid PRIMARY KEY,
  aggregate_type varchar(60) NOT NULL,
  aggregate_id uuid NOT NULL,
  event_type varchar(100) NOT NULL,
  payload jsonb NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  last_error text
);

CREATE INDEX outbox_events_unpublished_idx
  ON {{schema}}.outbox_events (occurred_at)
  WHERE published_at IS NULL;

CREATE TABLE {{schema}}.draft_reminders (
  id uuid PRIMARY KEY,
  raw_entry_id uuid NOT NULL REFERENCES {{schema}}.raw_entries(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES {{schema}}.users(id),
  remind_at timestamptz NOT NULL,
  status varchar(24) NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'sent', 'cancelled', 'failed')),
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (raw_entry_id)
);
