import { queryOne } from "../db/client.ts";

/**
 * 审核队列：给 App 的「审核话题」页提供两样东西 —— 自动审核的结论，
 * 以及「还剩几条、下一条是哪个」。
 *
 * 为什么不直接复用 botJobs 里的函数：那些是跑批任务的一部分（带任务配置、
 * 带写入副作用），而这里只要读。审核页不该因为一次查看就动 review 表。
 */

export interface TopicReviewVerdict {
  decision: string;
  riskScore: number;
  reasons: string[];
  resultStatus: string;
  model: string;
  provider: string;
  createdAt: string;
}

interface VerdictRow {
  decision: string | null;
  risk_score: number | null;
  reasons_json: string | null;
  result_status: string | null;
  ai_model: string | null;
  ai_provider: string | null;
  created_at: string | null;
}

/** 取这条话题最近一次自动审核结论；没跑过就是 null（老内容、或任务没开）。 */
export async function latestTopicVerdict(topicId: number): Promise<TopicReviewVerdict | null> {
  const row = await queryOne<VerdictRow>(
    `
    SELECT decision, risk_score, reasons_json, result_status, ai_model, ai_provider, created_at
    FROM content_review_results
    WHERE target_type = 'topic' AND target_id = $1
    ORDER BY id DESC
    LIMIT 1
    `,
    [topicId],
  );

  if (!row) return null;

  return {
    decision: row.decision || "unknown",
    riskScore: typeof row.risk_score === "number" ? row.risk_score : 0,
    reasons: parseReasons(row.reasons_json),
    resultStatus: row.result_status || "pending",
    model: row.ai_model || "",
    provider: row.ai_provider || "",
    createdAt: row.created_at || "",
  };
}

function parseReasons(raw: string | null): string[] {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === "string" && item.trim() !== "").slice(0, 8);
    }
  } catch {
    // reasons_json 偶尔是纯文本，交给下面按行切
  }

  return raw
    .split(/[\n;；]/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 8);
}

/** 除当前这条之外还剩几条待审。 */
export async function countPendingTopics(excludeId = 0): Promise<number> {
  const row = await queryOne<{ count: string }>(
    `
    SELECT COUNT(*)::text AS count
    FROM topics
    WHERE status = 'pending' AND id <> $1
    `,
    [excludeId],
  );

  return row ? Number(row.count) || 0 : 0;
}

/**
 * 队列里的下一条。
 *
 * 按「先提交先审」排（created_at 升序），和后台列表一致 —— 审核最怕的就是
 * 挑着看，越挑越积压。已经处理过的自然不在 pending 里，不需要另存游标。
 */
export async function nextPendingTopicId(excludeId = 0): Promise<number | null> {
  const row = await queryOne<{ id: number }>(
    `
    SELECT id
    FROM topics
    WHERE status = 'pending' AND id <> $1
    ORDER BY created_at ASC, id ASC
    LIMIT 1
    `,
    [excludeId],
  );

  return row?.id ?? null;
}
