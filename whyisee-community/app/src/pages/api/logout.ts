import type { APIRoute } from "astro";
import { authCookieName, safeRedirectPath } from "@lib/auth";

export const prerender = false;

export const POST: APIRoute = ({ cookies, redirect, request }) => {
  const url = new URL(request.url);
  const target = safeRedirectPath(url.searchParams.get("redirect"), "/");

  cookies.delete(authCookieName, {
    path: "/",
  });

  return redirect(target, 303);
};

export const GET: APIRoute = ({ cookies, redirect, url }) => {
  const target = safeRedirectPath(url.searchParams.get("redirect"), "/");

  cookies.delete(authCookieName, {
    path: "/",
  });

  return redirect(target, 303);
};
