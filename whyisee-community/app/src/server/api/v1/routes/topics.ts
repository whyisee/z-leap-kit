import { Hono } from "hono";
import { isAdmin } from "@lib/auth";
import { getTopicById, listRelatedTopics } from "@server/services/topics";
import { getPostForEdit, listPostsForTopic, topicHref, createPost } from "@server/services/posts";
import { getTopicInteractionState, listPostInteractionStats } from "@server/services/interactions";
import { recordUserContentEvent, listReadingRecommendations } from "@server/services/recommendations";
import { withIdempotency } from "@server/services/appIdempotency";
import { takeToken } from "@lib/rateLimit";
import { fail, intParam, langOf, ok, type ApiEnv } from "../http";
import { optionalAuth, requireAuth, sessionOf } from "../middleware";
import { toAuthor, toCategory, toFeedItem, toPostDto, toTag } from "../serializers";

const topics = new Hono<ApiEnv>();

const writeRateLimit = { limit: 30, windowMs: 60 * 1000 };

/**
 * 详情聚合：客户端打开帖子只发一次请求。
 * 回帖互动状态用批量 SQL，避免网页版那种每帖两次查询的 N+1。
 */
topics.get("/:id", optionalAuth, async (c) => {
  const id = intParam(c.req.param("id"));
  if (id <= 0) return fail(c, "validation_failed", "话题 id 不合法");

  const session = sessionOf(c);
  const lang = langOf(c);
  const topic = await getTopicById(id, lang);

  if (!topic) return fail(c, "not_found", "话题不存在");

  // updatedAt 是 PG 的 timestamp 字符串（含空格），空格在 ETag 里不合法，压成纯数字/字母
  const stamp = String(Date.parse(topic.updatedAt) || topic.updatedAt).replace(/[^0-9A-Za-z]/g, "");
  const etag = `W/"${topic.id}-${stamp}"`;
  if (c.req.header("if-none-match") === etag) {
    return c.body(null, 304);
  }

  const [posts, interaction, related, readingCandidates] = await Promise.all([
    listPostsForTopic(topic.id, session?.userId, lang),
    getTopicInteractionState(topic.id, session?.userId),
    listRelatedTopics(topic, 4, lang),
    // 「滑到底继续滑」的候选池。网页版一次渲染 12 条，客户端也拿一批，
    // 由客户端自己按已读栈去重 —— 只给 1 条会退化成 A→B→A 打转。
    listReadingRecommendations({ topic, userId: session?.userId, lang, limit: 12 }),
  ]);

  const stats = await listPostInteractionStats(
    posts.map((post) => post.id),
    session?.userId,
  );

  const canEdit = Boolean(session && (session.userId === topic.authorId || isAdmin(session)));

  c.header("etag", etag);
  c.header("cache-control", "private, no-cache");

  return ok(c, {
    topic: {
      ...toFeedItem(topic),
      contentHtml: topic.contentHtml,
      status: topic.status,
    },
    posts: posts.map((post) => toPostDto(post, stats.get(post.id))),
    interactions: interaction,
    me: {
      authenticated: Boolean(session),
      canReply: Boolean(session),
      canEdit,
    },
    related: related.map((item) => ({
      id: item.id,
      title: item.title,
      replyCount: item.replyCount,
      lastActivityAt: item.lastActivityAt || null,
      category: toCategory(item.category),
      tags: (item.tags || []).map(toTag),
      author: toAuthor(item.author),
    })),
    // 下一篇候选（按服务端推荐分排序，已排除推荐池外的低分项）。
    // 客户端按自己的已读队列挑第一条没读过的；啃光了再调 /:id/next 换新。
    nextCandidates: readingCandidates.map((item) => ({
      id: item.targetId,
      title: item.topic.title,
      summary: item.topic.summary,
      replyCount: item.topic.replyCount,
    })),
  });
});

/**
 * 候选池补充：客户端把当前这篇算出来的 12 条啃完后调用，
 * 用 exclude 把自己读过的排除掉，避免又转回同一批。
 */
topics.get("/:id/next", optionalAuth, async (c) => {
  const id = intParam(c.req.param("id"));
  if (id <= 0) return fail(c, "validation_failed", "话题 id 不合法");

  const session = sessionOf(c);
  const lang = langOf(c);
  const topic = await getTopicById(id, lang);
  if (!topic) return fail(c, "not_found", "话题不存在");

  const limit = Math.min(Math.max(intParam(c.req.query("limit"), 12), 1), 24);
  const exclude = readIdList(c.req.query("exclude"));

  const items = await listReadingRecommendations({
    topic,
    userId: session?.userId,
    lang,
    limit,
    excludeTopicIds: exclude,
  });

  return ok(c, {
    items: items.map((item) => ({
      id: item.targetId,
      title: item.topic.title,
      summary: item.topic.summary,
      replyCount: item.topic.replyCount,
    })),
  });
});

/** `?exclude=1,2,3`，最多认 60 个，防止超长 query */
function readIdList(value: string | undefined) {
  return String(value || "")
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item) && item > 0)
    .slice(0, 60);
}

topics.post("/:id/posts", requireAuth, async (c) => {
  const session = c.get("session");
  const topicId = intParam(c.req.param("id"));
  if (topicId <= 0) return fail(c, "validation_failed", "话题 id 不合法");

  const limit = takeToken(`write:${session.userId}`, writeRateLimit.limit, writeRateLimit.windowMs);
  if (!limit.allowed) {
    c.header("retry-after", String(limit.retryAfterSeconds));
    return fail(c, "rate_limited", "发得太频繁，稍等一会儿");
  }

  const body = await readJson<{
    contentMarkdown?: string;
    parentPostId?: number;
    clientRequestId?: string;
  }>(c.req.raw);

  const contentMarkdown = String(body?.contentMarkdown || "").trim();

  if (!contentMarkdown) {
    return fail(c, "validation_failed", "内容不能为空", { contentMarkdown: "必填" });
  }

  const parentPostId = Number(body?.parentPostId || 0) || undefined;

  if (parentPostId) {
    // 父帖必须属于同一个话题，否则会把回复挂到别处
    const parent = await getPostForEdit(parentPostId);
    if (!parent || parent.topicId !== topicId) {
      return fail(c, "validation_failed", "被回复的内容不存在", { parentPostId: "无效" });
    }
  }

  const topic = await getTopicById(topicId, langOf(c));
  if (!topic) return fail(c, "not_found", "话题不存在");

  const { result, replayed } = await withIdempotency({
    key: body?.clientRequestId ?? null,
    userId: session.userId,
    scope: `post:${topicId}`,
    run: () =>
      createPost({
        topicId,
        parentPostId,
        authorId: session.userId,
        contentMarkdown,
      }),
  });

  if (!replayed) {
    await recordUserContentEvent({
      userId: session.userId,
      eventType: "reply",
      targetType: "topic",
      targetId: topicId,
      sourceSurface: "app",
    });
  }

  const created = await getPostForEdit(result.postId);
  c.header("x-idempotent-replay", replayed ? "1" : "0");

  return ok(c, {
    postId: result.postId,
    topicId: result.topicId,
    href: topicHref(result.topicId, result.topicSlug, `post-${result.postId}`),
    post: created ? toPostDto(created, { likeCount: 0, liked: false }) : null,
  });
});

async function readJson<T>(request: Request): Promise<T | undefined> {
  try {
    return (await request.json()) as T;
  } catch {
    return undefined;
  }
}

export default topics;
