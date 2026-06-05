import { closeDb, ensureSchema, execute, queryOne, withTransaction } from "../src/server/db/client.ts";
import { getDatabaseLabel } from "../src/server/db/config.ts";
import { schemaSql } from "../src/server/db/schema.ts";

await ensureSchema();

await execute(`
CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);
`);

const migrations = [
  {
    version: "001_initial_postgres_schema",
    sql: schemaSql,
  },
  {
    version: "002_auth_sessions_invitations",
    sql: `
      ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS locale TEXT NOT NULL DEFAULT 'zh';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'Asia/Shanghai';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_email_enabled BOOLEAN NOT NULL DEFAULT TRUE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_until TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_at TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS ban_reason TEXT;

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

      CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
      CREATE INDEX IF NOT EXISTS idx_posts_author_id ON posts(author_id);
    `,
  },
  {
    version: "003_operations_interactions_search_stats",
    sql: `
      CREATE TABLE IF NOT EXISTS follows (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        target_type TEXT NOT NULL,
        target_id INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE (user_id, target_type, target_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
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

      CREATE INDEX IF NOT EXISTS idx_reactions_target ON reactions(target_type, target_id);
      CREATE INDEX IF NOT EXISTS idx_bookmarks_user_id ON bookmarks(user_id);
      CREATE INDEX IF NOT EXISTS idx_follows_user_target ON follows(user_id, target_type, target_id);
      CREATE INDEX IF NOT EXISTS idx_follows_target ON follows(target_type, target_id);
      CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, read_at);
      CREATE INDEX IF NOT EXISTS idx_reports_status_created ON reports(status, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_page_views_created ON page_views(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_page_views_path_created ON page_views(path, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_topics_search ON topics USING GIN (to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(summary, '') || ' ' || coalesce(content_markdown, '')));
      CREATE INDEX IF NOT EXISTS idx_posts_search ON posts USING GIN (to_tsvector('simple', coalesce(content_markdown, '')));
    `,
  },
  {
    version: "004_local_image_uploads",
    sql: `
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

      CREATE INDEX IF NOT EXISTS idx_uploaded_files_user_created ON uploaded_files(user_id, created_at DESC);
    `,
  },
  {
    version: "005_ai_model_configs",
    sql: `
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

      CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_model_configs_default ON ai_model_configs ((is_default)) WHERE is_default = TRUE;
      CREATE INDEX IF NOT EXISTS idx_ai_model_configs_provider ON ai_model_configs(provider, is_enabled);
    `,
  },
  {
    version: "006_mentions_and_bots",
    sql: `
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_bot BOOLEAN NOT NULL DEFAULT FALSE;

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

      CREATE INDEX IF NOT EXISTS idx_mentions_user_created ON mentions(mentioned_user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_mentions_source ON mentions(source_type, source_id);
      CREATE INDEX IF NOT EXISTS idx_bot_jobs_status_created ON bot_jobs(status, created_at ASC);
      CREATE INDEX IF NOT EXISTS idx_bot_jobs_source ON bot_jobs(source_type, source_id);

      INSERT INTO users (username, display_name, email, password_hash, role, is_bot, status, bio, email_verified_at, created_at, updated_at)
      VALUES
        ('ai', 'AI 助手', NULL, NULL, 'member', TRUE, 'active', '通用社区助手，可以总结讨论、整理观点和回答明确问题。', CURRENT_TIMESTAMP::text, CURRENT_TIMESTAMP::text, CURRENT_TIMESTAMP::text),
        ('seo', 'SEO 助手', NULL, NULL, 'member', TRUE, 'active', '帮助优化标题、摘要、关键词和标签。', CURRENT_TIMESTAMP::text, CURRENT_TIMESTAMP::text, CURRENT_TIMESTAMP::text),
        ('writer', '写作助手', NULL, NULL, 'member', TRUE, 'active', '帮助扩写、润色、去 AI 味和整理表达。', CURRENT_TIMESTAMP::text, CURRENT_TIMESTAMP::text, CURRENT_TIMESTAMP::text),
        ('mod', '审核助手', NULL, NULL, 'member', TRUE, 'active', '辅助管理员判断广告、低质内容和审核风险。', CURRENT_TIMESTAMP::text, CURRENT_TIMESTAMP::text, CURRENT_TIMESTAMP::text)
      ON CONFLICT(username) DO UPDATE SET
        display_name = excluded.display_name,
        is_bot = TRUE,
        status = 'active',
        bio = excluded.bio,
        updated_at = excluded.updated_at;
    `,
  },
  {
    version: "007_nested_post_replies",
    sql: `
      ALTER TABLE posts ADD COLUMN IF NOT EXISTS parent_post_id INTEGER;

      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'posts_parent_post_id_fkey'
        ) THEN
          ALTER TABLE posts
            ADD CONSTRAINT posts_parent_post_id_fkey
            FOREIGN KEY (parent_post_id) REFERENCES posts(id) ON DELETE CASCADE;
        END IF;
      END $$;

      CREATE INDEX IF NOT EXISTS idx_posts_parent_post_id ON posts(parent_post_id);

      UPDATE posts
      SET parent_post_id = COALESCE(source_posts.parent_post_id, source_posts.id)
      FROM bot_jobs
      INNER JOIN posts AS source_posts ON source_posts.id = bot_jobs.source_id
      WHERE bot_jobs.source_type = 'post'
        AND bot_jobs.result_post_id = posts.id
        AND posts.parent_post_id IS NULL
        AND posts.id <> source_posts.id;
    `,
  },
  {
    version: "008_user_blocks",
    sql: `
      CREATE TABLE IF NOT EXISTS user_blocks (
        id SERIAL PRIMARY KEY,
        blocker_id INTEGER NOT NULL,
        blocked_user_id INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE (blocker_id, blocked_user_id),
        FOREIGN KEY (blocker_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (blocked_user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker ON user_blocks(blocker_id, blocked_user_id);
    `,
  },
  {
    version: "009_agent_content_api",
    sql: `
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

      CREATE TABLE IF NOT EXISTS agent_action_logs (
        id SERIAL PRIMARY KEY,
        agent_profile_id INTEGER NOT NULL,
        token_id INTEGER,
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
        FOREIGN KEY (token_id) REFERENCES agent_tokens(id) ON DELETE SET NULL
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

      CREATE INDEX IF NOT EXISTS idx_agent_profiles_user ON agent_profiles(user_id);
      CREATE INDEX IF NOT EXISTS idx_agent_tokens_agent ON agent_tokens(agent_profile_id);
      CREATE INDEX IF NOT EXISTS idx_agent_tokens_hash ON agent_tokens(token_hash);
      CREATE INDEX IF NOT EXISTS idx_agent_action_logs_agent_created ON agent_action_logs(agent_profile_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_agent_action_logs_resource ON agent_action_logs(resource_type, resource_id);
      CREATE INDEX IF NOT EXISTS idx_content_runs_agent_created ON content_runs(agent_profile_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_content_run_items_item ON content_run_items(item_type, item_id);
      CREATE INDEX IF NOT EXISTS idx_agent_idempotency_agent_key ON agent_idempotency_keys(agent_profile_id, idempotency_key);

      INSERT INTO agent_profiles (user_id, name, description, default_scopes, rate_limit_per_hour, created_at, updated_at)
      SELECT users.id, 'content-seeder', '生产冷启动话题、项目复盘和工具讨论。', '["site:read","search:read","category:read","tag:read","topic:read","topic:create","topic:update_own","upload:image","mention:read","content_run:write"]', 20, CURRENT_TIMESTAMP::text, CURRENT_TIMESTAMP::text
      FROM users
      WHERE users.username = 'writer'
      ON CONFLICT (name) DO NOTHING;

      INSERT INTO agent_profiles (user_id, name, description, default_scopes, rate_limit_per_hour, created_at, updated_at)
      SELECT users.id, 'reply-assistant', '回复无人回应的问题和被点名的讨论。', '["site:read","search:read","category:read","tag:read","topic:read","post:create","mention:read","content_run:write"]', 40, CURRENT_TIMESTAMP::text, CURRENT_TIMESTAMP::text
      FROM users
      WHERE users.username = 'ai'
      ON CONFLICT (name) DO NOTHING;

      INSERT INTO agent_profiles (user_id, name, description, default_scopes, rate_limit_per_hour, created_at, updated_at)
      SELECT users.id, 'seo-editor', '优化标题、摘要和标签建议。', '["site:read","search:read","category:read","tag:read","topic:read","topic:update_own","content_run:write"]', 30, CURRENT_TIMESTAMP::text, CURRENT_TIMESTAMP::text
      FROM users
      WHERE users.username = 'seo'
      ON CONFLICT (name) DO NOTHING;

      INSERT INTO agent_profiles (user_id, name, description, default_scopes, rate_limit_per_hour, created_at, updated_at)
      SELECT users.id, 'moderation-assistant', '辅助发现低质内容和审核风险。', '["site:read","search:read","topic:read","review:suggest","content_run:write"]', 30, CURRENT_TIMESTAMP::text, CURRENT_TIMESTAMP::text
      FROM users
      WHERE users.username = 'mod'
      ON CONFLICT (name) DO NOTHING;
    `,
  },
  {
    version: "010_user_agent_device_binding",
    sql: `
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

      ALTER TABLE agent_action_logs ADD COLUMN IF NOT EXISTS agent_device_id INTEGER;
      ALTER TABLE agent_action_logs ADD COLUMN IF NOT EXISTS device_id TEXT;

      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'agent_action_logs_agent_device_id_fkey'
        ) THEN
          ALTER TABLE agent_action_logs
            ADD CONSTRAINT agent_action_logs_agent_device_id_fkey
            FOREIGN KEY (agent_device_id) REFERENCES agent_devices(id) ON DELETE SET NULL;
        END IF;
      END $$;

      CREATE INDEX IF NOT EXISTS idx_agent_bind_links_user_created ON agent_bind_links(user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_agent_bind_links_hash ON agent_bind_links(code_hash);
      CREATE INDEX IF NOT EXISTS idx_agent_devices_user_created ON agent_devices(user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_agent_devices_device_id ON agent_devices(device_id);
      CREATE INDEX IF NOT EXISTS idx_agent_device_tokens_device ON agent_device_tokens(agent_device_id);
      CREATE INDEX IF NOT EXISTS idx_agent_device_tokens_hash ON agent_device_tokens(token_hash);
      CREATE INDEX IF NOT EXISTS idx_agent_action_logs_device_created ON agent_action_logs(agent_device_id, created_at DESC);
    `,
  },
  {
    version: "011_bot_task_scheduler",
    sql: `
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

      CREATE INDEX IF NOT EXISTS idx_bot_tasks_status_next ON bot_tasks(status, next_run_at);
      CREATE INDEX IF NOT EXISTS idx_bot_task_runs_task_started ON bot_task_runs(task_id, started_at DESC);
      CREATE INDEX IF NOT EXISTS idx_content_review_results_target ON content_review_results(target_type, target_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_content_review_results_status_created ON content_review_results(result_status, created_at DESC);

      INSERT INTO bot_tasks (
        task_key, name, description, task_type, bot_user_id, trigger_type, status,
        schedule_interval_seconds, config_json, next_run_at, created_at, updated_at
      )
      SELECT
        'auto_review_pending_topics',
        '自动审核待发布话题',
        '定时扫描 pending 话题，使用 AI 给出审核判断，低风险内容自动发布。',
        'auto_review',
        users.id,
        'schedule',
        'active',
        60,
        '{"scope":"pending_topics","batchSize":5,"autoApproveMaxRisk":25,"dryRun":false}',
        CURRENT_TIMESTAMP::text,
        CURRENT_TIMESTAMP::text,
        CURRENT_TIMESTAMP::text
      FROM users
      WHERE users.username = 'mod'
      ON CONFLICT (task_key) DO NOTHING;
    `,
  },
];

for (const migration of migrations) {
  const existing = await queryOne<{ version: string }>("SELECT version FROM schema_migrations WHERE version = $1", [
    migration.version,
  ]);

  if (existing) {
    continue;
  }

  await withTransaction(async (client) => {
    await client.query(migration.sql);
    await client.query("INSERT INTO schema_migrations (version, applied_at) VALUES ($1, $2)", [
      migration.version,
      new Date().toISOString(),
    ]);
  });
}

console.log(`Migration finished: ${getDatabaseLabel()}`);

await closeDb();
