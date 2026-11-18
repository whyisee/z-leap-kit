import { Hono } from "hono";
import { listTopics } from "@server/services/topics";
import { intParam, langOf, ok, type ApiEnv } from "../http";
import { toFeedItem } from "../serializers";

/**
 * 项目展示：网页 `/projects` 就是「type=project 的话题列表」。
 *
 * 没有再包一层业务逻辑 —— 类型过滤、排序、可见性都在 listTopics 里，
 * 这里只做分页和 DTO 转换，否则网页和 app 会慢慢长出两套筛选规则。
 */
const projects = new Hono<ApiEnv>();

projects.get("/", async (c) => {
  const lang = langOf(c);
  const limit = Math.min(Math.max(intParam(c.req.query("limit"), 20), 1), 50);
  const offset = Math.max(intParam(c.req.query("offset"), 0), 0);

  // 多取一条判断还有没有下一页，比再来一次 COUNT 便宜
  const rows = await listTopics({ type: "project", limit: limit + 1, offset, lang });
  const hasMore = rows.length > limit;

  return ok(
    c,
    { items: rows.slice(0, limit).map(toFeedItem) },
    { hasMore, nextOffset: hasMore ? offset + limit : null },
  );
});

export default projects;
