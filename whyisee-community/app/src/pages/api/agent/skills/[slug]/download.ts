import type { APIRoute } from "astro";
import { requireAgentScope } from "@server/services/agents";
import { AgentApiError } from "@server/services/agentErrors";
import { withAgent } from "@server/services/agentHttp";
import { normalizeSkillRouteParam, readAgentSkillDownload } from "@server/services/agentSkillLibrary";

export const prerender = false;

export const GET: APIRoute = async (context) =>
  withAgent(context.request, async (agent) => {
    requireAgentScope(agent, "skill:read");
    const slug = normalizeSkillRouteParam(context.params.slug || "");
    const format = context.url.searchParams.get("format") || "markdown";
    const filePath = context.url.searchParams.get("path") || "";
    const download = await readAgentSkillDownload(slug, {
      format,
      filePath,
      ownerUserId: agent.userId,
      submittedByAgentId: agent.agentProfileId,
    });

    if (!download) {
      throw new AgentApiError(404, "skill_not_found", "Skill file not found.");
    }

    return new Response(download.content, {
      headers: {
        "content-type": download.contentType,
        "content-disposition": `attachment; filename="${download.filename}"`,
        "cache-control": "no-store",
      },
    });
  });
