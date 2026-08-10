CREATE UNIQUE INDEX social_projections_active_feature_unique_idx
  ON {{schema}}.social_projections (owner_user_id, source_event_id, canonical_entity_id, feature_type)
  WHERE status = 'active';

CREATE INDEX social_projections_owner_status_idx
  ON {{schema}}.social_projections (owner_user_id, status, canonical_entity_id);

CREATE INDEX social_matches_user_low_status_idx
  ON {{schema}}.social_matches (user_low_id, status, score DESC);

CREATE INDEX social_matches_user_high_status_idx
  ON {{schema}}.social_matches (user_high_id, status, score DESC);

CREATE INDEX match_consents_match_status_idx
  ON {{schema}}.match_consents (match_id, consent_type, status);
