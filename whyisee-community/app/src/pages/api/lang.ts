import type { APIRoute } from "astro";
import { langCookieName, normalizeLang } from "@lib/i18n";

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const formData = await request.formData();
  const lang = normalizeLang(String(formData.get("lang") || ""));
  const target = safeRedirectPath(formData.get("redirect"));

  cookies.set(langCookieName, lang, {
    httpOnly: false,
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
    sameSite: "lax",
  });

  return redirect(target, 303);
};

export const GET: APIRoute = ({ url, cookies, redirect }) => {
  const lang = normalizeLang(url.searchParams.get("lang"));
  const target = safeRedirectPath(url.searchParams.get("redirect"));

  cookies.set(langCookieName, lang, {
    httpOnly: false,
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
    sameSite: "lax",
  });

  return redirect(target, 303);
};

function safeRedirectPath(value: FormDataEntryValue | string | null): string {
  const target = String(value || "/");

  if (!target.startsWith("/") || target.startsWith("//")) {
    return "/";
  }

  return target;
}
