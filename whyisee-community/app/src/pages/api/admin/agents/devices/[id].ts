import type { APIRoute } from "astro";
import { getSessionFromAstro, isAdmin, safeRedirectPath } from "@lib/auth";
import {
  revokeAnyUserAgentDeviceTokens,
  updateAnyUserAgentDeviceStatus,
} from "@server/services/userAgentDevices";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const session = await getSessionFromAstro(context);
  const redirect = safeRedirectPath(await readRedirect(context.request), "/admin/agents");

  if (!session) {
    return context.redirect(`/login?redirect=${encodeURIComponent(redirect)}`, 303);
  }

  if (!isAdmin(session)) {
    return context.redirect("/", 303);
  }

  const id = Number(context.params.id || 0);

  if (!Number.isFinite(id) || id <= 0) {
    return context.redirect(`${redirect}?error=1`, 303);
  }

  const form = await context.request.formData();
  const intent = String(form.get("intent") || "");

  if (intent === "revoke-token") {
    await revokeAnyUserAgentDeviceTokens(id);
  } else {
    await updateAnyUserAgentDeviceStatus(id, String(form.get("status") || "") === "active" ? "active" : "disabled");
  }

  return context.redirect(`${redirect}?saved=1`, 303);
};

async function readRedirect(request: Request) {
  try {
    const clone = request.clone();
    const form = await clone.formData();
    return form.get("redirect");
  } catch {
    return "/admin/agents";
  }
}
