import type { APIRoute } from "astro";
import { requireAgentScope } from "@server/services/agents";
import { AgentApiError } from "@server/services/agentErrors";
import { jsonResponse, withAgent } from "@server/services/agentHttp";
import {
  isSkillDownloadable,
  normalizeSkillSlug,
  parseAgentSkillUploadObject,
  readAgentSkillRecord,
  upsertUploadedAgentSkill,
  type AgentSkillRecord,
} from "@server/services/agentSkillLibrary";
import { publicSkillName } from "@server/services/skillPack";

export const prerender = false;

export const GET: APIRoute = async (context) =>
  withAgent(context.request, async (agent) => {
    requireAgentScope(agent, "skill:read");
    const slug = normalizeSkillSlug(context.params.slug || "");
    const skill = await readAgentSkillRecord(slug, {
      ownerUserId: agent.userId,
      submittedByAgentId: agent.agentProfileId,
    });

    if (!skill) {
      throw new AgentApiError(404, "skill_not_found", "Skill not found.");
    }

    return jsonResponse({ ok: true, skill: serializeSkillDetail(skill) });
  });

export const PATCH: APIRoute = async (context) =>
  withAgent(context.request, async (agent) => {
    requireAgentScope(agent, "skill:update");
    const slug = normalizeSkillSlug(context.params.slug || "");

    if (!slug || slug === publicSkillName) {
      throw new AgentApiError(400, "skill_update_forbidden", "This Skill cannot be updated by Agent API.");
    }

    const existing = await readAgentSkillRecord(slug, {
      includeUnpublished: true,
      ownerUserId: agent.userId,
      submittedByAgentId: agent.agentProfileId,
    });

    if (!existing) {
      throw new AgentApiError(404, "skill_not_found", "Skill not found.");
    }

    if (existing.createdById !== agent.userId && existing.submittedByAgentId !== agent.agentProfileId) {
      throw new AgentApiError(403, "skill_update_forbidden", "Only the submitting user or agent can update this Skill.");
    }

    const body = await readJsonBody(context.request);
    const hasNewFiles = Array.isArray(body.files) || typeof body.content === "string";
    const parsed = hasNewFiles ? parseAgentSkillUploadObject(body, String(body.entrypoint || existing.entrypoint)) : { files: [] };
    await upsertUploadedAgentSkill({
      slug,
      name: readString(body.name) || existing.name,
      summary: readString(body.summary) || existing.summary,
      description: readString(body.description) || existing.description,
      version: readString(body.version) || parsed.version || existing.version,
      status: "pending_review",
      entrypoint: parsed.entrypoint || readString(body.entrypoint) || existing.entrypoint,
      files: parsed.files,
      createdById: agent.userId,
      submittedByAgentId: agent.agentProfileId,
      preserveFiles: !hasNewFiles,
    });

    return jsonResponse({
      ok: true,
      slug,
      status: "pending_review",
      message: "Skill updated and submitted for review.",
    });
  });

function serializeSkillDetail(skill: AgentSkillRecord) {
  return {
    slug: skill.slug,
    name: skill.name,
    summary: skill.summary,
    description: skill.description,
    version: skill.version,
    status: skill.status,
    sourceType: skill.sourceType,
    entrypoint: skill.entrypoint,
    fileCount: skill.files.length,
    files: skill.files.map((file) => ({
      path: file.path,
      size: file.content.length,
      download: `/api/agent/skills/${encodeURIComponent(skill.slug)}/download?format=file&path=${encodeURIComponent(file.path)}`,
    })),
    downloadable: isSkillDownloadable(skill),
    review: {
      score: skill.reviewScore,
      comment: skill.reviewComment,
      reasons: skill.reviewReasons,
      reviewedAt: skill.reviewedAt,
    },
    updatedAt: skill.updatedAt,
    publishedAt: skill.publishedAt,
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
