import type { APIRoute } from "astro";
import { getSessionFromAstro, isAdmin, safeRedirectPath } from "@lib/auth";
import { revokeAgentToken } from "@server/services/agents";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const session = await getSessionFromAstro(context);

  if (!session) {
    return context.redirect(`/login?redirect=${encodeURIComponent("/admin/agents")}`, 303);
  }

  if (!isAdmin(session)) {
    return new Response("Forbidden", { status: 403 });
  }

  const formData = await context.request.formData();
  const redirectPath = safeRedirectPath(formData.get("redirect"), "/admin/agents");
  const id = Number(context.params.id || 0);

  if (!Number.isFinite(id) || id <= 0) {
    return context.redirect(`${redirectPath}${redirectPath.includes("?") ? "&" : "?"}error=1`, 303);
  }

  try {
    await revokeAgentToken(id);
    return context.redirect(`${redirectPath}${redirectPath.includes("?") ? "&" : "?"}saved=1`, 303);
  } catch (error) {
    console.error("Failed to revoke agent token", error);
    return context.redirect(`${redirectPath}${redirectPath.includes("?") ? "&" : "?"}error=1`, 303);
  }
};
