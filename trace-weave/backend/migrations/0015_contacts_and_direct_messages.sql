ALTER TABLE {{schema}}.social_connections
  ALTER COLUMN match_id DROP NOT NULL;

ALTER TABLE {{schema}}.social_connections
  ADD COLUMN source varchar(24) NOT NULL DEFAULT 'discovery'
    CHECK (source IN ('discovery', 'friend_request', 'shared_occurrence'));

ALTER TABLE {{schema}}.social_connections
  ADD CONSTRAINT social_connections_user_pair_unique UNIQUE (user_low_id, user_high_id);

CREATE TABLE {{schema}}.friend_requests (
  id uuid PRIMARY KEY,
  sender_user_id uuid NOT NULL REFERENCES {{schema}}.users(id),
  recipient_user_id uuid NOT NULL REFERENCES {{schema}}.users(id),
  message varchar(240),
  status varchar(24) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (sender_user_id <> recipient_user_id)
);

CREATE UNIQUE INDEX friend_requests_pending_pair_unique_idx
  ON {{schema}}.friend_requests (
    LEAST(sender_user_id, recipient_user_id),
    GREATEST(sender_user_id, recipient_user_id)
  )
  WHERE status = 'pending';

CREATE INDEX friend_requests_recipient_status_created_idx
  ON {{schema}}.friend_requests (recipient_user_id, status, created_at DESC);

CREATE INDEX friend_requests_sender_status_created_idx
  ON {{schema}}.friend_requests (sender_user_id, status, created_at DESC);

CREATE TABLE {{schema}}.direct_conversations (
  id uuid PRIMARY KEY,
  user_low_id uuid NOT NULL REFERENCES {{schema}}.users(id),
  user_high_id uuid NOT NULL REFERENCES {{schema}}.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz,
  UNIQUE (user_low_id, user_high_id),
  CHECK (user_low_id::text < user_high_id::text)
);

CREATE TABLE {{schema}}.direct_conversation_members (
  conversation_id uuid NOT NULL REFERENCES {{schema}}.direct_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES {{schema}}.users(id),
  last_read_at timestamptz NOT NULL DEFAULT now(),
  muted boolean NOT NULL DEFAULT false,
  hidden_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX direct_conversation_members_user_idx
  ON {{schema}}.direct_conversation_members (user_id, updated_at DESC);

CREATE TABLE {{schema}}.direct_messages (
  id uuid PRIMARY KEY,
  conversation_id uuid NOT NULL REFERENCES {{schema}}.direct_conversations(id) ON DELETE CASCADE,
  sender_user_id uuid NOT NULL REFERENCES {{schema}}.users(id),
  client_message_id uuid,
  content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 4000),
  created_at timestamptz NOT NULL DEFAULT now(),
  edited_at timestamptz,
  deleted_at timestamptz,
  UNIQUE (sender_user_id, client_message_id)
);

CREATE INDEX direct_messages_conversation_created_idx
  ON {{schema}}.direct_messages (conversation_id, created_at DESC, id DESC);
