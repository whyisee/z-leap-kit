import type { APIRoute } from "astro";
import { requireAgentScope } from "@server/services/agents";
import { AgentApiError } from "@server/services/agentErrors";
import { jsonResponse, withAgent } from "@server/services/agentHttp";
import {
  listUploadedAgentSkills,
  listDownloadableAgentSkills,
  normalizeSkillSlug,
  parseAgentSkillUpload,
  parseAgentSkillUploadFile,
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
    const body = await readSkillRequest(context.request);
    const name = readString(body.fields.name) || body.parsed.name || "";

    if (!name) {
      throw new AgentApiError(400, "skill_name_required", "Skill name is required.");
    }

    const slug = await upsertUploadedAgentSkill({
      slug: readString(body.fields.slug) || normalizeSkillSlug(name),
      name,
      summary: readString(body.fields.summary),
      description: readString(body.fields.description),
      version: readString(body.fields.version) || body.parsed.version || "",
      status: "pending_review",
      entrypoint: body.parsed.entrypoint || readString(body.fields.entrypoint) || "SKILL.md",
      files: body.parsed.files,
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
    packageKey: skill.packageKey,
    ownerUsername: skill.ownerUsername,
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

async function readSkillRequest(request: Request) {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const entrypoint = readString(formData.get("entrypoint")) || "SKILL.md";
    const uploaded = readFile(formData.get("skillFile")) || readFile(formData.get("file")) || readFile(formData.get("zip"));
    const pastedContent = readString(formData.get("content"));
    const parsed = uploaded
      ? await parseAgentSkillUploadFile(uploaded, entrypoint)
      : parseAgentSkillUpload(pastedContent, entrypoint);

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
    };
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    return {
      fields: body,
      parsed: parseAgentSkillUploadObject(body, String(body.entrypoint || "SKILL.md")),
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
