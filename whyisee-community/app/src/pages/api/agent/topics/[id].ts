import type { APIRoute } from "astro";
import type { TopicStatus, TopicType } from "@lib/types";
import {
  hasAgentScope,
  logAgentAction,
  requireAgentScope,
  type AgentContext,
} from "@server/services/agents";
import { jsonResponse, withAgent } from "@server/services/agentHttp";
import { listCategories } from "@server/services/categories";
import { listPostsForTopic } from "@server/services/posts";
import { getTopicByIdForAdmin, updateTopic } from "@server/services/topics";

export const prerender = false;

export const GET: APIRoute = async (context) =>
  withAgent(context.request, async (agent) => {
    requireAgentScope(agent, "topic:read");
    const topicId = readTopicId(context.params.id);
    const topic = await getTopicByIdForAdmin(topicId);

    if (!topic || (topic.status !== "published" && topic.authorId !== agent.userId)) {
      return jsonResponse({ ok: false, code: "topic_not_found", error: "Topic not found." }, 404);
    }

    const posts = topic.status === "published" ? await listPostsForTopic(topic.id) : [];

    return jsonResponse({
      ok: true,
      topic,
      posts,
      links: {
        publicUrl: topic.status === "published" ? `/t/${topic.id}` : null,
        adminUrl: `/admin/topics/${topic.id}/edit`,
      },
    });
  });

export const PATCH: APIRoute = async ({ params, request }) =>
  withAgent(request, async (agent) => {
    requireAgentScope(agent, "topic:update_own");
    const topicId = readTopicId(params.id);
    const topic = await getTopicByIdForAdmin(topicId);

    if (!topic || topic.authorId !== agent.userId) {
      return jsonResponse({ ok: false, code: "topic_not_editable", error: "Topic not found or not editable." }, 404);
    }

    let title = topic.title;

    try {
      const body = await readJsonBody(request);
      title = readString(body.title) || topic.title;
      const contentMarkdown = readString(body.body || body.contentMarkdown) || topic.contentMarkdown;
      const requestedStatus = readTopicStatus(body.status);
      const status = resolveStatus(topic.status, requestedStatus, agent);
      const categoryId = await resolveCategoryId(body, topic.category.id);
      const summary = readString(body.summary) || topic.summary;
      const type = readTopicType(body.type, topic.type);
      const tags = body.tags === undefined ? topic.tags.map((tag) => tag.name) : normalizeTags(body.tags);

      await updateTopic(topic.id, {
        title,
        summary,
        contentMarkdown,
        authorId: topic.authorId,
        categoryId,
        type,
        status,
        isPinned: topic.isPinned,
        isFeatured: topic.isFeatured,
        tags,
      });
      await logAgentAction(agent, {
        action: "update_topic",
        resourceType: "topic",
        resourceId: topic.id,
        status: "success",
        requestSummary: title,
        responseSummary: `status=${status}`,
        request,
      });

      return jsonResponse({
        ok: true,
        topicId: topic.id,
        status,
        reviewUrl: `/admin/topics/${topic.id}/edit`,
        publicUrl: status === "published" ? `/t/${topic.id}` : null,
      });
    } catch (error) {
      await logAgentAction(agent, {
        action: "update_topic",
        resourceType: "topic",
        resourceId: topic.id,
        status: "failed",
        requestSummary: title,
        responseSummary: error instanceof Error ? error.message : "failed",
        request,
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

async function resolveCategoryId(body: Record<string, unknown>, fallbackId: number) {
  const explicitId = Number(body.categoryId || 0);

  if (Number.isFinite(explicitId) && explicitId > 0) {
    return explicitId;
  }

  const slug = readString(body.categorySlug);

  if (!slug) {
    return fallbackId;
  }

  const category = (await listCategories()).find((item) => item.slug === slug);

  if (!category) {
    throw new Error("Category not found.");
  }

  return category.id;
}

function resolveStatus(current: TopicStatus, requested: TopicStatus | undefined, agent: AgentContext) {
  if (!requested) {
    return current;
  }

  if (requested === "published" && !hasAgentScope(agent, "topic:publish")) {
    throw new Error("Publishing requires topic:publish scope.");
  }

  if (requested === "draft" || requested === "pending" || requested === "published") {
    return requested;
  }

  return current;
}

function readTopicType(value: unknown, fallback: TopicType): TopicType {
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

  return fallback;
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
