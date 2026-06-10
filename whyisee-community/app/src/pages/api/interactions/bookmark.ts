import type { APIRoute } from "astro";
import { getSessionFromAstro, safeRedirectPath } from "@lib/auth";
import { getTopicInteractionState, toggleBookmark } from "@server/services/interactions";
import { recordUserContentEvent } from "@server/services/recommendations";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const formData = await context.request.formData();
  const redirectPath = safeRedirectPath(formData.get("redirect"), "/latest");
  const session = await getSessionFromAstro(context);
  const wantsJson = isJsonRequest(context.request);

  if (!session) {
    if (wantsJson) {
      return json({ ok: false, error: "login_required", loginUrl: `/login?redirect=${encodeURIComponent(redirectPath)}` }, 401);
    }

    return context.redirect(`/login?redirect=${encodeURIComponent(redirectPath)}`, 303);
  }

  const topicId = Number(formData.get("topicId") || 0);

  if (!Number.isFinite(topicId) || topicId <= 0) {
    if (wantsJson) {
      return json({ ok: false, error: "invalid_topic" }, 400);
    }

    return context.redirect(redirectPath, 303);
  }

  const enabled = await toggleBookmark(session.userId, topicId);

  if (enabled) {
    await recordUserContentEvent({
      userId: session.userId,
      eventType: "bookmark",
      targetType: "topic",
      targetId: topicId,
    });
  }

  if (wantsJson) {
    const state = await getTopicInteractionState(topicId, session.userId);

    return json({
      ok: true,
      enabled,
      topicId,
      count: state.bookmarkCount,
    });
  }

  return context.redirect(redirectPath, 303);
};

function isJsonRequest(request: Request) {
  return request.headers.get("accept")?.includes("application/json")
    || request.headers.get("x-requested-with") === "fetch";
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
