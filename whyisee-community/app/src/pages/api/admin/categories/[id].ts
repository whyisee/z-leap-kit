import type { APIRoute } from "astro";
import { getSessionFromAstro, isAdmin, safeRedirectPath } from "@lib/auth";
import { mapCategoryForm, updateCategory } from "@server/services/admin";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const session = await getSessionFromAstro(context);

  if (!session) {
    return context.redirect(`/login?redirect=${encodeURIComponent("/admin/categories")}`, 303);
  }

  if (!isAdmin(session)) {
    return new Response("Forbidden", { status: 403 });
  }

  const id = Number(context.params.id || 0);
  const formData = await context.request.formData();
  const redirectPath = safeRedirectPath(formData.get("redirect"), "/admin/categories");

  if (!Number.isFinite(id) || id <= 0) {
    return context.redirect(`${redirectPath}${redirectPath.includes("?") ? "&" : "?"}error=1`, 303);
  }

  try {
    await updateCategory(id, mapCategoryForm(formData));
    return context.redirect(redirectPath, 303);
  } catch (error) {
    console.error("Failed to update category", error);
    return context.redirect(`${redirectPath}${redirectPath.includes("?") ? "&" : "?"}error=1`, 303);
  }
};
