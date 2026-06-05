import type { APIRoute } from "astro";
import { getSessionFromAstro } from "@lib/auth";
import { jsonResponse } from "@server/services/agentHttp";
import {
  revokeUserAgentDeviceTokens,
  unbindUserAgentDevice,
  updateUserAgentDeviceStatus,
} from "@server/services/userAgentDevices";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const session = await getSessionFromAstro(context);

  if (!session) {
    return jsonResponse({ ok: false, code: "login_required", error: "Login required." }, 401);
  }

  const id = Number(context.params.id || 0);

  if (!Number.isFinite(id) || id <= 0) {
    return jsonResponse({ ok: false, code: "invalid_device", error: "Invalid device." }, 400);
  }

  const body = await readAction(context.request);

  if (body.intent === "unbind") {
    await unbindUserAgentDevice(session.userId, id);
  } else if (body.intent === "revoke-token") {
    await revokeUserAgentDeviceTokens(session.userId, id);
  } else {
    await updateUserAgentDeviceStatus(session.userId, id, body.status === "active" ? "active" : "disabled");
  }

  if (body.redirect) {
    return context.redirect(body.redirect, 303);
  }

  return jsonResponse({ ok: true });
};

async function readAction(request: Request) {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    try {
      return (await request.json()) as { intent?: string; status?: string; redirect?: string };
    } catch {
      return {};
    }
  }

  try {
    const form = await request.formData();
    return {
      intent: String(form.get("intent") || ""),
      status: String(form.get("status") || ""),
      redirect: safeRedirectPath(String(form.get("redirect") || ""), ""),
    };
  } catch {
    return {};
  }
}

function safeRedirectPath(value: string, fallback: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  return value;
}
