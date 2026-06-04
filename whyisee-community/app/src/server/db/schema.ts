export const schemaSql = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  email TEXT UNIQUE,
  password_hash TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'member',
  is_bot BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'pending',
  bio TEXT NOT NULL DEFAULT '',
  website_url TEXT,
  github_url TEXT,
  email_verified_at TEXT,
  last_login_at TEXT,
  last_seen_at TEXT,
  locale TEXT NOT NULL DEFAULT 'zh',
  timezone TEXT NOT NULL DEFAULT 'Asia/Shanghai',
  notification_email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  suspended_until TEXT,
  banned_at TEXT,
  ban_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '#7fb3ff',
  sort_order INTEGER NOT NULL DEFAULT 100,
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS topics (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  summary TEXT NOT NULL DEFAULT '',
  content_markdown TEXT NOT NULL DEFAULT '',
  content_html TEXT NOT NULL DEFAULT '',
  author_id INTEGER NOT NULL,
  category_id INTEGER NOT NULL,
  type TEXT NOT NULL DEFAULT 'discussion',
  status TEXT NOT NULL DEFAULT 'draft',
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  view_count INTEGER NOT NULL DEFAULT 0,
  reply_count INTEGER NOT NULL DEFAULT 0,
  last_activity_at TEXT,
  published_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (author_id) REFERENCES users(id),
  FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE TABLE IF NOT EXISTS posts (
  id SERIAL PRIMARY KEY,
  topic_id INTEGER NOT NULL,
  parent_post_id INTEGER,
  author_id INTEGER NOT NULL,
  content_markdown TEXT NOT NULL,
  content_html TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'published',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (topic_id) REFERENCES topics(id),
  FOREIGN KEY (parent_post_id) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (author_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS tags (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS topic_tags (
  topic_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  PRIMARY KEY (topic_id, tag_id),
  FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reactions (
  id SERIAL PRIMARY KEY,
  target_type TEXT NOT NULL,
  target_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  reaction_type TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (target_type, target_id, user_id, reaction_type),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS bookmarks (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  topic_id INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (user_id, topic_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  actor_id INTEGER,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id INTEGER,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  FOREIGN KEY (actor_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  user_agent TEXT,
  ip_hash TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  revoked_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS invitations (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  email TEXT,
  role TEXT NOT NULL DEFAULT 'member',
  max_uses INTEGER NOT NULL DEFAULT 1,
  use_count INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT,
  created_by INTEGER,
  created_at TEXT NOT NULL,
  disabled_at TEXT,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS follows (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  target_type TEXT NOT NULL,
  target_id INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (user_id, target_type, target_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_blocks (
  id SERIAL PRIMARY KEY,
  blocker_id INTEGER NOT NULL,
  blocked_user_id INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (blocker_id, blocked_user_id),
  FOREIGN KEY (blocker_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (blocked_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  actor_id INTEGER,
  type TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  href TEXT NOT NULL DEFAULT '/',
  read_at TEXT,
  emailed_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS mentions (
  id SERIAL PRIMARY KEY,
  source_type TEXT NOT NULL,
  source_id INTEGER NOT NULL,
  mentioned_user_id INTEGER NOT NULL,
  actor_id INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (source_type, source_id, mentioned_user_id),
  FOREIGN KEY (mentioned_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS bot_jobs (
  id SERIAL PRIMARY KEY,
  bot_user_id INTEGER NOT NULL,
  source_type TEXT NOT NULL,
  source_id INTEGER NOT NULL,
  actor_id INTEGER NOT NULL,
  prompt TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'queued',
  result_post_id INTEGER,
  error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (bot_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (result_post_id) REFERENCES posts(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS reports (
  id SERIAL PRIMARY KEY,
  reporter_id INTEGER NOT NULL,
  target_type TEXT NOT NULL,
  target_id INTEGER NOT NULL,
  reason TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',
  resolved_by INTEGER,
  resolved_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS email_logs (
  id SERIAL PRIMARY KEY,
  recipient_user_id INTEGER,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'console',
  status TEXT NOT NULL DEFAULT 'queued',
  error TEXT,
  created_at TEXT NOT NULL,
  sent_at TEXT,
  FOREIGN KEY (recipient_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS page_views (
  id SERIAL PRIMARY KEY,
  path TEXT NOT NULL,
  method TEXT NOT NULL,
  user_id INTEGER,
  ip_hash TEXT,
  user_agent TEXT,
  referrer TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS uploaded_files (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  original_name TEXT NOT NULL,
  stored_path TEXT NOT NULL UNIQUE,
  public_url TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ai_model_configs (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'deepseek',
  model TEXT NOT NULL,
  base_url TEXT NOT NULL,
  api_key TEXT NOT NULL DEFAULT '',
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  temperature NUMERIC(4, 2) NOT NULL DEFAULT 0.70,
  max_tokens INTEGER NOT NULL DEFAULT 4096,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_topics_status_published_at ON topics(status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_topics_category_id ON topics(category_id);
CREATE INDEX IF NOT EXISTS idx_topics_type ON topics(type);
CREATE INDEX IF NOT EXISTS idx_posts_topic_id ON posts(topic_id);
CREATE INDEX IF NOT EXISTS idx_posts_parent_post_id ON posts(parent_post_id);
CREATE INDEX IF NOT EXISTS idx_topic_tags_tag_id ON topic_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_posts_author_id ON posts(author_id);
CREATE INDEX IF NOT EXISTS idx_reactions_target ON reactions(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_id ON bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_follows_user_target ON follows(user_id, target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_follows_target ON follows(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker ON user_blocks(blocker_id, blocked_user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_mentions_user_created ON mentions(mentioned_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mentions_source ON mentions(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_bot_jobs_status_created ON bot_jobs(status, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_bot_jobs_source ON bot_jobs(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_reports_status_created ON reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_views_created ON page_views(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_views_path_created ON page_views(path, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_uploaded_files_user_created ON uploaded_files(user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_model_configs_default ON ai_model_configs ((is_default)) WHERE is_default = TRUE;
CREATE INDEX IF NOT EXISTS idx_ai_model_configs_provider ON ai_model_configs(provider, is_enabled);
CREATE INDEX IF NOT EXISTS idx_topics_search ON topics USING GIN (to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(summary, '') || ' ' || coalesce(content_markdown, '')));
CREATE INDEX IF NOT EXISTS idx_posts_search ON posts USING GIN (to_tsvector('simple', coalesce(content_markdown, '')));
`;
