import type { APIRoute } from "astro";
import { getSessionFromAstro, isAdmin, safeRedirectPath } from "@lib/auth";
import { mapInvitationForm, setInvitationDisabled, updateInvitation } from "@server/services/admin";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const session = await getSessionFromAstro(context);

  if (!session) {
    return context.redirect(`/login?redirect=${encodeURIComponent("/admin/invitations")}`, 303);
  }

  if (!isAdmin(session)) {
    return new Response("Forbidden", { status: 403 });
  }

  const id = Number(context.params.id || 0);
  const formData = await context.request.formData();
  const redirectPath = safeRedirectPath(formData.get("redirect"), "/admin/invitations");

  if (!Number.isFinite(id) || id <= 0) {
    return context.redirect(`${redirectPath}${redirectPath.includes("?") ? "&" : "?"}error=1`, 303);
  }

  try {
    const action = String(formData.get("action") || "update");

    if (action === "disable") {
      await setInvitationDisabled(id, true);
    } else if (action === "enable") {
      await setInvitationDisabled(id, false);
    } else {
      await updateInvitation(id, mapInvitationForm(formData));
    }

    return context.redirect(`${redirectPath}${redirectPath.includes("?") ? "&" : "?"}saved=1`, 303);
  } catch (error) {
    console.error("Failed to update invitation", error);
    return context.redirect(`${redirectPath}${redirectPath.includes("?") ? "&" : "?"}error=1`, 303);
  }
};
