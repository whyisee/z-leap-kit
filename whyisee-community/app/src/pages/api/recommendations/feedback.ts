import type { APIRoute } from "astro";
import { getSessionFromAstro } from "@lib/auth";
import { recordUserContentEvent } from "@server/services/recommendations";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const session = await getSessionFromAstro(context);
  const body = await readJson(context.request);

  await recordUserContentEvent({
    userId: session?.userId,
    anonymousKey: readString(body.anonymousKey),
    eventType: readFeedback(body.feedback),
    targetType: readString(body.targetType),
    targetId: Number(body.targetId || 0),
    sourceSurface: readString(body.sourceSurface),
    sourceReason: readString(body.sourceReason),
    metadata: {
      feedback: readString(body.feedback),
    },
  });

  return json({ ok: true });
};

async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function readFeedback(value: unknown) {
  const feedback = String(value || "");
  if (feedback === "hide" || feedback === "dismiss" || feedback === "report" || feedback === "block") {
    return feedback;
  }

  return "dismiss";
}

function readString(value: unknown) {
  return String(value || "").slice(0, 160);
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

