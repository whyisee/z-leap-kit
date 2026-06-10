import type { APIRoute } from "astro";
import { getSessionFromAstro, safeRedirectPath } from "@lib/auth";
import { countTargetLikes, toggleReaction } from "@server/services/interactions";
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

  const targetType = readTargetType(formData.get("targetType"));
  const targetId = Number(formData.get("targetId") || 0);

  if (!targetType || !Number.isFinite(targetId) || targetId <= 0) {
    if (wantsJson) {
      return json({ ok: false, error: "invalid_target" }, 400);
    }

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

  if (wantsJson) {
    return json({
      ok: true,
      enabled,
      targetType,
      targetId,
      count: await countTargetLikes(targetType, targetId),
    });
  }

  return context.redirect(redirectPath, 303);
};

function readTargetType(value: FormDataEntryValue | null) {
  const targetType = String(value || "");
  return targetType === "topic" || targetType === "post" ? targetType : undefined;
}

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
