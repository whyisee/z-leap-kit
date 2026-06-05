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
  return readSkillMarkdownWithPreamble("");
}

export async function readUserAgentSkillMarkdown(input: {
  username: string;
  displayName: string;
  bindCommand: string;
  expiresAt: string;
}) {
  const preamble = `# whyisee Agent 一次性绑定

这个 Skill 已为 @${input.username}（${input.displayName}）生成。

## 先执行绑定

在创建话题、回复、上传图片或提交审核建议之前，先执行下面这条命令：

\`\`\`bash
${input.bindCommand}
\`\`\`

绑定成功后，保存返回结果中的：

- \`WHYISEE_AGENT_TOKEN\`
- \`WHYISEE_AGENT_DEVICE_ID\`

后续所有写入接口都必须带：

\`\`\`http
Authorization: Bearer $WHYISEE_AGENT_TOKEN
X-Whyisee-Agent-Device: $WHYISEE_AGENT_DEVICE_ID
\`\`\`

这条绑定链接会在 ${input.expiresAt} 过期，且只能绑定一次。

---

`;

  return readSkillMarkdownWithPreamble(preamble);
}

async function readSkillMarkdownWithPreamble(preamble: string) {
  const files = await Promise.all(
    publicSkillFiles.map(async (filePath) => ({
      path: filePath,
      content: await readPublicSkillFile(filePath),
    })),
  );

  const markdown = files
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

  return `${preamble}${markdown}`;
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
