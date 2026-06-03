import type { APIRoute } from "astro";
import { getSessionFromAstro, safeRedirectPath } from "@lib/auth";
import { createPost } from "@server/services/posts";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const session = await getSessionFromAstro(context);
  const topicId = Number(context.params.id || 0);
  const formData = await context.request.formData();
  const redirectPath = safeRedirectPath(formData.get("redirect"), `/t/${topicId}/reply-error`);

  if (!session) {
    return context.redirect(`/login?redirect=${encodeURIComponent(redirectPath)}`, 303);
  }

  if (!Number.isFinite(topicId) || topicId <= 0) {
    return context.redirect("/latest", 303);
  }

  try {
    const result = await createPost({
      topicId,
      authorId: session.userId,
      contentMarkdown: String(formData.get("contentMarkdown") || ""),
    });

    return context.redirect(`/t/${result.topicId}/${result.topicSlug}#post-${result.postId}`, 303);
  } catch (error) {
    console.error("Failed to create reply", error);
    return context.redirect(`/t/${topicId}/reply-error?replyError=1`, 303);
  }
};
