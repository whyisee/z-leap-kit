import { Hono } from "hono";
import { isAdmin } from "@lib/auth";
import type { TopicType } from "@lib/types";
import {
  getTopicById,
  getTopicByIdForAdmin,
  listRelatedTopics,
  createTopic,
  updateTopic,
  updateTopicAdminState,
} from "@server/services/topics";
import { listCategories } from "@server/services/categories";
import { notifyAdmins } from "@server/services/notifications";
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

/**
 * 编辑前取原文。
 *
 * 为什么不把 markdown 塞进详情接口：详情是公开的，读者不需要正文源码，
 * 发了只是多一份可以被抓走的内容。这里单独一条，作者本人和管理员才拿得到。
 */
topics.get("/:id/edit", requireAuth, async (c) => {
  const id = intParam(c.req.param("id"));
  const session = c.get("session");

  if (id <= 0) return fail(c, "validation_failed", "话题 id 不合法");

  const topic = await getTopicByIdForAdmin(id);

  if (!topic || (topic.authorId !== session.userId && !isAdmin(session))) {
    return fail(c, "not_found", "话题不存在");
  }

  return ok(c, {
    topic: {
      id: topic.id,
      title: topic.title,
      contentMarkdown: topic.contentMarkdown,
      categoryId: topic.category?.id ?? null,
      type: topic.type,
      status: topic.status,
      tags: (topic.tags || []).map((tag) => tag.name),
    },
  });
});

/**
 * 保存编辑。
 *
 * 用 POST 而不是 PATCH：Astro 的跨站防护会拦掉不带 Origin 头的非常规方法，
 * 而原生请求根本不会带 Origin（`/me/agents/:id/unbind` 已经踩过一次）。
 *
 * 状态规则和网页一致：普通作者改完回到 `pending` 重新审核，管理员可以直接
 * `published`。App 里没有「存草稿」这个动作 —— 编辑页是从一篇已存在的文章
 * 进的，把线上文章改回草稿没有意义。
 */
topics.post("/:id/update", requireAuth, async (c) => {
  const id = intParam(c.req.param("id"));
  const session = c.get("session");

  if (id <= 0) return fail(c, "validation_failed", "话题 id 不合法");

  const topic = await getTopicByIdForAdmin(id);

  if (!topic || (topic.authorId !== session.userId && !isAdmin(session))) {
    return fail(c, "not_found", "话题不存在");
  }

  const body = await readJson<{
    title?: string;
    summary?: string;
    contentMarkdown?: string;
    categoryId?: number;
    type?: string;
    tags?: string[];
    status?: string;
  }>(c.req.raw);

  const title = String(body?.title || "").trim();
  const contentMarkdown = String(body?.contentMarkdown || "").trim();
  const categoryId = Number(body?.categoryId || 0);

  if (title.length < 4) return fail(c, "validation_failed", "标题至少 4 个字");
  if (contentMarkdown.length < 10) return fail(c, "validation_failed", "正文至少 10 个字");
  if (!Number.isFinite(categoryId) || categoryId <= 0) {
    return fail(c, "validation_failed", "选一个分区");
  }

  const allowedTypes: TopicType[] = [
    "discussion",
    "question",
    "article",
    "project",
    "resource",
    "announcement",
  ];
  const type: TopicType = allowedTypes.find((item) => item === body?.type) ?? "discussion";

  const status =
    isAdmin(session) && body?.status === "published" ? "published" : "pending";

  try {
    await updateTopic(topic.id, {
      title,
      slug: topic.slug,
      summary: String(body?.summary || "").trim(),
      contentMarkdown,
      authorId: topic.authorId,
      categoryId,
      type,
      status,
      isPinned: topic.isPinned,
      isFeatured: topic.isFeatured,
      tags: Array.isArray(body?.tags) ? body!.tags!.map(String).filter(Boolean).slice(0, 5) : [],
    });
  } catch (error) {
    console.error("Failed to update topic from app", error);
    return fail(c, "server_error", "保存失败，稍后再试");
  }

  return ok(c, { id: topic.id, status });
});

/**
 * 删除（软删）。和网页后台同一个动作：status 改 `deleted`，数据和回复都还在。
 *
 * 只用 POST，理由同 `/:id/update`。
 */
topics.post("/:id/delete", requireAuth, async (c) => {
  const id = intParam(c.req.param("id"));
  const session = c.get("session");

  if (id <= 0) return fail(c, "validation_failed", "话题 id 不合法");

  const topic = await getTopicByIdForAdmin(id);

  if (!topic || (topic.authorId !== session.userId && !isAdmin(session))) {
    return fail(c, "not_found", "话题不存在");
  }

  await updateTopicAdminState(topic.id, { status: "deleted" });

  return ok(c, { deleted: true });
});

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

const topicTypes = new Set(["discussion", "question", "article", "project", "resource"]);

/**
 * 原生发帖。和网页 `/api/topics` 走同一个 `createTopic`，审核规则也一致：
 * 普通用户只能 `draft` 或 `pending`，管理员才能直接发。
 */
topics.post("/", requireAuth, async (c) => {
  const session = c.get("session");

  const limit = takeToken(`write:${session.userId}`, writeRateLimit.limit, writeRateLimit.windowMs);
  if (!limit.allowed) {
    c.header("retry-after", String(limit.retryAfterSeconds));
    return fail(c, "rate_limited", "发得太频繁，稍等一会儿");
  }

  const body = await readJson<{
    title?: string;
    contentMarkdown?: string;
    summary?: string;
    categoryId?: number;
    type?: string;
    tags?: string[];
    status?: string;
    clientRequestId?: string;
  }>(c.req.raw);

  const title = String(body?.title || "").trim();
  const contentMarkdown = String(body?.contentMarkdown || "").trim();

  if (title.length < 4) {
    return fail(c, "validation_failed", "标题至少 4 个字", { title: "太短" });
  }
  if (title.length > 120) {
    return fail(c, "validation_failed", "标题最多 120 个字", { title: "太长" });
  }
  if (contentMarkdown.length < 10) {
    return fail(c, "validation_failed", "正文至少 10 个字", { contentMarkdown: "太短" });
  }

  const categories = await listCategories(langOf(c));
  const categoryId = Number(body?.categoryId || 0);
  if (!categories.some((category) => category.id === categoryId)) {
    return fail(c, "validation_failed", "选一个分类", { categoryId: "无效" });
  }

  const type = topicTypes.has(String(body?.type)) ? String(body?.type) : "discussion";
  // 和网页版 readSubmissionStatus(formData, isAdmin) 同一套规则：显式要草稿就是草稿，
  // 否则管理员直接发，普通用户进待审。之前这里不看角色，导致站长自己在 App 里发帖
  // 也得等审核，而 App 里的文章列表只认 published —— 发完就「不见了」。
  const status = body?.status === "draft" ? "draft" : isAdmin(session) ? "published" : "pending";

  const tags = Array.isArray(body?.tags)
    ? body!.tags!.map((tag) => String(tag || "").trim()).filter(Boolean).slice(0, 5)
    : [];

  const { result, replayed } = await withIdempotency({
    key: body?.clientRequestId ?? null,
    userId: session.userId,
    scope: "topic:create",
    run: () =>
      createTopic({
        title,
        slug: "",
        summary: String(body?.summary || "").trim() || buildSummary(contentMarkdown),
        contentMarkdown,
        authorId: session.userId,
        categoryId,
        type: type as "discussion" | "question" | "article" | "project" | "resource",
        status: status as "draft" | "pending",
        isPinned: false,
        isFeatured: false,
        tags,
      }),
  });

  if (!replayed) {
    if (status === "pending") {
      await notifyAdmins({
        actorId: session.userId,
        type: "topic_pending",
        targetType: "topic",
        targetId: result,
        title: "新的待审核话题",
        body: title,
        href: "/admin?status=pending",
      });
    }

    await recordUserContentEvent({
      userId: session.userId,
      eventType: "topic_create",
      targetType: "topic",
      targetId: result,
      sourceSurface: "app",
    });
  }

  c.header("x-idempotent-replay", replayed ? "1" : "0");

  return ok(c, {
    id: result,
    status,
    // 只有 pending 拿不到可点链接（还没公开，点进去 404）；草稿和已发布都能看
    href: status === "pending" ? null : topicHref(result, ""),
  });
});

/** 和网页 `/api/topics` 的摘要生成保持一致，别让两边摘要长度不同。 */
function buildSummary(contentMarkdown: string): string {
  return contentMarkdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[[^\]]+]\([^)]*\)/g, "$1")
    .replace(/[#>*_`~|[\](){}-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140);
}

export default topics;
