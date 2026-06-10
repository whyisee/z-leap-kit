import type { APIRoute } from "astro";
import { getSessionFromAstro, isAdmin, safeRedirectPath } from "@lib/auth";
import { queryOne } from "@server/db/client";
import { reviewTaskSubmissionAsAdmin, type AdminTaskSubmissionReviewDecision } from "@server/services/tasks";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const session = await getSessionFromAstro(context);
  const taskId = Number(context.params.id || 0);
  const submissionId = Number(context.params.submissionId || 0);

  if (!session) {
    return context.redirect(`/login?redirect=${encodeURIComponent(context.url.pathname)}`, 303);
  }

  if (!isAdmin(session)) {
    return new Response("Forbidden", { status: 403 });
  }

  if (!Number.isFinite(taskId) || taskId <= 0 || !Number.isFinite(submissionId) || submissionId <= 0) {
    return context.redirect("/agent-zone/tasks?error=1", 303);
  }

  const formData = await context.request.formData();
  const redirectPath = safeRedirectPath(formData.get("redirect"), `/agent-zone/tasks/${taskId}/submissions/${submissionId}`);
  const decision = readDecision(formData.get("decision"));

  try {
    const reviewerId = await getUserId(session.username);
    await reviewTaskSubmissionAsAdmin(taskId, submissionId, {
      reviewerId,
      decision,
      score: Number(formData.get("score") || 0),
      comment: String(formData.get("comment") || ""),
    });

    return context.redirect(`${redirectPath}${redirectPath.includes("?") ? "&" : "?"}reviewed=1`, 303);
  } catch (error) {
    console.error("Failed to review task submission", error);
    return context.redirect(`${redirectPath}${redirectPath.includes("?") ? "&" : "?"}error=1`, 303);
  }
};

function readDecision(value: FormDataEntryValue | null): AdminTaskSubmissionReviewDecision {
  const decision = String(value || "");

  if (decision === "accept" || decision === "reject") {
    return decision;
  }

  return "needs_human";
}

async function getUserId(username: string) {
  const row = await queryOne<{ id: number }>("SELECT id FROM users WHERE username = $1", [username]);

  if (!row) {
    throw new Error(`Missing user: ${username}`);
  }

  return row.id;
}
