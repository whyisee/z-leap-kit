import type { APIRoute } from "astro";
import { getLangFromAstro } from "@lib/i18n";
import { runCommunitySearch, type SearchMode } from "@server/services/search";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const lang = getLangFromAstro(context);
  const q = context.url.searchParams.get("q") || "";
  const mode = readSearchMode(context.url.searchParams.get("mode"));
  const rawLimit = Number(context.url.searchParams.get("limit") || 8);
  const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(rawLimit, 12)) : 8;

  try {
    const search = await runCommunitySearch(q, lang, {
      limit: Number.isFinite(limit) ? limit : 8,
      mode,
    });

    return new Response(JSON.stringify({
      q,
      mode: search.mode,
      results: search.results,
      plan: {
        source: search.plan.source,
        normalizedQuery: search.plan.normalizedQuery,
        warnings: search.warnings,
        notes: search.notes,
      },
      ai: search.ai,
      fallback: search.fallback,
      error: search.error,
    }), {
      headers: {
        "content-type": "application/json; charset=utf-8",
      },
    });
  } catch (error) {
    console.error("Failed to search community", error);

    return new Response(JSON.stringify({ q, results: [], error: "search_failed" }), {
      status: 500,
      headers: {
        "content-type": "application/json; charset=utf-8",
      },
    });
  }
};

function readSearchMode(value: string | null): SearchMode {
  if (value === "ai" || value === "directive") {
    return value;
  }

  return "auto";
}
