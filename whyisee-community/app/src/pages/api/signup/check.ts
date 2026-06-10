import type { APIRoute } from "astro";
import { getLangFromRequest } from "@lib/i18n";
import {
  getSignupIssueMessage,
  validateSignupInput,
  type SignupField,
} from "@server/services/users";

export const prerender = false;

const signupFields = new Set(["username", "email", "password", "inviteCode"]);

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const field = url.searchParams.get("field") || "";
  const lang = getLangFromRequest(request);

  if (!isSignupField(field)) {
    return json({ ok: false, message: lang === "en" ? "Unknown field." : "未知字段。" }, 400);
  }

  const issues = await validateSignupInput(
    {
      username: field === "username" ? url.searchParams.get("value") || "" : "",
      email: field === "email" ? url.searchParams.get("value") || "" : url.searchParams.get("email") || "",
      password: field === "password" ? url.searchParams.get("value") || "" : "",
      inviteCode: field === "inviteCode" ? url.searchParams.get("value") || "" : "",
    },
    { fields: [field] },
  );
  const issue = issues[0];

  if (!issue) {
    return json({
      ok: true,
      field,
      message: getValidMessage(field, lang),
    });
  }

  return json(
    {
      ok: false,
      field,
      code: issue.code,
      message: getSignupIssueMessage(issue, lang),
    },
    400,
  );
};

function isSignupField(value: string): value is SignupField {
  return signupFields.has(value);
}

function getValidMessage(field: SignupField, lang: "zh" | "en") {
  if (lang === "en") {
    return {
      username: "Username is available.",
      email: "Email can be used.",
      password: "Password length looks good.",
      inviteCode: "Invitation code is available.",
    }[field];
  }

  return {
    username: "这个用户名可以使用。",
    email: "这个邮箱可以使用。",
    password: "密码长度可以。",
    inviteCode: "邀请码可用。",
  }[field];
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  });
}
