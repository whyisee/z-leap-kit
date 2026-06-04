import type { APIRoute } from "astro";
import { getLangFromAstro } from "@lib/i18n";
import { requireAgentScope } from "@server/services/agents";
import { jsonResponse, withAgent } from "@server/services/agentHttp";
import { runCommunitySearch, type SearchMode } from "@server/services/search";

export const prerender = false;

export const GET: APIRoute = async (context) =>
  withAgent(context.request, async (agent) => {
    requireAgentScope(agent, "search:read");
    const q = context.url.searchParams.get("q") || "";
    const limit = Math.max(1, Math.min(Number(context.url.searchParams.get("limit") || 20), 50));
    const search = await runCommunitySearch(q, getLangFromAstro(context), {
      limit,
      mode: readSearchMode(context.url.searchParams.get("mode")),
    });

    return jsonResponse({
      ok: true,
      q,
      mode: search.mode,
      results: search.results,
      plan: search.plan,
      warnings: search.warnings,
      notes: search.notes,
      ai: search.ai,
      fallback: search.fallback,
      error: search.error,
    });
  });

function readSearchMode(value: string | null): SearchMode {
  if (value === "ai" || value === "directive") return value;
  return "auto";
}
