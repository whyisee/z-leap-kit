import type { APIRoute } from "astro";
import { getSessionFromAstro, isAdmin, safeRedirectPath } from "@lib/auth";
import {
  generateExternalHotDeepAnalysisReport,
  resolveExternalHotBotUserId,
} from "@server/services/externalHotReports";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const session = await getSessionFromAstro(context);
  const id = Number(context.params.id || 0);

  if (!session) {
    return context.redirect(`/login?redirect=${encodeURIComponent("/admin/bot-jobs")}`, 303);
  }

  if (!isAdmin(session)) {
    return new Response("Forbidden", { status: 403 });
  }

  const formData = await context.request.formData();
  const redirect = safeRedirectPath(formData.get("redirect"), "/admin/bot-jobs");

  if (!Number.isFinite(id) || id <= 0) {
    return context.redirect(`${redirect}${redirect.includes("?") ? "&" : "?"}error=1`, 303);
  }

  try {
    const botUserId = await resolveExternalHotBotUserId();
    await generateExternalHotDeepAnalysisReport({
      itemId: id,
      botUserId,
      config: {
        publishMode: "draft",
        categorySlug: String(formData.get("categorySlug") || "ai"),
        tagNames: ["知乎热榜", "深度分析"],
        style: String(formData.get("style") || "sharp_but_fair"),
      },
    });

    return context.redirect(`${redirect}${redirect.includes("?") ? "&" : "?"}reportCreated=1`, 303);
  } catch (error) {
    console.error("Failed to generate external hot analysis", error);
    return context.redirect(`${redirect}${redirect.includes("?") ? "&" : "?"}error=1`, 303);
  }
};
