import { Hono } from "hono";
import { getUserByUsername, listUserTopics } from "@server/services/users";
import { getUserFollowStats, userFollowsTarget } from "@server/services/interactions";
import { getUserGrowthProfile } from "@server/services/reputation";
import { fail, langOf, ok, type ApiEnv } from "../http";
import { optionalAuth, sessionOf } from "../middleware";
import { toFeedItem } from "../serializers";

const users = new Hono<ApiEnv>();

// 登录可选：没登录照样能看，只是不知道「你有没有关注他」
users.use("*", optionalAuth);

/**
 * 用户主页。
 *
 * 网页 `/u/:username` 那页的信息密度很大（徽章、贡献流水、信任等级），手机上
 * 全搬过来只会变成一屏读不完的模块。这里只给三块：这个人是谁、他的数据、
 * 他写的公开话题——足够判断「要不要关注」。
 *
 * 登录是可选的：没登录也能看别人的主页，只是 `following` 恒为 false。
 */
users.get("/:username", async (c) => {
  const username = (c.req.param("username") || "").trim();
  if (!username) return fail(c, "validation_failed", "缺少用户名");

  const user = await getUserByUsername(username);
  if (!user || user.status === "banned") return fail(c, "not_found", "用户不存在");

  const session = sessionOf(c);
  const isSelf = session?.userId === user.id;
  const lang = langOf(c);

  const [topics, stats, growth, following] = await Promise.all([
    // 自己主页才带上草稿：草稿是「只有我看得见」的东西，别人不该看到条数
    listUserTopics(user.id, lang, isSelf),
    getUserFollowStats(user.id),
    getUserGrowthProfile(user.id),
    session ? userFollowsTarget("user", user.id, session.userId) : Promise.resolve(false),
  ]);

  return ok(c, {
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      role: user.role,
      // 邮箱、状态这类字段只对本人有意义，别塞给所有人
      websiteUrl: user.websiteUrl,
      githubUrl: user.githubUrl,
      joinedAt: user.createdAt,
    },
    stats: {
      topicCount: growth?.topicCount ?? topics.length,
      replyCount: growth?.replyCount ?? 0,
      featuredCount: growth?.featuredTopicCount ?? 0,
      followerCount: stats.followerCount,
      followingCount: stats.followingCount,
      trustName: growth?.trustName ?? null,
      badgeCount: growth?.badgeCount ?? 0,
    },
    isSelf,
    following,
    topics: topics.map(toFeedItem),
  });
});

export default users;
