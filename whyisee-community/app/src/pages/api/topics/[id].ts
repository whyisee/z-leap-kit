import type { APIRoute } from "astro";
import { getSessionFromAstro, isAdmin } from "@lib/auth";
import type { TopicStatus, TopicType } from "@lib/types";
import { getTopicByIdForAdmin, updateTopic, updateTopicAdminState } from "@server/services/topics";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const session = await getSessionFromAstro(context);
  const id = Number(context.params.id || 0);

  if (!session) {
    return context.redirect(`/login?redirect=${encodeURIComponent(`/topics/${id}/edit`)}`, 303);
  }

  const topic = Number.isFinite(id) ? await getTopicByIdForAdmin(id) : undefined;

  if (!topic || (topic.authorId !== session.userId && !isAdmin(session))) {
    return new Response("Not found", { status: 404 });
  }

  const formData = await context.request.formData();
  const intent = String(formData.get("intent") || "update");

  try {
    if (intent === "delete") {
      await updateTopicAdminState(topic.id, { status: "deleted" });
      return context.redirect(`/u/${session.username}?deleted=1`, 303);
    }

    const status = readSubmissionStatus(formData, isAdmin(session));

    await updateTopic(topic.id, {
      title: String(formData.get("title") || ""),
      slug: topic.slug,
      summary: String(formData.get("summary") || ""),
      contentMarkdown: String(formData.get("contentMarkdown") || ""),
      authorId: topic.authorId,
      categoryId: Number(formData.get("categoryId") || 0),
      type: readTopicType(formData),
      status,
      isPinned: topic.isPinned,
      isFeatured: topic.isFeatured,
      tags: [String(formData.get("tags") || "")],
    });

    if (status === "draft") {
      return context.redirect(`/topics/${topic.id}/edit?saved=1`, 303);
    }

    return context.redirect(`/u/${encodeURIComponent(session.username)}?tab=topics&submitted=1#topics`, 303);
  } catch (error) {
    console.error("Failed to update user topic", error);
    return context.redirect(`/topics/${topic.id}/edit?error=1`, 303);
  }
};

function readTopicType(formData: FormData): TopicType {
  const value = String(formData.get("type") || "discussion");

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

function readSubmissionStatus(formData: FormData, canPublish: boolean): TopicStatus {
  const values = formData.getAll("status").map((value) => String(value || ""));
  const value = values[values.length - 1] || "pending";

  if (value === "draft" || value === "pending") {
    return value;
  }

  if (canPublish && value === "published") {
    return value;
  }

  return "pending";
}
