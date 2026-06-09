import { createHash } from "node:crypto";
import { query, queryOne } from "../db/client.ts";

export interface ExternalHotScanConfig {
  provider: "zhihu_hot" | "rebang_today";
  sourceUrl: string;
  apiBaseUrl: string;
  boards: ExternalHotBoardConfig[];
  maxItems: number;
  timeoutMs: number;
  userAgent: string;
}

export interface ExternalHotBoardConfig {
  tab: string;
  subTab: string;
  label: string;
}

export interface ExternalHotScanMetrics {
  fetched: number;
  inserted: number;
  updated: number;
  snapshotted: number;
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

export interface ExternalHotSnapshot {
  id: number;
  itemId: number;
  source: string;
  sourceItemId: string;
  taskRunId: number | null;
  title: string;
  url: string;
  summary: string;
  rank: number | null;
  heatText: string;
  observedAt: string;
  createdAt: string;
}

export interface ExternalHotDigestCandidate extends ExternalHotItem {
  snapshotCount: number;
  bestRank: number | null;
  latestRank: number | null;
  firstObservedAt: string | null;
  lastObservedAt: string | null;
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

interface ExternalHotSnapshotRow {
  id: number;
  item_id: number;
  source: string;
  source_item_id: string;
  task_run_id: number | null;
  title: string;
  url: string;
  summary: string;
  rank: number | null;
  heat_text: string;
  observed_at: string;
  created_at: string;
}

interface ExternalHotDigestCandidateRow extends ExternalHotItemRow {
  snapshot_count: number;
  best_rank: number | null;
  latest_rank: number | null;
  first_observed_at: string | null;
  last_observed_at: string | null;
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

interface ParsedHotEntry {
  source: string;
  item: ParsedHotItem;
}

const DEFAULT_ZHIHU_HOT_SOURCE_URL = "https://api.zhihu.com/topstory/hot-list,https://www.zhihu.com/billboard,https://www.zhihu.com/hot";
const DEFAULT_REBANG_API_BASE_URL = "https://api.rebang.today";
const DEFAULT_REBANG_BOARDS: ExternalHotBoardConfig[] = [
  { tab: "top", subTab: "today", label: "综合今日" },
  { tab: "baidu", subTab: "realtime", label: "百度热搜" },
  { tab: "ithome", subTab: "today", label: "IT之家日榜" },
  { tab: "36kr", subTab: "hotlist", label: "36氪热榜" },
  { tab: "toutiao", subTab: "", label: "今日头条" },
  { tab: "huxiu", subTab: "hot", label: "虎嗅热文" },
  { tab: "sspai", subTab: "recommend", label: "少数派推荐" },
  { tab: "weread", subTab: "rising", label: "微信读书飙升榜" },
];

export async function scanExternalHotSource(input: {
  taskId: number;
  runId: number;
  botUserId: number;
  config: ExternalHotScanConfig;
}): Promise<ExternalHotScanMetrics> {
  const result = await fetchExternalHotEntries(input.config);
  const parsedItems = result.entries.slice(0, input.config.maxItems * Math.max(1, input.config.boards.length));
  const metrics: ExternalHotScanMetrics = {
    fetched: parsedItems.length,
    inserted: 0,
    updated: 0,
    snapshotted: 0,
    skipped: 0,
    failed: result.failed,
  };

  for (const { source, item } of parsedItems) {
    if (!item.title || !item.url) {
      metrics.skipped += 1;
      continue;
    }

    try {
      const result = await upsertExternalHotItem({
        source,
        item,
        taskId: input.taskId,
        runId: input.runId,
        botUserId: input.botUserId,
      });

      if (result.status === "inserted") {
        metrics.inserted += 1;
      } else {
        metrics.updated += 1;
      }

      if (result.snapshotted) {
        metrics.snapshotted += 1;
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
    WHERE ($1 = 'all' OR source = $1 OR source LIKE ($1 || ':%'))
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

export async function getExternalHotItem(id: number): Promise<ExternalHotItem | undefined> {
  const row = await queryOne<ExternalHotItemRow>(
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
    WHERE id = $1
    LIMIT 1
    `,
    [id],
  );

  return row ? mapExternalHotItemRow(row) : undefined;
}

export async function listExternalHotSnapshots(source = "all", limit = 160): Promise<ExternalHotSnapshot[]> {
  const rows = await query<ExternalHotSnapshotRow>(
    `
    SELECT
      id,
      item_id,
      source,
      source_item_id,
      task_run_id,
      title,
      url,
      summary,
      rank,
      heat_text,
      observed_at,
      created_at
    FROM external_hot_item_snapshots
    WHERE ($1 = 'all' OR source = $1 OR source LIKE ($1 || ':%'))
    ORDER BY observed_at DESC, COALESCE(rank, 999999) ASC, id DESC
    LIMIT $2
    `,
    [source, limit],
  );

  return rows.map((row) => ({
    id: row.id,
    itemId: row.item_id,
    source: row.source,
    sourceItemId: row.source_item_id,
    taskRunId: row.task_run_id,
    title: row.title,
    url: row.url,
    summary: row.summary,
    rank: row.rank,
    heatText: row.heat_text,
    observedAt: row.observed_at,
    createdAt: row.created_at,
  }));
}

export async function listExternalHotSnapshotsForItem(itemId: number, limit = 30): Promise<ExternalHotSnapshot[]> {
  const rows = await query<ExternalHotSnapshotRow>(
    `
    SELECT
      id,
      item_id,
      source,
      source_item_id,
      task_run_id,
      title,
      url,
      summary,
      rank,
      heat_text,
      observed_at,
      created_at
    FROM external_hot_item_snapshots
    WHERE item_id = $1
    ORDER BY observed_at DESC, id DESC
    LIMIT $2
    `,
    [itemId, limit],
  );

  return rows.map(mapExternalHotSnapshotRow);
}

export async function listExternalHotDigestCandidates(input: {
  source: string;
  windowHours: number;
  topN: number;
  minSeenCount: number;
}): Promise<ExternalHotDigestCandidate[]> {
  const rows = await query<ExternalHotDigestCandidateRow>(
    `
    WITH window_snapshots AS (
      SELECT *
      FROM external_hot_item_snapshots
      WHERE ($1 = 'all' OR source = $1 OR source LIKE ($1 || ':%'))
        AND observed_at::timestamptz >= CURRENT_TIMESTAMP - ($2::int * INTERVAL '1 hour')
    ),
    latest_snapshots AS (
      SELECT DISTINCT ON (item_id)
        item_id,
        rank AS latest_rank,
        observed_at AS latest_observed_at
      FROM window_snapshots
      ORDER BY item_id, observed_at DESC, id DESC
    )
    SELECT
      items.id,
      items.source,
      items.source_item_id,
      items.title,
      items.url,
      items.summary,
      items.rank,
      items.heat_text,
      items.status,
      items.first_seen_at,
      items.last_seen_at,
      items.seen_count,
      COUNT(window_snapshots.id)::int AS snapshot_count,
      MIN(window_snapshots.rank) AS best_rank,
      latest_snapshots.latest_rank,
      MIN(window_snapshots.observed_at) AS first_observed_at,
      MAX(window_snapshots.observed_at) AS last_observed_at
    FROM external_hot_items items
    LEFT JOIN window_snapshots ON window_snapshots.item_id = items.id
    LEFT JOIN latest_snapshots ON latest_snapshots.item_id = items.id
    WHERE ($1 = 'all' OR items.source = $1 OR items.source LIKE ($1 || ':%'))
      AND items.last_seen_at::timestamptz >= CURRENT_TIMESTAMP - ($2::int * INTERVAL '1 hour')
    GROUP BY
      items.id,
      items.source,
      items.source_item_id,
      items.title,
      items.url,
      items.summary,
      items.rank,
      items.heat_text,
      items.status,
      items.first_seen_at,
      items.last_seen_at,
      items.seen_count,
      latest_snapshots.latest_rank
    HAVING COUNT(window_snapshots.id)::int >= $3
    ORDER BY COALESCE(MIN(window_snapshots.rank), items.rank, 999999) ASC,
      items.seen_count DESC,
      MAX(window_snapshots.observed_at) DESC,
      items.id DESC
    LIMIT $4
    `,
    [input.source, input.windowHours, input.minSeenCount, input.topN],
  );

  return rows.map((row) => ({
    ...mapExternalHotItemRow(row),
    snapshotCount: row.snapshot_count,
    bestRank: row.best_rank,
    latestRank: row.latest_rank,
    firstObservedAt: row.first_observed_at,
    lastObservedAt: row.last_observed_at,
  }));
}

function mapExternalHotItemRow(row: ExternalHotItemRow): ExternalHotItem {
  return {
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
  };
}

function mapExternalHotSnapshotRow(row: ExternalHotSnapshotRow): ExternalHotSnapshot {
  return {
    id: row.id,
    itemId: row.item_id,
    source: row.source,
    sourceItemId: row.source_item_id,
    taskRunId: row.task_run_id,
    title: row.title,
    url: row.url,
    summary: row.summary,
    rank: row.rank,
    heatText: row.heat_text,
    observedAt: row.observed_at,
    createdAt: row.created_at,
  };
}

export function normalizeExternalHotScanConfig(value: unknown): ExternalHotScanConfig {
  const config = typeof value === "object" && value ? value as Record<string, unknown> : {};
  const provider = readString(config.provider) === "zhihu_hot" ? "zhihu_hot" : "rebang_today";
  const sourceUrl = normalizeSourceUrlList(readString(config.sourceUrl) || process.env.ZHIHU_HOT_SOURCE_URL);

  return {
    provider,
    sourceUrl,
    apiBaseUrl: readString(config.apiBaseUrl) || process.env.REBANG_TODAY_API_BASE_URL || DEFAULT_REBANG_API_BASE_URL,
    boards: normalizeRebangBoards(config.boards ?? config.boardKeys ?? config.tabs),
    maxItems: clampInteger(config.maxItems ?? config.batchSize, 1, 100, 30),
    timeoutMs: clampInteger(config.timeoutMs, 3000, 60_000, 15_000),
    userAgent: readString(config.userAgent) || "whyisee-community-bot/0.1 (+https://whyisee.xyz)",
  };
}

async function fetchExternalHotEntries(config: ExternalHotScanConfig): Promise<{ entries: ParsedHotEntry[]; failed: number }> {
  if (config.provider === "zhihu_hot") {
    const items = await fetchZhihuHotItems(config);

    return {
      entries: items.map((item) => ({ source: "zhihu_hot", item })),
      failed: 0,
    };
  }

  if (config.provider === "rebang_today") {
    return fetchRebangTodayHotItems(config);
  }

  throw new Error(`Unsupported external hot source provider: ${config.provider}`);
}

async function fetchZhihuHotItems(config: ExternalHotScanConfig) {
  const sourceUrls = splitSourceUrls(config.sourceUrl);
  const errors: string[] = [];

  for (const sourceUrl of sourceUrls) {
    try {
      const text = await fetchSourceText(config, sourceUrl);
      const items = parseZhihuHotItems(text, sourceUrl);

      if (items.length > 0) {
        return items;
      }

      errors.push(`${sourceUrl}: 没有解析到热榜条目`);
    } catch (error) {
      errors.push(`${sourceUrl}: ${formatError(error)}`);
    }
  }

  throw new Error(`知乎热榜抓取失败：${errors.join("；")}`);
}

async function fetchRebangTodayHotItems(config: ExternalHotScanConfig): Promise<{ entries: ParsedHotEntry[]; failed: number }> {
  const boards = config.boards.length > 0 ? config.boards : DEFAULT_REBANG_BOARDS;
  const entries: ParsedHotEntry[] = [];
  const errors: string[] = [];

  for (const board of boards) {
    try {
      const text = await fetchRebangJson(config, buildRebangItemsUrl(config, board));
      const items = parseRebangTodayItems(text, board).slice(0, config.maxItems);
      const source = boardSourceKey(board);

      for (const item of items) {
        entries.push({ source, item });
      }

      if (items.length === 0) {
        errors.push(`${board.label || source}: 没有解析到热榜条目`);
      }
    } catch (error) {
      errors.push(`${board.label || boardSourceKey(board)}: ${formatError(error)}`);
    }
  }

  if (entries.length === 0) {
    throw new Error(`今日热榜抓取失败：${errors.join("；")}`);
  }

  return {
    entries,
    failed: errors.length,
  };
}

async function fetchRebangJson(config: ExternalHotScanConfig, sourceUrl: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(sourceUrl, {
      headers: {
        accept: "application/json",
        "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
        origin: "https://rebang.today",
        referer: "https://rebang.today/",
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

function buildRebangItemsUrl(config: ExternalHotScanConfig, board: ExternalHotBoardConfig) {
  const url = new URL("/v1/items", config.apiBaseUrl.replace(/\/+$/, ""));
  url.searchParams.set("tab", board.tab);

  if (board.subTab) {
    url.searchParams.set("sub_tab", board.subTab);
  }

  url.searchParams.set("page", "1");
  url.searchParams.set("version", "1");

  return url.toString();
}

function parseRebangTodayItems(text: string, board: ExternalHotBoardConfig): ParsedHotItem[] {
  const parsed = JSON.parse(text) as unknown;
  const record = typeof parsed === "object" && parsed ? parsed as Record<string, unknown> : {};
  const data = typeof record.data === "object" && record.data ? record.data as Record<string, unknown> : {};
  const listText = readString(data.list);
  const rawList = listText ? JSON.parse(listText) as unknown : [];
  const items = Array.isArray(rawList) ? rawList : [];

  return items.map((item, index) => {
    const hot = typeof item === "object" && item ? item as Record<string, unknown> : {};
    const title = readNestedText(hot, ["title", "word", "query", "name"]);
    const summary = readNestedText(hot, ["desc", "description", "summary", "abstract", "label"]);
    const url = readRebangItemUrl(hot, board, title);
    const heatText = readNestedText(hot, ["hot_text", "hot_score", "hot_value", "stat_format", "comment_count", "heat"]);

    return normalizeParsedItem({
      sourceItemId: `${boardSourceKey(board)}:${readNestedText(hot, ["item_key", "item_id", "id", "url", "www_url"]) || title}`,
      title,
      url,
      summary,
      rank: index + 1,
      heatText,
      raw: {
        provider: "rebang_today",
        board,
        item: hot,
      },
    });
  }).filter(Boolean) as ParsedHotItem[];
}

async function fetchSourceText(config: ExternalHotScanConfig, sourceUrl: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(sourceUrl, {
      headers: {
        accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, application/json, text/html;q=0.8",
        "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
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
    const title = readNestedText(target, ["title", "titleArea.text", "question.title"])
      || readNestedText(record, ["query_display", "real_query"]);
    const url = readNestedText(target, ["url", "link.url", "question.url"])
      || readNestedText(record, ["url", "redirect_link", "link.url"]);
    const summary = readNestedText(target, ["excerpt", "excerptArea.text", "summary", "description"])
      || readNestedText(record, ["query_description"]);
    const heatText = readNestedText(record, ["detail_text", "metricsArea.text", "heat", "hot", "metrics"])
      || readNestedText(target, ["metricsArea.text", "heat", "hot", "metrics"]);

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

    await insertExternalHotSnapshot({
      itemId: existing.id,
      source: input.source,
      item: input.item,
      taskId: input.taskId,
      runId: input.runId,
      botUserId: input.botUserId,
      observedAt: now,
    });

    return {
      status: "updated" as const,
      snapshotted: true,
    };
  }

  const inserted = await queryOne<{ id: number }>(
    `
    INSERT INTO external_hot_items (
      source, source_item_id, title, url, summary, rank, heat_text, raw_json,
      status, first_seen_at, last_seen_at, seen_count, last_task_id, last_task_run_id, last_bot_user_id
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'new', $9, $9, 1, $10, $11, $12)
    RETURNING id
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

  if (!inserted) {
    throw new Error("External hot item insert failed.");
  }

  await insertExternalHotSnapshot({
    itemId: inserted.id,
    source: input.source,
    item: input.item,
    taskId: input.taskId,
    runId: input.runId,
    botUserId: input.botUserId,
    observedAt: now,
  });

  return {
    status: "inserted" as const,
    snapshotted: true,
  };
}

async function insertExternalHotSnapshot(input: {
  itemId: number;
  source: string;
  item: ParsedHotItem;
  taskId: number;
  runId: number;
  botUserId: number;
  observedAt: string;
}) {
  await query(
    `
    INSERT INTO external_hot_item_snapshots (
      item_id, source, source_item_id, task_id, task_run_id, bot_user_id,
      title, url, summary, rank, heat_text, raw_json, observed_at, created_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $13)
    ON CONFLICT (task_run_id, source, source_item_id) DO UPDATE SET
      title = EXCLUDED.title,
      url = EXCLUDED.url,
      summary = EXCLUDED.summary,
      rank = EXCLUDED.rank,
      heat_text = EXCLUDED.heat_text,
      raw_json = EXCLUDED.raw_json,
      observed_at = EXCLUDED.observed_at
    `,
    [
      input.itemId,
      input.source,
      input.item.sourceItemId,
      input.taskId,
      input.runId,
      input.botUserId,
      input.item.title,
      input.item.url,
      input.item.summary,
      input.item.rank,
      input.item.heatText,
      JSON.stringify(input.item.raw),
      input.observedAt,
    ],
  );
}

function normalizeRebangBoards(value: unknown): ExternalHotBoardConfig[] {
  const values = Array.isArray(value)
    ? value
    : readString(value)
      .split(/[\n,]+/)
      .map((item) => item.trim())
      .filter(Boolean);

  const boards = values
    .map((item) => normalizeRebangBoard(item))
    .filter(Boolean) as ExternalHotBoardConfig[];

  return boards.length > 0 ? boards : DEFAULT_REBANG_BOARDS;
}

function normalizeRebangBoard(value: unknown): ExternalHotBoardConfig | undefined {
  const record = typeof value === "object" && value ? value as Record<string, unknown> : undefined;
  const raw = record ? "" : readString(value);
  const [rawKey = "", rawLabel = ""] = raw.split("|").map((part) => part.trim());
  const [rawTab = "", rawSubTab = ""] = rawKey.split(/[/:]/).map((part) => part.trim());
  const tab = record ? readString(record.tab ?? record.key) : rawTab;
  const subTab = record
    ? readString(record.subTab ?? record.sub_tab ?? record.child)
    : rawSubTab;
  const label = record
    ? readString(record.label ?? record.name)
    : rawLabel;

  if (!tab) {
    return undefined;
  }

  return {
    tab,
    subTab,
    label: label || `${tab}${subTab ? `/${subTab}` : ""}`,
  };
}

function boardSourceKey(board: ExternalHotBoardConfig) {
  return `rebang_today:${board.tab}${board.subTab ? `/${board.subTab}` : ""}`;
}

function readRebangItemUrl(record: Record<string, unknown>, board: ExternalHotBoardConfig, title: string) {
  const directUrl = readNestedText(record, [
    "www_url",
    "url",
    "mobile_url",
    "source_url",
    "article_url",
    "link",
    "target_url",
  ]);

  if (directUrl) {
    if (directUrl.startsWith("/")) {
      return `https://rebang.today${directUrl}`;
    }

    return directUrl;
  }

  const query = readNestedText(record, ["query", "word", "title"]) || title;
  const itemId = readNestedText(record, ["item_id", "id"]);

  if (board.tab === "baidu" && query) {
    return `https://www.baidu.com/s?wd=${encodeURIComponent(query)}`;
  }

  if (board.tab === "36kr" && itemId) {
    return `https://36kr.com/p/${encodeURIComponent(itemId)}`;
  }

  const tab = encodeURIComponent(board.tab);
  const sub = board.subTab ? `&sub_tab=${encodeURIComponent(board.subTab)}` : "";

  return `https://rebang.today/home?tab=${tab}${sub}`;
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
  const apiQuestionMatch = value.match(/^https:\/\/api\.zhihu\.com\/questions\/(\d+)/);
  if (apiQuestionMatch?.[1]) {
    return `https://www.zhihu.com/question/${apiQuestionMatch[1]}`;
  }
  if (value.startsWith("//")) return `https:${value}`;
  if (value.startsWith("/")) return `https://www.zhihu.com${value}`;
  return value;
}

function normalizeSourceUrlList(value: string | undefined) {
  if (!value || value.includes("rsshub.app/zhihu/hot")) {
    return DEFAULT_ZHIHU_HOT_SOURCE_URL;
  }

  return splitSourceUrls(value).join(",");
}

function splitSourceUrls(value: string) {
  const urls = value
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);

  return urls.length > 0 ? urls : DEFAULT_ZHIHU_HOT_SOURCE_URL.split(",");
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

function formatError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function clampInteger(value: unknown, min: number, max: number, fallback: number) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(number)));
}
