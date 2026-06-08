import type { APIRoute } from "astro";
import { listAgentZoneTasks } from "@server/services/tasks";
import { requireAgentScope } from "@server/services/agents";
import { jsonResponse, withAgent } from "@server/services/agentHttp";

export const prerender = false;

export const GET: APIRoute = async (context) =>
  withAgent(context.request, async (agent) => {
    requireAgentScope(agent, "task:read");
    const limit = Math.max(1, Math.min(Number(context.url.searchParams.get("limit") || 100), 200));
    const tasks = await listAgentZoneTasks(limit);

    return jsonResponse({ ok: true, tasks });
  });
