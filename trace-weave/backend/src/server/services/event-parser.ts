import type { EventCandidatePayload, GraphParserContext } from "../domain/event-candidate";

export type EventParserContext = {
  text: string;
  timezone: string;
  referenceTime: Date;
  eventGrouping?: "automatic" | "single_event";
  graphContext?: GraphParserContext;
  location?: {
    label?: string;
    role: "occurred_at" | "recorded_at";
  };
};

function distinctBy<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const value = key(item);
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

export function applyEventGroupingConstraint(
  candidates: EventCandidatePayload[],
  context: EventParserContext,
): EventCandidatePayload[] {
  if (context.eventGrouping !== "single_event") return candidates;
  if (candidates.length <= 1) return candidates.map((candidate) => ({
    ...candidate,
    extensions: { ...candidate.extensions, eventGrouping: "single_event" },
  }));
  const eventTypes = [...new Set(candidates.map((candidate) => candidate.eventType))];
  const base = candidates[0];
  return [{
    ...base,
    eventType: eventTypes.length === 1 ? eventTypes[0] : "activity",
    title: context.text,
    participants: distinctBy(
      candidates.flatMap((candidate) => candidate.participants),
      (participant) => `${participant.isCurrentUser}:${participant.mention.normalize("NFKC").toLocaleLowerCase("zh-CN")}:${participant.role}`,
    ),
    entities: distinctBy(
      candidates.flatMap((candidate) => candidate.entities),
      (entity) => `${entity.entityType}:${entity.mention.normalize("NFKC").toLocaleLowerCase("zh-CN")}:${entity.role}`,
    ),
    subjectiveExperience: Object.assign({}, ...candidates.map((candidate) => candidate.subjectiveExperience)),
    extensions: {
      ...Object.assign({}, ...candidates.map((candidate) => candidate.extensions)),
      eventGrouping: "single_event",
      mergedParserCandidateCount: candidates.length,
      mergedParserEventTypes: eventTypes,
    },
    confidence: Math.min(...candidates.map((candidate) => candidate.confidence)),
  }];
}

function graphEntityType(category: string, kind: GraphParserContext["nodes"][number]["kind"]): string {
  if (kind === "location") return "place";
  if (kind === "event") return "event";
  if (kind === "occurrence") return "shared_occurrence";
  return category === "self" ? "person" : category;
}

function graphEntityRole(category: string, kind: GraphParserContext["nodes"][number]["kind"]): string {
  if (kind === "location") return "place";
  if (["app", "platform"].includes(category)) return "platform";
  if (["book", "movie", "song", "video", "game"].includes(category)) return "content";
  return "object";
}

function normalizedMention(value: string): string {
  return value.normalize("NFKC").trim().replace(/[《》]/g, "").toLocaleLowerCase("zh-CN");
}

export function applyGraphContextConstraint(
  candidates: EventCandidatePayload[],
  context: EventParserContext,
): EventCandidatePayload[] {
  const graphContext = context.graphContext;
  if (!graphContext) return candidates;
  return candidates.map((candidate) => {
    const participants = [...candidate.participants];
    const entities = [...candidate.entities];
    for (const node of graphContext.nodes) {
      if (node.category === "self") continue;
      if (node.kind === "user" || node.kind === "person") {
        const existingIndex = participants.findIndex((participant) => normalizedMention(participant.mention) === normalizedMention(node.label));
        const participant = {
          ...(existingIndex >= 0 ? participants[existingIndex] : {}),
          mention: node.label,
          role: existingIndex >= 0 ? participants[existingIndex].role : "companion",
          isCurrentUser: false,
          confidence: 1,
        };
        if (existingIndex >= 0) participants[existingIndex] = participant;
        else participants.push(participant);
        continue;
      }
      const existingIndex = entities.findIndex((entity) => normalizedMention(entity.mention) === normalizedMention(node.label));
      const entityType = graphEntityType(node.category, node.kind);
      const role = graphEntityRole(node.category, node.kind);
      const entity = {
        ...(existingIndex >= 0 ? entities[existingIndex] : {}),
        mention: node.label,
        entityType,
        role: existingIndex >= 0 && entities[existingIndex].role !== "object" ? entities[existingIndex].role : role,
        confidence: 1,
        attributes: {
          ...(existingIndex >= 0 ? entities[existingIndex].attributes : {}),
          graphSelected: true,
          graphCategory: node.category,
        },
      };
      if (existingIndex >= 0) entities[existingIndex] = entity;
      else entities.push(entity);
    }
    return {
      ...candidate,
      participants: distinctBy(participants, (participant) => `${participant.isCurrentUser}:${normalizedMention(participant.mention)}:${participant.role}`),
      entities: distinctBy(entities, (entity) => `${entity.entityType}:${normalizedMention(entity.mention)}:${entity.role}`),
      extensions: {
        ...candidate.extensions,
        graphInteraction: {
          actionId: graphContext.actionId,
          intent: graphContext.intent,
          relationHint: graphContext.relationHint,
        },
      },
    };
  });
}

export function applyEventParserConstraints(
  candidates: EventCandidatePayload[],
  context: EventParserContext,
): EventCandidatePayload[] {
  return applyGraphContextConstraint(applyEventGroupingConstraint(candidates, context), context);
}

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
