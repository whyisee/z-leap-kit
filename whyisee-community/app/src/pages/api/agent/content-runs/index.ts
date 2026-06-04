import type { APIRoute } from "astro";
import {
  listAgentRunsForAgent,
  logAgentAction,
  requireAgentScope,
  upsertContentRun,
} from "@server/services/agents";
import { jsonResponse, withAgent } from "@server/services/agentHttp";

export const prerender = false;

export const GET: APIRoute = async (context) =>
  withAgent(context.request, async (agent) => {
    requireAgentScope(agent, "content_run:write");
    const limit = Math.max(1, Math.min(Number(context.url.searchParams.get("limit") || 50), 100));
    const runs = await listAgentRunsForAgent(agent.agentProfileId, limit);

    return jsonResponse({ ok: true, runs });
  });

export const POST: APIRoute = async ({ request }) =>
  withAgent(request, async (agent) => {
    requireAgentScope(agent, "content_run:write");

    let runKey = "";

    try {
      const body = await readJsonBody(request);
      runKey = readString(body.runKey || body.runId);
      const run = await upsertContentRun(agent, {
        runKey,
        skillVersion: readString(body.skillVersion) || undefined,
        task: readString(body.task) || "content_run",
        status: readString(body.status) || "success",
        inputSummary: readString(body.inputSummary),
        outputSummary: readString(body.outputSummary),
        qualityScore: readQualityScore(body.qualityScore),
        metadata: readMetadata(body.metadata),
        items: readItems(body.items),
      });

      await logAgentAction(agent, {
        action: "record_content_run",
        resourceType: "content_run",
        resourceId: run.id,
        status: "success",
        requestSummary: run.runKey,
        responseSummary: run.status,
        request,
      });

      return jsonResponse({ ok: true, run }, 201);
    } catch (error) {
      await logAgentAction(agent, {
        action: "record_content_run",
        resourceType: "content_run",
        status: "failed",
        requestSummary: runKey,
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

function readItems(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") return undefined;
      const raw = item as Record<string, unknown>;
      const id = Number(raw.id || raw.itemId || 0);
      const type = readString(raw.type || raw.itemType);

      if (!Number.isFinite(id) || id <= 0 || !type) return undefined;

      return {
        id,
        type,
        status: readString(raw.status) || "pending",
      };
    })
    .filter((item): item is { id: number; type: string; status: string } => Boolean(item));
}

function readMetadata(value: unknown) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function readQualityScore(value: unknown) {
  const score = Number(value);
  return Number.isFinite(score) ? score : null;
}

function readString(value: unknown) {
  return String(value || "").trim();
}
