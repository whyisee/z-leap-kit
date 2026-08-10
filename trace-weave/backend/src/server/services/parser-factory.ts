import { config } from "../config";
import { DeepSeekEventParser } from "./deepseek-event-parser";
import {
  AiConfigurationError,
  type EventParser,
  type EventParserContext,
  type EventParserResult,
} from "./event-parser";
import { MockEventParser } from "./mock-event-parser";

class UnconfiguredDeepSeekParser implements EventParser {
  readonly provider = "deepseek" as const;
  readonly configured = false;
  readonly retentionPolicy = "not-configured";
  readonly modelVersion = config.DEEPSEEK_MODEL;

  async parse(_context: EventParserContext): Promise<EventParserResult> {
    throw new AiConfigurationError(
      "DeepSeek 尚未配置：请在 backend/.env 中填写 DEEPSEEK_API_KEY 后重启服务",
    );
  }
}

function createEventParser(): EventParser {
  if (config.AI_PROVIDER === "mock") return new MockEventParser();
  if (!config.DEEPSEEK_API_KEY) return new UnconfiguredDeepSeekParser();

  return new DeepSeekEventParser({
    apiKey: config.DEEPSEEK_API_KEY,
    baseUrl: config.DEEPSEEK_BASE_URL,
    model: config.DEEPSEEK_MODEL,
    timeoutMs: config.DEEPSEEK_TIMEOUT_MS,
    maxRetries: config.DEEPSEEK_MAX_RETRIES,
  });
}

export const eventParser = createEventParser();
