import type { EventCandidatePayload } from "../domain/event-candidate";

export type EventParserContext = {
  text: string;
  timezone: string;
  referenceTime: Date;
  location?: {
    label?: string;
    role: "occurred_at" | "recorded_at";
  };
};

export type EventParserUsage = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  promptCacheHitTokens?: number;
  promptCacheMissTokens?: number;
};

export type EventParserResult = {
  candidates: EventCandidatePayload[];
  providerRequestId?: string;
  resolvedModelVersion: string;
  usage?: EventParserUsage;
};

export interface EventParser {
  readonly provider: "mock" | "deepseek";
  readonly modelVersion: string;
  readonly configured: boolean;
  readonly retentionPolicy: string;
  parse(context: EventParserContext): Promise<EventParserResult>;
}

export class AiConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiConfigurationError";
  }
}

export class AiProviderError extends Error {
  readonly providerStatus?: number;
  readonly retryable: boolean;

  constructor(message: string, options?: { providerStatus?: number; retryable?: boolean }) {
    super(message);
    this.name = "AiProviderError";
    this.providerStatus = options?.providerStatus;
    this.retryable = options?.retryable ?? false;
  }
}
