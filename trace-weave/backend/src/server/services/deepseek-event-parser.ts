import { z } from "zod";
import { eventCandidatePayloadSchema } from "../domain/event-candidate";
import {
  AiProviderError,
  applyEventParserConstraints,
  type EventParser,
  type EventParserContext,
  type EventParserResult,
} from "./event-parser";

const responseEnvelopeSchema = z.object({
  events: z.array(eventCandidatePayloadSchema).min(1).max(20),
});

const deepSeekApiResponseSchema = z.object({
  id: z.string(),
  model: z.string(),
  choices: z
    .array(
      z.object({
        finish_reason: z.string(),
        message: z.object({
          content: z.string().nullable(),
        }),
      }),
    )
    .min(1),
  usage: z
    .object({
      prompt_tokens: z.number().optional(),
      completion_tokens: z.number().optional(),
      total_tokens: z.number().optional(),
      prompt_cache_hit_tokens: z.number().optional(),
      prompt_cache_miss_tokens: z.number().optional(),
    })
    .optional(),
});

type FetchLike = typeof fetch;

export type DeepSeekEventParserOptions = {
  apiKey: string;
  baseUrl: string;
  model: string;
  timeoutMs: number;
  maxRetries: number;
  fetchImpl?: FetchLike;
};

const SYSTEM_PROMPT = `你是织络的生活事件结构化引擎。你的唯一任务是把用户主动提交的中文生活记录转换成 JSON。

必须输出一个 JSON 对象，根字段只能是 events。events 是一个或多个事件数组。不要输出 Markdown、解释或额外文字。

每个事件必须符合以下规则：
1. schemaVersion 固定为 "event-candidate/v1"。
2. eventType 使用简短英文类型，优先使用：eat、drink、order_food、purchase、visit、meet、communicate、watch、listen、read、play、use_app、exercise、work、study、sleep、create、travel、activity。
3. factualStatus 只能是 occurred、ongoing、planned、cancelled、negated、uncertain、inferred。
4. time 包含 start、end、timezone、precision、sourceExpression。时间未知用 null，禁止编造精确时间。若事件显然已经发生但没有时间表达，可使用记录时间，precision 写 inferred_recording_time。
5. participants 必须包含当前用户：mention="我"、role="actor"、isCurrentUser=true。只提取原文明确出现的其他人物。
6. entities 中 place 只能是真实地理地点。美团、抖音、微信、Steam 等是 app 或 platform，不能识别为地点。
7. “在美团点外卖”应识别为 order_food；美团是 app/platform，外卖或具体餐品是 object，不要把整句话识别成 place。
8. 作品名、歌曲、书、视频、游戏、App、食物、商店等分别提取成实体。无法确定实体类型时使用 object。
9. 数量、单位、金额、币种分别写入 quantity、unit、amount、currency；没有就省略。
10. title 用简洁自然语言保留用户原意，不增加用户没有说过的事实。
11. confidence 为 0 到 1。字段不确定时降低置信度，不要用臆测填充。
12. 一句话包含先后独立行为时拆成多个事件；同一行为的地点、同行人、多个对象和评价保留在同一事件。“A 和 B”“同时涉及 A、B”不代表两个事件。
13. locationContext 是用户主动附加的位置上下文，不是原文。如果 role=occurred_at 且存在 label，可以把 label 作为 place 实体；如果 role=recorded_at，它只表示记录时位置，绝不能当作事件发生地。没有 label 时禁止根据坐标或“当前位置”编造地点名。
14. eventGrouping="single_event" 表示用户已明确把整段内容定义为同一件事。此时 events 必须且只能返回 1 项；即使涉及多个事物、人物或地点，也要把它们作为同一事件的实体与参与者，禁止按对象拆分。
15. graphContext 来自用户主动选择的图谱节点，是可信的消歧上下文：节点 label 和 category 必须保留，不能把 app/platform 当成食物或地点，也不能把 food 当成 app。根据用户原文、actionId、intent 和 relationHint 推断节点在同一事件中的合理角色，但不要编造时间、金额、数量或未表达的人物。
16. 常见平台语义：外卖/电商/内容平台通常是 platform，用户同时选择平台与食物/商品/内容时，优先理解为“通过该平台获取、下单或体验对象”；例如“饿了么(app/platform)+牛排(food)”在 record.pair.entities 的同一事件上下文中，应理解为“通过饿了么点/买了牛排”，而不是“体验了牛排和饿了么”两个并列对象。若用户补充文字明确表达其他关系，以用户文字为准。

每个事件对象需要包含：schemaVersion、eventType、title、factualStatus、time、participants、entities、subjectiveExperience、extensions、confidence。
每个 entity 需要包含：mention、entityType、role、attributes；其他字段按需添加。`;

function sleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

function stripCodeFence(value: string): string {
  const trimmed = value.trim();
  if (!trimmed.startsWith("```")) return trimmed;
  return trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
}

function sanitizedProviderMessage(status: number): string {
  if (status === 401 || status === 403) return "DeepSeek API Key 无效或没有访问权限";
  if (status === 402) return "DeepSeek 账户余额不足";
  if (status === 429) return "DeepSeek 请求过于频繁，请稍后重试";
  if (status >= 500) return "DeepSeek 服务暂时不可用";
  return `DeepSeek 请求失败（HTTP ${status}）`;
}

export class DeepSeekEventParser implements EventParser {
  readonly provider = "deepseek" as const;
  readonly configured = true;
  readonly retentionPolicy = "deepseek-api-provider-policy";
  readonly modelVersion: string;

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly fetchImpl: FetchLike;

  constructor(options: DeepSeekEventParserOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.modelVersion = options.model;
    this.timeoutMs = options.timeoutMs;
    this.maxRetries = options.maxRetries;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async parse(context: EventParserContext): Promise<EventParserResult> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const response = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: this.modelVersion,
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              {
                role: "user",
                content: JSON.stringify({
                  recordText: context.text,
                  referenceTime: context.referenceTime.toISOString(),
                  timezone: context.timezone,
                  locationContext: context.location ?? null,
                  eventGrouping: context.eventGrouping ?? "automatic",
                  graphContext: context.graphContext ?? null,
                  outputInstruction: context.eventGrouping === "single_event"
                    ? "返回符合约束的 JSON 对象，events 必须且只能有一个事件"
                    : "返回符合约束的 JSON 对象",
                }),
              },
            ],
            response_format: { type: "json_object" },
            thinking: { type: "disabled" },
            temperature: 0.1,
            max_tokens: 4_000,
          }),
          signal: controller.signal,
        });

        const responseText = await response.text();
        if (!response.ok) {
          throw new AiProviderError(sanitizedProviderMessage(response.status), {
            providerStatus: response.status,
            retryable: response.status === 429 || response.status >= 500,
          });
        }

        const apiResponse = deepSeekApiResponseSchema.parse(JSON.parse(responseText));
        const choice = apiResponse.choices[0];
        if (choice.finish_reason !== "stop") {
          throw new AiProviderError(`DeepSeek 输出未正常结束（${choice.finish_reason}）`, {
            retryable: choice.finish_reason === "insufficient_system_resource",
          });
        }

        if (!choice.message.content) {
          throw new AiProviderError("DeepSeek 返回了空内容", { retryable: true });
        }

        const parsedOutput = responseEnvelopeSchema.parse(
          JSON.parse(stripCodeFence(choice.message.content)),
        );

        return {
          candidates: applyEventParserConstraints(parsedOutput.events, context),
          providerRequestId: apiResponse.id,
          resolvedModelVersion: apiResponse.model,
          usage: apiResponse.usage
            ? {
                promptTokens: apiResponse.usage.prompt_tokens,
                completionTokens: apiResponse.usage.completion_tokens,
                totalTokens: apiResponse.usage.total_tokens,
                promptCacheHitTokens: apiResponse.usage.prompt_cache_hit_tokens,
                promptCacheMissTokens: apiResponse.usage.prompt_cache_miss_tokens,
              }
            : undefined,
        };
      } catch (error) {
        lastError = error;
        const retryable =
          error instanceof AiProviderError
            ? error.retryable
            : error instanceof z.ZodError || error instanceof SyntaxError ||
              (error instanceof Error && error.name === "AbortError");

        if (!retryable || attempt >= this.maxRetries) break;
        await sleep(Math.min(2_000, 300 * 2 ** attempt));
      } finally {
        clearTimeout(timeout);
      }
    }

    if (lastError instanceof AiProviderError) throw lastError;
    if (lastError instanceof Error && lastError.name === "AbortError") {
      throw new AiProviderError("DeepSeek 请求超时", { retryable: true });
    }
    if (lastError instanceof z.ZodError || lastError instanceof SyntaxError) {
      throw new AiProviderError("DeepSeek 返回的数据未通过事件 Schema 校验", { retryable: true });
    }
    throw new AiProviderError("无法连接 DeepSeek 服务", { retryable: true });
  }
}
