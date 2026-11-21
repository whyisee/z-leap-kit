import { Hono } from "hono";
import { searchMentionTargets } from "@server/services/mentions";
import { ok, type ApiEnv } from "../http";
import { requireAuth } from "../middleware";

/**
 * 手机端 `@` 补全。
 *
 * 网页那边是 `/api/mentions/search`，走 cookie 会话；app 只能 Bearer，因此
 * 单开一个 v1 入口。查询本身复用同一个服务函数 —— 候选顺序、机器人标记、
 * 只搜 active 用户这些规则必须和网页一致，否则同一个名字在两端排位不同。
 */
const mentions = new Hono<ApiEnv>();

mentions.use("*", requireAuth);

mentions.get("/search", async (c) => {
  const q = (c.req.query("q") || "").slice(0, 32);
  const targets = await searchMentionTargets(q, 8);

  return ok(c, {
    users: targets.map((target) => ({
      username: target.username,
      displayName: target.displayName,
      avatarUrl: target.avatarUrl,
      isBot: target.isBot,
    })),
  });
});

export default mentions;
