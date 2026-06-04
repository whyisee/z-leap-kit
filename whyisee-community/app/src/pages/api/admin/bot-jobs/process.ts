import type { APIRoute } from "astro";
import { getSessionFromAstro, isAdmin, safeRedirectPath } from "@lib/auth";
import { processNextBotJob } from "@server/services/botJobs";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const session = await getSessionFromAstro(context);

  if (!session) {
    return context.redirect(`/login?redirect=${encodeURIComponent("/admin/bot-jobs")}`, 303);
  }

  if (!isAdmin(session)) {
    return new Response("Forbidden", { status: 403 });
  }

  const formData = await context.request.formData();
  const redirect = safeRedirectPath(formData.get("redirect"), "/admin/bot-jobs");

  try {
    await processNextBotJob();
    return context.redirect(`${redirect}${redirect.includes("?") ? "&" : "?"}processed=1`, 303);
  } catch (error) {
    console.error("Failed to process bot job", error);
    return context.redirect(`${redirect}${redirect.includes("?") ? "&" : "?"}error=1`, 303);
  }
};
