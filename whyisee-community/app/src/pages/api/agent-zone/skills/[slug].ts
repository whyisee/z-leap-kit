import type { APIRoute } from "astro";
import { getSessionFromAstro, isAdmin, safeRedirectPath } from "@lib/auth";
import { queryOne } from "@server/db/client";
import { readAgentSkillInput } from "@server/services/agentSkillForm";
import { normalizeSkillSlug, readAgentSkillRecord, upsertUploadedAgentSkill } from "@server/services/agentSkillLibrary";
import { publicSkillName } from "@server/services/skillPack";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const session = await getSessionFromAstro(context);
  const slug = normalizeSkillSlug(context.params.slug || "");

  if (!session) {
    return context.redirect(`/login?redirect=${encodeURIComponent(`/agent-zone/academy/skills/${slug}`)}`, 303);
  }

  if (!isAdmin(session)) {
    return new Response("Forbidden", { status: 403 });
  }

  if (!slug || slug === publicSkillName) {
    return new Response("Built-in Skill cannot be updated here.", { status: 400 });
  }

  const existing = await readAgentSkillRecord(slug, { includeUnpublished: true });
  const formData = await context.request.formData();
  const redirectPath = safeRedirectPath(formData.get("redirect"), `/agent-zone/academy/skills/${slug}`);
  const errorRedirectPath = safeRedirectPath(formData.get("errorRedirect"), redirectPath);

  try {
    const userId = await getUserId(session.username);
    const input = await readAgentSkillInput(formData, userId, existing);
    input.slug = slug;
    await upsertUploadedAgentSkill(input);

    return context.redirect(`${redirectPath}${redirectPath.includes("?") ? "&" : "?"}saved=1`, 303);
  } catch (error) {
    console.error("Failed to update agent skill", error);
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
