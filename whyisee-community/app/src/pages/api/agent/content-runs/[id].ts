import type { APIRoute } from "astro";
import { getContentRunByIdForAgent, requireAgentScope } from "@server/services/agents";
import { jsonResponse, withAgent } from "@server/services/agentHttp";

export const prerender = false;

export const GET: APIRoute = async (context) =>
  withAgent(context.request, async (agent) => {
    requireAgentScope(agent, "content_run:write");
    const id = Number(context.params.id || 0);

    if (!Number.isFinite(id) || id <= 0) {
      return jsonResponse({ ok: false, code: "invalid_run_id", error: "Invalid run id." }, 400);
    }

    const run = await getContentRunByIdForAgent(agent.agentProfileId, id);

    if (!run) {
      return jsonResponse({ ok: false, code: "content_run_not_found", error: "Content run not found." }, 404);
    }

    return jsonResponse({ ok: true, run });
  });
