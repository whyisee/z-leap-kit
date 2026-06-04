import type { APIRoute } from "astro";
import { getSessionFromAstro, isAdmin, safeRedirectPath } from "@lib/auth";
import {
  createAgentProfile,
  updateAgentProfileStatus,
} from "@server/services/agents";

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
  const intent = String(formData.get("intent") || "create");

  try {
    if (intent === "status") {
      const profileId = Number(formData.get("profileId") || 0);
      const status = formData.get("status") === "disabled" ? "disabled" : "active";

      if (!Number.isFinite(profileId) || profileId <= 0) {
        throw new Error("Invalid agent profile.");
      }

      await updateAgentProfileStatus(profileId, status);
      return context.redirect(`${redirectPath}${redirectPath.includes("?") ? "&" : "?"}saved=1`, 303);
    }

    await createAgentProfile({
      userId: Number(formData.get("userId") || 0),
      name: String(formData.get("name") || ""),
      description: String(formData.get("description") || ""),
      defaultScopes: formData.getAll("scopes").map(String),
      rateLimitPerHour: Number(formData.get("rateLimitPerHour") || 60),
    });

    return context.redirect(`${redirectPath}${redirectPath.includes("?") ? "&" : "?"}saved=1`, 303);
  } catch (error) {
    console.error("Failed to save agent profile", error);
    return context.redirect(`${redirectPath}${redirectPath.includes("?") ? "&" : "?"}error=1`, 303);
  }
};
