import { Hono } from "hono";
import { AiServiceError } from "@server/services/ai";
import { listPostsForTopic } from "@server/services/posts";
import { getTopicById, listRelatedTopics } from "@server/services/topics";
import { isTopicAiAction, runTopicAiAction, type TopicAiAction } from "@server/services/topicAi";
import { takeToken } from "@lib/rateLimit";
import { fail, failWithStatus, langOf, ok, type ApiEnv } from "../http";
import { requireAuth, sessionOf } from "../middleware";

const ai = new Hono<ApiEnv>();

/**
 * AI 很贵，按用户限流：5 分钟内最多 8 次。
 * 和网页版 /api/ai/topic 共用 runTopicAiAction，避免两套 prompt 漂移。
 */
const aiRateLimit = { limit: 8, windowMs: 5 * 60 * 1000 };

const actionLabels: Record<TopicAiAction, string> = {
  summarize: "总结话题",
  "draft-reply": "生成回复",
  translate: "双语翻译",
  "extract-actions": "提炼行动项",
  "find-related": "查找相关",
  "quality-check": "质量检查",
};

ai.post("/topic", requireAuth, async (c) => {
  const session = c.get("session");

  const limit = takeToken(`ai:topic:${session.userId}`, aiRateLimit.limit, aiRateLimit.windowMs);
  if (!limit.allowed) {
    c.header("retry-after", String(limit.retryAfterSeconds));
    return fail(c, "rate_limited", "AI 用得有点密，歇一会儿再来");
  }

  const body = await readJson<{ topicId?: number; action?: string }>(c.req.raw);
  const topicId = Number(body?.topicId || 0);
  const action = String(body?.action || "");

  if (!Number.isFinite(topicId) || topicId <= 0) {
    return fail(c, "validation_failed", "话题 id 不合法");
  }

  if (!isTopicAiAction(action)) {
    return fail(c, "validation_failed", "不支持的 AI 动作");
  }

  const lang = langOf(c);
  const topic = await getTopicById(topicId, lang);
  if (!topic) return fail(c, "not_found", "话题不存在");

  try {
    const [posts, related] = await Promise.all([
      listPostsForTopic(topic.id, sessionOf(c)?.userId, lang),
      listRelatedTopics(topic, 4, lang),
    ]);
    const result = await runTopicAiAction({ action, topic, posts, related, lang });

    return ok(c, {
      action,
      topicId: topic.id,
      label: actionLabels[action],
      outputMarkdown: result.text,
      provider: result.provider,
      model: result.model,
      configName: result.configName,
    });
  } catch (error) {
    if (error instanceof AiServiceError) {
      console.error("[api/v1] topic ai failed", error.code, error.message);
      return failWithStatus(c, aiErrorStatus(error.code), "server_error", aiErrorMessage(error.code));
    }

    console.error("[api/v1] topic ai failed", error);
    return fail(c, "server_error", "AI 暂时不可用，稍后再试");
  }
});

function aiErrorStatus(code: string) {
  if (code === "ai_not_configured" || code === "ai_key_missing") return 503;
  if (code === "ai_timeout") return 504;
  return 502;
}

function aiErrorMessage(code: string) {
  if (code === "ai_not_configured") return "站点还没配置 AI，暂时用不了";
  if (code === "ai_key_missing") return "AI 密钥缺失，请联系管理员";
  if (code === "ai_timeout") return "AI 想太久了，重试一次";
  return "AI 暂时不可用，稍后再试";
}

async function readJson<T>(request: Request): Promise<T | undefined> {
  try {
    return (await request.json()) as T;
  } catch {
    return undefined;
  }
}

export default ai;
