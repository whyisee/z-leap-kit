import type { APIRoute } from "astro";
import { getSessionFromAstro, isAdmin } from "@lib/auth";
import type { TopicStatus, TopicType } from "@lib/types";
import { queryOne } from "@server/db/client";
import { createTopic, type TopicWriteInput } from "@server/services/topics";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const session = await getSessionFromAstro(context);

  if (!session) {
    return context.redirect("/login?redirect=/admin/topics/new", 303);
  }

  if (!isAdmin(session)) {
    return new Response("Forbidden", { status: 403 });
  }

  try {
    const formData = await context.request.formData();
    const authorId = await getAdminUserId(session.username);
    const topicId = await createTopic(readTopicInput(formData, authorId));

    return context.redirect(`/admin/topics/${topicId}/edit?saved=1`, 303);
  } catch (error) {
    console.error("Failed to create admin topic", error);
    return context.redirect("/admin/topics/new?error=1", 303);
  }
};

async function getAdminUserId(username: string) {
  const row = await queryOne<{ id: number }>("SELECT id FROM users WHERE username = $1", [username]);

  if (!row) {
    throw new Error(`Missing admin user: ${username}`);
  }

  return row.id;
}

function readTopicInput(formData: FormData, authorId: number): TopicWriteInput {
  return {
    title: String(formData.get("title") || ""),
    slug: String(formData.get("slug") || ""),
    summary: String(formData.get("summary") || ""),
    contentMarkdown: String(formData.get("contentMarkdown") || ""),
    authorId,
    categoryId: Number(formData.get("categoryId") || 0),
    type: readTopicType(formData),
    status: readTopicStatus(formData),
    isPinned: formData.get("isPinned") === "1",
    isFeatured: formData.get("isFeatured") === "1",
    tags: [String(formData.get("tags") || "")],
  };
}

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

function readTopicStatus(formData: FormData): TopicStatus {
  const value = String(formData.get("status") || "draft");

  if (value === "draft" || value === "pending" || value === "published" || value === "hidden" || value === "deleted") {
    return value;
  }

  return "draft";
}

export { readTopicInput, getAdminUserId };
