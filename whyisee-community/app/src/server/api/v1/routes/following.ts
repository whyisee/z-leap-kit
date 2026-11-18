import { Hono } from "hono";
import {
  listFollowingFeed,
  type FollowingFeedItem,
  type FollowingFilter,
} from "@server/services/recommendations";
import { fail, langOf, ok, type ApiEnv } from "../http";
import { requireAuth, sessionOf } from "../middleware";
import { clampLimit, decodeCursor, encodeCursor } from "../pagination";
import { toCategory, toTag } from "../serializers";

const following = new Hono<ApiEnv>();

const FILTERS: FollowingFilter[] = ["all", "topics", "users", "categories", "tags"];

/**
 * 「关注」页：你关注的话题 / 作者 / 分类 / 标签里，最近有动静的帖子。
 *
 * 和 `/participation` 同一个套路：直接复用网页 `/following` 用的
 * `listFollowingFeed`，来源判定、打分、排序都不另写 —— 否则 App 和网页会给出
 * 两条顺序不同的订阅流，同一个用户会觉得「手机上有、电脑上没有」。
 *
 * 必须登录：关注关系是账号私有的，未登录没有可看的内容，直接 401 让 App 出登录引导。
 */
following.get("/", requireAuth, async (c) => {
  const session = sessionOf(c);
  if (!session) return fail(c, "unauthorized", "请先登录");

  const filter = readFilter(c.req.query("filter"));
  const limit = clampLimit(c.req.query("limit"), 30, 60);
  const offset = decodeCursor(c.req.query("cursor"));

  // 多取一条判 hasMore，比再查一次 count 便宜
  const requested = Math.min(limit + 1, 60);
  const items = await listFollowingFeed({
    userId: session.userId,
    lang: langOf(c),
    filter,
    limit: requested,
    offset,
  });

  const hasMore = items.length > limit;

  return ok(
    c,
    { items: items.slice(0, limit).map(toFollowingItem), filter },
    { hasMore, nextCursor: hasMore ? encodeCursor(offset + limit) : null },
  );
});

function readFilter(value: string | undefined): FollowingFilter {
  return FILTERS.includes(value as FollowingFilter) ? (value as FollowingFilter) : "all";
}

function toFollowingItem(item: FollowingFeedItem) {
  return {
    sourceType: item.sourceType,
    sourceLabel: item.sourceLabel,
    targetType: item.targetType,
    targetId: item.targetId,
    title: item.title,
    summary: item.summary,
    href: item.href,
    // 相对时间在服务端算好（formatRelative 依赖 locale），客户端只管显示
    timeLabel: item.meta,
    category: toCategory(item.category),
    tags: (item.tags || []).slice(0, 4).map(toTag),
  };
}

export default following;
