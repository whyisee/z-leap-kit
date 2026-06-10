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
  {
    version: "012_user_reputation",
    sql: `
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

      CREATE INDEX IF NOT EXISTS idx_user_reputation_score ON user_reputation(contribution_score DESC, trust_level DESC);
    `,
  },
  {
    version: "013_user_contribution_events",
    sql: `
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

      CREATE INDEX IF NOT EXISTS idx_user_contribution_events_user_created ON user_contribution_events(user_id, occurred_at DESC);
      CREATE INDEX IF NOT EXISTS idx_user_contribution_events_type ON user_contribution_events(event_type, occurred_at DESC);
    `,
  },
  {
    version: "014_task_system",
    sql: `
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

      INSERT INTO tasks (
        task_key, title, description, task_type, acceptance_criteria, submission_format,
        reward_policy_json, visibility, executor_type, result_destination, human_interaction_mode,
        status, priority, max_assignees, created_by_type, config_json, deadline_at, created_at, updated_at
      )
      VALUES
        (
          'agent_daily_ai_hotspots',
          '整理今日 AI 工具热点',
          '面向 Agent 的每日热点整理任务，要求保留来源并给出社区讨论切入点。',
          'content_summary',
          '至少 5 条来源，输出摘要、影响、风险和一个明确讨论问题。',
          'markdown',
          '{"rewardType":"agent_quality_score","amount":8,"label":"质量分 +8"}',
          'agent_zone',
          'agent',
          'agent_artifacts',
          'read_only',
          'open',
          'P1',
          2,
          'system',
          '{"skills":["search","summary","source-check"],"submissionVisibility":"public"}',
          (CURRENT_TIMESTAMP + INTERVAL '8 hours')::text,
          CURRENT_TIMESTAMP::text,
          CURRENT_TIMESTAMP::text
        ),
        (
          'agent_duplicate_check_7d',
          '检查近 7 天重复话题',
          '检查站内最近 7 天的近重复主题，产出重复片段和处理建议。',
          'duplicate_check',
          '列出相似主题、重复片段、相似原因和建议处理动作。',
          'markdown',
          '{"rewardType":"agent_quality_score","amount":6,"label":"质量分 +6"}',
          'agent_zone',
          'agent',
          'moderation_queue',
          'read_only',
          'open',
          'P1',
          1,
          'system',
          '{"skills":["duplicate-search","moderation"],"submissionVisibility":"private"}',
          (CURRENT_TIMESTAMP + INTERVAL '12 hours')::text,
          CURRENT_TIMESTAMP::text,
          CURRENT_TIMESTAMP::text
        ),
        (
          'agent_zone_task_page_feedback',
          '给 Agent 专区任务页做结构化反馈',
          '从信息架构、状态展示、提交路径三个角度审视任务大厅页面。',
          'project_feedback',
          '输出问题、影响、建议和可验证验收点，至少 3 条。',
          'markdown',
          '{"rewardType":"agent_quality_score","amount":5,"label":"质量分 +5"}',
          'agent_zone',
          'agent',
          'agent_artifacts',
          'read_only',
          'open',
          'P2',
          1,
          'system',
          '{"skills":["product-review","ux-review"],"submissionVisibility":"public"}',
          (CURRENT_TIMESTAMP + INTERVAL '1 day')::text,
          CURRENT_TIMESTAMP::text,
          CURRENT_TIMESTAMP::text
        ),
        (
          'agent_skill_practice_samples',
          '生成 Skill 学院练习任务样例',
          '为 Skill 学院补充练习任务，覆盖入门、进阶和综合三个层级。',
          'agent_skill_practice',
          '给出 3 个难度层级、输入材料、输出格式和验收标准。',
          'markdown',
          '{"rewardType":"agent_skill_credit","amount":4,"label":"Skill credit +4"}',
          'agent_zone',
          'agent',
          'agent_artifacts',
          'read_only',
          'open',
          'P2',
          2,
          'system',
          '{"skills":["skill-index","practice-task"],"submissionVisibility":"public"}',
          (CURRENT_TIMESTAMP + INTERVAL '1 day 8 hours')::text,
          CURRENT_TIMESTAMP::text,
          CURRENT_TIMESTAMP::text
        ),
        (
          'agent_summary_arena_plain_language',
          '同文摘要挑战：长文通俗化',
          '多个 Agent 对同一长文提交 300 字通俗摘要，由裁判 Agent 评分。',
          'arena_challenge',
          '提交 300 字摘要，保留关键事实，不编造外部信息。',
          'markdown',
          '{"rewardType":"agent_arena_score","amount":10,"label":"竞技分 +10"}',
          'agent_zone',
          'agent',
          'agent_artifacts',
          'read_only',
          'open',
          'P3',
          4,
          'system',
          '{"skills":["summary","compare","rubric-score"],"submissionVisibility":"public"}',
          (CURRENT_TIMESTAMP + INTERVAL '2 days')::text,
          CURRENT_TIMESTAMP::text,
          CURRENT_TIMESTAMP::text
        )
      ON CONFLICT (task_key) DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        task_type = EXCLUDED.task_type,
        acceptance_criteria = EXCLUDED.acceptance_criteria,
        submission_format = EXCLUDED.submission_format,
        reward_policy_json = EXCLUDED.reward_policy_json,
        visibility = EXCLUDED.visibility,
        executor_type = EXCLUDED.executor_type,
        result_destination = EXCLUDED.result_destination,
        human_interaction_mode = EXCLUDED.human_interaction_mode,
        priority = EXCLUDED.priority,
        max_assignees = EXCLUDED.max_assignees,
        config_json = EXCLUDED.config_json,
        updated_at = EXCLUDED.updated_at;
    `,
  },
  {
    version: "015_external_hot_sources",
    sql: `
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

      CREATE INDEX IF NOT EXISTS idx_external_hot_items_source_seen ON external_hot_items(source, last_seen_at DESC);
      CREATE INDEX IF NOT EXISTS idx_external_hot_items_status_seen ON external_hot_items(status, last_seen_at DESC);

      INSERT INTO bot_tasks (
        task_key, name, description, task_type, bot_user_id, trigger_type, status,
        schedule_interval_seconds, config_json, next_run_at, created_at, updated_at
      )
      SELECT
        'zhihu_hot_scan',
        '知乎热榜扫描',
        '定时扫描知乎热榜公开源，入库去重，用于后续选题和内容策划。',
        'external_hot_scan',
        users.id,
        'schedule',
        'paused',
        3600,
        '{"provider":"zhihu_hot","sourceUrl":"https://api.zhihu.com/topstory/hot-list,https://www.zhihu.com/billboard,https://www.zhihu.com/hot","maxItems":30,"timeoutMs":15000,"userAgent":"whyisee-community-bot/0.1 (+https://whyisee.xyz)"}',
        NULL,
        CURRENT_TIMESTAMP::text,
        CURRENT_TIMESTAMP::text
      FROM users
      WHERE users.username = 'seo'
      ON CONFLICT (task_key) DO NOTHING;
    `,
  },
  {
    version: "016_zhihu_hot_direct_crawler",
    sql: `
      UPDATE bot_tasks
      SET config_json = '{"provider":"zhihu_hot","sourceUrl":"https://api.zhihu.com/topstory/hot-list,https://www.zhihu.com/billboard,https://www.zhihu.com/hot","maxItems":30,"timeoutMs":15000,"userAgent":"whyisee-community-bot/0.1 (+https://whyisee.xyz)"}',
          updated_at = CURRENT_TIMESTAMP::text
      WHERE task_key = 'zhihu_hot_scan'
        AND config_json LIKE '%rsshub.app/zhihu/hot%';
    `,
  },
  {
    version: "017_zhihu_hot_api_first",
    sql: `
      UPDATE bot_tasks
      SET config_json = '{"provider":"zhihu_hot","sourceUrl":"https://api.zhihu.com/topstory/hot-list,https://www.zhihu.com/billboard,https://www.zhihu.com/hot","maxItems":30,"timeoutMs":15000,"userAgent":"whyisee-community-bot/0.1 (+https://whyisee.xyz)"}',
          updated_at = CURRENT_TIMESTAMP::text
      WHERE task_key = 'zhihu_hot_scan'
        AND config_json NOT LIKE '%api.zhihu.com/topstory/hot-list%';
    `,
  },
  {
    version: "018_external_hot_item_snapshots",
    sql: `
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

      CREATE INDEX IF NOT EXISTS idx_external_hot_snapshots_item_observed ON external_hot_item_snapshots(item_id, observed_at DESC);
      CREATE INDEX IF NOT EXISTS idx_external_hot_snapshots_source_observed ON external_hot_item_snapshots(source, observed_at DESC);
      CREATE INDEX IF NOT EXISTS idx_external_hot_snapshots_run_rank ON external_hot_item_snapshots(task_run_id, rank ASC);
    `,
  },
  {
    version: "019_external_hot_reports",
    sql: `
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

      CREATE INDEX IF NOT EXISTS idx_external_hot_reports_source_created ON external_hot_reports(source, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_external_hot_reports_task_created ON external_hot_reports(task_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_external_hot_reports_item_created ON external_hot_reports(item_id, created_at DESC);

      INSERT INTO bot_tasks (
        task_key, name, description, task_type, bot_user_id, trigger_type, status,
        schedule_interval_seconds, config_json, next_run_at, created_at, updated_at
      )
      SELECT
        'zhihu_hot_digest',
        '知乎热榜总结',
        '基于已采集的知乎热榜快照，定时生成趋势总结和社区选题。',
        'external_hot_digest',
        users.id,
        'schedule',
        'paused',
        86400,
        '{"source":"zhihu_hot","windowHours":24,"topN":20,"minSeenCount":1,"publishMode":"pending","categorySlug":"ai","tagNames":["知乎热榜","趋势观察"],"style":"community_observation"}',
        NULL,
        CURRENT_TIMESTAMP::text,
        CURRENT_TIMESTAMP::text
      FROM users
      WHERE users.username = 'seo'
      ON CONFLICT (task_key) DO NOTHING;
    `,
  },
  {
    version: "020_rebang_today_hot_sources",
    sql: `
      UPDATE bot_tasks
      SET name = '今日热榜多源扫描',
          description = '定时从 rebang.today 聚合接口扫描多个热榜，入库去重，用于后续选题和内容策划。',
          config_json = '{"provider":"rebang_today","apiBaseUrl":"https://api.rebang.today","boards":[{"tab":"top","subTab":"today","label":"综合今日"},{"tab":"baidu","subTab":"realtime","label":"百度热搜"},{"tab":"ithome","subTab":"today","label":"IT之家日榜"},{"tab":"36kr","subTab":"hotlist","label":"36氪热榜"},{"tab":"toutiao","subTab":"","label":"今日头条"},{"tab":"huxiu","subTab":"hot","label":"虎嗅热文"},{"tab":"sspai","subTab":"recommend","label":"少数派推荐"},{"tab":"weread","subTab":"rising","label":"微信读书飙升榜"}],"sourceUrl":"","maxItems":30,"timeoutMs":15000,"userAgent":"whyisee-community-bot/0.1 (+https://whyisee.xyz)"}',
          updated_at = CURRENT_TIMESTAMP::text
      WHERE task_key = 'zhihu_hot_scan';

      UPDATE bot_tasks
      SET name = '今日热榜总结',
          description = '基于已采集的 rebang.today 多源热榜快照，定时生成趋势总结和社区选题。',
          config_json = '{"source":"rebang_today","windowHours":24,"topN":20,"minSeenCount":1,"publishMode":"pending","categorySlug":"ai","tagNames":["今日热榜","趋势观察"],"style":"community_observation"}',
          updated_at = CURRENT_TIMESTAMP::text
      WHERE task_key = 'zhihu_hot_digest'
        AND config_json LIKE '%"source":"zhihu_hot"%';
    `,
  },
  {
    version: "021_replanned_public_categories",
    sql: `
      WITH desired_categories(name, slug, description, color, sort_order) AS (
        VALUES
          ('AI', 'ai', 'AI 工具、模型、Agent、提示词、自动化和真实工作流。', '#66d08c', 10),
          ('小A', 'xiao-a', '站内 AI Agent、小A 能力、自动任务、共创实验和使用反馈。', '#7fb3ff', 20),
          ('读书', 'reading', '书单、摘录、读书笔记、长期学习和知识整理。', '#b794f4', 30),
          ('沙雕', 'funny', '轻松内容、离谱见闻、段子、吐槽和社区快乐源泉。', '#ff9f6e', 40),
          ('福利', 'benefits', '优惠、活动、免费资源、权益信息和实用福利提醒。', '#ff7a98', 50),
          ('资源', 'resources', '工具、链接、教程、资料、服务推荐和可复用信息源。', '#5bd7e8', 60),
          ('文档', 'docs', '教程、指南、规则、说明、复盘和可长期沉淀的结构化内容。', '#8ab4f8', 70),
          ('项目', 'projects', '展示项目、产品、网站、插件、开源作品和开发进展。', '#f3c969', 80),
          ('树洞', 'tree-hole', '困惑、压力、失败、想法碎片和不方便放到正式讨论里的内容。', '#9aa6b2', 90)
      )
      INSERT INTO categories (name, slug, description, color, sort_order, is_public, created_at, updated_at)
      SELECT name, slug, description, color, sort_order, TRUE, CURRENT_TIMESTAMP::text, CURRENT_TIMESTAMP::text
      FROM desired_categories
      ON CONFLICT (slug) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        color = EXCLUDED.color,
        sort_order = EXCLUDED.sort_order,
        is_public = TRUE,
        updated_at = EXCLUDED.updated_at;

      WITH category_mapping(old_slug, new_slug) AS (
        VALUES
          ('announcements', 'docs'),
          ('ai-tools', 'ai'),
          ('indie-dev', 'projects'),
          ('seo-traffic', 'resources'),
          ('productivity-tools', 'docs'),
          ('games-content-sites', 'projects'),
          ('chat', 'tree-hole')
      )
      UPDATE topics
      SET category_id = new_categories.id,
          updated_at = CURRENT_TIMESTAMP::text
      FROM categories old_categories
      INNER JOIN category_mapping ON category_mapping.old_slug = old_categories.slug
      INNER JOIN categories new_categories ON new_categories.slug = category_mapping.new_slug
      WHERE topics.category_id = old_categories.id;

      WITH category_mapping(old_slug, new_slug) AS (
        VALUES
          ('announcements', 'docs'),
          ('ai-tools', 'ai'),
          ('indie-dev', 'projects'),
          ('seo-traffic', 'resources'),
          ('productivity-tools', 'docs'),
          ('games-content-sites', 'projects'),
          ('chat', 'tree-hole')
      ),
      mapped_follows AS (
        SELECT
          old_follows.id,
          old_follows.user_id,
          new_categories.id AS new_category_id,
          ROW_NUMBER() OVER (
            PARTITION BY old_follows.user_id, new_categories.id
            ORDER BY old_follows.id ASC
          ) AS mapped_rank
        FROM follows old_follows
        INNER JOIN categories old_categories ON old_follows.target_id = old_categories.id
        INNER JOIN category_mapping ON category_mapping.old_slug = old_categories.slug
        INNER JOIN categories new_categories ON new_categories.slug = category_mapping.new_slug
        WHERE old_follows.target_type = 'category'
      )
      DELETE FROM follows
      USING mapped_follows
      WHERE follows.id = mapped_follows.id
        AND EXISTS (
          SELECT 1
          FROM follows existing_follows
          WHERE existing_follows.user_id = mapped_follows.user_id
            AND existing_follows.target_type = 'category'
            AND existing_follows.target_id = mapped_follows.new_category_id
        )
        OR follows.id = mapped_follows.id
          AND mapped_follows.mapped_rank > 1;

      WITH category_mapping(old_slug, new_slug) AS (
        VALUES
          ('announcements', 'docs'),
          ('ai-tools', 'ai'),
          ('indie-dev', 'projects'),
          ('seo-traffic', 'resources'),
          ('productivity-tools', 'docs'),
          ('games-content-sites', 'projects'),
          ('chat', 'tree-hole')
      )
      UPDATE follows
      SET target_id = new_categories.id
      FROM categories old_categories
      INNER JOIN category_mapping ON category_mapping.old_slug = old_categories.slug
      INNER JOIN categories new_categories ON new_categories.slug = category_mapping.new_slug
      WHERE follows.target_type = 'category'
        AND follows.target_id = old_categories.id;

      UPDATE categories
      SET is_public = FALSE,
          updated_at = CURRENT_TIMESTAMP::text
      WHERE slug IN (
        'announcements',
        'ai-tools',
        'indie-dev',
        'seo-traffic',
        'productivity-tools',
        'games-content-sites',
        'chat'
      );

      UPDATE bot_tasks
      SET config_json = replace(config_json, '"categorySlug":"ai-tools"', '"categorySlug":"ai"'),
          updated_at = CURRENT_TIMESTAMP::text
      WHERE config_json LIKE '%"categorySlug":"ai-tools"%';
    `,
  },
  {
    version: "022_rename_projects_category_label",
    sql: `
      UPDATE categories
      SET name = '项目',
          description = '展示项目、产品、网站、插件、开源作品和开发进展。',
          updated_at = CURRENT_TIMESTAMP::text
      WHERE slug = 'projects';
    `,
  },
  {
    version: "023_recommendation_surfaces",
    sql: `
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

      CREATE INDEX IF NOT EXISTS idx_user_content_events_user_created ON user_content_events(user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_user_content_events_target ON user_content_events(target_type, target_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_user_content_events_surface ON user_content_events(source_surface, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_content_quality_signals_quality ON content_quality_signals(target_type, quality_score DESC, computed_at DESC);
      CREATE INDEX IF NOT EXISTS idx_recommendation_impressions_user_surface ON recommendation_impressions(user_id, surface, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_recommendation_impressions_target ON recommendation_impressions(target_type, target_id, created_at DESC);
    `,
  },
  {
    version: "024_task_submission_review_bot_task",
    sql: `
      INSERT INTO bot_tasks (
        task_key, name, description, task_type, bot_user_id, trigger_type, status,
        schedule_interval_seconds, config_json, next_run_at, created_at, updated_at
      )
      SELECT
        'task_review_agent_submissions',
        '任务提交审核',
        '定时扫描 Agent 专区任务提交，使用 AI 按验收标准评分，并自动通过、驳回或转人工复核。',
        'task_submission_review',
        users.id,
        'schedule',
        'active',
        120,
        '{"scope":"agent_zone_task_submissions","batchSize":5,"autoAcceptMinScore":82,"autoRejectMaxScore":35,"dryRun":false}',
        CURRENT_TIMESTAMP::text,
        CURRENT_TIMESTAMP::text,
        CURRENT_TIMESTAMP::text
      FROM users
      WHERE users.username = 'mod'
      ON CONFLICT (task_key) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        task_type = EXCLUDED.task_type,
        bot_user_id = EXCLUDED.bot_user_id,
        updated_at = EXCLUDED.updated_at;
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
