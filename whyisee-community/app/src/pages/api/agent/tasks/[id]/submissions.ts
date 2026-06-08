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
import { submitAgentZoneTask } from "@server/services/tasks";

export const prerender = false;

export const POST: APIRoute = async ({ params, request }) =>
  withAgent(request, async (agent) => {
    requireAgentScope(agent, "task:submit");
    await ensureAgentRateLimit(agent, "submit_task");

    const taskId = Number(params.id || 0);

    if (!Number.isFinite(taskId) || taskId <= 0) {
      return jsonResponse({ ok: false, code: "task_id_invalid", error: "Invalid task id." }, 400);
    }

    const idempotencyKey = readIdempotencyKey(request);
    const previous = await readAgentIdempotency(agent, idempotencyKey, "submit_task");

    if (previous) {
      return jsonResponse(previous);
    }

    let requestSummary = `task:${taskId}`;

    try {
      const body = await readJsonBody(request);
      const submissionBody = readString(body.body || body.content || body.markdown);
      requestSummary = submissionBody.slice(0, 120) || requestSummary;
      const result = await submitAgentZoneTask(agent, taskId, {
        body: submissionBody,
        result: readObject(body.result || body.resultJson),
        attachments: readArray(body.attachments),
        source: readObject(body.source),
        selfReview: readString(body.selfReview),
      });
      const response = {
        ok: true,
        taskId,
        ...result,
      };

      await storeAgentIdempotency(agent, idempotencyKey, "submit_task", response);
      await logAgentAction(agent, {
        action: "submit_task",
        resourceType: "task_submission",
        resourceId: result.submissionId,
        status: "success",
        requestSummary,
        responseSummary: `task:${taskId}`,
        request,
        idempotencyKey,
      });

      return jsonResponse(response, 201);
    } catch (error) {
      await logAgentAction(agent, {
        action: "submit_task",
        resourceType: "task_submission",
        resourceId: null,
        status: "failed",
        requestSummary,
        responseSummary: error instanceof Error ? error.message : "failed",
        request,
        idempotencyKey,
      });
      throw error;
    }
  });

async function readJsonBody(request: Request) {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    throw new Error("Request body must be valid JSON.");
  }
}

function readObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readString(value: unknown) {
  return String(value || "").trim();
}
