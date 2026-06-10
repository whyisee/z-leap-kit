import type { APIRoute } from "astro";
import { requireAgentScope } from "@server/services/agents";
import { AgentApiError } from "@server/services/agentErrors";
import { jsonResponse, withAgent } from "@server/services/agentHttp";
import {
  listUploadedAgentSkills,
  listDownloadableAgentSkills,
  normalizeSkillSlug,
  parseAgentSkillUploadObject,
  upsertUploadedAgentSkill,
  type AgentSkillRecord,
} from "@server/services/agentSkillLibrary";

export const prerender = false;

export const GET: APIRoute = async (context) =>
  withAgent(context.request, async (agent) => {
    requireAgentScope(agent, "skill:read");
    const includeMine = context.url.searchParams.get("mine") === "1";
    const skills = includeMine
      ? await listUploadedAgentSkills({
          includeUnpublished: true,
          ownerUserId: agent.userId,
          submittedByAgentId: agent.agentProfileId,
        })
      : await listDownloadableAgentSkills();

    return jsonResponse({
      ok: true,
      skills: skills.map(serializeSkillSummary),
    });
  });

export const POST: APIRoute = async (context) =>
  withAgent(context.request, async (agent) => {
    requireAgentScope(agent, "skill:submit");
    const body = await readJsonBody(context.request);
    const parsed = parseAgentSkillUploadObject(body, String(body.entrypoint || "SKILL.md"));
    const name = readString(body.name) || parsed.name || "";

    if (!name) {
      throw new AgentApiError(400, "skill_name_required", "Skill name is required.");
    }

    const slug = await upsertUploadedAgentSkill({
      slug: readString(body.slug) || normalizeSkillSlug(name),
      name,
      summary: readString(body.summary),
      description: readString(body.description),
      version: readString(body.version) || parsed.version || "",
      status: "pending_review",
      entrypoint: parsed.entrypoint || readString(body.entrypoint) || "SKILL.md",
      files: parsed.files,
      createdById: agent.userId,
      submittedByAgentId: agent.agentProfileId,
    });

    return jsonResponse({
      ok: true,
      slug,
      status: "pending_review",
      message: "Skill submitted for review.",
      links: {
        detail: `/api/agent/skills/${encodeURIComponent(slug)}`,
        page: `/agent-zone/academy/skills/${encodeURIComponent(slug)}`,
      },
    }, 201);
  });

function serializeSkillSummary(skill: AgentSkillRecord) {
  return {
    slug: skill.slug,
    name: skill.name,
    summary: skill.summary,
    version: skill.version,
    status: skill.status,
    sourceType: skill.sourceType,
    entrypoint: skill.entrypoint,
    fileCount: skill.files.length,
    updatedAt: skill.updatedAt,
    publishedAt: skill.publishedAt,
    links: {
      detail: `/api/agent/skills/${encodeURIComponent(skill.slug)}`,
      downloadMarkdown: `/api/agent/skills/${encodeURIComponent(skill.slug)}/download?format=markdown`,
      downloadJson: `/api/agent/skills/${encodeURIComponent(skill.slug)}/download?format=json`,
    },
  };
}

async function readJsonBody(request: Request) {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    throw new AgentApiError(400, "invalid_json", "Request body must be JSON.");
  }
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
