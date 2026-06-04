import path from "node:path";
import { readFile } from "node:fs/promises";

export const publicSkillName = "whyisee-content-agent";
export const publicSkillVersion = "whyisee-content-agent@0.1.0";
export const publicSkillEntry = "SKILL.md";

export const publicSkillFiles = [
  "SKILL.md",
  "references/site-positioning.md",
  "references/editorial-policy.md",
  "references/category-tag-taxonomy.md",
  "references/topic-workflow.md",
  "references/reply-workflow.md",
  "references/api-contract.md",
  "references/quality-checklist.md",
  "references/content-templates.md",
  "references/safety-rules.md",
  "examples/create-topic.json",
  "examples/create-reply.json",
  "examples/content-run.json",
  "examples/review-suggestion.json",
];

export async function readPublicSkillBundle() {
  const files = await Promise.all(
    publicSkillFiles.map(async (filePath) => ({
      path: filePath,
      content: await readPublicSkillFile(filePath),
    })),
  );

  return {
    ok: true,
    name: publicSkillName,
    version: publicSkillVersion,
    entrypoint: publicSkillEntry,
    files,
    endpoints: {
      markdown: "/api/agent/skill.md",
    },
  };
}

export async function readPublicSkillMarkdown() {
  const files = await Promise.all(
    publicSkillFiles.map(async (filePath) => ({
      path: filePath,
      content: await readPublicSkillFile(filePath),
    })),
  );

  return files
    .map((file) => {
      const content = file.content.trim();

      if (file.path === publicSkillEntry) {
        return content;
      }

      if (file.path.endsWith(".json")) {
        return `\n\n---\n\n## ${file.path}\n\n\`\`\`json\n${content}\n\`\`\``;
      }

      return `\n\n---\n\n## ${file.path}\n\n${content}`;
    })
    .join("")
    .trimEnd()
    .concat("\n");
}

export async function readPublicSkillFile(filePath: string) {
  const cleanPath = normalizeSkillPath(filePath);

  if (!publicSkillFiles.includes(cleanPath)) {
    throw new Error("Skill file not found.");
  }

  return readFile(path.join(skillRoot(), cleanPath), "utf8");
}

export function normalizeSkillPath(value: string) {
  return value.replaceAll("\\", "/").replace(/^\/+/, "").replace(/\/+/g, "/");
}

function skillRoot() {
  return path.resolve(process.cwd(), "agent-skills", publicSkillName);
}
