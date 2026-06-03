import type { APIRoute } from "astro";
import {
  authCookieName,
  authenticateUser,
  getSessionMaxAgeSeconds,
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

  cookies.set(authCookieName, session.sessionId, {
    httpOnly: true,
    maxAge: getSessionMaxAgeSeconds(),
    path: "/",
    sameSite: "lax",
    secure: import.meta.env.PROD,
  });

  return redirect(target, 303);
};
