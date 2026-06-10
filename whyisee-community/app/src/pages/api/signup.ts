import type { APIRoute } from "astro";
import { authCookieName, getAuthCookieOptions, safeRedirectPath } from "@lib/auth";
import { getLangFromRequest } from "@lib/i18n";
import {
  createUserWithInvitation,
  getSignupIssueMessage,
  SignupValidationError,
  type SignupValidationIssue,
} from "@server/services/users";

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const formData = await request.formData();
  const target = safeRedirectPath(formData.get("redirect"), "/");
  const lang = getLangFromRequest(request);
  const wantsJson =
    request.headers.get("accept")?.includes("application/json") ||
    request.headers.get("x-requested-with") === "fetch";

  try {
    const session = await createUserWithInvitation({
      username: String(formData.get("username") || ""),
      email: String(formData.get("email") || ""),
      password: String(formData.get("password") || ""),
      inviteCode: String(formData.get("inviteCode") || ""),
    });

    cookies.set(authCookieName, session.sessionId, getAuthCookieOptions(import.meta.env.PROD));

    if (wantsJson) {
      return json({ ok: true, redirect: target });
    }

    return redirect(target, 303);
  } catch (error) {
    console.error("Failed to sign up", error);
    const issue = getSignupIssue(error);
    const message = getSignupIssueMessage(issue, lang);

    if (wantsJson) {
      return json({ ok: false, field: issue.field, code: issue.code, message }, 400);
    }

    return redirect(
      `/signup?error=${encodeURIComponent(issue.code)}&field=${encodeURIComponent(issue.field)}&redirect=${encodeURIComponent(target)}`,
      303,
    );
  }
};

function getSignupIssue(error: unknown): SignupValidationIssue {
  if (error instanceof SignupValidationError) {
    return error.issue;
  }

  return { field: "inviteCode", code: "signup_failed" };
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  });
}
