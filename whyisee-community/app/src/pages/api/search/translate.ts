import type { APIRoute } from "astro";
import { getLangFromAstro } from "@lib/i18n";
import { AiServiceError } from "@server/services/ai";
import { translateSearchQueryWithAi } from "@server/services/searchAi";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const lang = getLangFromAstro(context);

  let body: unknown;

  try {
    body = await context.request.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const q = readBodyString(body, "q").trim();

  if (!q) {
    return json({ error: "empty_query" }, 400);
  }

  try {
    const translation = await translateSearchQueryWithAi({ query: q, lang });

    return json({
      q,
      directiveQuery: translation.directiveQuery,
      plan: {
        source: translation.plan.source,
        normalizedQuery: translation.plan.normalizedQuery,
        keywords: translation.plan.keywords,
        types: translation.plan.types,
        fields: translation.plan.fields,
        categories: translation.plan.categoryQueries,
        tags: translation.plan.tagQueries,
        authors: translation.plan.authorQueries,
        mentions: translation.plan.mentionQueries,
        sort: translation.plan.sort,
        limit: translation.plan.limit,
        warnings: translation.plan.warnings,
        notes: translation.plan.notes,
      },
      provider: translation.provider,
      model: translation.model,
      configName: translation.configName,
    });
  } catch (error) {
    if (error instanceof AiServiceError) {
      console.error("Search AI translation failed", error.code, error.message);
      return json({ error: error.code }, errorStatus(error.code));
    }

    console.error("Search AI translation failed", error);
    return json({ error: "ai_failed" }, 500);
  }
};

function readBodyString(body: unknown, key: string) {
  if (!body || typeof body !== "object") {
    return "";
  }

  const value = (body as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
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
