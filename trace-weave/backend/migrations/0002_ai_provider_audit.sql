ALTER TABLE {{schema}}.ai_processing_audits
  ADD COLUMN provider_request_id text,
  ADD COLUMN usage jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN error_code varchar(80),
  ADD COLUMN error_message text;

