import type { APIRoute } from "astro";
import { getSessionFromAstro } from "@lib/auth";
import { getLangFromAstro } from "@lib/i18n";
import { listSeeRecommendations, type SeeSort } from "@server/services/recommendations";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const session = await getSessionFromAstro(context);
  const url = context.url;
  const items = await listSeeRecommendations({
    userId: session?.userId,
    lang: getLangFromAstro(context),
    categorySlug: url.searchParams.get("category") || undefined,
    tagSlug: url.searchParams.get("tag") || undefined,
    sort: readSort(url.searchParams.get("sort")),
    limit: Number(url.searchParams.get("limit") || 30),
    offset: Number(url.searchParams.get("offset") || 0),
  });

  return json({ items });
};

function readSort(value: string | null): SeeSort {
  return value === "latest" || value === "hot" || value === "featured" ? value : "recommend";
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

