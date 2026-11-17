import { Hono } from "hono";
import { listSeeRecommendations, type SeeSort } from "@server/services/recommendations";
import { fail, langOf, ok, type ApiEnv } from "../http";
import { optionalAuth, sessionOf } from "../middleware";
import { clampLimit, decodeCursor, encodeCursor } from "../pagination";
import { toFeedItem } from "../serializers";

const feed = new Hono<ApiEnv>();

feed.get("/", optionalAuth, async (c) => {
  const surface = c.req.query("surface") || "see";

  // 「关注」流的服务层只返回 title/summary/href，没有作者与计数，拼不出完整 DTO。
  // 与其返回半成品，不如明确拒绝——这个 tab 在 P1 仍走 WebView。
  if (surface !== "see") {
    return fail(c, "validation_failed", `surface=${surface} 暂未提供 JSON，请使用网页版`);
  }

  const session = sessionOf(c);
  const limit = clampLimit(c.req.query("limit"), 20, 50);
  const offset = decodeCursor(c.req.query("cursor"));
  const sort = readSort(c.req.query("sort"));

  // 多取一条用来判断 hasMore，服务层 normalizeLimit 上限 50，所以 limit=50 时判断会退化
  const requested = Math.min(limit + 1, 50);
  const items = await listSeeRecommendations({
    userId: session?.userId,
    lang: langOf(c),
    categorySlug: c.req.query("category") || undefined,
    tagSlug: c.req.query("tag") || undefined,
    sort,
    limit: requested,
    offset,
  });

  const hasMore = items.length > limit;
  const page = items.slice(0, limit);

  return ok(
    c,
    { items: page.map(toFeedItem), surface: "see", sort },
    { hasMore, nextCursor: hasMore ? encodeCursor(offset + limit) : null },
  );
});

function readSort(value: string | undefined): SeeSort {
  return value === "latest" || value === "hot" || value === "featured" ? value : "recommend";
}

export default feed;
