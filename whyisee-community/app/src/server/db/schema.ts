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

CREATE TABLE IF NOT EXISTS direct_conversations (
  id SERIAL PRIMARY KEY,
  conversation_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS direct_conversation_participants (
  conversation_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  last_read_at TEXT,
  archived_at TEXT,
  created_at TEXT NOT NULL,
  PRIMARY KEY (conversation_id, user_id),
  FOREIGN KEY (conversation_id) REFERENCES direct_conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS direct_messages (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER NOT NULL,
  sender_id INTEGER NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  deleted_at TEXT,
  FOREIGN KEY (conversation_id) REFERENCES direct_conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
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

CREATE TABLE IF NOT EXISTS bot_tasks (
  id SERIAL PRIMARY KEY,
  task_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  task_type TEXT NOT NULL,
  bot_user_id INTEGER NOT NULL,
  trigger_type TEXT NOT NULL DEFAULT 'schedule',
  status TEXT NOT NULL DEFAULT 'active',
  schedule_interval_seconds INTEGER NOT NULL DEFAULT 60,
  config_json TEXT NOT NULL DEFAULT '{}',
  next_run_at TEXT,
  locked_at TEXT,
  last_run_at TEXT,
  last_status TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (bot_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS bot_task_runs (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL,
  run_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'running',
  input_summary TEXT NOT NULL DEFAULT '',
  output_summary TEXT NOT NULL DEFAULT '',
  error TEXT,
  metrics_json TEXT NOT NULL DEFAULT '{}',
  started_at TEXT NOT NULL,
  completed_at TEXT,
  FOREIGN KEY (task_id) REFERENCES bot_tasks(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS content_review_results (
  id SERIAL PRIMARY KEY,
  target_type TEXT NOT NULL,
  target_id INTEGER NOT NULL,
  content_hash TEXT NOT NULL,
  task_id INTEGER,
  task_run_id INTEGER,
  bot_user_id INTEGER,
  ai_provider TEXT NOT NULL DEFAULT '',
  ai_model TEXT NOT NULL DEFAULT '',
  decision TEXT NOT NULL,
  risk_score INTEGER NOT NULL DEFAULT 100,
  reasons_json TEXT NOT NULL DEFAULT '[]',
  raw_result_json TEXT NOT NULL DEFAULT '{}',
  result_status TEXT NOT NULL DEFAULT 'suggested',
  error TEXT,
  applied_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (task_id) REFERENCES bot_tasks(id) ON DELETE SET NULL,
  FOREIGN KEY (task_run_id) REFERENCES bot_task_runs(id) ON DELETE SET NULL,
  FOREIGN KEY (bot_user_id) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE (target_type, target_id, content_hash)
);

CREATE TABLE IF NOT EXISTS external_hot_items (
  id SERIAL PRIMARY KEY,
  source TEXT NOT NULL,
  source_item_id TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  rank INTEGER,
  heat_text TEXT NOT NULL DEFAULT '',
  raw_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'new',
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  seen_count INTEGER NOT NULL DEFAULT 1,
  last_task_id INTEGER,
  last_task_run_id INTEGER,
  last_bot_user_id INTEGER,
  UNIQUE (source, source_item_id),
  FOREIGN KEY (last_task_id) REFERENCES bot_tasks(id) ON DELETE SET NULL,
  FOREIGN KEY (last_task_run_id) REFERENCES bot_task_runs(id) ON DELETE SET NULL,
  FOREIGN KEY (last_bot_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS external_hot_item_snapshots (
  id SERIAL PRIMARY KEY,
  item_id INTEGER NOT NULL,
  source TEXT NOT NULL,
  source_item_id TEXT NOT NULL,
  task_id INTEGER,
  task_run_id INTEGER,
  bot_user_id INTEGER,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  rank INTEGER,
  heat_text TEXT NOT NULL DEFAULT '',
  raw_json TEXT NOT NULL DEFAULT '{}',
  observed_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (task_run_id, source, source_item_id),
  FOREIGN KEY (item_id) REFERENCES external_hot_items(id) ON DELETE CASCADE,
  FOREIGN KEY (task_id) REFERENCES bot_tasks(id) ON DELETE SET NULL,
  FOREIGN KEY (task_run_id) REFERENCES bot_task_runs(id) ON DELETE SET NULL,
  FOREIGN KEY (bot_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS external_hot_reports (
  id SERIAL PRIMARY KEY,
  source TEXT NOT NULL,
  report_type TEXT NOT NULL,
  scope_key TEXT NOT NULL,
  item_id INTEGER,
  task_id INTEGER,
  task_run_id INTEGER,
  bot_user_id INTEGER,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  content_markdown TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  topic_id INTEGER,
  ai_provider TEXT NOT NULL DEFAULT '',
  ai_model TEXT NOT NULL DEFAULT '',
  ai_config_name TEXT NOT NULL DEFAULT '',
  input_json TEXT NOT NULL DEFAULT '{}',
  output_json TEXT NOT NULL DEFAULT '{}',
  error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (item_id) REFERENCES external_hot_items(id) ON DELETE SET NULL,
  FOREIGN KEY (task_id) REFERENCES bot_tasks(id) ON DELETE SET NULL,
  FOREIGN KEY (task_run_id) REFERENCES bot_task_runs(id) ON DELETE SET NULL,
  FOREIGN KEY (bot_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE SET NULL
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

CREATE TABLE IF NOT EXISTS user_content_events (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  anonymous_key TEXT,
  event_type TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id INTEGER NOT NULL,
  source_surface TEXT NOT NULL DEFAULT '',
  source_reason TEXT NOT NULL DEFAULT '',
  category_id INTEGER,
  tag_slugs_json TEXT NOT NULL DEFAULT '[]',
  topic_type TEXT NOT NULL DEFAULT '',
  author_id INTEGER,
  dwell_seconds INTEGER,
  weight INTEGER NOT NULL DEFAULT 0,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
  FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS user_interest_profiles (
  user_id INTEGER PRIMARY KEY,
  category_weights_json TEXT NOT NULL DEFAULT '{}',
  tag_weights_json TEXT NOT NULL DEFAULT '{}',
  topic_type_weights_json TEXT NOT NULL DEFAULT '{}',
  author_weights_json TEXT NOT NULL DEFAULT '{}',
  long_term_json TEXT NOT NULL DEFAULT '{}',
  short_term_json TEXT NOT NULL DEFAULT '{}',
  negative_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS content_quality_signals (
  id SERIAL PRIMARY KEY,
  target_type TEXT NOT NULL,
  target_id INTEGER NOT NULL,
  quality_score INTEGER NOT NULL DEFAULT 50,
  freshness_score INTEGER NOT NULL DEFAULT 50,
  engagement_score INTEGER NOT NULL DEFAULT 0,
  participation_need_score INTEGER NOT NULL DEFAULT 0,
  verified_score INTEGER NOT NULL DEFAULT 0,
  risk_penalty INTEGER NOT NULL DEFAULT 0,
  stale_score INTEGER NOT NULL DEFAULT 0,
  computed_from_json TEXT NOT NULL DEFAULT '{}',
  computed_at TEXT NOT NULL,
  UNIQUE (target_type, target_id)
);

CREATE TABLE IF NOT EXISTS recommendation_impressions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  anonymous_key TEXT,
  surface TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id INTEGER NOT NULL,
  rank INTEGER NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  reasons_json TEXT NOT NULL DEFAULT '[]',
  clicked_at TEXT,
  dismissed_at TEXT,
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

CREATE TABLE IF NOT EXISTS user_reputation (
  user_id INTEGER PRIMARY KEY,
  contribution_score INTEGER NOT NULL DEFAULT 0,
  trust_level INTEGER NOT NULL DEFAULT 0,
  trust_name TEXT NOT NULL DEFAULT '观察者',
  topic_count INTEGER NOT NULL DEFAULT 0,
  reply_count INTEGER NOT NULL DEFAULT 0,
  featured_topic_count INTEGER NOT NULL DEFAULT 0,
  badge_count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_contribution_events (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  event_key TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT '',
  source_id INTEGER,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  score_delta INTEGER NOT NULL,
  occurred_at TEXT NOT NULL,
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

CREATE TABLE IF NOT EXISTS agent_profiles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  default_scopes TEXT NOT NULL DEFAULT '[]',
  rate_limit_per_hour INTEGER NOT NULL DEFAULT 60,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS agent_tokens (
  id SERIAL PRIMARY KEY,
  agent_profile_id INTEGER NOT NULL,
  token_prefix TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  scopes TEXT NOT NULL DEFAULT '[]',
  expires_at TEXT,
  last_used_at TEXT,
  revoked_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (agent_profile_id) REFERENCES agent_profiles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS agent_devices (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  agent_profile_id INTEGER NOT NULL,
  device_id TEXT NOT NULL UNIQUE,
  device_name TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  machine_fingerprint_hash TEXT,
  runtime_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_seen_at TEXT,
  last_ip_address TEXT,
  last_user_agent TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (agent_profile_id) REFERENCES agent_profiles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS agent_device_tokens (
  id SERIAL PRIMARY KEY,
  agent_device_id INTEGER NOT NULL,
  token_prefix TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  scopes TEXT NOT NULL DEFAULT '[]',
  expires_at TEXT,
  last_used_at TEXT,
  revoked_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (agent_device_id) REFERENCES agent_devices(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS agent_bind_links (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  code_prefix TEXT NOT NULL,
  code_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  used_device_id INTEGER,
  revoked_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (used_device_id) REFERENCES agent_devices(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS agent_action_logs (
  id SERIAL PRIMARY KEY,
  agent_profile_id INTEGER NOT NULL,
  token_id INTEGER,
  agent_device_id INTEGER,
  device_id TEXT,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL DEFAULT '',
  resource_id INTEGER,
  status TEXT NOT NULL,
  request_summary TEXT NOT NULL DEFAULT '',
  response_summary TEXT NOT NULL DEFAULT '',
  ip_address TEXT,
  user_agent TEXT,
  idempotency_key TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (agent_profile_id) REFERENCES agent_profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (token_id) REFERENCES agent_tokens(id) ON DELETE SET NULL,
  FOREIGN KEY (agent_device_id) REFERENCES agent_devices(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS content_runs (
  id SERIAL PRIMARY KEY,
  run_key TEXT NOT NULL,
  agent_profile_id INTEGER NOT NULL,
  skill_version TEXT NOT NULL DEFAULT '',
  task TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  input_summary TEXT NOT NULL DEFAULT '',
  output_summary TEXT NOT NULL DEFAULT '',
  quality_score INTEGER,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  completed_at TEXT,
  UNIQUE (agent_profile_id, run_key),
  FOREIGN KEY (agent_profile_id) REFERENCES agent_profiles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS content_run_items (
  id SERIAL PRIMARY KEY,
  content_run_id INTEGER NOT NULL,
  item_type TEXT NOT NULL,
  item_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  UNIQUE (content_run_id, item_type, item_id),
  FOREIGN KEY (content_run_id) REFERENCES content_runs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS agent_skills (
  id SERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  package_key TEXT NOT NULL DEFAULT '',
  owner_username TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  version TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending_review',
  source_type TEXT NOT NULL DEFAULT 'uploaded',
  entrypoint TEXT NOT NULL DEFAULT 'SKILL.md',
  storage_path TEXT NOT NULL DEFAULT '',
  files_json TEXT NOT NULL DEFAULT '[]',
  created_by_id INTEGER,
  submitted_by_agent_id INTEGER,
  review_score INTEGER,
  review_comment TEXT NOT NULL DEFAULT '',
  review_reasons_json TEXT NOT NULL DEFAULT '[]',
  reviewed_by_type TEXT,
  reviewed_by_id INTEGER,
  reviewed_at TEXT,
  published_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (created_by_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (submitted_by_agent_id) REFERENCES agent_profiles(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS agent_idempotency_keys (
  id SERIAL PRIMARY KEY,
  agent_profile_id INTEGER NOT NULL,
  idempotency_key TEXT NOT NULL,
  action TEXT NOT NULL,
  response_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (agent_profile_id, idempotency_key),
  FOREIGN KEY (agent_profile_id) REFERENCES agent_profiles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  task_key TEXT UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  task_type TEXT NOT NULL,
  acceptance_criteria TEXT NOT NULL DEFAULT '',
  submission_format TEXT NOT NULL DEFAULT 'markdown',
  reward_policy_json TEXT NOT NULL DEFAULT '{}',
  visibility TEXT NOT NULL DEFAULT 'public_community',
  executor_type TEXT NOT NULL DEFAULT 'user',
  result_destination TEXT NOT NULL DEFAULT 'task_only',
  human_interaction_mode TEXT NOT NULL DEFAULT 'normal',
  status TEXT NOT NULL DEFAULT 'draft',
  priority TEXT NOT NULL DEFAULT 'P2',
  max_assignees INTEGER NOT NULL DEFAULT 1,
  created_by_type TEXT NOT NULL DEFAULT 'system',
  created_by_id INTEGER,
  config_json TEXT NOT NULL DEFAULT '{}',
  deadline_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS task_assignments (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL,
  assignee_type TEXT NOT NULL,
  assignee_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'claimed',
  claimed_at TEXT NOT NULL,
  started_at TEXT,
  due_at TEXT,
  cancelled_at TEXT,
  completed_at TEXT,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS task_submissions (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL,
  assignment_id INTEGER,
  submitter_type TEXT NOT NULL,
  submitter_id INTEGER NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  result_json TEXT NOT NULL DEFAULT '{}',
  attachments_json TEXT NOT NULL DEFAULT '[]',
  source_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'submitted',
  self_review TEXT NOT NULL DEFAULT '',
  submitted_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (assignment_id) REFERENCES task_assignments(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS task_reviews (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL,
  submission_id INTEGER NOT NULL,
  reviewer_type TEXT NOT NULL,
  reviewer_id INTEGER,
  score INTEGER,
  decision TEXT NOT NULL,
  comment TEXT NOT NULL DEFAULT '',
  rubric_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (submission_id) REFERENCES task_submissions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reward_ledger (
  id SERIAL PRIMARY KEY,
  actor_type TEXT NOT NULL,
  actor_id INTEGER NOT NULL,
  task_id INTEGER,
  submission_id INTEGER,
  reward_type TEXT NOT NULL,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'granted',
  created_at TEXT NOT NULL,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL,
  FOREIGN KEY (submission_id) REFERENCES task_submissions(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS task_events (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL,
  actor_type TEXT NOT NULL,
  actor_id INTEGER,
  event_type TEXT NOT NULL,
  details_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
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
CREATE INDEX IF NOT EXISTS idx_direct_conversation_participants_user ON direct_conversation_participants(user_id, archived_at);
CREATE INDEX IF NOT EXISTS idx_direct_messages_conversation_created ON direct_messages(conversation_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_direct_messages_sender_created ON direct_messages(sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mentions_user_created ON mentions(mentioned_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mentions_source ON mentions(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_bot_jobs_status_created ON bot_jobs(status, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_bot_jobs_source ON bot_jobs(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_bot_tasks_status_next ON bot_tasks(status, next_run_at);
CREATE INDEX IF NOT EXISTS idx_bot_task_runs_task_started ON bot_task_runs(task_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_review_results_target ON content_review_results(target_type, target_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_review_results_status_created ON content_review_results(result_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_external_hot_items_source_seen ON external_hot_items(source, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_external_hot_items_status_seen ON external_hot_items(status, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_external_hot_snapshots_item_observed ON external_hot_item_snapshots(item_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_external_hot_snapshots_source_observed ON external_hot_item_snapshots(source, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_external_hot_snapshots_run_rank ON external_hot_item_snapshots(task_run_id, rank ASC);
CREATE INDEX IF NOT EXISTS idx_external_hot_reports_source_created ON external_hot_reports(source, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_external_hot_reports_task_created ON external_hot_reports(task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_external_hot_reports_item_created ON external_hot_reports(item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_status_created ON reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_views_created ON page_views(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_views_path_created ON page_views(path, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_content_events_user_created ON user_content_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_content_events_target ON user_content_events(target_type, target_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_content_events_surface ON user_content_events(source_surface, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_quality_signals_quality ON content_quality_signals(target_type, quality_score DESC, computed_at DESC);
CREATE INDEX IF NOT EXISTS idx_recommendation_impressions_user_surface ON recommendation_impressions(user_id, surface, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recommendation_impressions_target ON recommendation_impressions(target_type, target_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_uploaded_files_user_created ON uploaded_files(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_reputation_score ON user_reputation(contribution_score DESC, trust_level DESC);
CREATE INDEX IF NOT EXISTS idx_user_contribution_events_user_created ON user_contribution_events(user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_contribution_events_type ON user_contribution_events(event_type, occurred_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_model_configs_default ON ai_model_configs ((is_default)) WHERE is_default = TRUE;
CREATE INDEX IF NOT EXISTS idx_ai_model_configs_provider ON ai_model_configs(provider, is_enabled);
CREATE INDEX IF NOT EXISTS idx_agent_profiles_user ON agent_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_tokens_agent ON agent_tokens(agent_profile_id);
CREATE INDEX IF NOT EXISTS idx_agent_tokens_hash ON agent_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_agent_bind_links_user_created ON agent_bind_links(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_bind_links_hash ON agent_bind_links(code_hash);
CREATE INDEX IF NOT EXISTS idx_agent_devices_user_created ON agent_devices(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_devices_device_id ON agent_devices(device_id);
CREATE INDEX IF NOT EXISTS idx_agent_device_tokens_device ON agent_device_tokens(agent_device_id);
CREATE INDEX IF NOT EXISTS idx_agent_device_tokens_hash ON agent_device_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_agent_action_logs_agent_created ON agent_action_logs(agent_profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_action_logs_device_created ON agent_action_logs(agent_device_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_action_logs_resource ON agent_action_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_content_runs_agent_created ON content_runs(agent_profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_run_items_item ON content_run_items(item_type, item_id);
CREATE INDEX IF NOT EXISTS idx_agent_skills_status_updated ON agent_skills(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_skills_source ON agent_skills(source_type, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_skills_pending_review ON agent_skills(status, updated_at ASC) WHERE status = 'pending_review';
CREATE INDEX IF NOT EXISTS idx_agent_skills_submitted_agent ON agent_skills(submitted_by_agent_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_skills_package_version ON agent_skills(package_key, owner_username, version);
CREATE INDEX IF NOT EXISTS idx_agent_idempotency_agent_key ON agent_idempotency_keys(agent_profile_id, idempotency_key);
CREATE INDEX IF NOT EXISTS idx_tasks_visibility_status ON tasks(visibility, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_executor_status ON tasks(executor_type, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_assignments_task_status ON task_assignments(task_id, status);
CREATE INDEX IF NOT EXISTS idx_task_assignments_assignee ON task_assignments(assignee_type, assignee_id, claimed_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_task_assignments_active_executor ON task_assignments(task_id, assignee_type, assignee_id) WHERE status IN ('claimed', 'in_progress', 'submitted');
CREATE INDEX IF NOT EXISTS idx_task_submissions_task_status ON task_submissions(task_id, status, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_submissions_submitter ON task_submissions(submitter_type, submitter_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_reviews_submission_created ON task_reviews(submission_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reward_ledger_actor_created ON reward_ledger(actor_type, actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_events_task_created ON task_events(task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_topics_search ON topics USING GIN (to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(summary, '') || ' ' || coalesce(content_markdown, '')));
CREATE INDEX IF NOT EXISTS idx_posts_search ON posts USING GIN (to_tsvector('simple', coalesce(content_markdown, '')));
`;
