import type { APIRoute } from "astro";
import { getLangFromAstro } from "@lib/i18n";
import { searchCommunity } from "@server/services/search";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const lang = getLangFromAstro(context);
  const q = context.url.searchParams.get("q") || "";
  const rawLimit = Number(context.url.searchParams.get("limit") || 8);
  const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(rawLimit, 12)) : 8;

  try {
    const results = await searchCommunity(q, lang, Number.isFinite(limit) ? limit : 8);

    return new Response(JSON.stringify({ q, results }), {
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
