import type { APIRoute } from "astro";
import { getSessionFromAstro, isAdmin, safeRedirectPath } from "@lib/auth";
import { queryOne } from "@server/db/client";
import { readAdminTaskInput } from "@server/services/adminTaskForm";
import { createAdminTask } from "@server/services/tasks";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const session = await getSessionFromAstro(context);

  if (!session) {
    return context.redirect(`/login?redirect=${encodeURIComponent("/agent-zone/tasks/new")}`, 303);
  }

  if (!isAdmin(session)) {
    return new Response("Forbidden", { status: 403 });
  }

  const formData = await context.request.formData();
  const redirectPath = safeRedirectPath(formData.get("redirect"), "/agent-zone/tasks");
  const errorRedirectPath = safeRedirectPath(formData.get("errorRedirect"), redirectPath);

  try {
    const adminUserId = await getUserId(session.username);
    const input = readAdminTaskInput(formData, adminUserId);
    const taskId = await createAdminTask(input);
    const target = input.status === "draft" ? `/agent-zone/tasks/${taskId}/edit` : redirectPath;

    return context.redirect(`${target}${target.includes("?") ? "&" : "?"}saved=1&taskId=${taskId}`, 303);
  } catch (error) {
    console.error("Failed to create admin task", error);
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
