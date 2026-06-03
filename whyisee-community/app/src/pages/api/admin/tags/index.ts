import type { APIRoute } from "astro";
import { getSessionFromAstro, isAdmin } from "@lib/auth";
import { createTag, mapTagForm } from "@server/services/admin";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const session = await getSessionFromAstro(context);

  if (!session) {
    return context.redirect(`/login?redirect=${encodeURIComponent("/admin/tags")}`, 303);
  }

  if (!isAdmin(session)) {
    return new Response("Forbidden", { status: 403 });
  }

  try {
    const formData = await context.request.formData();
    await createTag(mapTagForm(formData));
    return context.redirect("/admin/tags?saved=1", 303);
  } catch (error) {
    console.error("Failed to create tag", error);
    return context.redirect("/admin/tags?error=1", 303);
  }
};
