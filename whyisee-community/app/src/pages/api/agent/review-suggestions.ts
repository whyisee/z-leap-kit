import type { APIRoute } from "astro";
import {
  logAgentAction,
  requireAgentScope,
  upsertContentRun,
  type AgentContext,
} from "@server/services/agents";
import { jsonResponse, withAgent } from "@server/services/agentHttp";
import { createReport } from "@server/services/reports";

export const prerender = false;

export const POST: APIRoute = async ({ request }) =>
  withAgent(request, async (agent) => {
    requireAgentScope(agent, "review:suggest");

    let targetType = "";
    let targetId = 0;

    try {
      const body = await readJsonBody(request);
      targetType = readTargetType(body.targetType);
      targetId = Number(body.targetId || 0);
      const reason = readString(body.reason);
      const details = readString(body.details);
      const severity = readSeverity(body.severity);

      if (!targetType || !Number.isFinite(targetId) || targetId <= 0) {
        return jsonResponse({ ok: false, code: "invalid_target", error: "Invalid review target." }, 400);
      }

      if (reason.length < 2) {
        return jsonResponse({ ok: false, code: "reason_required", error: "Review reason is required." }, 400);
      }

      await createReport({
        reporterId: agent.userId,
        targetType,
        targetId,
        reason: `agent_review:${severity}:${reason}`.slice(0, 180),
        details: buildDetails(agent, body, details),
      });

      await recordSourceRun(agent, body, { targetType, targetId, severity, reason });
      await logAgentAction(agent, {
        action: "review_suggestion",
        resourceType: targetType,
        resourceId: targetId,
        status: "success",
        requestSummary: reason,
        responseSummary: severity,
        request,
      });

      return jsonResponse({
        ok: true,
        status: "open",
        targetType,
        targetId,
      }, 201);
    } catch (error) {
      await logAgentAction(agent, {
        action: "review_suggestion",
        resourceType: targetType,
        resourceId: targetId || null,
        status: "failed",
        responseSummary: error instanceof Error ? error.message : "failed",
        request,
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

async function recordSourceRun(
  agent: AgentContext,
  body: Record<string, unknown>,
  item: { targetType: string; targetId: number; severity: string; reason: string },
) {
  const source = typeof body.source === "object" && body.source ? (body.source as Record<string, unknown>) : {};
  const runKey = readString(source.runId || body.runKey);

  if (!runKey) {
    return;
  }

  await upsertContentRun(agent, {
    runKey,
    skillVersion: readString(source.skillVersion) || undefined,
    task: "review_suggestion",
    status: "success",
    inputSummary: `${item.targetType} #${item.targetId}`,
    outputSummary: `${item.severity}: ${item.reason}`,
    metadata: {
      source,
      severity: item.severity,
      reason: item.reason,
    },
    items: [{ type: "review_suggestion", id: item.targetId, status: "open" }],
  });
}

function buildDetails(agent: AgentContext, body: Record<string, unknown>, details: string) {
  const evidence = readString(body.evidence);
  const source = typeof body.source === "object" && body.source ? (body.source as Record<string, unknown>) : {};
  const lines = [
    `Agent: ${agent.agentName} (@${agent.username})`,
    `Run: ${readString(source.runId || body.runKey) || "-"}`,
    `Skill: ${readString(source.skillVersion) || "-"}`,
    details ? `Details: ${details}` : "",
    evidence ? `Evidence: ${evidence}` : "",
  ].filter(Boolean);

  return lines.join("\n").slice(0, 3000);
}

function readTargetType(value: unknown) {
  const targetType = readString(value);

  if (targetType === "topic" || targetType === "post" || targetType === "user") {
    return targetType;
  }

  return "";
}

function readSeverity(value: unknown) {
  const severity = readString(value);

  if (severity === "low" || severity === "medium" || severity === "high") {
    return severity;
  }

  return "medium";
}

function readString(value: unknown) {
  return String(value || "").trim();
}
