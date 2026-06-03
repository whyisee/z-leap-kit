import type { APIRoute } from "astro";
import { getSessionFromAstro } from "@lib/auth";
import { updateUserProfile } from "@server/services/users";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const session = await getSessionFromAstro(context);

  if (!session) {
    return context.redirect("/login?redirect=/settings/profile", 303);
  }

  const formData = await context.request.formData();

  try {
    await updateUserProfile(session.userId, {
      displayName: String(formData.get("displayName") || ""),
      bio: String(formData.get("bio") || ""),
      websiteUrl: String(formData.get("websiteUrl") || ""),
      githubUrl: String(formData.get("githubUrl") || ""),
      locale: String(formData.get("locale") || "zh"),
    });

    return context.redirect("/settings/profile?saved=1", 303);
  } catch (error) {
    console.error("Failed to update profile", error);
    return context.redirect("/settings/profile?error=1", 303);
  }
};
