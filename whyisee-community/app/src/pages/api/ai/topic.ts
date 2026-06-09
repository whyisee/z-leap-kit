import type { APIRoute } from "astro";
import { getSessionFromAstro } from "@lib/auth";
import { getLangFromAstro } from "@lib/i18n";
import { AiServiceError } from "@server/services/ai";
import { listPostsForTopic } from "@server/services/posts";
import { getTopicById, listRelatedTopics } from "@server/services/topics";
import { isTopicAiAction, runTopicAiAction } from "@server/services/topicAi";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const session = await getSessionFromAstro(context);
  const lang = getLangFromAstro(context);

  if (!session) {
    return json({ error: "login_required" }, 401);
  }

  let body: unknown;

  try {
    body = await context.request.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const topicId = Number(readBodyValue(body, "topicId"));
  const action = String(readBodyValue(body, "action") || "");

  if (!Number.isFinite(topicId) || topicId <= 0) {
    return json({ error: "invalid_topic" }, 400);
  }

  if (!isTopicAiAction(action)) {
    return json({ error: "invalid_action" }, 400);
  }

  const topic = await getTopicById(topicId, lang);

  if (!topic) {
    return json({ error: "topic_not_found" }, 404);
  }

  try {
    const [posts, related] = await Promise.all([
      listPostsForTopic(topic.id, undefined, lang),
      listRelatedTopics(topic, 4, lang),
    ]);
    const result = await runTopicAiAction({ action, topic, posts, related, lang });

    return json({
      action,
      topicId: topic.id,
      outputMarkdown: result.text,
      provider: result.provider,
      model: result.model,
      configName: result.configName,
    });
  } catch (error) {
    if (error instanceof AiServiceError) {
      console.error("Topic AI failed", error.code, error.message);
      return json({ error: error.code }, errorStatus(error.code));
    }

    console.error("Topic AI failed", error);
    return json({ error: "ai_failed" }, 500);
  }
};

function readBodyValue(body: unknown, key: string) {
  if (!body || typeof body !== "object") {
    return undefined;
  }

  return (body as Record<string, unknown>)[key];
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  });
}

function errorStatus(code: string) {
  if (code === "ai_not_configured" || code === "ai_key_missing") {
    return 503;
  }

  if (code === "ai_timeout") {
    return 504;
  }

  return 502;
}
