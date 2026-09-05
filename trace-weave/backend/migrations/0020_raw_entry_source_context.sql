ALTER TABLE {{schema}}.raw_entries
  ADD COLUMN source_context jsonb NOT NULL DEFAULT '{}'::jsonb
  CHECK (jsonb_typeof(source_context) = 'object');

