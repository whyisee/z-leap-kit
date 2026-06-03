import type { APIRoute } from "astro";
import { getSessionFromAstro, isAdmin } from "@lib/auth";
import { createCategory, mapCategoryForm } from "@server/services/admin";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const session = await getSessionFromAstro(context);

  if (!session) {
    return context.redirect(`/login?redirect=${encodeURIComponent("/admin/categories")}`, 303);
  }

  if (!isAdmin(session)) {
    return new Response("Forbidden", { status: 403 });
  }

  try {
    const formData = await context.request.formData();
    await createCategory(mapCategoryForm(formData));
    return context.redirect("/admin/categories?saved=1", 303);
  } catch (error) {
    console.error("Failed to create category", error);
    return context.redirect("/admin/categories?error=1", 303);
  }
};
