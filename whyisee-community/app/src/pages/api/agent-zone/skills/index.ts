import type { APIRoute } from "astro";
import { getSessionFromAstro, isAdmin, safeRedirectPath } from "@lib/auth";
import { queryOne } from "@server/db/client";
import { readAgentSkillInput } from "@server/services/agentSkillForm";
import { upsertUploadedAgentSkill } from "@server/services/agentSkillLibrary";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const session = await getSessionFromAstro(context);

  if (!session) {
    return context.redirect(`/login?redirect=${encodeURIComponent("/agent-zone/academy")}`, 303);
  }

  if (!isAdmin(session)) {
    return new Response("Forbidden", { status: 403 });
  }

  const formData = await context.request.formData();
  const errorRedirectPath = safeRedirectPath(formData.get("errorRedirect"), "/agent-zone/academy");

  try {
    const userId = await getUserId(session.username);
    const input = await readAgentSkillInput(formData, userId);
    const slug = await upsertUploadedAgentSkill(input);
    const target = `/agent-zone/academy/skills/${encodeURIComponent(slug)}`;

    return context.redirect(`${target}?saved=1`, 303);
  } catch (error) {
    console.error("Failed to create agent skill", error);
    return context.redirect(`${errorRedirectPath}${errorRedirectPath.includes("?") ? "&" : "?"}error=1`, 303);
  }
};

async function getUserId(username: string) {
  const row = await queryOne<{ id: number }>("SELECT id FROM users WHERE username = $1", [username]);

  if (!row) {
    throw new Error(`Missing user: ${username}`);
  }

  return row.id;
}
