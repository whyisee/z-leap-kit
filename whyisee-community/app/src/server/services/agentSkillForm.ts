import {
  normalizeSkillSlug,
  parseAgentSkillUpload,
  type AgentSkillRecord,
  type AgentSkillUpsertInput,
} from "@server/services/agentSkillLibrary";

export async function readAgentSkillInput(
  formData: FormData,
  createdById: number,
  existing?: AgentSkillRecord | null,
): Promise<AgentSkillUpsertInput> {
  const uploadedText = await readUploadedText(formData.get("skillFile"));
  const pastedText = String(formData.get("content") || "");
  const rawContent = uploadedText || pastedText;
  const entrypoint = String(formData.get("entrypoint") || existing?.entrypoint || "SKILL.md").trim() || "SKILL.md";
  const parsed = parseAgentSkillUpload(rawContent, entrypoint);
  const name = String(formData.get("name") || parsed.name || existing?.name || "").trim();
  const slug = normalizeSkillSlug(String(formData.get("slug") || existing?.slug || name));

  return {
    slug,
    name,
    summary: String(formData.get("summary") || existing?.summary || "").trim(),
    description: String(formData.get("description") || existing?.description || "").trim(),
    version: String(formData.get("version") || parsed.version || existing?.version || "").trim(),
    status: String(formData.get("status") || "pending_review").trim(),
    entrypoint: parsed.entrypoint || entrypoint,
    files: parsed.files,
    createdById,
    preserveFiles: Boolean(existing),
  };
}

async function readUploadedText(value: FormDataEntryValue | null) {
  if (!value || typeof value === "string") {
    return "";
  }

  const file = value as File;

  if (!file.size) {
    return "";
  }

  return file.text();
}
