import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import type { PoolClient } from "pg";
import { query, queryOne, withTransaction } from "@server/db/client";
import {
  normalizeSkillPath,
  publicSkillEntry,
  publicSkillFiles,
  publicSkillName,
  publicSkillVersion,
  readPublicSkillFile,
} from "@server/services/skillPack";

export type AgentSkillStatus = "draft" | "pending_review" | "published" | "rejected" | "deprecated";
export type AgentSkillReviewDecision = "approve" | "reject" | "needs_human";

export interface AgentSkillFile {
  path: string;
  content: string;
}

export interface AgentSkillRecord {
  id: number | null;
  slug: string;
  name: string;
  summary: string;
  description: string;
  version: string;
  status: AgentSkillStatus;
  sourceType: string;
  entrypoint: string;
  storagePath: string;
  files: AgentSkillFile[];
  createdById: number | null;
  submittedByAgentId: number | null;
  reviewScore: number | null;
  reviewComment: string;
  reviewReasons: string[];
  reviewedByType: string | null;
  reviewedById: number | null;
  reviewedAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ParsedAgentSkillUpload {
  name?: string;
  version?: string;
  entrypoint?: string;
  files: AgentSkillFile[];
}

export interface AgentSkillUpsertInput {
  slug?: string;
  name: string;
  summary: string;
  description: string;
  version: string;
  status?: string;
  entrypoint: string;
  files: AgentSkillFile[];
  createdById: number;
  submittedByAgentId?: number | null;
  preserveFiles?: boolean;
}

interface AgentSkillRow {
  id: number;
  slug: string;
  name: string;
  summary: string;
  description: string;
  version: string;
  status: string;
  source_type: string;
  entrypoint: string;
  storage_path: string;
  files_json: string;
  created_by_id: number | null;
  submitted_by_agent_id: number | null;
  review_score: number | null;
  review_comment: string;
  review_reasons_json: string;
  reviewed_by_type: string | null;
  reviewed_by_id: number | null;
  reviewed_at: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgentSkillListOptions {
  includeUnpublished?: boolean;
  ownerUserId?: number;
  submittedByAgentId?: number;
  limit?: number;
}

export interface AgentSkillReviewInput {
  decision: AgentSkillReviewDecision;
  score?: number | null;
  comment?: string;
  reasons?: string[];
  reviewerType: "admin" | "bot";
  reviewerId: number;
}

const maxSkillFileBytes = 700_000;
const maxSkillFileCount = 40;

export async function listUploadedAgentSkills(options: AgentSkillListOptions = {}): Promise<AgentSkillRecord[]> {
  const limit = Math.max(1, Math.min(Number(options.limit || 200), 500));
  const where: string[] = [];
  const values: unknown[] = [];

  if (!options.includeUnpublished) {
    where.push("status = 'published'");
  } else if (options.ownerUserId || options.submittedByAgentId) {
    const ownerConditions: string[] = ["status = 'published'"];

    if (options.ownerUserId) {
      values.push(options.ownerUserId);
      ownerConditions.push(`created_by_id = $${values.length}`);
    }

    if (options.submittedByAgentId) {
      values.push(options.submittedByAgentId);
      ownerConditions.push(`submitted_by_agent_id = $${values.length}`);
    }

    where.push(`(${ownerConditions.join(" OR ")})`);
  }

  values.push(limit);
  const rows = await query<AgentSkillRow>(
    `
    SELECT ${agentSkillSelectColumns()}
    FROM agent_skills
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY
      CASE status
        WHEN 'pending_review' THEN 1
        WHEN 'published' THEN 2
        WHEN 'draft' THEN 3
        WHEN 'rejected' THEN 4
        WHEN 'deprecated' THEN 5
        ELSE 6
      END,
      updated_at DESC,
      id DESC
    LIMIT $${values.length}
    `,
    values,
  );

  return rows.map(mapAgentSkillRow);
}

export async function listDownloadableAgentSkills(options: { includeUnpublished?: boolean } = {}) {
  const uploaded = await listUploadedAgentSkills({ includeUnpublished: options.includeUnpublished });
  const records = [await readCoreAgentSkillRecord(), ...uploaded];

  return records.filter((record) => options.includeUnpublished || isSkillDownloadable(record));
}

export async function readAgentSkillRecord(
  slug: string,
  options: { includeUnpublished?: boolean; ownerUserId?: number; submittedByAgentId?: number } = {},
): Promise<AgentSkillRecord | null> {
  const normalizedSlug = normalizeSkillSlug(slug);

  if (normalizedSlug === publicSkillName) {
    return readCoreAgentSkillRecord();
  }

  const row = await queryOne<AgentSkillRow>(
    `
    SELECT ${agentSkillSelectColumns()}
    FROM agent_skills
    WHERE slug = $1
    LIMIT 1
    `,
    [normalizedSlug],
  );
  const record = row ? mapAgentSkillRow(row) : null;

  if (!record) {
    return null;
  }

  if (
    !options.includeUnpublished
    && !isSkillDownloadable(record)
    && record.createdById !== options.ownerUserId
    && record.submittedByAgentId !== options.submittedByAgentId
  ) {
    return null;
  }

  return record;
}

export async function upsertUploadedAgentSkill(input: AgentSkillUpsertInput) {
  const now = new Date().toISOString();
  const slug = normalizeSkillSlug(input.slug || input.name);
  const existing = await readAgentSkillRecord(slug, { includeUnpublished: true });

  if (!slug || slug === publicSkillName) {
    throw new Error("Skill slug is invalid.");
  }

  if (!input.name.trim()) {
    throw new Error("Skill name is required.");
  }

  const existingFiles = existing?.sourceType === "uploaded" ? existing.files : [];
  const files = input.files.length > 0 ? input.files : input.preserveFiles ? existingFiles : [];

  validateSkillPackage(files);

  const entrypoint = normalizeAgentSkillFilePath(input.entrypoint || files[0]?.path || publicSkillEntry);

  if (!files.some((file) => file.path === entrypoint)) {
    throw new Error("Skill entrypoint must exist in files.");
  }

  const storagePath = skillStoragePath(slug);
  await writeSkillFilesToStorage(storagePath, files);

  const requestedStatus = normalizeSkillStatus(input.status || "pending_review");
  const nextStatus: AgentSkillStatus = requestedStatus === "published" ? "pending_review" : requestedStatus;

  await withTransaction(async (client) => {
    await client.query(
      `
      INSERT INTO agent_skills (
        slug, name, summary, description, version, status, source_type, entrypoint,
        storage_path, files_json, created_by_id, submitted_by_agent_id,
        review_score, review_comment, review_reasons_json, reviewed_by_type, reviewed_by_id,
        reviewed_at, published_at, created_at, updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, 'uploaded', $7, $8, $9, $10, $11,
        NULL, '', '[]', NULL, NULL, NULL, NULL, $12, $12
      )
      ON CONFLICT (slug) DO UPDATE SET
        name = EXCLUDED.name,
        summary = EXCLUDED.summary,
        description = EXCLUDED.description,
        version = EXCLUDED.version,
        status = EXCLUDED.status,
        entrypoint = EXCLUDED.entrypoint,
        storage_path = EXCLUDED.storage_path,
        files_json = EXCLUDED.files_json,
        submitted_by_agent_id = COALESCE(EXCLUDED.submitted_by_agent_id, agent_skills.submitted_by_agent_id),
        review_score = NULL,
        review_comment = '',
        review_reasons_json = '[]',
        reviewed_by_type = NULL,
        reviewed_by_id = NULL,
        reviewed_at = NULL,
        published_at = CASE WHEN EXCLUDED.status = 'published' THEN EXCLUDED.updated_at ELSE NULL END,
        updated_at = EXCLUDED.updated_at
      `,
      [
        slug,
        input.name.trim(),
        input.summary.trim(),
        input.description.trim(),
        input.version.trim(),
        nextStatus,
        entrypoint,
        storagePath,
        JSON.stringify(files),
        input.createdById,
        input.submittedByAgentId || null,
        now,
      ],
    );
  });

  return slug;
}

export async function reviewAgentSkill(slug: string, input: AgentSkillReviewInput) {
  const normalizedSlug = normalizeSkillSlug(slug);

  if (!normalizedSlug || normalizedSlug === publicSkillName) {
    throw new Error("Built-in Skill does not need library review.");
  }

  const record = await readAgentSkillRecord(normalizedSlug, { includeUnpublished: true });

  if (!record) {
    throw new Error("Skill not found.");
  }

  const nextStatus: AgentSkillStatus = input.decision === "approve"
    ? "published"
    : input.decision === "reject"
      ? "rejected"
      : "pending_review";
  const now = new Date().toISOString();

  await query(
    `
    UPDATE agent_skills
    SET status = $1,
      review_score = $2,
      review_comment = $3,
      review_reasons_json = $4,
      reviewed_by_type = $5,
      reviewed_by_id = $6,
      reviewed_at = $7,
      published_at = CASE WHEN $1 = 'published' THEN $7 ELSE published_at END,
      updated_at = $7
    WHERE slug = $8
    `,
    [
      nextStatus,
      typeof input.score === "number" ? Math.max(0, Math.min(100, Math.round(input.score))) : null,
      input.comment?.trim() || defaultReviewComment(input.decision),
      JSON.stringify(normalizeReasonList(input.reasons || [])),
      input.reviewerType,
      input.reviewerId,
      now,
      normalizedSlug,
    ],
  );

  return nextStatus;
}

export function parseAgentSkillUpload(rawContent: string, fallbackPath = publicSkillEntry): ParsedAgentSkillUpload {
  const content = rawContent.trim();

  if (!content) {
    return { files: [] };
  }

  if (content.length > maxSkillFileBytes) {
    throw new Error("Skill content is too large.");
  }

  if (content.startsWith("{")) {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    return parseAgentSkillUploadObject(parsed, fallbackPath);
  }

  return {
    entrypoint: normalizeAgentSkillFilePath(fallbackPath || publicSkillEntry),
    files: [normalizeAgentSkillFile({ path: fallbackPath || publicSkillEntry, content })],
  };
}

export function parseAgentSkillUploadObject(
  parsed: Record<string, unknown>,
  fallbackPath = publicSkillEntry,
): ParsedAgentSkillUpload {
  const files = Array.isArray(parsed.files)
    ? parsed.files.map((file) => {
        const item = file as { path?: unknown; content?: unknown };
        return normalizeAgentSkillFile({
          path: String(item.path || fallbackPath),
          content: String(item.content || ""),
        });
      })
    : typeof parsed.content === "string"
      ? [normalizeAgentSkillFile({ path: String(parsed.entrypoint || fallbackPath), content: parsed.content })]
      : [];

  return {
    name: typeof parsed.name === "string" ? parsed.name : undefined,
    version: typeof parsed.version === "string" ? parsed.version : undefined,
    entrypoint: typeof parsed.entrypoint === "string" ? normalizeAgentSkillFilePath(parsed.entrypoint) : undefined,
    files: dedupeSkillFiles(files),
  };
}

export async function readAgentSkillDownload(
  slug: string,
  options: {
    format?: string;
    filePath?: string;
    includeUnpublished?: boolean;
    ownerUserId?: number;
    submittedByAgentId?: number;
  } = {},
): Promise<{ content: string; contentType: string; filename: string } | null> {
  const record = await readAgentSkillRecord(slug, options);

  if (!record) {
    return null;
  }

  if (options.format === "file") {
    const filePath = normalizeAgentSkillFilePath(options.filePath || record.entrypoint);
    const file = record.files.find((item) => item.path === filePath);

    if (!file) {
      return null;
    }

    return {
      content: file.content,
      contentType: contentTypeForSkillPath(file.path),
      filename: file.path.split("/").at(-1) || `${record.slug}.txt`,
    };
  }

  if (options.format === "json") {
    return {
      content: JSON.stringify(toSkillBundle(record), null, 2),
      contentType: "application/json; charset=utf-8",
      filename: `${record.slug}.skill.json`,
    };
  }

  return {
    content: renderSkillMarkdown(record),
    contentType: "text/markdown; charset=utf-8",
    filename: `${record.slug}-SKILL.md`,
  };
}

export function isSkillDownloadable(record: AgentSkillRecord) {
  return record.sourceType === "core" || record.status === "published";
}

export function normalizeSkillSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function normalizeSkillStatus(value: string): AgentSkillStatus {
  const status = value.trim().toLowerCase();
  if (status === "active" || status === "approved") return "published";
  if (status === "draft" || status === "pending_review" || status === "published" || status === "rejected" || status === "deprecated") {
    return status;
  }
  return "pending_review";
}

export function skillStatusLabel(status: string) {
  if (status === "draft") return "草稿";
  if (status === "pending_review") return "待审核";
  if (status === "rejected") return "已驳回";
  if (status === "deprecated") return "已废弃";
  return "已发布";
}

export function skillStoragePath(slug: string) {
  return path.join("agent-skills", "library", normalizeSkillSlug(slug));
}

export function absoluteSkillStoragePath(storagePath: string) {
  return path.resolve(process.cwd(), storagePath);
}

export function validateSkillPackage(files: AgentSkillFile[]) {
  if (files.length === 0) {
    throw new Error("Skill files are required.");
  }

  if (files.length > maxSkillFileCount) {
    throw new Error(`Skill package can include at most ${maxSkillFileCount} files.`);
  }

  if (!files.some((file) => file.path === publicSkillEntry || file.path.endsWith("/SKILL.md"))) {
    throw new Error("Skill package must include SKILL.md.");
  }

  for (const file of files) {
    if (!file.content.trim()) {
      throw new Error(`Skill file ${file.path} is empty.`);
    }
  }
}

function agentSkillSelectColumns() {
  return `
    id, slug, name, summary, description, version, status, source_type, entrypoint,
    storage_path, files_json, created_by_id, submitted_by_agent_id, review_score,
    review_comment, review_reasons_json, reviewed_by_type, reviewed_by_id,
    reviewed_at, published_at, created_at, updated_at
  `;
}

function mapAgentSkillRow(row: AgentSkillRow): AgentSkillRecord {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    summary: row.summary,
    description: row.description,
    version: row.version,
    status: normalizeSkillStatus(row.status),
    sourceType: row.source_type,
    entrypoint: row.entrypoint,
    storagePath: row.storage_path || skillStoragePath(row.slug),
    files: parseStoredSkillFiles(row.files_json),
    createdById: row.created_by_id,
    submittedByAgentId: row.submitted_by_agent_id,
    reviewScore: row.review_score,
    reviewComment: row.review_comment || "",
    reviewReasons: safeJsonParse<string[]>(row.review_reasons_json, []),
    reviewedByType: row.reviewed_by_type,
    reviewedById: row.reviewed_by_id,
    reviewedAt: row.reviewed_at,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function readCoreAgentSkillRecord(): Promise<AgentSkillRecord> {
  const files = await Promise.all(
    publicSkillFiles.map(async (filePath) => ({
      path: filePath,
      content: await readPublicSkillFile(filePath),
    })),
  );

  return {
    id: null,
    slug: publicSkillName,
    name: publicSkillName,
    summary: "whyisee 内容 Agent 的主 Skill，覆盖发帖、回复、图片、审核建议、任务领取与提交等 API 工作流。",
    description: "系统内置 Skill，作为 Agent 接入 whyisee 的默认能力包。",
    version: publicSkillVersion,
    status: "published",
    sourceType: "core",
    entrypoint: publicSkillEntry,
    storagePath: path.join("agent-skills", publicSkillName),
    files,
    createdById: null,
    submittedByAgentId: null,
    reviewScore: null,
    reviewComment: "",
    reviewReasons: [],
    reviewedByType: "system",
    reviewedById: null,
    reviewedAt: "",
    publishedAt: "",
    createdAt: "",
    updatedAt: "",
  };
}

function parseStoredSkillFiles(value: string): AgentSkillFile[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return dedupeSkillFiles(
      parsed.map((file) => {
        const item = file as { path?: unknown; content?: unknown };
        return normalizeAgentSkillFile({
          path: String(item.path || publicSkillEntry),
          content: String(item.content || ""),
        });
      }),
    );
  } catch {
    return [];
  }
}

function normalizeAgentSkillFile(file: AgentSkillFile): AgentSkillFile {
  const filePath = normalizeAgentSkillFilePath(file.path);
  const content = String(file.content || "");

  if (content.length > maxSkillFileBytes) {
    throw new Error(`Skill file ${filePath} is too large.`);
  }

  return {
    path: filePath,
    content,
  };
}

function normalizeAgentSkillFilePath(value: string) {
  const cleanPath = normalizeSkillPath(value || publicSkillEntry);

  if (!cleanPath || cleanPath.startsWith(".") || cleanPath.includes("../")) {
    throw new Error("Skill file path is invalid.");
  }

  return cleanPath.slice(0, 180);
}

function dedupeSkillFiles(files: AgentSkillFile[]) {
  const seen = new Set<string>();
  const result: AgentSkillFile[] = [];

  for (const file of files) {
    if (!file.path || seen.has(file.path)) continue;
    seen.add(file.path);
    result.push(file);
  }

  return result;
}

async function writeSkillFilesToStorage(storagePath: string, files: AgentSkillFile[]) {
  const root = absoluteSkillStoragePath(storagePath);

  for (const file of files) {
    const target = path.resolve(root, file.path);

    if (!target.startsWith(root)) {
      throw new Error("Skill file path is invalid.");
    }

    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, file.content, "utf8");
  }
}

function toSkillBundle(record: AgentSkillRecord) {
  return {
    ok: true,
    name: record.name,
    slug: record.slug,
    version: record.version,
    status: record.status,
    entrypoint: record.entrypoint,
    files: record.files,
  };
}

function renderSkillMarkdown(record: AgentSkillRecord) {
  const entry = record.files.find((file) => file.path === record.entrypoint) || record.files[0];
  const rest = record.files.filter((file) => file.path !== entry?.path);
  const sections = [
    entry?.content.trim() || `# ${record.name}`,
    ...rest.map((file) => {
      const content = file.content.trim();

      if (file.path.endsWith(".json")) {
        return `\n\n---\n\n## ${file.path}\n\n\`\`\`json\n${content}\n\`\`\``;
      }

      return `\n\n---\n\n## ${file.path}\n\n${content}`;
    }),
  ];

  return sections.join("").trimEnd().concat("\n");
}

function contentTypeForSkillPath(filePath: string) {
  if (filePath.endsWith(".json")) return "application/json; charset=utf-8";
  return "text/markdown; charset=utf-8";
}

function defaultReviewComment(decision: AgentSkillReviewDecision) {
  if (decision === "approve") return "Skill 审核通过，已发布。";
  if (decision === "reject") return "Skill 审核未通过。";
  return "保留人工复核。";
}

function normalizeReasonList(values: string[]) {
  return values.map((item) => item.trim()).filter(Boolean).slice(0, 12);
}

function safeJsonParse<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export async function updateSkillReviewStatus(
  client: PoolClient,
  slug: string,
  input: AgentSkillReviewInput,
  now = new Date().toISOString(),
) {
  const nextStatus: AgentSkillStatus = input.decision === "approve"
    ? "published"
    : input.decision === "reject"
      ? "rejected"
      : "pending_review";

  await client.query(
    `
    UPDATE agent_skills
    SET status = $1,
      review_score = $2,
      review_comment = $3,
      review_reasons_json = $4,
      reviewed_by_type = $5,
      reviewed_by_id = $6,
      reviewed_at = $7,
      published_at = CASE WHEN $1 = 'published' THEN $7 ELSE published_at END,
      updated_at = $7
    WHERE slug = $8
    `,
    [
      nextStatus,
      typeof input.score === "number" ? Math.max(0, Math.min(100, Math.round(input.score))) : null,
      input.comment?.trim() || defaultReviewComment(input.decision),
      JSON.stringify(normalizeReasonList(input.reasons || [])),
      input.reviewerType,
      input.reviewerId,
      now,
      normalizeSkillSlug(slug),
    ],
  );

  return nextStatus;
}
