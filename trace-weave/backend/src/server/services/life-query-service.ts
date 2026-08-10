import { randomUUID } from "node:crypto";
import { z } from "zod";
import { config, quoteIdentifier } from "../config";
import { pool } from "../db/pool";
import { AiConfigurationError, AiProviderError } from "./event-parser";

const schema = quoteIdentifier(config.DB_SCHEMA);

const datePresetValues = [
  "all",
  "today",
  "yesterday",
  "this_week",
  "last_week",
  "this_month",
  "last_month",
  "recent_7_days",
  "recent_30_days",
  "custom",
] as const;

const lifeQueryIntentSchema = z.object({
  intent: z.enum(["count_events", "sum_amount", "latest_event", "top_entities", "list_events"]),
  datePreset: z.preprocess((value) => {
    const aliases: Record<string, typeof datePresetValues[number]> = {
      thisWeek: "this_week",
      lastWeek: "last_week",
      thisMonth: "this_month",
      lastMonth: "last_month",
      recent7Days: "recent_7_days",
      recent30Days: "recent_30_days",
      "这周": "this_week",
      "本周": "this_week",
      "上周": "last_week",
      "本月": "this_month",
      "上月": "last_month",
      "今天": "today",
      "昨天": "yesterday",
    };
    if (typeof value !== "string") return "all";
    if (datePresetValues.includes(value as typeof datePresetValues[number])) return value;
    return aliases[value] ?? "all";
  }, z.enum(datePresetValues)),
  dateRange: z.preprocess((value) => value ?? { start: null, end: null }, z.object({
    start: z.string().datetime({ offset: true }).nullable(),
    end: z.string().datetime({ offset: true }).nullable(),
  })),
  eventTypes: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  entityMention: z.string().trim().min(1).max(240).nullable().default(null),
  entityType: z.string().trim().min(1).max(60).nullable().default(null),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export type LifeQueryIntent = z.infer<typeof lifeQueryIntentSchema>;

export function parseLifeQueryIntent(value: unknown): LifeQueryIntent {
  return lifeQueryIntentSchema.parse(value);
}

const providerResponseSchema = z.object({
  id: z.string(),
  model: z.string(),
  choices: z.array(z.object({
    finish_reason: z.string(),
    message: z.object({ content: z.string().nullable() }),
  })).min(1),
  usage: z.object({
    prompt_tokens: z.number().optional(),
    completion_tokens: z.number().optional(),
    total_tokens: z.number().optional(),
  }).optional(),
});

const QUERY_SYSTEM_PROMPT = `你是 TraceWeave 的生活账本查询解释器。你只能把用户的问题转换成受限 JSON 查询意图，不能回答问题，不能生成 SQL。

根对象字段固定为：intent、datePreset、dateRange、eventTypes、entityMention、entityType、limit。
- intent 只能是 count_events、sum_amount、latest_event、top_entities、list_events。
- “几次/多少次”使用 count_events；“花了多少钱/消费多少”使用 sum_amount；“多久没/上次/最近一次”使用 latest_event；“最多/最常/排名”使用 top_entities；其余明细查询使用 list_events。
- datePreset 只能是 all、today、yesterday、this_week、last_week、this_month、last_month、recent_7_days、recent_30_days、custom。相对时间必须只通过 datePreset 表达，由服务端计算边界。
- 只有问题明确给出具体日期时才使用 custom，并将 dateRange.start/end 写成带时区 ISO 时间；其他 datePreset 的 dateRange 必须都为 null。
- eventTypes 使用简短英文事件类型，如 eat、drink、order_food、purchase、visit、watch、listen、read、play、use_app、exercise、work、study、travel、activity。不确定时用空数组。
- entityMention 只放问题中明确提到的具体对象或地点名，例如“包子”“商店A”；没有则 null。
- entityType 只在用户明确要求某类对象分组时填写，如 place、food、book、song、game、app；否则 null。
- limit 默认 10，最多 50。
只输出 JSON，不输出 Markdown 或解释。`;

function stripCodeFence(value: string): string {
  const trimmed = value.trim();
  if (!trimmed.startsWith("```")) return trimmed;
  return trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
}

function heuristicIntent(question: string): LifeQueryIntent {
  const normalized = question.trim();
  const intent = /花了多少|多少钱|消费/.test(normalized)
    ? "sum_amount"
    : /多久没|上次|最近一次/.test(normalized)
      ? "latest_event"
      : /最多|最常|排名/.test(normalized)
        ? "top_entities"
        : /几次|多少次/.test(normalized)
          ? "count_events"
          : "list_events";
  const eventTypes = ([
    [/吃|饮食|包子|饭/, "eat"],
    [/买|消费|花了/, "purchase"],
    [/看书|阅读|读/, "read"],
    [/看视频|电影|剧/, "watch"],
    [/听歌|音乐|播客/, "listen"],
    [/游戏|玩了/, "play"],
    [/App|应用/, "use_app"],
    [/去过|到访|去了/, "visit"],
  ] satisfies Array<[RegExp, string]>).flatMap(([pattern, type]) =>
    pattern.test(normalized) ? [type] : [],
  );
  return {
    intent,
    datePreset: /这周|本周/.test(normalized)
      ? "this_week"
      : /上周/.test(normalized)
        ? "last_week"
        : /这个月|本月/.test(normalized)
          ? "this_month"
          : /上个月|上月/.test(normalized)
            ? "last_month"
            : /今天|今日/.test(normalized)
              ? "today"
              : /昨天|昨日/.test(normalized)
                ? "yesterday"
                : /最近\s*7\s*天|近\s*7\s*天/.test(normalized)
                  ? "recent_7_days"
                  : /最近\s*30\s*天|近\s*30\s*天/.test(normalized)
                    ? "recent_30_days"
                    : "all",
    dateRange: { start: null, end: null },
    eventTypes,
    entityMention: null,
    entityType: /店|地点|哪里/.test(normalized) ? "place" : null,
    limit: 10,
  };
}

export function detectRelativeDatePreset(question: string): LifeQueryIntent["datePreset"] | null {
  if (/这周|本周/.test(question)) return "this_week";
  if (/上周/.test(question)) return "last_week";
  if (/这个月|本月/.test(question)) return "this_month";
  if (/上个月|上月/.test(question)) return "last_month";
  if (/今天|今日/.test(question)) return "today";
  if (/昨天|昨日/.test(question)) return "yesterday";
  if (/最近\s*7\s*天|近\s*7\s*天/.test(question)) return "recent_7_days";
  if (/最近\s*30\s*天|近\s*30\s*天/.test(question)) return "recent_30_days";
  return null;
}

async function resolveDateRange(
  intent: LifeQueryIntent,
  input: { question: string; timezone: string; referenceTime: Date },
): Promise<LifeQueryIntent> {
  const preset = detectRelativeDatePreset(input.question) ?? intent.datePreset;
  if (preset === "all") return { ...intent, datePreset: preset, dateRange: { start: null, end: null } };
  if (preset === "custom") return { ...intent, datePreset: preset };

  const result = await pool.query<{ start: string; end: string }>(
    `
      WITH local_reference AS (
        SELECT timezone($1, $2::timestamptz) AS value
      )
      SELECT
        CASE $3
          WHEN 'today' THEN date_trunc('day', value) AT TIME ZONE $1
          WHEN 'yesterday' THEN (date_trunc('day', value) - interval '1 day') AT TIME ZONE $1
          WHEN 'this_week' THEN date_trunc('week', value) AT TIME ZONE $1
          WHEN 'last_week' THEN (date_trunc('week', value) - interval '1 week') AT TIME ZONE $1
          WHEN 'this_month' THEN date_trunc('month', value) AT TIME ZONE $1
          WHEN 'last_month' THEN (date_trunc('month', value) - interval '1 month') AT TIME ZONE $1
          WHEN 'recent_7_days' THEN $2::timestamptz - interval '7 days'
          WHEN 'recent_30_days' THEN $2::timestamptz - interval '30 days'
        END AS start,
        CASE $3
          WHEN 'today' THEN (date_trunc('day', value) + interval '1 day') AT TIME ZONE $1
          WHEN 'yesterday' THEN date_trunc('day', value) AT TIME ZONE $1
          WHEN 'this_week' THEN (date_trunc('week', value) + interval '1 week') AT TIME ZONE $1
          WHEN 'last_week' THEN date_trunc('week', value) AT TIME ZONE $1
          WHEN 'this_month' THEN (date_trunc('month', value) + interval '1 month') AT TIME ZONE $1
          WHEN 'last_month' THEN date_trunc('month', value) AT TIME ZONE $1
          WHEN 'recent_7_days' THEN $2::timestamptz
          WHEN 'recent_30_days' THEN $2::timestamptz
        END AS end
      FROM local_reference
    `,
    [input.timezone, input.referenceTime.toISOString(), preset],
  );
  return {
    ...intent,
    datePreset: preset,
    dateRange: {
      start: result.rows[0]?.start ? new Date(result.rows[0].start).toISOString() : null,
      end: result.rows[0]?.end ? new Date(result.rows[0].end).toISOString() : null,
    },
  };
}

async function interpretLifeQuestion(input: {
  question: string;
  timezone: string;
  referenceTime: Date;
}): Promise<{ intent: LifeQueryIntent; provider: string; model: string; providerRequestId?: string; usage?: unknown }> {
  if (config.AI_PROVIDER === "mock") {
    return { intent: heuristicIntent(input.question), provider: "mock", model: "heuristic-life-query/v1" };
  }
  if (!config.DEEPSEEK_API_KEY) {
    throw new AiConfigurationError("DeepSeek 尚未配置，暂时无法理解自然语言查询");
  }

  let lastError: AiProviderError | undefined;
  for (let attempt = 0; attempt <= config.DEEPSEEK_MAX_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.DEEPSEEK_TIMEOUT_MS);
    try {
      const response = await fetch(`${config.DEEPSEEK_BASE_URL.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.DEEPSEEK_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: config.DEEPSEEK_MODEL,
          messages: [
            { role: "system", content: QUERY_SYSTEM_PROMPT },
            {
              role: "user",
              content: JSON.stringify({
                question: input.question,
                referenceTime: input.referenceTime.toISOString(),
                timezone: input.timezone,
              }),
            },
          ],
          response_format: { type: "json_object" },
          thinking: { type: "disabled" },
          temperature: 0,
          max_tokens: 1_200,
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new AiProviderError(`DeepSeek 查询解释失败（HTTP ${response.status}）`, {
          providerStatus: response.status,
          retryable: response.status === 429 || response.status >= 500,
        });
      }
      const provider = providerResponseSchema.parse(await response.json());
      const choice = provider.choices[0];
      if (choice.finish_reason !== "stop" || !choice.message.content) {
        throw new AiProviderError("DeepSeek 没有完成查询解释", { retryable: true });
      }
      return {
        intent: parseLifeQueryIntent(JSON.parse(stripCodeFence(choice.message.content))),
        provider: "deepseek",
        model: provider.model,
        providerRequestId: provider.id,
        usage: provider.usage,
      };
    } catch (error) {
      lastError = error instanceof AiProviderError
        ? error
        : error instanceof Error && error.name === "AbortError"
          ? new AiProviderError("DeepSeek 查询解释超时", { retryable: true })
          : new AiProviderError("DeepSeek 返回了无效的查询意图", { retryable: true });
      if (!lastError.retryable || attempt >= config.DEEPSEEK_MAX_RETRIES) throw lastError;
      await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError ?? new AiProviderError("DeepSeek 查询解释失败", { retryable: true });
}

function buildEventFilter(ownerUserId: string, intent: LifeQueryIntent) {
  const params: unknown[] = [ownerUserId];
  const conditions = [
    "e.owner_user_id = $1",
    "e.deleted_at IS NULL",
    "e.factual_status IN ('occurred', 'ongoing')",
  ];
  if (intent.dateRange.start) {
    params.push(intent.dateRange.start);
    conditions.push(`COALESCE(e.occurred_start, e.created_at) >= $${params.length}::timestamptz`);
  }
  if (intent.dateRange.end) {
    params.push(intent.dateRange.end);
    conditions.push(`COALESCE(e.occurred_start, e.created_at) < $${params.length}::timestamptz`);
  }
  if (intent.eventTypes.length) {
    params.push(intent.eventTypes);
    conditions.push(`e.event_type = ANY($${params.length}::text[])`);
  }
  if (intent.entityMention) {
    params.push(`%${intent.entityMention.toLocaleLowerCase("zh-CN")}%`);
    conditions.push(`EXISTS (
      SELECT 1
      FROM ${schema}.event_entity_relations filter_relation
      JOIN ${schema}.user_entities filter_entity ON filter_entity.id = filter_relation.user_entity_id
      WHERE filter_relation.event_id = e.id
        AND lower(filter_entity.display_name) LIKE $${params.length}
    )`);
  }
  return { params, where: conditions.join(" AND ") };
}

export async function runLifeQuery(
  ownerUserId: string,
  input: { question: string; timezone: string; referenceTime: Date },
) {
  const auditId = randomUUID();
  await pool.query(
    `
      INSERT INTO ${schema}.ai_processing_audits (
        id, owner_user_id, operation, provider, model_version,
        data_scope, retention_policy, status
      ) VALUES ($1, $2, 'life_query_interpretation', $3, $4, $5::jsonb, $6, 'started')
    `,
    [
      auditId,
      ownerUserId,
      config.AI_PROVIDER,
      config.AI_PROVIDER === "deepseek" ? config.DEEPSEEK_MODEL : "heuristic-life-query/v1",
      JSON.stringify({ question: true, eventData: false, attachments: false }),
      config.AI_PROVIDER === "deepseek" ? "deepseek-api-provider-policy" : "local-only",
    ],
  );

  let interpreted;
  try {
    interpreted = await interpretLifeQuestion(input);
    await pool.query(
      `
        UPDATE ${schema}.ai_processing_audits
        SET status = 'succeeded', model_version = $2, provider_request_id = $3,
            usage = $4::jsonb, completed_at = now()
        WHERE id = $1
      `,
      [auditId, interpreted.model, interpreted.providerRequestId ?? null, JSON.stringify(interpreted.usage ?? {})],
    );
  } catch (error) {
    await pool.query(
      `
        UPDATE ${schema}.ai_processing_audits
        SET status = 'failed', error_code = $2, error_message = $3, completed_at = now()
        WHERE id = $1
      `,
      [auditId, error instanceof Error ? error.name : "UNKNOWN", error instanceof Error ? error.message : "未知错误"],
    );
    throw error;
  }

  const intent = await resolveDateRange(interpreted.intent, input);
  const filter = buildEventFilter(ownerUserId, intent);
  const base = `FROM ${schema}.events e WHERE ${filter.where}`;
  let answer: string;
  let rows: unknown[] = [];

  if (intent.intent === "count_events") {
    const result = await pool.query<{ count: string }>(
      `SELECT count(DISTINCT e.id)::text AS count ${base}`,
      filter.params,
    );
    const count = Number(result.rows[0]?.count ?? 0);
    answer = `共记录了 ${count} 次符合条件的事件。`;
    rows = [{ count }];
  } else if (intent.intent === "sum_amount") {
    const result = await pool.query<{ currency: string; amount: number }>(
      `
        SELECT COALESCE(relation.currency, 'CNY') AS currency,
               COALESCE(sum(relation.amount), 0)::double precision AS amount
        FROM ${schema}.events e
        JOIN ${schema}.event_entity_relations relation ON relation.event_id = e.id
        WHERE ${filter.where}
          AND relation.amount IS NOT NULL
        GROUP BY COALESCE(relation.currency, 'CNY')
        ORDER BY amount DESC
      `,
      filter.params,
    );
    rows = result.rows;
    answer = result.rows.length
      ? `记录中的相关金额为 ${result.rows.map((row) => `${row.amount.toFixed(2)} ${row.currency}`).join("、")}。`
      : "没有找到带金额的相关事件。";
  } else if (intent.intent === "latest_event") {
    const result = await pool.query(
      `
        SELECT e.id, e.title, e.event_type AS "eventType",
               e.occurred_start AS "occurredStart", e.created_at AS "createdAt"
        ${base}
        ORDER BY COALESCE(e.occurred_start, e.created_at) DESC
        LIMIT 1
      `,
      filter.params,
    );
    rows = result.rows;
    answer = result.rows[0]
      ? `最近一次是“${result.rows[0].title}”，时间为 ${new Date(result.rows[0].occurredStart ?? result.rows[0].createdAt).toLocaleString("zh-CN", { timeZone: input.timezone })}。`
      : "没有找到符合条件的事件。";
  } else if (intent.intent === "top_entities") {
    const params = [...filter.params];
    if (intent.entityType) params.push(intent.entityType);
    const typeCondition = intent.entityType ? `AND entity.entity_type = $${params.length}` : "";
    const result = await pool.query(
      `
        SELECT entity.id, entity.display_name AS name, entity.entity_type AS type,
               count(DISTINCT e.id)::int AS count
        FROM ${schema}.events e
        JOIN ${schema}.event_entity_relations relation ON relation.event_id = e.id
        JOIN ${schema}.user_entities entity ON entity.id = relation.user_entity_id
        WHERE ${filter.where} ${typeCondition}
        GROUP BY entity.id, entity.display_name, entity.entity_type
        ORDER BY count DESC, entity.display_name
        LIMIT ${intent.limit}
      `,
      params,
    );
    rows = result.rows;
    answer = result.rows.length
      ? `出现最多的是“${result.rows[0].name}”，共关联 ${result.rows[0].count} 次事件。`
      : "没有找到可排行的相关实体。";
  } else {
    const result = await pool.query(
      `
        SELECT e.id, e.title, e.event_type AS "eventType",
               e.occurred_start AS "occurredStart", e.created_at AS "createdAt"
        ${base}
        ORDER BY COALESCE(e.occurred_start, e.created_at) DESC
        LIMIT ${intent.limit}
      `,
      filter.params,
    );
    rows = result.rows;
    answer = result.rows.length ? `找到了 ${result.rows.length} 条相关事件。` : "没有找到符合条件的事件。";
  }

  return {
    question: input.question,
    answer,
    rows,
    query: intent,
    parser: { provider: interpreted.provider, model: interpreted.model },
  };
}

export async function getPeriodReport(
  ownerUserId: string,
  input: { period: "week" | "month"; anchor: Date; timezone: string },
) {
  const truncUnit = input.period === "week" ? "week" : "month";
  const nextInterval = input.period === "week" ? "1 week" : "1 month";
  const boundary = await pool.query<{ start: string; end: string; previousStart: string }>(
    `
      SELECT
        (date_trunc($1, timezone($2, $3::timestamptz)) AT TIME ZONE $2) AS start,
        ((date_trunc($1, timezone($2, $3::timestamptz)) + $4::interval) AT TIME ZONE $2) AS end,
        ((date_trunc($1, timezone($2, $3::timestamptz)) - $4::interval) AT TIME ZONE $2) AS "previousStart"
    `,
    [truncUnit, input.timezone, input.anchor.toISOString(), nextInterval],
  );
  const range = boundary.rows[0];
  const rangeParams = [ownerUserId, range.start, range.end];
  const summaryParams = [...rangeParams, range.previousStart, input.timezone];
  const [summary, types, entities, spending, recent] = await Promise.all([
    pool.query<{
      eventCount: number;
      activeDays: number;
      previousEventCount: number;
    }>(
      `
        SELECT
          count(*) FILTER (WHERE occurred_at >= $2 AND occurred_at < $3)::int AS "eventCount",
          count(DISTINCT timezone($5, occurred_at)::date) FILTER (WHERE occurred_at >= $2 AND occurred_at < $3)::int AS "activeDays",
          count(*) FILTER (WHERE occurred_at >= $4 AND occurred_at < $2)::int AS "previousEventCount"
        FROM (
          SELECT COALESCE(occurred_start, created_at) AS occurred_at
          FROM ${schema}.events
          WHERE owner_user_id = $1 AND deleted_at IS NULL
            AND factual_status IN ('occurred', 'ongoing')
        ) event_time
      `,
      summaryParams,
    ),
    pool.query(
      `
        SELECT event_type AS "eventType", count(*)::int AS count
        FROM ${schema}.events
        WHERE owner_user_id = $1 AND deleted_at IS NULL
          AND factual_status IN ('occurred', 'ongoing')
          AND COALESCE(occurred_start, created_at) >= $2
          AND COALESCE(occurred_start, created_at) < $3
        GROUP BY event_type ORDER BY count DESC, event_type LIMIT 8
      `,
      rangeParams,
    ),
    pool.query(
      `
        SELECT entity.display_name AS name, entity.entity_type AS type,
               count(DISTINCT event.id)::int AS count
        FROM ${schema}.events event
        JOIN ${schema}.event_entity_relations relation ON relation.event_id = event.id
        JOIN ${schema}.user_entities entity ON entity.id = relation.user_entity_id
        WHERE event.owner_user_id = $1 AND event.deleted_at IS NULL
          AND event.factual_status IN ('occurred', 'ongoing')
          AND COALESCE(event.occurred_start, event.created_at) >= $2
          AND COALESCE(event.occurred_start, event.created_at) < $3
        GROUP BY entity.id, entity.display_name, entity.entity_type
        ORDER BY count DESC, entity.display_name LIMIT 8
      `,
      rangeParams,
    ),
    pool.query(
      `
        SELECT COALESCE(relation.currency, 'CNY') AS currency,
               sum(relation.amount)::double precision AS amount
        FROM ${schema}.events event
        JOIN ${schema}.event_entity_relations relation ON relation.event_id = event.id
        WHERE event.owner_user_id = $1 AND event.deleted_at IS NULL
          AND event.factual_status IN ('occurred', 'ongoing')
          AND relation.amount IS NOT NULL
          AND COALESCE(event.occurred_start, event.created_at) >= $2
          AND COALESCE(event.occurred_start, event.created_at) < $3
        GROUP BY COALESCE(relation.currency, 'CNY') ORDER BY amount DESC
      `,
      rangeParams,
    ),
    pool.query(
      `
        SELECT id, title, event_type AS "eventType", occurred_start AS "occurredStart"
        FROM ${schema}.events
        WHERE owner_user_id = $1 AND deleted_at IS NULL
          AND factual_status IN ('occurred', 'ongoing')
          AND COALESCE(occurred_start, created_at) >= $2
          AND COALESCE(occurred_start, created_at) < $3
        ORDER BY COALESCE(occurred_start, created_at) DESC LIMIT 10
      `,
      rangeParams,
    ),
  ]);
  return {
    period: input.period,
    range: { start: range.start, end: range.end, timezone: input.timezone },
    summary: summary.rows[0] ?? { eventCount: 0, activeDays: 0, previousEventCount: 0 },
    eventTypes: types.rows,
    topEntities: entities.rows,
    spending: spending.rows,
    recentEvents: recent.rows,
  };
}
