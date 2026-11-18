import { Hono } from "hono";
import {
  listParticipationRecommendations,
  type ParticipationFilter,
  type ParticipationRecommendation,
} from "@server/services/recommendations";
import { langOf, ok, type ApiEnv } from "../http";
import { optionalAuth, sessionOf } from "../middleware";
import { clampLimit, decodeCursor, encodeCursor } from "../pagination";
import { toCategory, toTag } from "../serializers";

const participation = new Hono<ApiEnv>();

const FILTERS: ParticipationFilter[] = ["all", "questions", "feedback", "tasks", "supplement", "stale"];

/**
 * 「出发」页：待回答 / 求反馈 / 可领取 / 可补充 / 可更新。
 *
 * 直接复用网页 `/go` 用的 `listParticipationRecommendations`，连排序和打分都不另写，
 * 否则 App 和网页会给出两套不同的推荐顺序。
 */
participation.get("/", optionalAuth, async (c) => {
  const session = sessionOf(c);
  const filter = readFilter(c.req.query("filter"));
  const limit = clampLimit(c.req.query("limit"), 20, 50);
  const offset = decodeCursor(c.req.query("cursor"));

  // 多取一条判 hasMore，服务层 normalizeLimit 上限 50
  const requested = Math.min(limit + 1, 50);
  const items = await listParticipationRecommendations({
    userId: session?.userId,
    lang: langOf(c),
    filter,
    limit: requested,
    offset,
  });

  const hasMore = items.length > limit;

  return ok(
    c,
    { items: items.slice(0, limit).map(toParticipationItem), filter },
    { hasMore, nextCursor: hasMore ? encodeCursor(offset + limit) : null },
  );
});

function readFilter(value: string | undefined): ParticipationFilter {
  return FILTERS.includes(value as ParticipationFilter) ? (value as ParticipationFilter) : "all";
}

function toParticipationItem(item: ParticipationRecommendation) {
  return {
    targetType: item.targetType,
    targetId: item.targetId,
    title: item.title,
    summary: item.summary,
    href: item.href,
    actionLabel: item.actionLabel,
    reason: item.reason,
    category: item.category ? toCategory(item.category) : null,
    tags: (item.tags || []).map(toTag),
    score: item.score,
    stats: {
      replyCount: item.stats.replyCount ?? null,
      viewCount: item.stats.viewCount ?? null,
      submissionCount: item.stats.submissionCount ?? null,
      rewardLabel: item.stats.rewardLabel ?? null,
    },
  };
}

export default participation;
