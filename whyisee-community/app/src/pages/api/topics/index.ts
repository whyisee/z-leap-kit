import type { APIRoute } from "astro";
import { getSessionFromAstro } from "@lib/auth";
import type { TopicType } from "@lib/types";
import { notifyAdmins } from "@server/services/notifications";
import { createTopic } from "@server/services/topics";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const session = await getSessionFromAstro(context);

  if (!session) {
    return context.redirect("/login?redirect=/new-topic", 303);
  }

  const formData = await context.request.formData();

  try {
    const status = session.role === "admin" ? "published" : "pending";
    const title = String(formData.get("title") || "");
    const contentMarkdown = String(formData.get("contentMarkdown") || "");
    const summary = String(formData.get("summary") || "").trim() || buildSummary(contentMarkdown);
    const topicId = await createTopic({
      title,
      slug: "",
      summary,
      contentMarkdown,
      authorId: session.userId,
      categoryId: Number(formData.get("categoryId") || 0),
      type: readTopicType(formData),
      status,
      isPinned: false,
      isFeatured: false,
      tags: [String(formData.get("tags") || "")],
    });

    if (status === "pending") {
      await notifyAdmins({
        actorId: session.userId,
        type: "topic_pending",
        targetType: "topic",
        targetId: topicId,
        title: "新的待审核话题",
        body: title,
        href: "/admin?status=pending",
      });
    }

    return context.redirect(`/topics/${topicId}/edit?saved=1`, 303);
  } catch (error) {
    console.error("Failed to submit topic", error);
    return context.redirect("/new-topic?error=1", 303);
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
