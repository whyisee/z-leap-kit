import { query, queryOne } from "@server/db/client";
import type { AuthSession } from "@lib/auth";

export interface UserBadge {
  id: string;
  name: string;
  description: string;
  icon: string;
  tone: "blue" | "green" | "gold" | "violet" | "rose";
}

export interface UserGrowthProfile {
  userId: number;
  contributionScore: number;
  trustLevel: number;
  trustName: string;
  trustDescription: string;
  nextLevelScore: number | null;
  nextLevelName: string | null;
  topicCount: number;
  replyCount: number;
  featuredTopicCount: number;
  badgeCount: number;
  badges: UserBadge[];
}

export interface UserContributionEvent {
  id: number;
  userId: number;
  eventType: string;
  sourceType: string;
  sourceId: number | null;
  title: string;
  description: string;
  scoreDelta: number;
  occurredAt: string;
}

interface GrowthStats {
  id: number;
  role: AuthSession["role"];
  is_bot: boolean;
  bio: string;
  avatar_url: string | null;
  website_url: string | null;
  github_url: string | null;
  published_topics: string;
  project_topics: string;
  article_topics: string;
  featured_topics: string;
  ai_topics: string;
  seo_topics: string;
  replies: string;
}

interface ContributionEventInput {
  eventKey: string;
  eventType: string;
  sourceType: string;
  sourceId: number | null;
  title: string;
  description: string;
  scoreDelta: number;
  occurredAt: string;
}

interface TopicContributionRow {
  id: number;
  title: string;
  type: string;
  is_featured: boolean;
  published_at: string | null;
  created_at: string;
}

interface ReplyContributionRow {
  id: number;
  topic_id: number;
  topic_title: string;
  created_at: string;
}

const trustLevels = [
  { level: 0, name: "观察者", minScore: 0, description: "刚加入社区，适合先浏览、回复和熟悉社区方向。" },
  { level: 1, name: "记录者", minScore: 50, description: "开始贡献真实记录和讨论，可以稳定参与基础互动。" },
  { level: 2, name: "实验者", minScore: 150, description: "持续发布实践内容，适合展示项目和分享实验过程。" },
  { level: 3, name: "建造者", minScore: 500, description: "有多次高质量贡献，能帮助社区筛选和沉淀内容。" },
  { level: 4, name: "共建者", minScore: 0, description: "参与社区治理、审核建议和内容共建。" },
  { level: 5, name: "管理员", minScore: 0, description: "负责站务、审核、分类维护和规则执行。" },
];

export async function getUserGrowthProfile(userId: number): Promise<UserGrowthProfile | undefined> {
  const stats = await loadGrowthStats(userId);

  if (!stats) {
    return undefined;
  }

  const profile = buildGrowthProfile(stats);
  await syncContributionEvents(stats);
  await upsertReputation(profile);
  return profile;
}

export async function refreshUserReputation(userId: number) {
  await getUserGrowthProfile(userId);
}

export async function listUserGrowthProfiles(userIds: number[]) {
  if (userIds.length === 0) {
    return new Map<number, UserGrowthProfile>();
  }

  const profiles = await Promise.all(userIds.map((userId) => getUserGrowthProfile(userId)));
  const map = new Map<number, UserGrowthProfile>();

  for (const profile of profiles) {
    if (profile) {
      map.set(profile.userId, profile);
    }
  }

  return map;
}

export async function listUserContributionEvents(userId: number, limit = 12) {
  const rows = await query<{
    id: number;
    user_id: number;
    event_type: string;
    source_type: string;
    source_id: number | null;
    title: string;
    description: string;
    score_delta: number;
    occurred_at: string;
  }>(
    `
    SELECT id, user_id, event_type, source_type, source_id, title, description, score_delta, occurred_at
    FROM user_contribution_events
    WHERE user_id = $1
    ORDER BY occurred_at DESC, id DESC
    LIMIT $2
    `,
    [userId, limit],
  );

  return rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    eventType: row.event_type,
    sourceType: row.source_type,
    sourceId: row.source_id,
    title: row.title,
    description: row.description,
    scoreDelta: Number(row.score_delta || 0),
    occurredAt: row.occurred_at,
  })) satisfies UserContributionEvent[];
}

function buildGrowthProfile(stats: GrowthStats): UserGrowthProfile {
  const topicCount = Number(stats.published_topics || 0);
  const projectTopicCount = Number(stats.project_topics || 0);
  const articleTopicCount = Number(stats.article_topics || 0);
  const featuredTopicCount = Number(stats.featured_topics || 0);
  const aiTopicCount = Number(stats.ai_topics || 0);
  const seoTopicCount = Number(stats.seo_topics || 0);
  const replyCount = Number(stats.replies || 0);
  const profileComplete = Boolean(stats.avatar_url && stats.bio.trim() && (stats.website_url || stats.github_url));

  const contributionScore = stats.is_bot
    ? 0
    : topicCount * 10 +
      projectTopicCount * 5 +
      articleTopicCount * 6 +
      featuredTopicCount * 30 +
      replyCount * 5 +
      (profileComplete ? 5 : 0);
  const levelMeta = resolveTrustLevel(stats.role, contributionScore, topicCount, replyCount, featuredTopicCount);
  const next = nextTrustLevel(levelMeta.level, stats.role);
  const badges = stats.is_bot
    ? []
    : buildBadges({
        topicCount,
        projectTopicCount,
        articleTopicCount,
        featuredTopicCount,
        aiTopicCount,
        seoTopicCount,
        replyCount,
        profileComplete,
      });

  return {
    userId: stats.id,
    contributionScore,
    trustLevel: levelMeta.level,
    trustName: levelMeta.name,
    trustDescription: levelMeta.description,
    nextLevelScore: next?.minScore ?? null,
    nextLevelName: next?.name ?? null,
    topicCount,
    replyCount,
    featuredTopicCount,
    badgeCount: badges.length,
    badges,
  };
}

async function loadGrowthStats(userId: number) {
  return queryOne<GrowthStats>(
    `
    SELECT
      users.id,
      users.role,
      users.is_bot,
      users.bio,
      users.avatar_url,
      users.website_url,
      users.github_url,
      COUNT(DISTINCT topics.id) FILTER (WHERE topics.status = 'published')::text AS published_topics,
      COUNT(DISTINCT topics.id) FILTER (WHERE topics.status = 'published' AND topics.type = 'project')::text AS project_topics,
      COUNT(DISTINCT topics.id) FILTER (WHERE topics.status = 'published' AND topics.type = 'article')::text AS article_topics,
      COUNT(DISTINCT topics.id) FILTER (WHERE topics.status = 'published' AND topics.is_featured = TRUE)::text AS featured_topics,
      COUNT(DISTINCT topics.id) FILTER (
        WHERE topics.status = 'published'
          AND (categories.slug ILIKE '%ai%' OR tags.slug ILIKE '%ai%' OR tags.slug ILIKE '%cursor%' OR tags.slug ILIKE '%codex%')
      )::text AS ai_topics,
      COUNT(DISTINCT topics.id) FILTER (
        WHERE topics.status = 'published'
          AND (categories.slug ILIKE '%seo%' OR tags.slug ILIKE '%seo%')
      )::text AS seo_topics,
      COUNT(DISTINCT posts.id) FILTER (WHERE posts.status = 'published')::text AS replies
    FROM users
    LEFT JOIN topics ON topics.author_id = users.id
    LEFT JOIN categories ON categories.id = topics.category_id
    LEFT JOIN topic_tags ON topic_tags.topic_id = topics.id
    LEFT JOIN tags ON tags.id = topic_tags.tag_id
    LEFT JOIN posts ON posts.author_id = users.id
    WHERE users.id = $1
    GROUP BY users.id
    LIMIT 1
    `,
    [userId],
  );
}

async function syncContributionEvents(stats: GrowthStats) {
  const userId = stats.id;

  if (stats.is_bot) {
    await query("DELETE FROM user_contribution_events WHERE user_id = $1", [userId]);
    return;
  }

  const events = await buildContributionEvents(stats);
  await query(
    `
    DELETE FROM user_contribution_events
    WHERE user_id = $1
      AND event_type IN ('topic_publish', 'topic_project_bonus', 'topic_article_bonus', 'topic_featured_bonus', 'reply_publish', 'profile_complete')
    `,
    [userId],
  );

  for (const event of events) {
    await query(
      `
      INSERT INTO user_contribution_events (
        user_id, event_key, event_type, source_type, source_id, title, description,
        score_delta, occurred_at, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (event_key) DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        score_delta = EXCLUDED.score_delta,
        occurred_at = EXCLUDED.occurred_at
      `,
      [
        userId,
        event.eventKey,
        event.eventType,
        event.sourceType,
        event.sourceId,
        event.title,
        event.description,
        event.scoreDelta,
        event.occurredAt,
        new Date().toISOString(),
      ],
    );
  }
}

async function buildContributionEvents(stats: GrowthStats) {
  const userId = stats.id;
  const events: ContributionEventInput[] = [];
  const topics = await query<TopicContributionRow>(
    `
    SELECT id, title, type, is_featured, published_at, created_at
    FROM topics
    WHERE author_id = $1 AND status = 'published'
    ORDER BY COALESCE(published_at, created_at) ASC
    `,
    [userId],
  );
  const replies = await query<ReplyContributionRow>(
    `
    SELECT posts.id, posts.topic_id, topics.title AS topic_title, posts.created_at
    FROM posts
    INNER JOIN topics ON topics.id = posts.topic_id
    WHERE posts.author_id = $1 AND posts.status = 'published'
    ORDER BY posts.created_at ASC
    `,
    [userId],
  );

  for (const topic of topics) {
    const occurredAt = topic.published_at || topic.created_at;
    events.push({
      eventKey: `topic:${topic.id}:publish`,
      eventType: "topic_publish",
      sourceType: "topic",
      sourceId: topic.id,
      title: "发布话题",
      description: topic.title,
      scoreDelta: 10,
      occurredAt,
    });

    if (topic.type === "project") {
      events.push({
        eventKey: `topic:${topic.id}:project`,
        eventType: "topic_project_bonus",
        sourceType: "topic",
        sourceId: topic.id,
        title: "项目展示加成",
        description: topic.title,
        scoreDelta: 5,
        occurredAt,
      });
    }

    if (topic.type === "article") {
      events.push({
        eventKey: `topic:${topic.id}:article`,
        eventType: "topic_article_bonus",
        sourceType: "topic",
        sourceId: topic.id,
        title: "文章沉淀加成",
        description: topic.title,
        scoreDelta: 6,
        occurredAt,
      });
    }

    if (topic.is_featured) {
      events.push({
        eventKey: `topic:${topic.id}:featured`,
        eventType: "topic_featured_bonus",
        sourceType: "topic",
        sourceId: topic.id,
        title: "精选内容加成",
        description: topic.title,
        scoreDelta: 30,
        occurredAt,
      });
    }
  }

  for (const reply of replies) {
    events.push({
      eventKey: `post:${reply.id}:publish`,
      eventType: "reply_publish",
      sourceType: "post",
      sourceId: reply.id,
      title: "参与回复",
      description: reply.topic_title,
      scoreDelta: 5,
      occurredAt: reply.created_at,
    });
  }

  if (stats.avatar_url && stats.bio.trim() && (stats.website_url || stats.github_url)) {
    events.push({
      eventKey: `user:${userId}:profile-complete`,
      eventType: "profile_complete",
      sourceType: "user",
      sourceId: userId,
      title: "完善资料",
      description: "补充头像、简介和外部链接。",
      scoreDelta: 5,
      occurredAt: new Date().toISOString(),
    });
  }

  return events;
}

function resolveTrustLevel(
  role: AuthSession["role"],
  score: number,
  topicCount: number,
  replyCount: number,
  featuredTopicCount: number,
) {
  if (role === "admin") {
    return trustLevels[5];
  }

  if (role === "moderator") {
    return trustLevels[4];
  }

  if (score >= 500 && featuredTopicCount > 0) {
    return trustLevels[3];
  }

  if (score >= 150 && topicCount >= 3) {
    return trustLevels[2];
  }

  if (score >= 50 && (topicCount >= 1 || replyCount >= 3)) {
    return trustLevels[1];
  }

  return trustLevels[0];
}

function nextTrustLevel(level: number, role: AuthSession["role"]) {
  if (role === "admin" || role === "moderator" || level >= 3) {
    return undefined;
  }

  return trustLevels.find((item) => item.level === level + 1 && item.level <= 3);
}

function buildBadges(stats: {
  topicCount: number;
  projectTopicCount: number;
  articleTopicCount: number;
  featuredTopicCount: number;
  aiTopicCount: number;
  seoTopicCount: number;
  replyCount: number;
  profileComplete: boolean;
}) {
  const badges: UserBadge[] = [];

  addBadge(badges, stats.topicCount >= 1, "first-topic", "第一篇帖子", "首次发布通过审核的话题。", "T", "blue");
  addBadge(badges, stats.replyCount >= 1, "first-reply", "第一次认真回复", "开始参与社区讨论。", "R", "green");
  addBadge(badges, stats.profileComplete, "profile-complete", "完善资料", "头像、简介和链接都已完善。", "ID", "violet");
  addBadge(badges, stats.projectTopicCount >= 1, "first-project", "首次项目展示", "发布了第一个项目展示内容。", "P", "gold");
  addBadge(badges, stats.articleTopicCount + stats.projectTopicCount >= 3, "practice-recorder", "实战记录者", "持续记录实践、项目或复盘。", "N", "blue");
  addBadge(badges, stats.aiTopicCount >= 3, "ai-tool-author", "工具流作者", "持续分享 AI 工具和工作流。", "AI", "violet");
  addBadge(badges, stats.seoTopicCount >= 3, "seo-experimenter", "SEO 实验员", "持续分享 SEO 或流量实验。", "S", "green");
  addBadge(badges, stats.replyCount >= 10, "discussion-builder", "讨论续航者", "多次参与并延续讨论。", "∞", "green");
  addBadge(badges, stats.featuredTopicCount >= 1, "featured-author", "精选作者", "至少一个话题被设为精选。", "★", "gold");
  addBadge(badges, stats.featuredTopicCount >= 3, "model-author", "社区样板帖", "多篇内容成为社区样板。", "M", "rose");

  return badges;
}

function addBadge(
  badges: UserBadge[],
  enabled: boolean,
  id: string,
  name: string,
  description: string,
  icon: string,
  tone: UserBadge["tone"],
) {
  if (enabled) {
    badges.push({ id, name, description, icon, tone });
  }
}

async function upsertReputation(profile: UserGrowthProfile) {
  await query(
    `
    INSERT INTO user_reputation (
      user_id, contribution_score, trust_level, trust_name, topic_count, reply_count,
      featured_topic_count, badge_count, updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT (user_id) DO UPDATE SET
      contribution_score = EXCLUDED.contribution_score,
      trust_level = EXCLUDED.trust_level,
      trust_name = EXCLUDED.trust_name,
      topic_count = EXCLUDED.topic_count,
      reply_count = EXCLUDED.reply_count,
      featured_topic_count = EXCLUDED.featured_topic_count,
      badge_count = EXCLUDED.badge_count,
      updated_at = EXCLUDED.updated_at
    `,
    [
      profile.userId,
      profile.contributionScore,
      profile.trustLevel,
      profile.trustName,
      profile.topicCount,
      profile.replyCount,
      profile.featuredTopicCount,
      profile.badgeCount,
      new Date().toISOString(),
    ],
  );
}
