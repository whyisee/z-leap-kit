CREATE TABLE {{schema}}.social_circles (
  id uuid PRIMARY KEY,
  canonical_entity_id uuid NOT NULL REFERENCES {{schema}}.canonical_entities(id),
  circle_type varchar(24) NOT NULL CHECK (circle_type IN ('interest', 'place')),
  name text NOT NULL,
  status varchar(24) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (canonical_entity_id, circle_type)
);

CREATE TABLE {{schema}}.circle_memberships (
  id uuid PRIMARY KEY,
  circle_id uuid NOT NULL REFERENCES {{schema}}.social_circles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES {{schema}}.users(id) ON DELETE CASCADE,
  status varchar(24) NOT NULL DEFAULT 'joined' CHECK (status IN ('joined', 'left', 'banned')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (circle_id, user_id)
);

CREATE TABLE {{schema}}.social_blocks (
  id uuid PRIMARY KEY,
  blocker_user_id uuid NOT NULL REFERENCES {{schema}}.users(id) ON DELETE CASCADE,
  blocked_user_id uuid NOT NULL REFERENCES {{schema}}.users(id) ON DELETE CASCADE,
  reason varchar(120),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (blocker_user_id, blocked_user_id),
  CHECK (blocker_user_id <> blocked_user_id)
);

CREATE TABLE {{schema}}.safety_reports (
  id uuid PRIMARY KEY,
  reporter_user_id uuid NOT NULL REFERENCES {{schema}}.users(id) ON DELETE CASCADE,
  reported_user_id uuid NOT NULL REFERENCES {{schema}}.users(id) ON DELETE CASCADE,
  reason varchar(60) NOT NULL CHECK (reason IN ('harassment','spam','impersonation','privacy','unsafe_content','other')),
  details text,
  context_type varchar(40),
  context_id uuid,
  status varchar(24) NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','reviewing','resolved','dismissed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (reporter_user_id <> reported_user_id)
);

CREATE INDEX circle_memberships_user_idx ON {{schema}}.circle_memberships (user_id, status);
CREATE INDEX social_blocks_blocked_idx ON {{schema}}.social_blocks (blocked_user_id);
CREATE INDEX safety_reports_status_idx ON {{schema}}.safety_reports (status, created_at);
