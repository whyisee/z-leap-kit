import type { APIRoute } from "astro";
import { getSessionFromAstro } from "@lib/auth";
import { getLangFromAstro } from "@lib/i18n";
import type { TopicType } from "@lib/types";
import { AiServiceError } from "@server/services/ai";
import { listCategories, listTags } from "@server/services/categories";
import { isWritingAiAction, runWritingAiAction } from "@server/services/writingAi";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const session = await getSessionFromAstro(context);
  const lang = getLangFromAstro(context);

  if (!session) {
    return json({ error: "login_required" }, 401);
  }

  let body: unknown;

  try {
    body = await context.request.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const action = String(readBodyValue(body, "action") || "");
  const title = String(readBodyValue(body, "title") || "").trim();
  const contentMarkdown = String(readBodyValue(body, "contentMarkdown") || "").trim();

  if (!isWritingAiAction(action)) {
    return json({ error: "invalid_action" }, 400);
  }

  if (!title && !contentMarkdown) {
    return json({ error: "empty_draft" }, 400);
  }

  try {
    const [categories, tags] = await Promise.all([listCategories(lang), listTags(lang)]);
    const result = await runWritingAiAction({
      action,
      title,
      body: contentMarkdown,
      summary: String(readBodyValue(body, "summary") || ""),
      categoryId: Number(readBodyValue(body, "categoryId") || 0),
      type: readTopicType(String(readBodyValue(body, "type") || "discussion")),
      tagsText: String(readBodyValue(body, "tags") || ""),
      categories,
      tags,
      lang,
    });

    return json(result);
  } catch (error) {
    if (error instanceof AiServiceError) {
      console.error("Writing AI failed", error.code, error.message);
      return json({ error: error.code }, errorStatus(error.code));
    }

    console.error("Writing AI failed", error);
    return json({ error: "ai_failed" }, 500);
  }
};

function readBodyValue(body: unknown, key: string) {
  if (!body || typeof body !== "object") {
    return undefined;
  }

  return (body as Record<string, unknown>)[key];
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  });
}

function readTopicType(value: string): TopicType {
  if (
    value === "discussion" ||
    value === "question" ||
    value === "article" ||
    value === "project" ||
    value === "resource" ||
    value === "announcement"
  ) {
    return value;
  }

  return "discussion";
}

function errorStatus(code: string) {
  if (code === "ai_not_configured" || code === "ai_key_missing") {
    return 503;
  }

  if (code === "ai_timeout") {
    return 504;
  }

  return 502;
}
