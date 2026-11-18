import { Hono } from "hono";
import { isTreeHoleCategorySlug } from "@lib/anonymous";
import { queryOne } from "@server/db/client";
import { listTopics } from "@server/services/topics";
import { getUserById, listUserTopics } from "@server/services/users";
import { getUserGrowthProfile } from "@server/services/reputation";
import { getUserFollowStats } from "@server/services/interactions";
import { fail, langOf, ok, type ApiEnv } from "../http";
import { requireAuth, sessionOf } from "../middleware";
import { toFeedItem } from "../serializers";
import todoRoutes from "./todo";
import settingsRoutes from "./settings";

const me = new Hono<ApiEnv>();

me.use("*", requireAuth);

// 「出发」页的数据：我该做的事，和「我」页共用登录守卫
me.route("/todo", todoRoutes);
// 设置页：公开资料 / 改密码 / Agent 设备（都在 /api/v1/me 下，天然只有本人能进）
me.route("/", settingsRoutes);

/**
 * 「我」页一次拿全：资料 + 统计 + 最近话题。
 *
 * 统计口径直接复用网页版 service（reputation / interactions），
 * 不另写 SQL —— 否则 App 和网页会出现两个不同的数字。
 */
me.get("/overview", async (c) => {
  const session = sessionOf(c);
  if (!session) return fail(c, "unauthorized", "请先登录");

  const lang = langOf(c);

  const [user, growth, follows, topics, unread, unpublished] = await Promise.all([
    getUserById(session.userId),
    getUserGrowthProfile(session.userId),
    getUserFollowStats(session.userId),
    listUserTopics(session.userId, lang, false),
    queryOne<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM notifications WHERE user_id = $1 AND read_at IS NULL",
      [session.userId],
    ),
    // 待审核 + 草稿的数量：首页和「我的话题」都不显示这些，得让「我」页能提示
    queryOne<{ pending: string; draft: string }>(
      `
      SELECT
        COUNT(*) FILTER (WHERE status = 'pending')::text AS pending,
        COUNT(*) FILTER (WHERE status = 'draft')::text AS draft
      FROM topics
      WHERE author_id = $1 AND status IN ('pending', 'draft')
      `,
      [session.userId],
    ),
  ]);

  return ok(c, {
    user: {
      id: session.userId,
      username: user?.username ?? session.username,
      displayName: user?.displayName ?? session.displayName,
      avatarUrl: user?.avatarUrl ?? session.avatarUrl,
      bio: user?.bio ?? "",
      websiteUrl: user?.websiteUrl ?? null,
      githubUrl: user?.githubUrl ?? null,
      locale: user?.locale ?? lang,
      role: user?.role ?? session.role,
      joinedAt: user?.createdAt ?? null,
    },
    stats: {
      topicCount: growth?.topicCount ?? topics.length,
      replyCount: growth?.replyCount ?? 0,
      featuredCount: growth?.featuredTopicCount ?? 0,
      badgeCount: growth?.badgeCount ?? 0,
      followerCount: follows.followerCount,
      followingCount: follows.followingCount,
      contributionScore: growth?.contributionScore ?? 0,
      trustLevel: growth?.trustLevel ?? 1,
      trustName: growth?.trustName ?? "",
      nextLevelScore: growth?.nextLevelScore ?? null,
      nextLevelName: growth?.nextLevelName ?? null,
    },
    // 勋章图标是站内的标识符（不是 emoji），客户端按 tone 上色即可
    badges: (growth?.badges ?? []).slice(0, 6).map((badge) => ({
      id: badge.id,
      name: badge.name,
      icon: badge.icon,
      tone: badge.tone,
    })),
    recentTopics: topics.slice(0, 6).map(toFeedItem),
    unreadCount: Number(unread?.count || 0),
    pendingCount: Number(unpublished?.pending || 0),
    draftCount: Number(unpublished?.draft || 0),
  });
});

/**
 * 「我的文章」：把自己还没公开的稿子也列出来。
 *
 * 首页和「我」页都只认 `published`，所以作者发完待审之后在 App 里一处都看不到
 * —— 分不清「发出去了在等审」还是「压根没发成功」。这一页就是那个缺口：
 * 带上 status，待审核 / 草稿都在这儿，点进去还能继续改。
 */
me.get("/topics", async (c) => {
  const session = sessionOf(c);
  if (!session) return fail(c, "unauthorized", "请先登录");

  const rows = await listTopics({
    authorId: session.userId,
    limit: 60,
    includeDrafts: true,
    lang: langOf(c),
  });

  // 软删的不进列表；树洞匿名帖和「我的话题」保持同一口径
  const items = rows.filter(
    (topic) => topic.status !== "deleted" && !isTreeHoleCategorySlug(topic.category.slug),
  );

  const counts = { published: 0, pending: 0, draft: 0 };
  for (const topic of items) {
    if (topic.status in counts) counts[topic.status as keyof typeof counts] += 1;
  }

  return ok(c, {
    items: items.map((topic) => ({
      ...toFeedItem(topic),
      status: topic.status,
      updatedAt: topic.updatedAt,
    })),
    counts,
  });
});

export default me;
