import type { APIRoute } from "astro";
import { getSessionFromAstro } from "@lib/auth";
import { getLangFromAstro } from "@lib/i18n";
import { getTopicById } from "@server/services/topics";
import { listReadingRecommendations } from "@server/services/recommendations";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const session = await getSessionFromAstro(context);
  const url = context.url;
  const topicId = Number(url.searchParams.get("topicId") || 0);
  const lang = getLangFromAstro(context);
  const topic = await getTopicById(topicId, lang);

  if (!topic) {
    return json({ error: "Topic not found." }, 404);
  }

  const items = await listReadingRecommendations({
    topic,
    userId: session?.userId,
    lang,
    limit: Number(url.searchParams.get("limit") || 12),
    excludeTopicIds: readIds(url.searchParams.get("exclude")),
  });

  return json({
    items: items.map((item) => ({
      targetType: item.targetType,
      targetId: item.targetId,
      href: item.href,
      title: item.topic.title,
      summary: item.topic.summary,
      category: item.topic.category,
      tags: item.topic.tags,
      score: item.score,
      reasons: item.reasons,
    })),
  });
};

function readIds(value: string | null) {
  return String(value || "")
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((id) => Number.isFinite(id) && id > 0);
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
