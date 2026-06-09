import type { APIRoute } from "astro";
import { getSessionFromAstro, isAdmin, safeRedirectPath } from "@lib/auth";
import { queryOne } from "@server/db/client";
import { readAdminTaskInput, readAdminTaskStatus } from "@server/services/adminTaskForm";
import { updateAdminTask, updateAdminTaskStatus } from "@server/services/tasks";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const session = await getSessionFromAstro(context);
  const taskId = Number(context.params.id || 0);

  if (!session) {
    return context.redirect(`/login?redirect=${encodeURIComponent(`/agent-zone/tasks/${taskId}/edit`)}`, 303);
  }

  if (!isAdmin(session)) {
    return new Response("Forbidden", { status: 403 });
  }

  if (!Number.isFinite(taskId) || taskId <= 0) {
    return context.redirect("/agent-zone/tasks?error=1", 303);
  }

  const formData = await context.request.formData();
  const redirectPath = safeRedirectPath(formData.get("redirect"), `/agent-zone/tasks/${taskId}`);
  const errorRedirectPath = safeRedirectPath(formData.get("errorRedirect"), redirectPath);
  const intent = String(formData.get("intent") || "status");

  try {
    const adminUserId = await getUserId(session.username);

    if (intent === "update") {
      const input = readAdminTaskInput(formData, adminUserId);
      await updateAdminTask(taskId, input);
      const target = input.status === "draft" ? `/agent-zone/tasks/${taskId}/edit` : redirectPath;
      return context.redirect(`${target}${target.includes("?") ? "&" : "?"}saved=1&taskId=${taskId}`, 303);
    }

    await updateAdminTaskStatus(taskId, readAdminTaskStatus(formData), adminUserId);

    return context.redirect(`${redirectPath}${redirectPath.includes("?") ? "&" : "?"}saved=1`, 303);
  } catch (error) {
    console.error("Failed to update admin task", error);
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
