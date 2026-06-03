import type { APIRoute } from "astro";
import { authCookieName, revokeSession, safeRedirectPath } from "@lib/auth";

export const prerender = false;

export const POST: APIRoute = async ({ cookies, redirect, request }) => {
  const url = new URL(request.url);
  const target = safeRedirectPath(url.searchParams.get("redirect"), "/");

  await revokeSession(cookies.get(authCookieName)?.value);
  cookies.delete(authCookieName, {
    path: "/",
  });

  return redirect(target, 303);
};

export const GET: APIRoute = async ({ cookies, redirect, url }) => {
  const target = safeRedirectPath(url.searchParams.get("redirect"), "/");

  await revokeSession(cookies.get(authCookieName)?.value);
  cookies.delete(authCookieName, {
    path: "/",
  });

  return redirect(target, 303);
};
