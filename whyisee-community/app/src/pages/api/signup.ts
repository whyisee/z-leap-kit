import type { APIRoute } from "astro";
import { authCookieName, getAuthCookieOptions, safeRedirectPath } from "@lib/auth";
import { createUserWithInvitation } from "@server/services/users";

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const formData = await request.formData();
  const target = safeRedirectPath(formData.get("redirect"), "/");

  try {
    const session = await createUserWithInvitation({
      username: String(formData.get("username") || ""),
      email: String(formData.get("email") || ""),
      password: String(formData.get("password") || ""),
      inviteCode: String(formData.get("inviteCode") || ""),
    });

    cookies.set(authCookieName, session.sessionId, getAuthCookieOptions(import.meta.env.PROD));

    return redirect(target, 303);
  } catch (error) {
    console.error("Failed to sign up", error);
    return redirect(`/signup?error=1&redirect=${encodeURIComponent(target)}`, 303);
  }
};
