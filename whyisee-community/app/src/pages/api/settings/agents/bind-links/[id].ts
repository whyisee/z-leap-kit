import type { APIRoute } from "astro";
import { getSessionFromAstro } from "@lib/auth";
import { jsonResponse } from "@server/services/agentHttp";
import { revokeUserAgentBindLink } from "@server/services/userAgentDevices";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const session = await getSessionFromAstro(context);

  if (!session) {
    return jsonResponse({ ok: false, code: "login_required", error: "Login required." }, 401);
  }

  const id = Number(context.params.id || 0);

  if (!Number.isFinite(id) || id <= 0) {
    return jsonResponse({ ok: false, code: "invalid_bind_link", error: "Invalid bind link." }, 400);
  }

  await revokeUserAgentBindLink(session.userId, id);

  const redirect = await readRedirect(context.request);

  if (redirect) {
    return context.redirect(redirect, 303);
  }

  return jsonResponse({ ok: true });
};

async function readRedirect(request: Request) {
  try {
    const form = await request.formData();
    const redirect = String(form.get("redirect") || "");

    if (redirect.startsWith("/") && !redirect.startsWith("//")) {
      return redirect;
    }
  } catch {
    return "";
  }

  return "";
}
