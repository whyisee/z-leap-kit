import type { APIRoute } from "astro";
import { getSessionFromAstro, safeRedirectPath } from "@lib/auth";
import { sendDirectMessage } from "@server/services/messages";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const session = await getSessionFromAstro(context);
  const fallback = "/notifications?tab=messages";

  if (!session) {
    return context.redirect(`/login?redirect=${encodeURIComponent(fallback)}`, 303);
  }

  const formData = await context.request.formData();
  const redirectPath = safeRedirectPath(formData.get("redirect"), fallback);

  try {
    const result = await sendDirectMessage({
      senderId: session.userId,
      recipientUsername: String(formData.get("recipient") || ""),
      conversationId: Number(formData.get("conversationId") || 0) || undefined,
      body: String(formData.get("body") || ""),
    });

    return context.redirect(`/notifications?tab=messages&conversation=${result.conversationId}`, 303);
  } catch (error) {
    console.error("Failed to send direct message", error);
    const params = new URLSearchParams();
    params.set("tab", "messages");
    params.set("error", "send");

    const recipient = String(formData.get("recipient") || "").trim();
    if (recipient) {
      params.set("to", recipient.replace(/^@/, ""));
    }

    if (redirectPath.includes("conversation=")) {
      return context.redirect(`${redirectPath}${redirectPath.includes("?") ? "&" : "?"}error=send`, 303);
    }

    return context.redirect(`/notifications?${params.toString()}`, 303);
  }
};
