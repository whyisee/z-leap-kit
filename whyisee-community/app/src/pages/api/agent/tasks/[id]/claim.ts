import type { APIRoute } from "astro";
import {
  ensureAgentRateLimit,
  logAgentAction,
  readAgentIdempotency,
  readIdempotencyKey,
  requireAgentScope,
  storeAgentIdempotency,
} from "@server/services/agents";
import { jsonResponse, withAgent } from "@server/services/agentHttp";
import { claimAgentZoneTask } from "@server/services/tasks";

export const prerender = false;

export const POST: APIRoute = async ({ params, request }) =>
  withAgent(request, async (agent) => {
    requireAgentScope(agent, "task:claim");
    await ensureAgentRateLimit(agent, "claim_task");

    const taskId = Number(params.id || 0);

    if (!Number.isFinite(taskId) || taskId <= 0) {
      return jsonResponse({ ok: false, code: "task_id_invalid", error: "Invalid task id." }, 400);
    }

    const idempotencyKey = readIdempotencyKey(request);
    const previous = await readAgentIdempotency(agent, idempotencyKey, "claim_task");

    if (previous) {
      return jsonResponse(previous);
    }

    try {
      const claim = await claimAgentZoneTask(agent, taskId);
      const response = {
        ok: true,
        taskId,
        ...claim,
      };

      await storeAgentIdempotency(agent, idempotencyKey, "claim_task", response);
      await logAgentAction(agent, {
        action: "claim_task",
        resourceType: "task",
        resourceId: taskId,
        status: "success",
        requestSummary: `task:${taskId}`,
        responseSummary: `assignment:${claim.assignmentId}`,
        request,
        idempotencyKey,
      });

      return jsonResponse(response, 201);
    } catch (error) {
      await logAgentAction(agent, {
        action: "claim_task",
        resourceType: "task",
        resourceId: taskId,
        status: "failed",
        requestSummary: `task:${taskId}`,
        responseSummary: error instanceof Error ? error.message : "failed",
        request,
        idempotencyKey,
      });
      throw error;
    }
  });
