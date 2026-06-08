import { createHash } from "node:crypto";
import { query, queryOne } from "../db/client.ts";

export interface ExternalHotScanConfig {
  provider: "zhihu_hot";
  sourceUrl: string;
  maxItems: number;
  timeoutMs: number;
  userAgent: string;
}

export interface ExternalHotScanMetrics {
  fetched: number;
  inserted: number;
  updated: number;
  skipped: number;
  failed: number;
}

export interface ExternalHotItem {
  id: number;
  source: string;
  sourceItemId: string;
  title: string;
  url: string;
  summary: string;
  rank: number | null;
  heatText: string;
  status: string;
  firstSeenAt: string;
  lastSeenAt: string;
  seenCount: number;
}

interface ExternalHotItemRow {
  id: number;
  source: string;
  source_item_id: string;
  title: string;
  url: string;
  summary: string;
  rank: number | null;
  heat_text: string;
  status: string;
  first_seen_at: string;
  last_seen_at: string;
  seen_count: number;
}

interface ParsedHotItem {
  sourceItemId: string;
  title: string;
  url: string;
  summary: string;
  rank: number | null;
  heatText: string;
  raw: Record<string, unknown>;
}

export async function scanExternalHotSource(input: {
  taskId: number;
  runId: number;
  botUserId: number;
  config: ExternalHotScanConfig;
}): Promise<ExternalHotScanMetrics> {
  if (input.config.provider !== "zhihu_hot") {
    throw new Error(`Unsupported external hot source provider: ${input.config.provider}`);
  }

  const text = await fetchSourceText(input.config);
  const parsedItems = parseZhihuHotItems(text, input.config.sourceUrl).slice(0, input.config.maxItems);
  const metrics: ExternalHotScanMetrics = {
    fetched: parsedItems.length,
    inserted: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
  };

  for (const item of parsedItems) {
    if (!item.title || !item.url) {
      metrics.skipped += 1;
      continue;
    }

    try {
      const result = await upsertExternalHotItem({
        source: input.config.provider,
        item,
        taskId: input.taskId,
        runId: input.runId,
        botUserId: input.botUserId,
      });

      if (result === "inserted") {
        metrics.inserted += 1;
      } else {
        metrics.updated += 1;
      }
    } catch {
      metrics.failed += 1;
    }
  }

  return metrics;
}

export async function listExternalHotItems(source = "all", limit = 80): Promise<ExternalHotItem[]> {
  const rows = await query<ExternalHotItemRow>(
    `
    SELECT
      id,
      source,
      source_item_id,
      title,
      url,
      summary,
      rank,
      heat_text,
      status,
      first_seen_at,
      last_seen_at,
      seen_count
    FROM external_hot_items
    WHERE ($1 = 'all' OR source = $1)
    ORDER BY last_seen_at DESC, COALESCE(rank, 999999) ASC, id DESC
    LIMIT $2
    `,
    [source, limit],
  );

  return rows.map((row) => ({
    id: row.id,
    source: row.source,
    sourceItemId: row.source_item_id,
    title: row.title,
    url: row.url,
    summary: row.summary,
    rank: row.rank,
    heatText: row.heat_text,
    status: row.status,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    seenCount: row.seen_count,
  }));
}

export function normalizeExternalHotScanConfig(value: unknown): ExternalHotScanConfig {
  const config = typeof value === "object" && value ? value as Record<string, unknown> : {};
  const sourceUrl = readString(config.sourceUrl) || process.env.ZHIHU_HOT_SOURCE_URL || "https://rsshub.app/zhihu/hot";

  return {
    provider: "zhihu_hot",
    sourceUrl,
    maxItems: clampInteger(config.maxItems ?? config.batchSize, 1, 100, 30),
    timeoutMs: clampInteger(config.timeoutMs, 3000, 60_000, 15_000),
    userAgent: readString(config.userAgent) || "whyisee-community-bot/0.1 (+https://whyisee.xyz)",
  };
}

async function fetchSourceText(config: ExternalHotScanConfig) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(config.sourceUrl, {
      headers: {
        accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, application/json, text/html;q=0.8",
        "user-agent": config.userAgent,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`External source request failed: HTTP ${response.status}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function parseZhihuHotItems(text: string, sourceUrl: string): ParsedHotItem[] {
  const trimmed = text.trim();

  if (!trimmed) {
    return [];
  }

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return parseJsonHotItems(trimmed);
  }

  const xmlItems = parseXmlFeedItems(trimmed);

  if (xmlItems.length > 0) {
    return xmlItems;
  }

  return parseZhihuInitialData(trimmed, sourceUrl);
}

function parseJsonHotItems(text: string): ParsedHotItem[] {
  const parsed = JSON.parse(text) as unknown;
  const items = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as { data?: unknown }).data)
      ? (parsed as { data: unknown[] }).data
      : [];

  return items.map((item, index) => {
    const record = typeof item === "object" && item ? item as Record<string, unknown> : {};
    const target = typeof record.target === "object" && record.target ? record.target as Record<string, unknown> : record;
    const title = readNestedText(target, ["title", "titleArea.text", "question.title"]);
    const url = readNestedText(target, ["url", "link.url", "question.url"]);
    const summary = readNestedText(target, ["excerpt", "excerptArea.text", "summary", "description"]);
    const heatText = readNestedText(target, ["metricsArea.text", "heat", "hot", "metrics"]);

    return normalizeParsedItem({
      sourceItemId: readNestedText(target, ["id", "token", "question.id"]) || url || title,
      title,
      url,
      summary,
      rank: index + 1,
      heatText,
      raw: record,
    });
  }).filter(Boolean) as ParsedHotItem[];
}

function parseXmlFeedItems(text: string): ParsedHotItem[] {
  const rawItems = matchAll(text, /<item\b[\s\S]*?<\/item>/gi);
  const atomItems = rawItems.length > 0 ? rawItems : matchAll(text, /<entry\b[\s\S]*?<\/entry>/gi);

  return atomItems.map((raw, index) => {
    const title = decodeXml(readXmlTag(raw, "title"));
    const link = decodeXml(readXmlTag(raw, "link")) || decodeXml(readXmlLinkHref(raw));
    const summary = stripHtml(decodeXml(readXmlTag(raw, "description") || readXmlTag(raw, "summary") || readXmlTag(raw, "content")));
    const guid = decodeXml(readXmlTag(raw, "guid") || readXmlTag(raw, "id"));

    return normalizeParsedItem({
      sourceItemId: guid || link || title,
      title: stripHtml(title),
      url: link,
      summary,
      rank: index + 1,
      heatText: "",
      raw: {
        feedType: rawItems.length > 0 ? "rss" : "atom",
        guid,
      },
    });
  }).filter(Boolean) as ParsedHotItem[];
}

function parseZhihuInitialData(text: string, sourceUrl: string): ParsedHotItem[] {
  const match = text.match(/<script[^>]+id=["']js-initialData["'][^>]*>([\s\S]*?)<\/script>/i);

  if (!match?.[1]) {
    throw new Error(`Unsupported Zhihu hot source format: ${sourceUrl}`);
  }

  const rawJson = decodeHtml(match[1]);
  const parsed = JSON.parse(rawJson) as unknown;
  const candidates: ParsedHotItem[] = [];

  walkJson(parsed, (record) => {
    const title = readNestedText(record, ["titleArea.text", "target.titleArea.text", "title", "question.title"]);
    const url = readNestedText(record, ["link.url", "target.link.url", "url", "question.url"]);

    if (!title || !url) {
      return;
    }

    candidates.push(normalizeParsedItem({
      sourceItemId: readNestedText(record, ["id", "target.id", "token"]) || url,
      title,
      url,
      summary: readNestedText(record, ["excerptArea.text", "target.excerptArea.text", "excerpt", "summary"]),
      rank: candidates.length + 1,
      heatText: readNestedText(record, ["metricsArea.text", "target.metricsArea.text"]),
      raw: record,
    }) as ParsedHotItem);
  });

  return dedupeItems(candidates);
}

async function upsertExternalHotItem(input: {
  source: string;
  item: ParsedHotItem;
  taskId: number;
  runId: number;
  botUserId: number;
}) {
  const existing = await queryOne<{ id: number }>(
    "SELECT id FROM external_hot_items WHERE source = $1 AND source_item_id = $2 LIMIT 1",
    [input.source, input.item.sourceItemId],
  );
  const now = new Date().toISOString();

  if (existing) {
    await query(
      `
      UPDATE external_hot_items
      SET title = $1,
          url = $2,
          summary = $3,
          rank = $4,
          heat_text = $5,
          raw_json = $6,
          last_seen_at = $7,
          seen_count = seen_count + 1,
          last_task_id = $8,
          last_task_run_id = $9,
          last_bot_user_id = $10
      WHERE id = $11
      `,
      [
        input.item.title,
        input.item.url,
        input.item.summary,
        input.item.rank,
        input.item.heatText,
        JSON.stringify(input.item.raw),
        now,
        input.taskId,
        input.runId,
        input.botUserId,
        existing.id,
      ],
    );

    return "updated" as const;
  }

  await query(
    `
    INSERT INTO external_hot_items (
      source, source_item_id, title, url, summary, rank, heat_text, raw_json,
      status, first_seen_at, last_seen_at, seen_count, last_task_id, last_task_run_id, last_bot_user_id
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'new', $9, $9, 1, $10, $11, $12)
    `,
    [
      input.source,
      input.item.sourceItemId,
      input.item.title,
      input.item.url,
      input.item.summary,
      input.item.rank,
      input.item.heatText,
      JSON.stringify(input.item.raw),
      now,
      input.taskId,
      input.runId,
      input.botUserId,
    ],
  );

  return "inserted" as const;
}

function normalizeParsedItem(item: ParsedHotItem): ParsedHotItem | undefined {
  const title = item.title.trim();
  const url = normalizeUrl(item.url.trim());

  if (!title || !url) {
    return undefined;
  }

  return {
    sourceItemId: hashStableId(item.sourceItemId || url),
    title: title.slice(0, 240),
    url,
    summary: item.summary.trim().slice(0, 1000),
    rank: item.rank && item.rank > 0 ? item.rank : null,
    heatText: item.heatText.trim().slice(0, 120),
    raw: item.raw,
  };
}

function normalizeUrl(value: string) {
  if (!value) return "";
  if (value.startsWith("//")) return `https:${value}`;
  if (value.startsWith("/")) return `https://www.zhihu.com${value}`;
  return value;
}

function dedupeItems(items: ParsedHotItem[]) {
  const seen = new Set<string>();
  const result: ParsedHotItem[] = [];

  for (const item of items) {
    if (seen.has(item.sourceItemId)) {
      continue;
    }

    seen.add(item.sourceItemId);
    result.push(item);
  }

  return result;
}

function hashStableId(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function readNestedText(record: Record<string, unknown>, paths: string[]) {
  for (const path of paths) {
    const value = path.split(".").reduce<unknown>((current, key) => {
      if (typeof current !== "object" || !current) return undefined;
      return (current as Record<string, unknown>)[key];
    }, record);
    const text = readString(value);

    if (text) {
      return text;
    }
  }

  return "";
}

function readXmlTag(raw: string, tag: string) {
  const match = raw.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match?.[1]?.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "").trim() || "";
}

function readXmlLinkHref(raw: string) {
  const match = raw.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*\/?>/i);
  return match?.[1] || "";
}

function matchAll(value: string, pattern: RegExp) {
  return Array.from(value.matchAll(pattern), (match) => match[0]);
}

function stripHtml(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function decodeXml(value: string) {
  return decodeHtml(value)
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"');
}

function decodeHtml(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function walkJson(value: unknown, visitor: (record: Record<string, unknown>) => void) {
  if (Array.isArray(value)) {
    for (const item of value) {
      walkJson(item, visitor);
    }
    return;
  }

  if (typeof value !== "object" || !value) {
    return;
  }

  const record = value as Record<string, unknown>;
  visitor(record);

  for (const child of Object.values(record)) {
    walkJson(child, visitor);
  }
}

function readString(value: unknown) {
  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return "";
}

function clampInteger(value: unknown, min: number, max: number, fallback: number) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(number)));
}
