import { Hono } from "hono";
import { queryOne } from "@server/db/client";
import { getUserById, listUserTopics } from "@server/services/users";
import { getUserGrowthProfile } from "@server/services/reputation";
import { getUserFollowStats } from "@server/services/interactions";
import { fail, langOf, ok, type ApiEnv } from "../http";
import { requireAuth, sessionOf } from "../middleware";
import { toFeedItem } from "../serializers";

const me = new Hono<ApiEnv>();

me.use("*", requireAuth);

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

  const [user, growth, follows, topics, unread] = await Promise.all([
    getUserById(session.userId),
    getUserGrowthProfile(session.userId),
    getUserFollowStats(session.userId),
    listUserTopics(session.userId, lang, false),
    queryOne<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM notifications WHERE user_id = $1 AND read_at IS NULL",
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
  });
});

export default me;
