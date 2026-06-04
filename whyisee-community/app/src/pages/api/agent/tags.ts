import type { APIRoute } from "astro";
import { getLangFromAstro } from "@lib/i18n";
import { requireAgentScope } from "@server/services/agents";
import { jsonResponse, withAgent } from "@server/services/agentHttp";
import { listTags } from "@server/services/categories";

export const prerender = false;

export const GET: APIRoute = async (context) =>
  withAgent(context.request, async (agent) => {
    requireAgentScope(agent, "tag:read");
    const query = (context.url.searchParams.get("q") || "").trim().toLowerCase();
    const tags = (await listTags(getLangFromAstro(context))).filter((tag) => {
      if (!query) return true;
      return tag.name.toLowerCase().includes(query) || tag.slug.toLowerCase().includes(query);
    });

    return jsonResponse({ ok: true, tags: tags.slice(0, 100) });
  });
