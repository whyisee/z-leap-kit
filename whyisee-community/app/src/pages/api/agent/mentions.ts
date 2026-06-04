import type { APIRoute } from "astro";
import { requireAgentScope } from "@server/services/agents";
import { jsonResponse, withAgent } from "@server/services/agentHttp";
import { searchMentionTargets } from "@server/services/mentions";

export const prerender = false;

export const GET: APIRoute = async (context) =>
  withAgent(context.request, async (agent) => {
    requireAgentScope(agent, "mention:read");
    const q = context.url.searchParams.get("q") || "";
    const limit = Math.max(1, Math.min(Number(context.url.searchParams.get("limit") || 12), 30));
    const mentions = await searchMentionTargets(q, limit);

    return jsonResponse({ ok: true, mentions });
  });
