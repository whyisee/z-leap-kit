ALTER TABLE {{schema}}.media_attachments
  DROP CONSTRAINT IF EXISTS media_attachments_media_kind_check;

ALTER TABLE {{schema}}.media_attachments
  ADD CONSTRAINT media_attachments_media_kind_check
  CHECK (media_kind IN ('voice', 'image', 'screenshot', 'video', 'file'));

ALTER TABLE {{schema}}.raw_entry_contents
  DROP CONSTRAINT IF EXISTS raw_entry_contents_content_kind_check;

ALTER TABLE {{schema}}.raw_entry_contents
  ADD CONSTRAINT raw_entry_contents_content_kind_check
  CHECK (content_kind IN ('text', 'voice', 'image', 'screenshot', 'video', 'file'));
