import type { APIRoute } from "astro";
import { getSessionFromAstro, isAdmin, safeRedirectPath } from "@lib/auth";
import type { TopicStatus } from "@lib/types";
import { getAdminUserId, readTopicInput } from "./index";
import { updateTopic, updateTopicAdminState } from "@server/services/topics";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const session = await getSessionFromAstro(context);
  const id = Number(context.params.id || 0);

  if (!session) {
    return context.redirect(`/login?redirect=${encodeURIComponent(`/admin/topics/${id}/edit`)}`, 303);
  }

  if (!isAdmin(session)) {
    return new Response("Forbidden", { status: 403 });
  }

  if (!Number.isFinite(id) || id <= 0) {
    return context.redirect("/admin?error=1", 303);
  }

  const formData = await context.request.formData();
  const intent = String(formData.get("intent") || "update");
  const target = safeRedirectPath(formData.get("redirect"), `/admin/topics/${id}/edit`);

  try {
    if (intent === "update") {
      const authorId = await getAdminUserId(session.username);
      await updateTopic(id, readTopicInput(formData, authorId));
      return context.redirect(`/admin/topics/${id}/edit?saved=1`, 303);
    }

    if (intent === "status") {
      await updateTopicAdminState(id, { status: readStatusPatch(formData) });
      return context.redirect(target, 303);
    }

    if (intent === "pinned") {
      await updateTopicAdminState(id, { isPinned: formData.get("value") === "1" });
      return context.redirect(target, 303);
    }

    if (intent === "featured") {
      await updateTopicAdminState(id, { isFeatured: formData.get("value") === "1" });
      return context.redirect(target, 303);
    }
  } catch (error) {
    console.error("Failed to update admin topic", error);
    return context.redirect(`${target}${target.includes("?") ? "&" : "?"}error=1`, 303);
  }

  return context.redirect(target, 303);
};

function readStatusPatch(formData: FormData): TopicStatus {
  const value = String(formData.get("status") || "draft");

  if (value === "draft" || value === "pending" || value === "published" || value === "hidden" || value === "deleted") {
    return value;
  }

  return "draft";
}
