import type { APIRoute } from "astro";
import { getSessionFromAstro, safeRedirectPath } from "@lib/auth";
import { createReport } from "@server/services/reports";

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
  const reason = String(formData.get("reason") || "").trim();

  if (!targetType || !Number.isFinite(targetId) || targetId <= 0 || reason.length < 2) {
    return context.redirect(`${redirectPath}${redirectPath.includes("?") ? "&" : "?"}reportError=1`, 303);
  }

  await createReport({
    reporterId: session.userId,
    targetType,
    targetId,
    reason,
    details: String(formData.get("details") || "").trim(),
  });

  return context.redirect(`${redirectPath}${redirectPath.includes("?") ? "&" : "?"}reported=1`, 303);
};

function readTargetType(value: FormDataEntryValue | null) {
  const targetType = String(value || "");
  if (targetType === "topic" || targetType === "post" || targetType === "user") {
    return targetType;
  }

  return undefined;
}
