import type { APIRoute } from "astro";
import { getSessionFromAstro, isAdmin } from "@lib/auth";
import { createAiModelConfig, mapAiModelConfigForm } from "@server/services/aiConfig";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const session = await getSessionFromAstro(context);

  if (!session) {
    return context.redirect(`/login?redirect=${encodeURIComponent("/admin/ai")}`, 303);
  }

  if (!isAdmin(session)) {
    return new Response("Forbidden", { status: 403 });
  }

  try {
    const formData = await context.request.formData();
    await createAiModelConfig(mapAiModelConfigForm(formData));
    return context.redirect("/admin/ai?saved=1", 303);
  } catch (error) {
    console.error("Failed to create AI model config", error);
    return context.redirect("/admin/ai?error=1", 303);
  }
};
