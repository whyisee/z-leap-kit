import type { APIRoute } from "astro";
import { getSessionFromAstro } from "@lib/auth";
import { jsonResponse } from "@server/services/agentHttp";
import { createUserAgentBindLink, listUserAgentBindLinks } from "@server/services/userAgentDevices";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const session = await getSessionFromAstro(context);

  if (!session) {
    return jsonResponse({ ok: false, code: "login_required", error: "Login required." }, 401);
  }

  return jsonResponse({
    ok: true,
    links: await listUserAgentBindLinks(session.userId, context.url.origin),
  });
};

export const POST: APIRoute = async (context) => {
  const session = await getSessionFromAstro(context);

  if (!session) {
    return jsonResponse({ ok: false, code: "login_required", error: "Login required." }, 401);
  }

  const link = await createUserAgentBindLink(session.userId, context.url.origin);

  return jsonResponse({ ok: true, link }, 201);
};
