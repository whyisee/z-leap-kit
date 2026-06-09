import type { APIRoute } from "astro";
import { getSessionFromAstro, safeRedirectPath } from "@lib/auth";
import { toggleReaction } from "@server/services/interactions";
import { recordUserContentEvent } from "@server/services/recommendations";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const formData = await context.request.formData();
  const redirectPath = safeRedirectPath(formData.get("redirect"), "/latest");
  const session = await getSessionFromAstro(context);

  if (!session) {
    return context.redirect(`/login?redirect=${encodeURIComponent(redirectPath)}`, 303);
  }

  const targetType = readTargetType(formData.get("targetType"));
  const targetId = Number(formData.get("targetId") || 0);

  if (!targetType || !Number.isFinite(targetId) || targetId <= 0) {
    return context.redirect(redirectPath, 303);
  }

  const enabled = await toggleReaction({
    userId: session.userId,
    targetType,
    targetId,
    reactionType: "like",
  });

  if (enabled) {
    await recordUserContentEvent({
      userId: session.userId,
      eventType: "like",
      targetType,
      targetId,
    });
  }

  return context.redirect(redirectPath, 303);
};

function readTargetType(value: FormDataEntryValue | null) {
  const targetType = String(value || "");
  return targetType === "topic" || targetType === "post" ? targetType : undefined;
}
