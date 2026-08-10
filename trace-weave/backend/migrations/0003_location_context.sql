CREATE TABLE {{schema}}.location_observations (
  id uuid PRIMARY KEY,
  raw_entry_id uuid NOT NULL REFERENCES {{schema}}.raw_entries(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES {{schema}}.users(id),
  latitude numeric(9,6) NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude numeric(9,6) NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  accuracy_m numeric CHECK (accuracy_m IS NULL OR accuracy_m >= 0),
  altitude_m numeric,
  altitude_accuracy_m numeric CHECK (altitude_accuracy_m IS NULL OR altitude_accuracy_m >= 0),
  heading_deg numeric CHECK (heading_deg IS NULL OR heading_deg BETWEEN 0 AND 360),
  speed_mps numeric CHECK (speed_mps IS NULL OR speed_mps >= 0),
  captured_at timestamptz NOT NULL,
  source varchar(32) NOT NULL
    CHECK (source IN ('browser_geolocation', 'manual_pin', 'shared_place', 'import')),
  user_label text,
  default_event_role varchar(32) NOT NULL DEFAULT 'occurred_at'
    CHECK (default_event_role IN ('occurred_at', 'recorded_at')),
  exact_geohash varchar(12) NOT NULL,
  social_cell varchar(12),
  sensitivity varchar(24) NOT NULL DEFAULT 'normal'
    CHECK (sensitivity IN ('normal', 'sensitive', 'prohibited')),
  match_eligible boolean NOT NULL DEFAULT false,
  consent_version integer NOT NULL DEFAULT 1 CHECK (consent_version > 0),
  technical_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (NOT match_eligible OR social_cell IS NOT NULL)
);

CREATE INDEX location_observations_entry_idx
  ON {{schema}}.location_observations (raw_entry_id, created_at);

CREATE INDEX location_observations_private_owner_idx
  ON {{schema}}.location_observations (owner_user_id, captured_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX location_observations_social_cell_idx
  ON {{schema}}.location_observations (social_cell, captured_at)
  WHERE match_eligible = true AND deleted_at IS NULL;

CREATE TABLE {{schema}}.event_location_links (
  id uuid PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES {{schema}}.events(id) ON DELETE CASCADE,
  location_observation_id uuid NOT NULL REFERENCES {{schema}}.location_observations(id),
  location_role varchar(32) NOT NULL
    CHECK (location_role IN ('occurred_at', 'recorded_at', 'route_start', 'route_end', 'nearby')),
  user_confirmed boolean NOT NULL DEFAULT true,
  confidence numeric(5,4) CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1),
  social_match_eligible boolean NOT NULL DEFAULT false,
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, location_observation_id, location_role),
  CHECK (NOT social_match_eligible OR location_role = 'occurred_at')
);

CREATE INDEX event_location_links_event_idx
  ON {{schema}}.event_location_links (event_id, location_role);

CREATE INDEX event_location_links_social_idx
  ON {{schema}}.event_location_links (location_observation_id)
  WHERE social_match_eligible = true;
