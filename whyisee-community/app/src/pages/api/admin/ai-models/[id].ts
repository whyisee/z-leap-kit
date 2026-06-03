import type { APIRoute } from "astro";
import { getSessionFromAstro, isAdmin, safeRedirectPath } from "@lib/auth";
import { mapAiModelConfigForm, updateAiModelConfig } from "@server/services/aiConfig";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const session = await getSessionFromAstro(context);

  if (!session) {
    return context.redirect(`/login?redirect=${encodeURIComponent("/admin/ai")}`, 303);
  }

  if (!isAdmin(session)) {
    return new Response("Forbidden", { status: 403 });
  }

  const id = Number(context.params.id || 0);
  const formData = await context.request.formData();
  const redirectPath = safeRedirectPath(formData.get("redirect"), "/admin/ai?saved=1");

  if (!Number.isFinite(id) || id <= 0) {
    return context.redirect("/admin/ai?error=1", 303);
  }

  try {
    await updateAiModelConfig(id, mapAiModelConfigForm(formData));
    return context.redirect(redirectPath, 303);
  } catch (error) {
    console.error("Failed to update AI model config", error);
    return context.redirect("/admin/ai?error=1", 303);
  }
};
