import type { APIRoute } from "astro";
import { normalizeSkillRouteParam, readAgentSkillDownload } from "@server/services/agentSkillLibrary";
import { getSessionFromAstro, isAdmin } from "@lib/auth";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const { params, url } = context;
  const slug = normalizeSkillRouteParam(params.slug || "");
  const format = url.searchParams.get("format") || "markdown";
  const filePath = url.searchParams.get("path") || "";
  const session = await getSessionFromAstro(context);
  const download = await readAgentSkillDownload(slug, {
    format,
    filePath,
    includeUnpublished: isAdmin(session),
    ownerUserId: session?.userId,
  });

  if (!download) {
    return new Response("Skill file not found.", { status: 404 });
  }

  return new Response(download.content, {
    headers: {
      "content-type": download.contentType,
      "content-disposition": `attachment; filename="${download.filename}"`,
      "cache-control": "no-store",
    },
  });
};
