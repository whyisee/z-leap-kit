import type { APIRoute } from "astro";
import { getSessionFromAstro, safeRedirectPath } from "@lib/auth";
import { toggleBookmark } from "@server/services/interactions";
import { recordUserContentEvent } from "@server/services/recommendations";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const formData = await context.request.formData();
  const redirectPath = safeRedirectPath(formData.get("redirect"), "/latest");
  const session = await getSessionFromAstro(context);

  if (!session) {
    return context.redirect(`/login?redirect=${encodeURIComponent(redirectPath)}`, 303);
  }

  const topicId = Number(formData.get("topicId") || 0);

  if (Number.isFinite(topicId) && topicId > 0) {
    const enabled = await toggleBookmark(session.userId, topicId);

    if (enabled) {
      await recordUserContentEvent({
        userId: session.userId,
        eventType: "bookmark",
        targetType: "topic",
        targetId: topicId,
      });
    }
  }

  return context.redirect(redirectPath, 303);
};
