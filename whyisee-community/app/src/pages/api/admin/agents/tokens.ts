import type { APIRoute } from "astro";
import { getSessionFromAstro, isAdmin } from "@lib/auth";
import { createAgentToken } from "@server/services/agents";

export const prerender = false;

const oneTimeTokenCookie = "whyisee_agent_token_once";

export const POST: APIRoute = async (context) => {
  const session = await getSessionFromAstro(context);

  if (!session) {
    return context.redirect(`/login?redirect=${encodeURIComponent("/admin/agents")}`, 303);
  }

  if (!isAdmin(session)) {
    return new Response("Forbidden", { status: 403 });
  }

  try {
    const formData = await context.request.formData();
    const created = await createAgentToken({
      agentProfileId: Number(formData.get("agentProfileId") || 0),
      name: String(formData.get("name") || ""),
      scopes: formData.getAll("scopes").map(String),
      expiresAt: String(formData.get("expiresAt") || "") || null,
    });

    return redirectWithToken(created.token);
  } catch (error) {
    console.error("Failed to create agent token", error);
    return context.redirect("/admin/agents?error=1", 303);
  }
};

function redirectWithToken(token: string) {
  return new Response(null, {
    status: 303,
    headers: {
      location: "/admin/agents?token=1",
      "set-cookie": `${oneTimeTokenCookie}=${encodeURIComponent(token)}; Path=/admin/agents; Max-Age=300; HttpOnly; SameSite=Lax`,
    },
  });
}
