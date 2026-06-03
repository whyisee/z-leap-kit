import type { APIRoute } from "astro";
import { getSessionFromAstro, isAdmin } from "@lib/auth";
import { softDeletePost, updatePost } from "@server/services/posts";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const session = await getSessionFromAstro(context);
  const id = Number(context.params.id || 0);

  if (!session) {
    return context.redirect(`/login?redirect=${encodeURIComponent(`/posts/${id}/edit`)}`, 303);
  }

  const formData = await context.request.formData();
  const intent = String(formData.get("intent") || "update");

  try {
    if (intent === "delete") {
      const deleted = await softDeletePost({
        postId: id,
        actorId: session.userId,
        isAdmin: isAdmin(session),
      });

      return context.redirect(`/t/${deleted.topicId}/${deleted.topicSlug}`, 303);
    }

    const post = await updatePost({
      postId: id,
      actorId: session.userId,
      isAdmin: isAdmin(session),
      contentMarkdown: String(formData.get("contentMarkdown") || ""),
    });

    return context.redirect(`/t/${post.topicId}/${post.topicSlug}#post-${post.id}`, 303);
  } catch (error) {
    console.error("Failed to update reply", error);
    return context.redirect(`/posts/${id}/edit?error=1`, 303);
  }
};
