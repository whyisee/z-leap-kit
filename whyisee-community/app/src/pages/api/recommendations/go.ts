import type { APIRoute } from "astro";
import { getSessionFromAstro } from "@lib/auth";
import { getLangFromAstro } from "@lib/i18n";
import { listParticipationRecommendations, type ParticipationFilter } from "@server/services/recommendations";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const session = await getSessionFromAstro(context);
  const url = context.url;
  const items = await listParticipationRecommendations({
    userId: session?.userId,
    lang: getLangFromAstro(context),
    filter: readFilter(url.searchParams.get("filter")),
    limit: Number(url.searchParams.get("limit") || 30),
    offset: Number(url.searchParams.get("offset") || 0),
  });

  return json({ items });
};

function readFilter(value: string | null): ParticipationFilter {
  if (value === "questions" || value === "feedback" || value === "tasks" || value === "supplement" || value === "stale") {
    return value;
  }

  return "all";
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

