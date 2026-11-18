import { Hono } from "hono";
import { runCommunitySearch, type SearchMode } from "@server/services/search";
import { fail, langOf, ok, type ApiEnv } from "../http";

const search = new Hono<ApiEnv>();

/**
 * 全站搜索。
 *
 * 网页 `/search` 那套服务已经能搜话题、回复、分类、标签、用户，还带指令解析
 * （`category:设计`、`sort:hot`）和 AI 兜底，这里只做一层 DTO，不另写查询——
 * 否则 App 和网页会搜出两套不同结果。AI 模式需要调模型，手机上等十几秒是不可
 * 接受的，所以默认只走关键词；要 AI 显式传 `mode=ai`。
 */
search.get("/", async (c) => {
  const q = (c.req.query("q") || "").trim();
  if (!q) return fail(c, "validation_failed", "请输入搜索词");

  const rawMode = (c.req.query("mode") || "directive").toLowerCase();
  const mode: SearchMode = rawMode === "ai" ? "ai" : "directive";

  const limit = Math.min(Math.max(Number(c.req.query("limit") || 30), 1), 50);

  try {
    const result = await runCommunitySearch(q, langOf(c), { limit, mode });

    return ok(c, {
      q: result.q,
      mode: result.mode,
      ai: result.ai ? { query: result.ai.directiveQuery, model: result.ai.model } : null,
      // 搜索词被 AI / 指令改写时告诉用户一声，否则「我搜 A 怎么出来 B」没法解释
      notes: result.notes,
      warnings: result.warnings,
      results: result.results.map((item) => ({
        kind: item.kind,
        title: item.title,
        summary: item.summary,
        href: item.href,
        meta: item.meta,
        replyCount: item.replyCount,
        viewCount: item.viewCount,
      })),
    });
  } catch (error) {
    console.error("App search failed", error);
    return fail(c, "server_error", "搜索暂时不可用，稍后再试");
  }
});

export default search;
