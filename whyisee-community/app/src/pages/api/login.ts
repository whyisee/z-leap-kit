import type { APIRoute } from "astro";
import {
  authCookieName,
  authenticateUser,
  getAuthCookieOptions,
  safeRedirectPath,
} from "@lib/auth";

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const formData = await request.formData();
  const username = String(formData.get("username") || "");
  const password = String(formData.get("password") || "");
  const target = safeRedirectPath(formData.get("redirect"), "/");
  const session = await authenticateUser(username, password);

  if (!session) {
    return redirect(`/login?error=1&redirect=${encodeURIComponent(target)}`, 303);
  }

  cookies.set(authCookieName, session.sessionId, getAuthCookieOptions(import.meta.env.PROD));

  return redirect(target, 303);
};
