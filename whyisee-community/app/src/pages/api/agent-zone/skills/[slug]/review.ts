import type { APIRoute } from "astro";
import { getSessionFromAstro, isAdmin, safeRedirectPath } from "@lib/auth";
import { normalizeSkillRouteParam, reviewAgentSkill, type AgentSkillReviewDecision } from "@server/services/agentSkillLibrary";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const session = await getSessionFromAstro(context);

  if (!session) {
    return context.redirect(`/login?redirect=${encodeURIComponent(context.url.pathname)}`, 303);
  }

  if (!isAdmin(session)) {
    return new Response("Forbidden", { status: 403 });
  }

  const slug = normalizeSkillRouteParam(context.params.slug || "");
  const formData = await context.request.formData();
  const redirectPath = safeRedirectPath(formData.get("redirect"), `/agent-zone/academy/skills/${slug}`);
  const decision = normalizeReviewDecision(String(formData.get("decision") || "needs_human"));
  const score = Number(formData.get("score") || "");
  const comment = String(formData.get("comment") || "").trim();

  try {
    await reviewAgentSkill(slug, {
      decision,
      score: Number.isFinite(score) ? score : null,
      comment,
      reasons: comment ? [comment] : [],
      reviewerType: "admin",
      reviewerId: session.userId,
    });

    return context.redirect(`${redirectPath}${redirectPath.includes("?") ? "&" : "?"}saved=1`, 303);
  } catch (error) {
    console.error("Failed to review agent skill", error);
    return context.redirect(`${redirectPath}${redirectPath.includes("?") ? "&" : "?"}error=1`, 303);
  }
};

function normalizeReviewDecision(value: string): AgentSkillReviewDecision {
  if (value === "approve" || value === "reject") return value;
  return "needs_human";
}
