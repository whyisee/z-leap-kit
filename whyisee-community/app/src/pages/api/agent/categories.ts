import type { APIRoute } from "astro";
import { getLangFromAstro } from "@lib/i18n";
import { requireAgentScope } from "@server/services/agents";
import { jsonResponse, withAgent } from "@server/services/agentHttp";
import { listCategories } from "@server/services/categories";

export const prerender = false;

export const GET: APIRoute = async (context) =>
  withAgent(context.request, async (agent) => {
    requireAgentScope(agent, "category:read");
    const categories = await listCategories(getLangFromAstro(context));

    return jsonResponse({ ok: true, categories });
  });
