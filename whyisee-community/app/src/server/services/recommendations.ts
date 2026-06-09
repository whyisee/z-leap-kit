import { formatRelative } from "@lib/format";
import type { Lang } from "@lib/i18n";
import { topicPath } from "@lib/routes";
import type { Category, Tag, Topic, TopicType } from "@lib/types";
import { execute, query, queryOne } from "@server/db/client";
import { listTopics } from "./topics";

export type RecommendationSurface = "see" | "go" | "following" | "related" | "reading" | "search";
export type SeeSort = "recommend" | "latest" | "hot" | "featured";
export type ParticipationFilter = "all" | "questions" | "feedback" | "tasks" | "supplement" | "stale";
export type FollowingFilter = "all" | "topics" | "users" | "categories" | "tags";

export interface RecommendedTopic extends Topic {
  recommendation: {
    surface: "see";
    score: number;
    reasons: string[];
  };
}

export type ParticipationTargetType =
  | "question"
  | "topic"
  | "project"
  | "resource"
  | "community_task"
  | "review_needed"
  | "stale_content";

export interface ParticipationRecommendation {
  targetType: ParticipationTargetType;
  targetId: number;
  title: string;
  summary: string;
  href: string;
  actionLabel: string;
  reason: string;
  category?: Category;
  tags: Tag[];
  score: number;
  stats: {
    replyCount?: number;
    viewCount?: number;
    submissionCount?: number;
    rewardLabel?: string;
  };
}

export interface FollowingFeedItem {
  sourceType: "topic" | "user" | "category" | "tag";
  sourceLabel: string;
  targetType: "topic";
  targetId: number;
  title: string;
  summary: string;
  href: string;
  meta: string;
  category: Category;
  tags: Tag[];
  score: number;
}

export interface ReadingRecommendation {
  targetType: "topic";
  targetId: number;
  href: string;
  topic: Topic;
  score: number;
  reasons: string[];
}

interface TopicAggregate {
  likeCount: number;
  bookmarkCount: number;
  reportCount: number;
  qualityScore?: number;
  freshnessScore?: number;
  engagementScore?: number;
  participationNeedScore?: number;
  riskPenalty?: number;
  staleScore?: number;
}

interface FollowRow {
  target_type: "topic" | "user" | "category" | "tag";
  target_id: number;
  created_at: string;
}

interface FollowMatch {
  sourceType: FollowingFeedItem["sourceType"];
  sourceLabel: string;
  strength: number;
}

interface UserSignals {
  categoryWeights: Map<string, number>;
  tagWeights: Map<string, number>;
  topicTypeWeights: Map<string, number>;
  authorWeights: Map<number, number>;
  negativeCategories: Map<string, number>;
  negativeTags: Map<string, number>;
  negativeAuthors: Map<number, number>;
  negativeTopicTypes: Map<string, number>;
  hiddenTopicIds: Set<number>;
  followedTopicIds: Set<number>;
  followedUserIds: Set<number>;
  followedCategoryIds: Set<number>;
  followedTagIds: Set<number>;
  bookmarkedTopicIds: Set<number>;
  likedTopicIds: Set<number>;
  repliedTopicIds: Set<number>;
}

interface TaskCandidateRow {
  id: number;
  title: string;
  description: string;
  task_type: string;
  priority: string;
  reward_policy_json: string;
  deadline_at: string | null;
  created_at: string;
  submission_count: string;
}

const topicCandidateLimit = 240;
const recommendationStopWords = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "this",
  "that",
  "what",
  "when",
  "where",
  "why",
  "how",
  "一个",
  "一些",
  "这个",
  "那个",
  "什么",
  "如何",
  "为什么",
  "可以",
  "需要",
  "现在",
]);

export async function listSeeRecommendations(input: {
  userId?: number;
  lang: Lang;
  categorySlug?: string;
  tagSlug?: string;
  sort?: SeeSort;
  limit?: number;
  offset?: number;
}): Promise<RecommendedTopic[]> {
  const sort = input.sort || "recommend";
  const limit = normalizeLimit(input.limit, 50);
  const offset = normalizeOffset(input.offset);
  const topics = await listTopics({
    limit: Math.max(topicCandidateLimit, limit + offset),
    categorySlug: input.categorySlug || undefined,
    tagSlug: input.tagSlug || undefined,
    lang: input.lang,
  });
  const aggregates = await loadTopicAggregates(topics.map((topic) => topic.id));
  const signals = await loadUserSignals(input.userId, topics);

  let scored = topics.map((topic) => {
    const score = scoreSeeTopic(topic, aggregates.get(topic.id) || emptyAggregate(), signals);
    return {
      ...topic,
      recommendation: {
        surface: "see" as const,
        score: score.total,
        reasons: score.reasons,
      },
    };
  });

  if (sort === "latest") {
    scored = scored.sort((a, b) => timestamp(b.lastActivityAt) - timestamp(a.lastActivityAt));
  } else if (sort === "hot") {
    scored = scored.sort((a, b) => hotScore(b, aggregates.get(b.id)) - hotScore(a, aggregates.get(a.id)));
  } else if (sort === "featured") {
    scored = scored
      .filter((topic) => topic.isFeatured || topic.isPinned || (aggregates.get(topic.id)?.qualityScore || 0) >= 70)
      .sort((a, b) => b.recommendation.score - a.recommendation.score);
  } else {
    scored = scored.sort((a, b) => b.recommendation.score - a.recommendation.score);
  }

  return scored.slice(offset, offset + limit);
}

export async function listParticipationRecommendations(input: {
  userId?: number;
  lang: Lang;
  filter?: ParticipationFilter;
  limit?: number;
  offset?: number;
}): Promise<ParticipationRecommendation[]> {
  const filter = input.filter || "all";
  const limit = normalizeLimit(input.limit, 50);
  const offset = normalizeOffset(input.offset);
  const topics = await listTopics({ limit: topicCandidateLimit, lang: input.lang });
  const aggregates = await loadTopicAggregates(topics.map((topic) => topic.id));
  const signals = await loadUserSignals(input.userId, topics);
  const items: ParticipationRecommendation[] = [];

  for (const topic of topics) {
    const aggregate = aggregates.get(topic.id) || emptyAggregate();
    const candidates = buildTopicParticipationCandidates(topic, aggregate, signals, input.lang);

    for (const candidate of candidates) {
      if (participationFilterMatches(filter, candidate)) {
        items.push(candidate);
      }
    }
  }

  if (filter === "all" || filter === "tasks") {
    items.push(...await listCommunityTaskParticipation(input.lang, signals));
  }

  return items
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(offset, offset + limit);
}

export async function listFollowingFeed(input: {
  userId?: number;
  lang: Lang;
  filter?: FollowingFilter;
  limit?: number;
  offset?: number;
}): Promise<FollowingFeedItem[]> {
  if (!input.userId) {
    return [];
  }

  const filter = input.filter || "all";
  const limit = normalizeLimit(input.limit, 60);
  const offset = normalizeOffset(input.offset);
  const follows = await listFollows(input.userId);
  const filteredFollows = follows.filter((follow) => followingFilterMatches(filter, follow.target_type));

  if (filteredFollows.length === 0) {
    return [];
  }

  const topics = await listTopics({ limit: topicCandidateLimit, lang: input.lang });
  const aggregates = await loadTopicAggregates(topics.map((topic) => topic.id));
  const items = new Map<number, FollowingFeedItem>();

  for (const topic of topics) {
    const match = matchFollowingSource(topic, filteredFollows);
    if (!match) {
      continue;
    }

    const aggregate = aggregates.get(topic.id) || emptyAggregate();
    const score = Math.round(
      freshnessScore(topic.lastActivityAt) * 0.36
        + followStrength(match.sourceType) * 0.24
        + qualityScore(topic, aggregate) * 0.18
        + Math.min(100, topic.replyCount * 7 + aggregate.likeCount * 9 + aggregate.bookmarkCount * 12) * 0.1
        + 8,
    );

    const existing = items.get(topic.id);
    if (existing && existing.score >= score) {
      continue;
    }

    items.set(topic.id, {
      sourceType: match.sourceType,
      sourceLabel: match.sourceLabel,
      targetType: "topic",
      targetId: topic.id,
      title: topic.title,
      summary: topic.summary,
      href: topicPath(topic),
      meta: formatRelative(topic.lastActivityAt, input.lang),
      category: topic.category,
      tags: topic.tags,
      score,
    });
  }

  return [...items.values()]
    .sort((a, b) => b.score - a.score)
    .slice(offset, offset + limit);
}

export async function listReadingRecommendations(input: {
  topic: Topic;
  userId?: number;
  lang: Lang;
  limit?: number;
  excludeTopicIds?: number[];
}): Promise<ReadingRecommendation[]> {
  const limit = normalizeLimit(input.limit, 12);
  const baseExcludedTopicIds = new Set([
    input.topic.id,
    ...(input.excludeTopicIds || []),
  ].filter((id) => Number.isFinite(id) && id > 0));
  const topics = await listTopics({ limit: topicCandidateLimit, lang: input.lang });
  const candidateTopics = topics.filter((topic) => !baseExcludedTopicIds.has(topic.id));
  const [aggregates, signals, recentViewedTopicIds] = await Promise.all([
    loadTopicAggregates(candidateTopics.map((topic) => topic.id)),
    loadUserSignals(input.userId, topics),
    loadRecentViewedTopicIds(input.userId),
  ]);

  const recommendations = candidateTopics
    .filter((topic) => !recentViewedTopicIds.has(topic.id))
    .map((topic) => {
      const aggregate = aggregates.get(topic.id) || emptyAggregate();
      const score = scoreReadingTopic(input.topic, topic, aggregate, signals, input.lang);

      return {
        targetType: "topic" as const,
        targetId: topic.id,
        href: topicPath(topic),
        topic,
        score: score.total,
        reasons: score.reasons,
      };
    })
    .filter((item) => item.score > 8 && !signals.hiddenTopicIds.has(item.topic.id));

  return diversifyReadingRecommendations(recommendations, limit);
}

export async function countParticipationRecommendations(userId?: number, lang: Lang = "zh") {
  const items = await listParticipationRecommendations({ userId, lang, limit: 200 });
  return items.length;
}

export async function countFollowingFeed(userId?: number, lang: Lang = "zh") {
  if (!userId) {
    return 0;
  }

  const items = await listFollowingFeed({ userId, lang, limit: 200 });
  return items.length;
}

export async function recordUserContentEvent(input: {
  userId?: number;
  anonymousKey?: string;
  eventType: string;
  targetType: string;
  targetId: number;
  sourceSurface?: string;
  sourceReason?: string;
  dwellSeconds?: number;
  metadata?: Record<string, unknown>;
}) {
  const eventType = normalizeEventType(input.eventType);
  const targetType = normalizeTargetType(input.targetType);
  const targetId = Math.round(Number(input.targetId || 0));

  if (!eventType || !targetType || targetId <= 0) {
    return;
  }

  const context = await loadEventTargetContext(targetType, targetId);
  await execute(
    `
    INSERT INTO user_content_events (
      user_id, anonymous_key, event_type, target_type, target_id, source_surface,
      source_reason, category_id, tag_slugs_json, topic_type, author_id,
      dwell_seconds, weight, metadata_json, created_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    `,
    [
      input.userId || null,
      input.anonymousKey || null,
      eventType,
      targetType,
      targetId,
      normalizeSurface(input.sourceSurface),
      String(input.sourceReason || "").slice(0, 120),
      context.categoryId,
      JSON.stringify(context.tagSlugs),
      context.topicType,
      context.authorId,
      typeof input.dwellSeconds === "number" && Number.isFinite(input.dwellSeconds) ? Math.max(0, Math.round(input.dwellSeconds)) : null,
      eventWeight(eventType, input.dwellSeconds),
      JSON.stringify(input.metadata || {}),
      new Date().toISOString(),
    ],
  );

  if (input.userId) {
    await refreshUserInterestProfile(input.userId);
  }
}

export async function recordRecommendationImpressions(input: {
  userId?: number;
  anonymousKey?: string;
  surface: RecommendationSurface;
  items: Array<{ targetType: string; targetId: number; score?: number; reasons?: string[] }>;
}) {
  const now = new Date().toISOString();
  const surface = normalizeSurface(input.surface);

  for (const [index, item] of input.items.entries()) {
    const targetType = normalizeTargetType(item.targetType);
    const targetId = Math.round(Number(item.targetId || 0));

    if (!targetType || targetId <= 0) {
      continue;
    }

    await execute(
      `
      INSERT INTO recommendation_impressions (
        user_id, anonymous_key, surface, target_type, target_id, rank, score, reasons_json, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `,
      [
        input.userId || null,
        input.anonymousKey || null,
        surface,
        targetType,
        targetId,
        index + 1,
        Math.round(item.score || 0),
        JSON.stringify((item.reasons || []).slice(0, 4)),
        now,
      ],
    );
  }
}

export async function refreshUserInterestProfile(userId: number) {
  if (!userId) {
    return;
  }

  const topics = await listTopics({ limit: topicCandidateLimit, includeDrafts: false });
  const signals = await loadUserSignals(userId, topics);
  const now = new Date().toISOString();

  await execute(
    `
    INSERT INTO user_interest_profiles (
      user_id, category_weights_json, tag_weights_json, topic_type_weights_json,
      author_weights_json, long_term_json, short_term_json, negative_json, updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT (user_id) DO UPDATE SET
      category_weights_json = EXCLUDED.category_weights_json,
      tag_weights_json = EXCLUDED.tag_weights_json,
      topic_type_weights_json = EXCLUDED.topic_type_weights_json,
      author_weights_json = EXCLUDED.author_weights_json,
      long_term_json = EXCLUDED.long_term_json,
      short_term_json = EXCLUDED.short_term_json,
      negative_json = EXCLUDED.negative_json,
      updated_at = EXCLUDED.updated_at
    `,
    [
      userId,
      JSON.stringify(mapToObject(signals.categoryWeights)),
      JSON.stringify(mapToObject(signals.tagWeights)),
      JSON.stringify(mapToObject(signals.topicTypeWeights)),
      JSON.stringify(mapToObject(signals.authorWeights)),
      JSON.stringify({
        categories: mapToObject(signals.categoryWeights),
        tags: mapToObject(signals.tagWeights),
        topicTypes: mapToObject(signals.topicTypeWeights),
      }),
      JSON.stringify({ windowHours: 72 }),
      JSON.stringify({
        categories: mapToObject(signals.negativeCategories),
        tags: mapToObject(signals.negativeTags),
        authors: mapToObject(signals.negativeAuthors),
        topicTypes: mapToObject(signals.negativeTopicTypes),
      }),
      now,
    ],
  );
}

export async function computeContentQualitySignals(input: { targetType?: string; targetId?: number } = {}) {
  const topics = await listTopics({ limit: input.targetId ? topicCandidateLimit : 500 });
  const filtered = input.targetType === "topic" && input.targetId
    ? topics.filter((topic) => topic.id === input.targetId)
    : topics;
  const aggregates = await loadTopicAggregates(filtered.map((topic) => topic.id));

  for (const topic of filtered) {
    const aggregate = aggregates.get(topic.id) || emptyAggregate();
    const now = new Date().toISOString();
    const quality = qualityScore(topic, aggregate);
    const freshness = freshnessScore(topic.lastActivityAt);
    const engagement = Math.min(100, topic.replyCount * 7 + topic.viewCount * 0.2 + aggregate.likeCount * 9 + aggregate.bookmarkCount * 12);
    const participationNeed = topic.type === "question" && topic.replyCount === 0
      ? 92
      : topic.type === "project" && topic.replyCount < 3
        ? 78
        : topic.replyCount === 0 && topic.viewCount > 20
          ? 64
          : 20;
    const stale = staleScore(topic);

    await execute(
      `
      INSERT INTO content_quality_signals (
        target_type, target_id, quality_score, freshness_score, engagement_score,
        participation_need_score, verified_score, risk_penalty, stale_score,
        computed_from_json, computed_at
      )
      VALUES ('topic', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (target_type, target_id) DO UPDATE SET
        quality_score = EXCLUDED.quality_score,
        freshness_score = EXCLUDED.freshness_score,
        engagement_score = EXCLUDED.engagement_score,
        participation_need_score = EXCLUDED.participation_need_score,
        verified_score = EXCLUDED.verified_score,
        risk_penalty = EXCLUDED.risk_penalty,
        stale_score = EXCLUDED.stale_score,
        computed_from_json = EXCLUDED.computed_from_json,
        computed_at = EXCLUDED.computed_at
      `,
      [
        topic.id,
        Math.round(quality),
        Math.round(freshness),
        Math.round(engagement),
        Math.round(participationNeed),
        topic.isFeatured ? 80 : 0,
        Math.min(90, aggregate.reportCount * 24),
        Math.round(stale),
        JSON.stringify({
          replyCount: topic.replyCount,
          viewCount: topic.viewCount,
          likeCount: aggregate.likeCount,
          bookmarkCount: aggregate.bookmarkCount,
          reportCount: aggregate.reportCount,
        }),
        now,
      ],
    );
  }
}

async function loadTopicAggregates(topicIds: number[]) {
  const ids = [...new Set(topicIds)].filter((id) => Number.isFinite(id) && id > 0);
  const aggregates = new Map<number, TopicAggregate>();

  for (const id of ids) {
    aggregates.set(id, emptyAggregate());
  }

  if (ids.length === 0) {
    return aggregates;
  }

  const [likes, bookmarks, reports, qualities] = await Promise.all([
    query<{ target_id: number; count: string }>(
      `
      SELECT target_id, COUNT(*)::text AS count
      FROM reactions
      WHERE target_type = 'topic'
        AND reaction_type = 'like'
        AND target_id = ANY($1::int[])
      GROUP BY target_id
      `,
      [ids],
    ),
    query<{ topic_id: number; count: string }>(
      `
      SELECT topic_id, COUNT(*)::text AS count
      FROM bookmarks
      WHERE topic_id = ANY($1::int[])
      GROUP BY topic_id
      `,
      [ids],
    ),
    query<{ target_id: number; count: string }>(
      `
      SELECT target_id, COUNT(*)::text AS count
      FROM reports
      WHERE target_type = 'topic'
        AND status = 'open'
        AND target_id = ANY($1::int[])
      GROUP BY target_id
      `,
      [ids],
    ),
    query<{
      target_id: number;
      quality_score: number;
      freshness_score: number;
      engagement_score: number;
      participation_need_score: number;
      risk_penalty: number;
      stale_score: number;
    }>(
      `
      SELECT target_id, quality_score, freshness_score, engagement_score, participation_need_score, risk_penalty, stale_score
      FROM content_quality_signals
      WHERE target_type = 'topic'
        AND target_id = ANY($1::int[])
      `,
      [ids],
    ),
  ]);

  for (const row of likes) {
    ensureAggregate(aggregates, row.target_id).likeCount = Number(row.count || 0);
  }

  for (const row of bookmarks) {
    ensureAggregate(aggregates, row.topic_id).bookmarkCount = Number(row.count || 0);
  }

  for (const row of reports) {
    ensureAggregate(aggregates, row.target_id).reportCount = Number(row.count || 0);
  }

  for (const row of qualities) {
    const aggregate = ensureAggregate(aggregates, row.target_id);
    aggregate.qualityScore = Number(row.quality_score || 0);
    aggregate.freshnessScore = Number(row.freshness_score || 0);
    aggregate.engagementScore = Number(row.engagement_score || 0);
    aggregate.participationNeedScore = Number(row.participation_need_score || 0);
    aggregate.riskPenalty = Number(row.risk_penalty || 0);
    aggregate.staleScore = Number(row.stale_score || 0);
  }

  return aggregates;
}

async function loadUserSignals(userId: number | undefined, topics: Topic[]): Promise<UserSignals> {
  const signals = createEmptySignals();

  if (!userId) {
    return signals;
  }

  const topicById = new Map(topics.map((topic) => [topic.id, topic]));
  const categorySlugById = new Map<number, string>();
  const tagSlugById = new Map<number, string>();

  for (const topic of topics) {
    categorySlugById.set(topic.category.id, topic.category.slug);
    topic.tags.forEach((tag) => tagSlugById.set(tag.id, tag.slug));
  }

  const [follows, bookmarks, likes, replies, ownTopics, negativeEvents] = await Promise.all([
    listFollows(userId),
    query<{ topic_id: number }>("SELECT topic_id FROM bookmarks WHERE user_id = $1", [userId]),
    query<{ target_id: number }>(
      "SELECT target_id FROM reactions WHERE user_id = $1 AND target_type = 'topic' AND reaction_type = 'like'",
      [userId],
    ),
    query<{ topic_id: number }>(
      `
      SELECT DISTINCT topic_id
      FROM posts
      WHERE author_id = $1
        AND status = 'published'
      `,
      [userId],
    ),
    query<{ id: number }>("SELECT id FROM topics WHERE author_id = $1 AND status = 'published'", [userId]),
    query<{
      event_type: string;
      target_type: string;
      target_id: number;
      category_id: number | null;
      tag_slugs_json: string;
      topic_type: string;
      author_id: number | null;
      weight: number;
    }>(
      `
      SELECT event_type, target_type, target_id, category_id, tag_slugs_json, topic_type, author_id, weight
      FROM user_content_events
      WHERE user_id = $1
        AND event_type IN ('hide', 'dismiss', 'report', 'block')
        AND created_at >= $2
      ORDER BY created_at DESC
      LIMIT 300
      `,
      [userId, daysAgo(120)],
    ),
  ]);

  for (const follow of follows) {
    if (follow.target_type === "topic") {
      signals.followedTopicIds.add(follow.target_id);
      const topic = topicById.get(follow.target_id);
      if (topic) addTopicInterest(signals, topic, 16);
    } else if (follow.target_type === "category") {
      signals.followedCategoryIds.add(follow.target_id);
      const slug = categorySlugById.get(follow.target_id);
      if (slug) addWeight(signals.categoryWeights, slug, 18);
    } else if (follow.target_type === "tag") {
      signals.followedTagIds.add(follow.target_id);
      const slug = tagSlugById.get(follow.target_id);
      if (slug) addWeight(signals.tagWeights, slug, 18);
    } else if (follow.target_type === "user") {
      signals.followedUserIds.add(follow.target_id);
      addWeight(signals.authorWeights, follow.target_id, 12);
    }
  }

  for (const row of bookmarks) {
    signals.bookmarkedTopicIds.add(row.topic_id);
    const topic = topicById.get(row.topic_id);
    if (topic) addTopicInterest(signals, topic, 14);
  }

  for (const row of likes) {
    signals.likedTopicIds.add(row.target_id);
    const topic = topicById.get(row.target_id);
    if (topic) addTopicInterest(signals, topic, 8);
  }

  for (const row of replies) {
    signals.repliedTopicIds.add(row.topic_id);
    const topic = topicById.get(row.topic_id);
    if (topic) addTopicInterest(signals, topic, 11);
  }

  for (const row of ownTopics) {
    const topic = topicById.get(row.id);
    if (topic) addTopicInterest(signals, topic, 13);
  }

  for (const row of negativeEvents) {
    if (row.target_type === "topic") {
      signals.hiddenTopicIds.add(row.target_id);
    }

    const penalty = Math.abs(Number(row.weight || 8));
    if (row.category_id) {
      const slug = categorySlugById.get(row.category_id);
      if (slug) addWeight(signals.negativeCategories, slug, penalty);
    }

    for (const slug of safeJsonArray(row.tag_slugs_json)) {
      addWeight(signals.negativeTags, slug, penalty);
    }

    if (row.topic_type) {
      addWeight(signals.negativeTopicTypes, row.topic_type, penalty);
    }

    if (row.author_id) {
      addWeight(signals.negativeAuthors, row.author_id, penalty);
    }
  }

  return signals;
}

async function listFollows(userId: number) {
  return query<FollowRow>(
    "SELECT target_type, target_id, created_at FROM follows WHERE user_id = $1 ORDER BY created_at DESC",
    [userId],
  );
}

async function loadRecentViewedTopicIds(userId: number | undefined) {
  if (!userId) {
    return new Set<number>();
  }

  const rows = await query<{ target_id: number }>(
    `
    SELECT DISTINCT target_id
    FROM user_content_events
    WHERE user_id = $1
      AND target_type = 'topic'
      AND event_type IN ('view', 'dwell', 'recommendation_click')
      AND created_at >= $2
    ORDER BY target_id DESC
    LIMIT 500
    `,
    [userId, daysAgo(14)],
  );

  return new Set(rows.map((row) => Number(row.target_id || 0)).filter((id) => id > 0));
}

function scoreSeeTopic(topic: Topic, aggregate: TopicAggregate, signals: UserSignals) {
  const interest = interestScore(topic, signals);
  const quality = qualityScore(topic, aggregate);
  const fresh = aggregate.freshnessScore ?? freshnessScore(topic.lastActivityAt);
  const engagement = aggregate.engagementScore ?? Math.min(100, topic.replyCount * 7 + topic.viewCount * 0.18 + aggregate.likeCount * 9 + aggregate.bookmarkCount * 12);
  const editorial = topic.isFeatured ? 88 : topic.isPinned ? 72 : 38;
  const exploration = interest < 20 && quality >= 70 ? 74 : 36;
  const seenPenalty = signals.repliedTopicIds.has(topic.id) || signals.bookmarkedTopicIds.has(topic.id) ? 0 : signals.likedTopicIds.has(topic.id) ? 6 : 0;
  const negativePenalty = negativePenaltyForTopic(topic, signals);
  const riskPenalty = Math.max(aggregate.riskPenalty || 0, aggregate.reportCount * 18);
  const total = Math.round(
    interest * 0.32
      + quality * 0.24
      + fresh * 0.14
      + engagement * 0.12
      + editorial * 0.08
      + exploration * 0.06
      - seenPenalty
      - negativePenalty
      - riskPenalty,
  );

  return {
    total: clamp(total, 0, 100),
      reasons: buildSeeReasons(topic, signals, interest, quality, engagement),
  };
}

function scoreReadingTopic(currentTopic: Topic, topic: Topic, aggregate: TopicAggregate, signals: UserSignals, lang: Lang) {
  const affinity = readingAffinityScore(currentTopic, topic);
  const interest = interestScore(topic, signals);
  const quality = qualityScore(topic, aggregate);
  const fresh = aggregate.freshnessScore ?? freshnessScore(topic.lastActivityAt);
  const engagement = aggregate.engagementScore ?? Math.min(100, topic.replyCount * 7 + topic.viewCount * 0.18 + aggregate.likeCount * 9 + aggregate.bookmarkCount * 12);
  const exploration = affinity < 28 && quality >= 72 ? 70 : 34;
  const alreadyInteractedPenalty =
    (signals.repliedTopicIds.has(topic.id) ? 20 : 0)
    + (signals.bookmarkedTopicIds.has(topic.id) ? 8 : 0)
    + (signals.likedTopicIds.has(topic.id) ? 5 : 0);
  const negativePenalty = negativePenaltyForTopic(topic, signals);
  const riskPenalty = Math.max(aggregate.riskPenalty || 0, aggregate.reportCount * 18);
  const editorialBoost = topic.isFeatured ? 6 : topic.isPinned ? 3 : 0;
  const total = Math.round(
    affinity * 0.36
      + interest * 0.22
      + quality * 0.18
      + fresh * 0.1
      + engagement * 0.08
      + exploration * 0.04
      + editorialBoost
      - alreadyInteractedPenalty
      - negativePenalty
      - riskPenalty,
  );

  return {
    total: clamp(total, 0, 100),
    reasons: buildReadingReasons(currentTopic, topic, signals, lang, affinity, interest, quality, engagement),
  };
}

function readingAffinityScore(currentTopic: Topic, topic: Topic) {
  const currentTagSlugs = new Set(currentTopic.tags.map((tag) => tag.slug));
  const sharedTags = topic.tags.filter((tag) => currentTagSlugs.has(tag.slug));
  const sharedTerms = sharedTextTerms(`${currentTopic.title} ${currentTopic.summary}`, `${topic.title} ${topic.summary}`);
  let score = 0;

  if (topic.category.slug === currentTopic.category.slug) {
    score += 30;
  }

  if (topic.type === currentTopic.type) {
    score += 8;
  }

  if (sharedTags.length > 0) {
    score += Math.min(42, 18 + sharedTags.length * 10);
  }

  if (topic.authorId === currentTopic.authorId) {
    score += 8;
  }

  score += Math.min(12, sharedTerms * 4);

  return clamp(Math.round(score), 0, 100);
}

function sharedTextTerms(left: string, right: string) {
  const leftTerms = new Set(tokenizeRecommendationText(left));
  const rightTerms = new Set(tokenizeRecommendationText(right));
  let count = 0;

  for (const term of leftTerms) {
    if (rightTerms.has(term)) {
      count += 1;
    }
  }

  return count;
}

function tokenizeRecommendationText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2 && !recommendationStopWords.has(term))
    .slice(0, 40);
}

function buildTopicParticipationCandidates(
  topic: Topic,
  aggregate: TopicAggregate,
  signals: UserSignals,
  lang: Lang,
): ParticipationRecommendation[] {
  const items: ParticipationRecommendation[] = [];
  const ability = interestScore(topic, signals);
  const quality = qualityScore(topic, aggregate);
  const need = aggregate.participationNeedScore ?? participationNeedScore(topic, aggregate);
  const baseScore = participationScore(topic, aggregate, signals, ability, need, quality);

  if (topic.type === "question" && topic.replyCount <= 2) {
    items.push({
      targetType: "question",
      targetId: topic.id,
      title: topic.title,
      summary: topic.summary,
      href: topicPath(topic),
      actionLabel: lang === "en" ? "Answer" : "去回答",
      reason: buildParticipationReason(topic, signals, lang, topic.replyCount === 0 ? "zeroReplyQuestion" : "lowReplyQuestion"),
      category: topic.category,
      tags: topic.tags,
      score: baseScore + (topic.replyCount === 0 ? 10 : 2),
      stats: { replyCount: topic.replyCount, viewCount: topic.viewCount },
    });
  }

  if (topic.type === "project" || topic.category.slug === "projects" || hasAnyTag(topic, ["feedback", "project-showcase", "user-feedback"])) {
    if (topic.replyCount <= 5) {
      items.push({
        targetType: "project",
        targetId: topic.id,
        title: topic.title,
        summary: topic.summary,
        href: topicPath(topic),
        actionLabel: lang === "en" ? "Review" : "去点评",
        reason: buildParticipationReason(topic, signals, lang, "projectFeedback"),
        category: topic.category,
        tags: topic.tags,
        score: baseScore + 6,
        stats: { replyCount: topic.replyCount, viewCount: topic.viewCount },
      });
    }
  }

  if (topic.type === "resource" || topic.category.slug === "resources" || hasAnyTag(topic, ["resources", "tools", "resource", "open-source"])) {
    if (topic.replyCount <= 3 || topic.summary.length < 40) {
      items.push({
        targetType: "resource",
        targetId: topic.id,
        title: topic.title,
        summary: topic.summary,
        href: topicPath(topic),
        actionLabel: lang === "en" ? "Add resource" : "补充资源",
        reason: buildParticipationReason(topic, signals, lang, "resourceSupplement"),
        category: topic.category,
        tags: topic.tags,
        score: baseScore,
        stats: { replyCount: topic.replyCount, viewCount: topic.viewCount },
      });
    }
  }

  if (staleScore(topic) >= 62) {
    items.push({
      targetType: "stale_content",
      targetId: topic.id,
      title: topic.title,
      summary: topic.summary,
      href: topicPath(topic),
      actionLabel: lang === "en" ? "Update" : "更新内容",
      reason: buildParticipationReason(topic, signals, lang, "stale"),
      category: topic.category,
      tags: topic.tags,
      score: baseScore + 2,
      stats: { replyCount: topic.replyCount, viewCount: topic.viewCount },
    });
  }

  if (topic.replyCount === 0 && topic.viewCount >= 20 && topic.type === "discussion") {
    items.push({
      targetType: "topic",
      targetId: topic.id,
      title: topic.title,
      summary: topic.summary,
      href: topicPath(topic),
      actionLabel: lang === "en" ? "Join" : "去参与",
      reason: buildParticipationReason(topic, signals, lang, "zeroReplyTopic"),
      category: topic.category,
      tags: topic.tags,
      score: baseScore - 4,
      stats: { replyCount: topic.replyCount, viewCount: topic.viewCount },
    });
  }

  return items
    .filter((item) => item.score > 24)
    .filter((item) => !signals.hiddenTopicIds.has(item.targetId));
}

async function listCommunityTaskParticipation(lang: Lang, signals: UserSignals): Promise<ParticipationRecommendation[]> {
  const rows = await query<TaskCandidateRow>(
    `
    SELECT
      tasks.id,
      tasks.title,
      tasks.description,
      tasks.task_type,
      tasks.priority,
      tasks.reward_policy_json,
      tasks.deadline_at,
      tasks.created_at,
      COUNT(task_submissions.id)::text AS submission_count
    FROM tasks
    LEFT JOIN task_submissions ON task_submissions.task_id = tasks.id
    WHERE tasks.visibility = 'public_community'
      AND tasks.executor_type IN ('user', 'any')
      AND tasks.status = 'open'
    GROUP BY tasks.id
    ORDER BY
      CASE tasks.priority WHEN 'P0' THEN 0 WHEN 'P1' THEN 1 WHEN 'P2' THEN 2 ELSE 3 END,
      tasks.created_at DESC
    LIMIT 80
    `,
  );

  return rows.map((row) => {
    const reward = parseReward(row.reward_policy_json);
    const base = row.priority === "P0" ? 86 : row.priority === "P1" ? 76 : 64;
    const skillBoost = taskSkillBoost(row, signals);
    return {
      targetType: "community_task" as const,
      targetId: row.id,
      title: row.title,
      summary: row.description,
      href: `/agent-zone/tasks/${row.id}`,
      actionLabel: lang === "en" ? "Claim task" : "领取任务",
      reason: lang === "en" ? "Open community task that matches your interests." : "这是开放社区任务，适合直接领取推进。",
      tags: [],
      score: clamp(base + skillBoost - Number(row.submission_count || 0) * 4, 0, 100),
      stats: {
        submissionCount: Number(row.submission_count || 0),
        rewardLabel: reward,
      },
    };
  });
}

function participationScore(topic: Topic, aggregate: TopicAggregate, signals: UserSignals, ability: number, need: number, quality: number) {
  const communityValue = Math.min(100, topic.viewCount * 0.24 + aggregate.bookmarkCount * 14 + aggregate.likeCount * 8 + quality * 0.35);
  const fresh = freshnessScore(topic.lastActivityAt);
  const reward = topic.isFeatured ? 70 : 30;
  const relation = signals.followedUserIds.has(topic.authorId)
    || signals.followedCategoryIds.has(topic.category.id)
    || topic.tags.some((tag) => signals.followedTagIds.has(tag.id))
    ? 72
    : 26;
  const already = signals.repliedTopicIds.has(topic.id) ? 32 : 0;
  const negative = negativePenaltyForTopic(topic, signals);
  const risk = Math.max(aggregate.riskPenalty || 0, aggregate.reportCount * 18);

  return clamp(Math.round(
    ability * 0.3
      + need * 0.26
      + communityValue * 0.2
      + fresh * 0.1
      + reward * 0.06
      + relation * 0.04
      + 28 * 0.04
      - already
      - negative
      - risk,
  ), 0, 100);
}

function scoreReasonFromTag(topic: Topic, signals: UserSignals) {
  const tag = topic.tags
    .map((item) => ({ tag: item, weight: signals.tagWeights.get(item.slug) || 0 }))
    .sort((a, b) => b.weight - a.weight)[0];

  return tag && tag.weight > 0 ? `#${tag.tag.name}` : "";
}

function buildSeeReasons(topic: Topic, signals: UserSignals, interest: number, quality: number, engagement: number) {
  const reasons: string[] = [];
  const tagReason = scoreReasonFromTag(topic, signals);

  if (tagReason) {
    reasons.push(`因为你关注 ${tagReason}`);
  } else if (signals.categoryWeights.get(topic.category.slug)) {
    reasons.push(`因为你常看 ${topic.category.name}`);
  } else if (signals.followedUserIds.has(topic.authorId)) {
    reasons.push("你关注的作者");
  }

  if (topic.isFeatured || quality >= 76) {
    reasons.push("社区精选");
  }

  if (engagement >= 70) {
    reasons.push("今天升温");
  } else if (freshnessScore(topic.publishedAt) >= 82) {
    reasons.push("新内容");
  }

  if (interest < 15 && reasons.length === 0) {
    reasons.push("值得探索");
  }

  return reasons.slice(0, 2);
}

function buildReadingReasons(
  currentTopic: Topic,
  topic: Topic,
  signals: UserSignals,
  lang: Lang,
  affinity: number,
  interest: number,
  quality: number,
  engagement: number,
) {
  const reasons: string[] = [];
  const currentTagSlugs = new Set(currentTopic.tags.map((tag) => tag.slug));
  const sharedTag = topic.tags.find((tag) => currentTagSlugs.has(tag.slug));
  const interestTag = scoreReasonFromTag(topic, signals);

  if (sharedTag) {
    reasons.push(lang === "en" ? `More on #${sharedTag.name}` : `延续 #${sharedTag.name}`);
  } else if (topic.category.slug === currentTopic.category.slug) {
    reasons.push(lang === "en" ? `More in ${topic.category.name}` : `同分类延伸`);
  } else if (topic.authorId === currentTopic.authorId) {
    reasons.push(lang === "en" ? "Same author" : "同作者内容");
  } else if (affinity >= 34) {
    reasons.push(lang === "en" ? "Related context" : "语境相关");
  }

  if (interestTag && interest >= 20) {
    reasons.push(lang === "en" ? `Matches ${interestTag}` : `匹配你的 ${interestTag}`);
  } else if (interest >= 28) {
    reasons.push(lang === "en" ? "Matches your interests" : "匹配你的兴趣");
  }

  if (topic.isFeatured || quality >= 76) {
    reasons.push(lang === "en" ? "Community pick" : "社区精选");
  }

  if (engagement >= 70) {
    reasons.push(lang === "en" ? "Trending now" : "正在升温");
  } else if (freshnessScore(topic.publishedAt) >= 82) {
    reasons.push(lang === "en" ? "New content" : "新内容");
  }

  if (reasons.length === 0) {
    reasons.push(lang === "en" ? "Worth exploring" : "值得探索");
  }

  return [...new Set(reasons)].slice(0, 3);
}

function diversifyReadingRecommendations(items: ReadingRecommendation[], limit: number) {
  const pending = [...items].sort((a, b) => b.score - a.score || timestamp(b.topic.lastActivityAt) - timestamp(a.topic.lastActivityAt));
  const selected: ReadingRecommendation[] = [];
  const categoryCounts = new Map<string, number>();
  const authorCounts = new Map<number, number>();

  while (pending.length > 0 && selected.length < limit) {
    let bestIndex = 0;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (const [index, item] of pending.entries()) {
      const categoryPenalty = (categoryCounts.get(item.topic.category.slug) || 0) * 7;
      const authorPenalty = (authorCounts.get(item.topic.authorId) || 0) * 5;
      const adjustedScore = item.score - categoryPenalty - authorPenalty;

      if (adjustedScore > bestScore) {
        bestScore = adjustedScore;
        bestIndex = index;
      }
    }

    const [item] = pending.splice(bestIndex, 1);
    if (!item) {
      break;
    }

    selected.push(item);
    categoryCounts.set(item.topic.category.slug, (categoryCounts.get(item.topic.category.slug) || 0) + 1);
    authorCounts.set(item.topic.authorId, (authorCounts.get(item.topic.authorId) || 0) + 1);
  }

  return selected;
}

function buildParticipationReason(topic: Topic, signals: UserSignals, lang: Lang, kind: string) {
  const tagReason = scoreReasonFromTag(topic, signals);

  if (tagReason) {
    return lang === "en" ? `Matches your interest in ${tagReason}.` : `和你常看的 ${tagReason} 相关。`;
  }

  if (signals.categoryWeights.get(topic.category.slug)) {
    return lang === "en" ? `You often read ${topic.category.name}.` : `你经常关注「${topic.category.name}」分类。`;
  }

  const zh: Record<string, string> = {
    zeroReplyQuestion: "这个问题还没人回答，适合抢先补上经验。",
    lowReplyQuestion: "这个问题仍然缺少更多角度。",
    projectFeedback: "这是项目展示，作者正在等具体反馈。",
    resourceSupplement: "这个资源内容还可以继续补充。",
    stale: "这个内容可能需要更新。",
    zeroReplyTopic: "这个讨论有浏览但还没人接话。",
  };
  const en: Record<string, string> = {
    zeroReplyQuestion: "This question has no answers yet.",
    lowReplyQuestion: "This question still needs more perspectives.",
    projectFeedback: "This project is waiting for concrete feedback.",
    resourceSupplement: "This resource can use more additions.",
    stale: "This content may need an update.",
    zeroReplyTopic: "This discussion has views but no replies.",
  };

  return (lang === "en" ? en : zh)[kind] || (lang === "en" ? "Worth joining." : "值得参与。");
}

function matchFollowingSource(topic: Topic, follows: FollowRow[]) {
  let match: FollowMatch | undefined;

  for (const follow of follows) {
    if (follow.target_type === "topic" && follow.target_id === topic.id) {
      match = chooseFollowMatch(match, { sourceType: "topic", sourceLabel: "关注的话题", strength: 100 });
    } else if (follow.target_type === "user" && follow.target_id === topic.authorId) {
      match = chooseFollowMatch(match, { sourceType: "user", sourceLabel: topic.author.displayName, strength: 84 });
    } else if (follow.target_type === "category" && follow.target_id === topic.category.id) {
      match = chooseFollowMatch(match, { sourceType: "category", sourceLabel: topic.category.name, strength: 68 });
    } else if (follow.target_type === "tag") {
      const tag = topic.tags.find((item) => item.id === follow.target_id);
      if (tag) {
        match = chooseFollowMatch(match, { sourceType: "tag", sourceLabel: `#${tag.name}`, strength: 76 });
      }
    }
  }

  return match;
}

function chooseFollowMatch(current: FollowMatch | undefined, next: FollowMatch) {
  return !current || next.strength > current.strength ? next : current;
}

function followingFilterMatches(filter: FollowingFilter, targetType: FollowRow["target_type"]) {
  if (filter === "all") return true;
  if (filter === "topics") return targetType === "topic";
  if (filter === "users") return targetType === "user";
  if (filter === "categories") return targetType === "category";
  if (filter === "tags") return targetType === "tag";
  return true;
}

function participationFilterMatches(filter: ParticipationFilter, item: ParticipationRecommendation) {
  if (filter === "all") return true;
  if (filter === "questions") return item.targetType === "question";
  if (filter === "feedback") return item.targetType === "project";
  if (filter === "tasks") return item.targetType === "community_task";
  if (filter === "supplement") return item.targetType === "resource" || item.targetType === "review_needed";
  if (filter === "stale") return item.targetType === "stale_content";
  return true;
}

function interestScore(topic: Topic, signals: UserSignals) {
  let score = 0;
  score += Math.min(32, (signals.categoryWeights.get(topic.category.slug) || 0) * 1.55);
  score += Math.min(42, topic.tags.reduce((sum, tag) => sum + (signals.tagWeights.get(tag.slug) || 0), 0) * 1.28);
  score += Math.min(16, (signals.topicTypeWeights.get(topic.type) || 0) * 1.4);
  score += Math.min(14, (signals.authorWeights.get(topic.authorId) || 0) * 1.3);

  if (signals.followedTopicIds.has(topic.id)) score += 28;
  if (signals.followedCategoryIds.has(topic.category.id)) score += 18;
  if (topic.tags.some((tag) => signals.followedTagIds.has(tag.id))) score += 18;
  if (signals.followedUserIds.has(topic.authorId)) score += 14;

  return clamp(Math.round(score), 0, 100);
}

function negativePenaltyForTopic(topic: Topic, signals: UserSignals) {
  if (signals.hiddenTopicIds.has(topic.id)) {
    return 100;
  }

  let penalty = 0;
  penalty += signals.negativeCategories.get(topic.category.slug) || 0;
  penalty += signals.negativeTopicTypes.get(topic.type) || 0;
  penalty += signals.negativeAuthors.get(topic.authorId) || 0;
  penalty += topic.tags.reduce((sum, tag) => sum + (signals.negativeTags.get(tag.slug) || 0), 0);
  return Math.min(85, penalty);
}

function qualityScore(topic: Topic, aggregate: TopicAggregate) {
  if (typeof aggregate.qualityScore === "number" && aggregate.qualityScore > 0) {
    return aggregate.qualityScore;
  }

  let score = 46;
  if (topic.isFeatured) score += 18;
  if (topic.isPinned) score += 10;
  if (topic.summary.trim().length >= 32) score += 5;
  if (topic.tags.length > 0) score += 4;
  score += Math.min(12, aggregate.bookmarkCount * 4);
  score += Math.min(10, aggregate.likeCount * 3);
  score += Math.min(12, topic.replyCount * 2);
  score += Math.min(8, topic.viewCount / 24);
  score -= Math.min(42, aggregate.reportCount * 18);
  return clamp(Math.round(score), 0, 100);
}

function participationNeedScore(topic: Topic, aggregate: TopicAggregate) {
  if (typeof aggregate.participationNeedScore === "number" && aggregate.participationNeedScore > 0) {
    return aggregate.participationNeedScore;
  }

  if (topic.type === "question" && topic.replyCount === 0) return 94;
  if (topic.type === "question" && topic.replyCount <= 2) return 78;
  if (topic.type === "project" && topic.replyCount <= 2) return 82;
  if (topic.replyCount === 0 && topic.viewCount > 20) return 66;
  if (topic.type === "resource" && topic.replyCount <= 2) return 58;
  return 24;
}

function freshnessScore(value: string) {
  const ageHours = Math.max(0, (Date.now() - timestamp(value)) / 36e5);
  if (ageHours <= 6) return 100;
  if (ageHours <= 24) return 88;
  if (ageHours <= 72) return 70;
  if (ageHours <= 168) return 52;
  if (ageHours <= 720) return 34;
  return 16;
}

function staleScore(topic: Topic) {
  const ageDays = Math.max(0, (Date.now() - timestamp(topic.updatedAt || topic.lastActivityAt)) / 864e5);
  const staleType = topic.type === "article" || topic.type === "resource" || topic.category.slug === "docs" || topic.category.slug === "resources";

  if (!staleType) {
    return 0;
  }

  if (ageDays >= 120) return 86;
  if (ageDays >= 60) return 68;
  if (ageDays >= 35) return 52;
  return 0;
}

function hotScore(topic: Topic, aggregate: TopicAggregate | undefined) {
  const stats = aggregate || emptyAggregate();
  return topic.replyCount * 8 + topic.viewCount + stats.likeCount * 10 + stats.bookmarkCount * 14 + (topic.isFeatured ? 60 : 0);
}

function followStrength(value: FollowingFeedItem["sourceType"]) {
  if (value === "topic") return 100;
  if (value === "user") return 84;
  if (value === "tag") return 76;
  return 68;
}

function addTopicInterest(signals: UserSignals, topic: Topic, weight: number) {
  addWeight(signals.categoryWeights, topic.category.slug, weight);
  addWeight(signals.topicTypeWeights, topic.type, Math.round(weight * 0.72));
  addWeight(signals.authorWeights, topic.authorId, Math.round(weight * 0.5));

  for (const tag of topic.tags) {
    addWeight(signals.tagWeights, tag.slug, weight);
  }
}

function addWeight<K>(map: Map<K, number>, key: K, value: number) {
  map.set(key, (map.get(key) || 0) + value);
}

function createEmptySignals(): UserSignals {
  return {
    categoryWeights: new Map(),
    tagWeights: new Map(),
    topicTypeWeights: new Map(),
    authorWeights: new Map(),
    negativeCategories: new Map(),
    negativeTags: new Map(),
    negativeAuthors: new Map(),
    negativeTopicTypes: new Map(),
    hiddenTopicIds: new Set(),
    followedTopicIds: new Set(),
    followedUserIds: new Set(),
    followedCategoryIds: new Set(),
    followedTagIds: new Set(),
    bookmarkedTopicIds: new Set(),
    likedTopicIds: new Set(),
    repliedTopicIds: new Set(),
  };
}

function emptyAggregate(): TopicAggregate {
  return {
    likeCount: 0,
    bookmarkCount: 0,
    reportCount: 0,
  };
}

function ensureAggregate(map: Map<number, TopicAggregate>, topicId: number) {
  let aggregate = map.get(topicId);
  if (!aggregate) {
    aggregate = emptyAggregate();
    map.set(topicId, aggregate);
  }
  return aggregate;
}

async function loadEventTargetContext(targetType: string, targetId: number) {
  const empty = {
    categoryId: null as number | null,
    tagSlugs: [] as string[],
    topicType: "",
    authorId: null as number | null,
  };

  if (targetType === "topic") {
    const row = await queryOne<{
      category_id: number;
      topic_type: TopicType;
      author_id: number;
      tag_slugs_json: string;
    }>(
      `
      SELECT
        topics.category_id,
        topics.type AS topic_type,
        topics.author_id,
        COALESCE(json_agg(tags.slug) FILTER (WHERE tags.slug IS NOT NULL), '[]')::text AS tag_slugs_json
      FROM topics
      LEFT JOIN topic_tags ON topic_tags.topic_id = topics.id
      LEFT JOIN tags ON tags.id = topic_tags.tag_id
      WHERE topics.id = $1
      GROUP BY topics.id
      LIMIT 1
      `,
      [targetId],
    );

    if (!row) return empty;
    return {
      categoryId: row.category_id,
      tagSlugs: safeJsonArray(row.tag_slugs_json),
      topicType: row.topic_type,
      authorId: row.author_id,
    };
  }

  if (targetType === "post") {
    const row = await queryOne<{
      category_id: number;
      topic_type: TopicType;
      author_id: number;
      tag_slugs_json: string;
    }>(
      `
      SELECT
        topics.category_id,
        topics.type AS topic_type,
        topics.author_id,
        COALESCE(json_agg(tags.slug) FILTER (WHERE tags.slug IS NOT NULL), '[]')::text AS tag_slugs_json
      FROM posts
      INNER JOIN topics ON topics.id = posts.topic_id
      LEFT JOIN topic_tags ON topic_tags.topic_id = topics.id
      LEFT JOIN tags ON tags.id = topic_tags.tag_id
      WHERE posts.id = $1
      GROUP BY topics.id
      LIMIT 1
      `,
      [targetId],
    );

    if (!row) return empty;
    return {
      categoryId: row.category_id,
      tagSlugs: safeJsonArray(row.tag_slugs_json),
      topicType: row.topic_type,
      authorId: row.author_id,
    };
  }

  return empty;
}

function eventWeight(eventType: string, dwellSeconds?: number) {
  if (eventType === "view") return 1;
  if (eventType === "dwell") return dwellSeconds && dwellSeconds >= 120 ? 4 : dwellSeconds && dwellSeconds >= 30 ? 2 : 1;
  if (eventType === "search_click") return 5;
  if (eventType === "recommendation_click") return 4;
  if (eventType === "like") return 5;
  if (eventType === "bookmark") return 9;
  if (eventType === "reply") return 10;
  if (eventType === "topic_create") return 12;
  if (eventType === "follow") return 14;
  if (eventType === "task_claim") return 10;
  if (eventType === "task_submit") return 16;
  if (eventType === "hide") return -12;
  if (eventType === "dismiss") return -6;
  if (eventType === "report") return -18;
  if (eventType === "block") return -30;
  return 0;
}

function normalizeEventType(value: string) {
  const allowed = new Set([
    "view",
    "dwell",
    "search_click",
    "recommendation_click",
    "like",
    "bookmark",
    "reply",
    "topic_create",
    "follow",
    "hide",
    "dismiss",
    "report",
    "block",
    "task_claim",
    "task_submit",
  ]);
  return allowed.has(value) ? value : "";
}

function normalizeTargetType(value: string) {
  const allowed = new Set(["topic", "post", "category", "tag", "user", "task"]);
  return allowed.has(value) ? value : "";
}

function normalizeSurface(value: string | undefined) {
  if (value === "see" || value === "go" || value === "following" || value === "related" || value === "reading" || value === "search") {
    return value;
  }

  return "";
}

function hasAnyTag(topic: Topic, slugs: string[]) {
  return topic.tags.some((tag) => slugs.includes(tag.slug));
}

function taskSkillBoost(row: TaskCandidateRow, signals: UserSignals) {
  const text = `${row.title} ${row.description} ${row.task_type}`.toLowerCase();
  let score = 0;

  for (const [tag, weight] of signals.tagWeights) {
    if (text.includes(tag.toLowerCase())) {
      score += Math.min(18, weight);
    }
  }

  return Math.min(24, score);
}

function parseReward(value: string) {
  try {
    const data = JSON.parse(value || "{}") as { label?: string; amount?: number; rewardType?: string };
    if (data.label) return data.label;
    if (data.amount) return `${data.amount}`;
  } catch {
    return "";
  }

  return "";
}

function safeJsonArray(value: string) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed.map((item) => String(item || "")).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function mapToObject<K extends string | number>(map: Map<K, number>) {
  return [...map.entries()].reduce<Record<string, number>>((acc, [key, value]) => {
    acc[String(key)] = value;
    return acc;
  }, {});
}

function normalizeLimit(value: number | undefined, fallback: number) {
  return Math.max(1, Math.min(Number(value || fallback), 100));
}

function normalizeOffset(value: number | undefined) {
  return Math.max(0, Math.round(Number(value || 0)));
}

function timestamp(value: string) {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
