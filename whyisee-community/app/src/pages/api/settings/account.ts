import type { APIRoute } from "astro";
import { authCookieName, getSessionFromAstro } from "@lib/auth";
import { changeUserPassword } from "@server/services/users";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const session = await getSessionFromAstro(context);

  if (!session) {
    return context.redirect("/login?redirect=/settings/account", 303);
  }

  const formData = await context.request.formData();

  try {
    await changeUserPassword(
      session.userId,
      String(formData.get("currentPassword") || ""),
      String(formData.get("nextPassword") || ""),
    );
    context.cookies.delete(authCookieName, { path: "/" });

    return context.redirect("/login?reset=1", 303);
  } catch (error) {
    console.error("Failed to change password", error);
    return context.redirect("/settings/account?error=1", 303);
  }
};
