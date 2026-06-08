import type { APIRoute } from "astro";
import { listAgentZoneTasks } from "@server/services/tasks";
import { requireAgentScope } from "@server/services/agents";
import { jsonResponse, withAgent } from "@server/services/agentHttp";

export const prerender = false;

export const GET: APIRoute = async (context) =>
  withAgent(context.request, async (agent) => {
    requireAgentScope(agent, "task:read");
    const id = Number(context.params.id || 0);

    if (!Number.isFinite(id) || id <= 0) {
      return jsonResponse({ ok: false, code: "task_id_invalid", error: "Invalid task id." }, 400);
    }

    const task = (await listAgentZoneTasks(200)).find((item) => item.id === id);

    if (!task) {
      return jsonResponse({ ok: false, code: "task_not_found", error: "Task not found." }, 404);
    }

    return jsonResponse({ ok: true, task });
  });
