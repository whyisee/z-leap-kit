import type { APIRoute } from "astro";
import { requireAgentScope } from "@server/services/agents";
import { AgentApiError } from "@server/services/agentErrors";
import { jsonResponse, withAgent } from "@server/services/agentHttp";
import {
  isSkillDownloadable,
  normalizeSkillRouteParam,
  parseAgentSkillUpload,
  parseAgentSkillUploadFile,
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
    const slug = normalizeSkillRouteParam(context.params.slug || "");
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
    const slug = normalizeSkillRouteParam(context.params.slug || "");

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

    const body = await readSkillRequest(context.request, existing.entrypoint);
    const hasNewFiles = body.hasNewFiles;
    const parsed = hasNewFiles ? body.parsed : { files: [] };
    const nextSlug = await upsertUploadedAgentSkill({
      slug: readString(body.fields.slug) || existing.packageKey || existing.name,
      name: readString(body.fields.name) || existing.name,
      summary: readString(body.fields.summary) || existing.summary,
      description: readString(body.fields.description) || existing.description,
      version: readString(body.fields.version) || parsed.version || existing.version,
      status: "pending_review",
      entrypoint: parsed.entrypoint || readString(body.fields.entrypoint) || existing.entrypoint,
      files: parsed.files,
      createdById: agent.userId,
      submittedByAgentId: agent.agentProfileId,
      preserveFiles: !hasNewFiles,
    });

    return jsonResponse({
      ok: true,
      slug: nextSlug,
      status: "pending_review",
      message: "Skill updated and submitted for review.",
    });
  });

function serializeSkillDetail(skill: AgentSkillRecord) {
  return {
    slug: skill.slug,
    packageKey: skill.packageKey,
    ownerUsername: skill.ownerUsername,
    name: skill.name,
    summary: skill.summary,
    description: skill.description,
    version: skill.version,
    status: skill.status,
    sourceType: skill.sourceType,
    entrypoint: skill.entrypoint,
    storagePath: skill.storagePath,
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

async function readSkillRequest(request: Request, fallbackEntrypoint: string) {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const entrypoint = readString(formData.get("entrypoint")) || fallbackEntrypoint || "SKILL.md";
    const uploaded = readFile(formData.get("skillFile")) || readFile(formData.get("file")) || readFile(formData.get("zip"));
    const pastedContent = readString(formData.get("content"));
    const hasNewFiles = Boolean(uploaded || pastedContent);
    const parsed = uploaded
      ? await parseAgentSkillUploadFile(uploaded, entrypoint)
      : hasNewFiles
        ? parseAgentSkillUpload(pastedContent, entrypoint)
        : { files: [] };

    return {
      fields: {
        name: formData.get("name"),
        slug: formData.get("slug"),
        summary: formData.get("summary"),
        description: formData.get("description"),
        version: formData.get("version"),
        entrypoint: formData.get("entrypoint"),
      },
      parsed,
      hasNewFiles,
    };
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const hasNewFiles = Array.isArray(body.files) || typeof body.content === "string";
    return {
      fields: body,
      parsed: hasNewFiles ? parseAgentSkillUploadObject(body, String(body.entrypoint || fallbackEntrypoint || "SKILL.md")) : { files: [] },
      hasNewFiles,
    };
  } catch {
    throw new AgentApiError(400, "invalid_json", "Request body must be JSON.");
  }
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readFile(value: FormDataEntryValue | null) {
  if (!value || typeof value === "string") return null;
  return value.size > 0 ? value : null;
}
