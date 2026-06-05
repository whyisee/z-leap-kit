import type { APIRoute } from "astro";
import { getSessionFromAstro, isAdmin } from "@lib/auth";
import { createInvitation, mapInvitationForm } from "@server/services/admin";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const session = await getSessionFromAstro(context);

  if (!session) {
    return context.redirect(`/login?redirect=${encodeURIComponent("/admin/invitations")}`, 303);
  }

  if (!isAdmin(session)) {
    return new Response("Forbidden", { status: 403 });
  }

  try {
    const formData = await context.request.formData();
    await createInvitation({
      ...mapInvitationForm(formData),
      createdBy: session.userId,
    });
    return context.redirect("/admin/invitations?saved=1", 303);
  } catch (error) {
    console.error("Failed to create invitation", error);
    return context.redirect("/admin/invitations?error=1", 303);
  }
};
