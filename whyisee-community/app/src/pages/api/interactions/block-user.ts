import type { APIRoute } from "astro";
import { getSessionFromAstro, safeRedirectPath } from "@lib/auth";
import { blockUser } from "@server/services/interactions";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const session = await getSessionFromAstro(context);
  const formData = await context.request.formData();
  const redirectPath = safeRedirectPath(formData.get("redirect"), "/latest");

  if (!session) {
    return context.redirect(`/login?redirect=${encodeURIComponent(redirectPath)}`, 303);
  }

  const blockedUserId = Number(formData.get("blockedUserId") || 0);

  if (!Number.isFinite(blockedUserId) || blockedUserId <= 0 || blockedUserId === session.userId) {
    return context.redirect(redirectPath, 303);
  }

  try {
    await blockUser(session.userId, blockedUserId);
  } catch (error) {
    console.error("Failed to block user", error);
  }

  return context.redirect(redirectPath, 303);
};
