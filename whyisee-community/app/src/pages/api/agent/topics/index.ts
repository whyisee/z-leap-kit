import type { APIRoute } from "astro";
import { getLangFromAstro } from "@lib/i18n";
import type { TopicStatus, TopicType } from "@lib/types";
import {
  ensureAgentRateLimit,
  hasAgentScope,
  logAgentAction,
  readAgentIdempotency,
  readIdempotencyKey,
  requireAgentScope,
  storeAgentIdempotency,
  upsertContentRun,
  type AgentContext,
} from "@server/services/agents";
import { jsonResponse, withAgent } from "@server/services/agentHttp";
import { listCategories } from "@server/services/categories";
import { notifyAdmins } from "@server/services/notifications";
import { createTopic, listTopics } from "@server/services/topics";

export const prerender = false;

export const GET: APIRoute = async (context) =>
  withAgent(context.request, async (agent) => {
    requireAgentScope(agent, "topic:read");

    const status = readTopicStatus(context.url.searchParams.get("status"));
    const includeDrafts = Boolean(status && status !== "published");
    const limit = Math.max(1, Math.min(Number(context.url.searchParams.get("limit") || 30), 100));
    const topics = await listTopics({
      includeDrafts,
      authorId: includeDrafts ? agent.userId : undefined,
      limit,
      lang: getLangFromAstro(context),
      categorySlug: context.url.searchParams.get("category") || undefined,
      tagSlug: context.url.searchParams.get("tag") || undefined,
      search: context.url.searchParams.get("q") || undefined,
    });

    return jsonResponse({
      ok: true,
      topics: status ? topics.filter((topic) => topic.status === status) : topics,
    });
  });

export const POST: APIRoute = async ({ request }) =>
  withAgent(request, async (agent) => {
    requireAgentScope(agent, "topic:create");
    await ensureAgentRateLimit(agent, "create_topic");

    const idempotencyKey = readIdempotencyKey(request);
    const previous = await readAgentIdempotency(agent, idempotencyKey, "create_topic");

    if (previous) {
      return jsonResponse(previous);
    }

    let title = "";

    try {
      const body = await readJsonBody(request);
      title = readString(body.title);
      const contentMarkdown = readString(body.body || body.contentMarkdown);
      const requestedStatus = readTopicStatus(body.status);
      const status: TopicStatus = requestedStatus === "published" && hasAgentScope(agent, "topic:publish")
        ? "published"
        : requestedStatus === "draft"
          ? "draft"
          : "pending";
      const categoryId = await resolveCategoryId(body);
      const summary = readString(body.summary) || buildSummary(contentMarkdown);
      const type = readTopicType(body.type);
      const tags = normalizeTags(body.tags);

      const topicId = await createTopic({
        title,
        summary,
        contentMarkdown,
        authorId: agent.userId,
        categoryId,
        type,
        status,
        isPinned: false,
        isFeatured: false,
        tags,
      });
      const response = {
        ok: true,
        topicId,
        status,
        reviewUrl: `/admin/topics/${topicId}/edit`,
        publicUrl: status === "published" ? `/t/${topicId}` : null,
      };

      if (status === "pending") {
        await notifyAdmins({
          actorId: agent.userId,
          type: "topic_pending",
          targetType: "topic",
          targetId: topicId,
          title: "Agent 提交了待审核话题",
          body: title,
          href: "/admin?status=pending",
        });
      }

      await recordSourceRun(agent, body, {
        type: "topic",
        id: topicId,
        status,
        outputSummary: `创建话题 #${topicId}: ${title}`,
      });
      await storeAgentIdempotency(agent, idempotencyKey, "create_topic", response);
      await logAgentAction(agent, {
        action: "create_topic",
        resourceType: "topic",
        resourceId: topicId,
        status: "success",
        requestSummary: title,
        responseSummary: `status=${status}`,
        request,
        idempotencyKey,
      });

      return jsonResponse(response, 201);
    } catch (error) {
      await logAgentAction(agent, {
        action: "create_topic",
        resourceType: "topic",
        status: "failed",
        requestSummary: title,
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

async function resolveCategoryId(body: Record<string, unknown>) {
  const explicitId = Number(body.categoryId || 0);

  if (Number.isFinite(explicitId) && explicitId > 0) {
    return explicitId;
  }

  const slug = readString(body.categorySlug);

  if (!slug) {
    throw new Error("categorySlug or categoryId is required.");
  }

  const categories = await listCategories();
  const category = categories.find((item) => item.slug === slug);

  if (!category) {
    throw new Error("Category not found.");
  }

  return category.id;
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
    task: "create_topic",
    status: "success",
    inputSummary: readString(body.title),
    outputSummary: item.outputSummary,
    qualityScore: Number.isFinite(qualityScore) && qualityScore > 0 ? qualityScore : null,
    metadata: {
      source,
      quality,
    },
    items: [{ type: item.type, id: item.id, status: item.status }],
  });
}

function readTopicType(value: unknown): TopicType {
  if (
    value === "discussion" ||
    value === "question" ||
    value === "article" ||
    value === "project" ||
    value === "resource" ||
    value === "announcement"
  ) {
    return value;
  }

  return "discussion";
}

function readTopicStatus(value: unknown): TopicStatus | undefined {
  if (value === "draft" || value === "pending" || value === "published" || value === "hidden" || value === "deleted") {
    return value;
  }

  return undefined;
}

function normalizeTags(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => readString(item)).filter(Boolean).slice(0, 8);
  }

  return readString(value)
    .split(/[,，\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function readString(value: unknown) {
  return String(value || "").trim();
}

function buildSummary(contentMarkdown: string): string {
  return contentMarkdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[[^\]]+]\([^)]*\)/g, "$1")
    .replace(/[#>*_`~|[\](){}-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140);
}
