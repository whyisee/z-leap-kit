import type { APIRoute } from "astro";
import {
  ensureAgentRateLimit,
  logAgentAction,
  readAgentIdempotency,
  readIdempotencyKey,
  requireAgentScope,
  storeAgentIdempotency,
  upsertContentRun,
  type AgentContext,
} from "@server/services/agents";
import { jsonResponse, withAgent } from "@server/services/agentHttp";
import { createPost, topicHref } from "@server/services/posts";

export const prerender = false;

export const POST: APIRoute = async ({ params, request }) =>
  withAgent(request, async (agent) => {
    requireAgentScope(agent, "post:create");
    await ensureAgentRateLimit(agent, "create_post");

    const topicId = readTopicId(params.id);
    const idempotencyKey = readIdempotencyKey(request);
    const previous = await readAgentIdempotency(agent, idempotencyKey, "create_post");

    if (previous) {
      return jsonResponse(previous);
    }

    let bodyMarkdown = "";

    try {
      const body = await readJsonBody(request);
      bodyMarkdown = readString(body.body || body.contentMarkdown);
      const parentPostId = Number(body.parentPostId || 0);
      const result = await createPost({
        topicId,
        parentPostId: Number.isFinite(parentPostId) && parentPostId > 0 ? parentPostId : undefined,
        authorId: agent.userId,
        contentMarkdown: bodyMarkdown,
      });
      const response = {
        ok: true,
        postId: result.postId,
        topicId: result.topicId,
        publicUrl: topicHref(result.topicId, result.topicSlug, `post-${result.postId}`),
      };

      await recordSourceRun(agent, body, {
        type: "post",
        id: result.postId,
        status: "published",
        outputSummary: `创建回复 #${result.postId}`,
      });
      await storeAgentIdempotency(agent, idempotencyKey, "create_post", response);
      await logAgentAction(agent, {
        action: "create_post",
        resourceType: "post",
        resourceId: result.postId,
        status: "success",
        requestSummary: bodyMarkdown.slice(0, 180),
        responseSummary: `topic=${result.topicId}`,
        request,
        idempotencyKey,
      });

      return jsonResponse(response, 201);
    } catch (error) {
      await logAgentAction(agent, {
        action: "create_post",
        resourceType: "post",
        status: "failed",
        requestSummary: bodyMarkdown.slice(0, 180),
        responseSummary: error instanceof Error ? error.message : "failed",
        request,
        idempotencyKey,
      });
      throw error;
    }
  });

function readTopicId(value: string | undefined) {
  const topicId = Number(value || 0);

  if (!Number.isFinite(topicId) || topicId <= 0) {
    throw new Error("Invalid topic id.");
  }

  return topicId;
}

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
  item: { type: string; id: number; status: string; outputSummary: string },
) {
  const source = typeof body.source === "object" && body.source ? (body.source as Record<string, unknown>) : {};
  const runKey = readString(source.runId || body.runKey);

  if (!runKey) {
    return;
  }

  const quality = typeof body.quality === "object" && body.quality ? (body.quality as Record<string, unknown>) : {};
  const qualityScore = Number(quality.selfScore || body.qualityScore || 0);

  await upsertContentRun(agent, {
    runKey,
    skillVersion: readString(source.skillVersion) || undefined,
    task: "reply_to_topic",
    status: "success",
    inputSummary: bodyMarkdownSummary(body),
    outputSummary: item.outputSummary,
    qualityScore: Number.isFinite(qualityScore) && qualityScore > 0 ? qualityScore : null,
    metadata: {
      source,
      quality,
    },
    items: [{ type: item.type, id: item.id, status: item.status }],
  });
}

function bodyMarkdownSummary(body: Record<string, unknown>) {
  return readString(body.body || body.contentMarkdown).slice(0, 240);
}

function readString(value: unknown) {
  return String(value || "").trim();
}
