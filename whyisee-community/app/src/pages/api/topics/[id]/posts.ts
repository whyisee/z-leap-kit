import type { APIRoute } from "astro";
import { getSessionFromAstro, safeRedirectPath } from "@lib/auth";
import { createPost, topicHref } from "@server/services/posts";
import { recordUserContentEvent } from "@server/services/recommendations";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const session = await getSessionFromAstro(context);
  const topicId = Number(context.params.id || 0);
  const formData = await context.request.formData();
  const redirectPath = safeRedirectPath(formData.get("redirect"), `/t/${topicId}`);

  if (!session) {
    return context.redirect(`/login?redirect=${encodeURIComponent(redirectPath)}`, 303);
  }

  if (!Number.isFinite(topicId) || topicId <= 0) {
    return context.redirect("/latest", 303);
  }

  try {
    const parentPostId = Number(formData.get("parentPostId") || 0);
    const result = await createPost({
      topicId,
      parentPostId: Number.isFinite(parentPostId) && parentPostId > 0 ? parentPostId : undefined,
      authorId: session.userId,
      contentMarkdown: String(formData.get("contentMarkdown") || ""),
    });

    await recordUserContentEvent({
      userId: session.userId,
      eventType: "reply",
      targetType: "topic",
      targetId: topicId,
    });

    return context.redirect(topicHref(result.topicId, result.topicSlug, `post-${result.postId}`), 303);
  } catch (error) {
    console.error("Failed to create reply", error);
    return context.redirect(`/t/${topicId}?replyError=1`, 303);
  }
};
