ALTER TABLE {{schema}}.outbox_events
  ADD COLUMN available_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN locked_at timestamptz,
  ADD COLUMN locked_by varchar(120),
  ADD COLUMN dead_lettered_at timestamptz;

DROP INDEX {{schema}}.outbox_events_unpublished_idx;
CREATE INDEX outbox_events_delivery_idx
  ON {{schema}}.outbox_events (available_at, occurred_at)
  WHERE published_at IS NULL AND dead_lettered_at IS NULL;

ALTER TABLE {{schema}}.deletion_jobs
  ADD COLUMN available_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN locked_at timestamptz,
  ADD COLUMN locked_by varchar(120),
  ADD COLUMN attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  ADD COLUMN last_error_at timestamptz;

CREATE INDEX deletion_jobs_delivery_idx
  ON {{schema}}.deletion_jobs (available_at, requested_at)
  WHERE status IN ('pending', 'running');

CREATE UNIQUE INDEX deletion_jobs_one_open_resource_idx
  ON {{schema}}.deletion_jobs (owner_user_id, resource_type, resource_id)
  WHERE status IN ('pending', 'running');
