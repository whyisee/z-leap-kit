import { Hono } from "hono";
import { takeToken } from "@lib/rateLimit";
import { createReport } from "@server/services/reports";
import { fail, ok, type ApiEnv } from "../http";
import { requireAuth } from "../middleware";

/**
 * 举报：网页那边是 `/report` 表单 POST 到 `/api/reports`（form 编码 + 303 跳回）。
 * app 走 JSON，但校验规则必须和网页一致 —— 两套宽松度不同的校验，
 * 结果就是有人专挑松的那一侧刷。
 */
const reports = new Hono<ApiEnv>();

reports.use("*", requireAuth);

const targetTypes = ["topic", "post", "user"];

reports.post("/", async (c) => {
  const session = c.get("session");

  const limit = takeToken(`report:${session.userId}`, 5, 10 * 60 * 1000);
  if (!limit.allowed) {
    c.header("retry-after", String(limit.retryAfterSeconds));
    return fail(c, "rate_limited", "举报提交太频繁，稍后再试");
  }

  const body = await readJson(c.req.raw);
  const targetType = String(body?.targetType || "");
  const targetId = Number(body?.targetId || 0);
  const reason = String(body?.reason || "").trim();
  const details = String(body?.details || "").trim();

  if (!targetTypes.includes(targetType)) {
    return fail(c, "validation_failed", "举报对象类型不合法");
  }

  if (!Number.isFinite(targetId) || targetId <= 0) {
    return fail(c, "validation_failed", "举报对象不合法");
  }

  if (reason.length < 2) {
    return fail(c, "validation_failed", "请写清楚举报原因");
  }

  await createReport({
    reporterId: session.userId,
    targetType,
    targetId,
    reason: reason.slice(0, 200),
    details: details.slice(0, 2000),
  });

  return ok(c, { submitted: true });
});

async function readJson(request: Request): Promise<Record<string, unknown> | undefined> {
  try {
    const parsed = await request.json();
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}

export default reports;
