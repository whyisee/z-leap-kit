import type { APIRoute } from "astro";
import { getSessionFromAstro } from "@lib/auth";
import { recordRecommendationImpressions, recordUserContentEvent, type RecommendationSurface } from "@server/services/recommendations";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const session = await getSessionFromAstro(context);
  const body = await readJson(context.request);

  if (Array.isArray(body.items)) {
    await recordRecommendationImpressions({
      userId: session?.userId,
      anonymousKey: readString(body.anonymousKey),
      surface: readSurface(body.surface),
      items: body.items.map((item: Record<string, unknown>) => ({
        targetType: readString(item.targetType),
        targetId: Number(item.targetId || 0),
        score: Number(item.score || 0),
        reasons: Array.isArray(item.reasons) ? item.reasons.map((reason) => String(reason || "")) : [],
      })),
    });
    return json({ ok: true });
  }

  await recordUserContentEvent({
    userId: session?.userId,
    anonymousKey: readString(body.anonymousKey),
    eventType: readString(body.eventType),
    targetType: readString(body.targetType),
    targetId: Number(body.targetId || 0),
    sourceSurface: readString(body.sourceSurface),
    sourceReason: readString(body.sourceReason),
    dwellSeconds: typeof body.dwellSeconds === "number" ? body.dwellSeconds : undefined,
    metadata: typeof body.metadata === "object" && body.metadata ? body.metadata as Record<string, unknown> : undefined,
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

function readString(value: unknown) {
  return String(value || "").slice(0, 160);
}

function readSurface(value: unknown): RecommendationSurface {
  return value === "go" || value === "following" || value === "related" || value === "reading" || value === "search" ? value : "see";
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
