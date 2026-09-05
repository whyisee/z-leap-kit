import type { EventCandidatePayload } from "../domain/event-candidate";
import { applyEventParserConstraints, type EventParser, type EventParserContext, type EventParserResult } from "./event-parser";

type EntityHint = EventCandidatePayload["entities"][number];

type CalendarParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const activityRules: Array<{ pattern: RegExp; type: string }> = [
  { pattern: /吃|早餐|午餐|晚餐|夜宵/, type: "eat" },
  { pattern: /喝|咖啡|茶|饮料/, type: "drink" },
  { pattern: /读|看书|阅读/, type: "read" },
  { pattern: /听|歌曲|音乐|播客/, type: "listen" },
  { pattern: /刷|视频|电影|电视剧|综艺/, type: "watch" },
  { pattern: /玩|游戏|对局/, type: "play" },
  { pattern: /买|购买|花了|消费/, type: "purchase" },
  { pattern: /去|到|逛|参观/, type: "visit" },
];

const knownObjects: Array<{ pattern: RegExp; entityType: string; role: string }> = [
  { pattern: /猪肉包子|肉包|包子/g, entityType: "food", role: "object" },
  { pattern: /咖啡|奶茶|茶/g, entityType: "food", role: "object" },
  { pattern: /《([^》]+)》/g, entityType: "work", role: "content" },
];

function inferActivityType(text: string): string {
  return activityRules.find((rule) => rule.pattern.test(text))?.type ?? "activity";
}

function uniqueEntities(entities: EntityHint[]): EntityHint[] {
  const seen = new Set<string>();

  return entities.filter((entity) => {
    const key = `${entity.entityType}:${entity.mention.toLocaleLowerCase("zh-CN")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractEntities(text: string): EntityHint[] {
  const entities: EntityHint[] = [];

  for (const rule of knownObjects) {
    for (const match of text.matchAll(rule.pattern)) {
      const mention = match[1] ?? match[0];
      entities.push({
        mention,
        entityType: rule.entityType,
        role: rule.role,
        confidence: 0.78,
        attributes: {},
      });
    }
  }

  const placeMatch = text.match(/(?:在|去了?|到)([^，。]{1,24}?)(?:花了|吃了|喝了|看了|玩了|买了|见了|，|。|$)/);
  if (placeMatch?.[1]) {
    entities.push({
      mention: placeMatch[1].trim(),
      entityType: "place",
      role: "place",
      confidence: 0.72,
      attributes: {},
    });
  }

  const amountMatch = text.match(/(?:花了|消费|支付)\s*(\d+(?:\.\d+)?)\s*(?:元|块)/);
  if (amountMatch?.[1]) {
    entities.push({
      mention: "人民币",
      entityType: "currency",
      role: "cost",
      amount: Number(amountMatch[1]),
      currency: "CNY",
      confidence: 0.92,
      attributes: {},
    });
  }

  return uniqueEntities(entities);
}

function extractParticipants(text: string): EventCandidatePayload["participants"] {
  const participants: EventCandidatePayload["participants"] = [
    { mention: "我", role: "actor", isCurrentUser: true, confidence: 1 },
  ];
  const personMatch = text.match(/和([^，。]{1,20}?)(?:在|去|吃|喝|看|玩|见|聊)/);

  if (personMatch?.[1]) {
    participants.push({
      mention: personMatch[1].trim(),
      role: "companion",
      isCurrentUser: false,
      confidence: 0.75,
    });
  }

  return participants;
}

function inferFactualStatus(text: string): EventCandidatePayload["factualStatus"] {
  if (/没去|没有|没吃|没看|没玩/.test(text)) return "negated";
  if (/打算|计划|准备|明天|下周/.test(text)) return "planned";
  if (/可能|也许|大概/.test(text)) return "uncertain";
  return "occurred";
}

function calendarParts(date: Date, timezone: string): CalendarParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]),
  );

  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
}

function zonedWallTimeToIso(parts: CalendarParts, timezone: string): string {
  const wallTimeAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  let guess = wallTimeAsUtc;

  // Re-evaluate twice so daylight-saving transitions converge without relying on the host timezone.
  for (let iteration = 0; iteration < 2; iteration += 1) {
    const rendered = calendarParts(new Date(guess), timezone);
    const renderedAsUtc = Date.UTC(
      rendered.year,
      rendered.month - 1,
      rendered.day,
      rendered.hour,
      rendered.minute,
      rendered.second,
    );
    guess -= renderedAsUtc - wallTimeAsUtc;
  }

  return new Date(guess).toISOString();
}

function inferTime(
  text: string,
  timezone: string,
  referenceTime: Date,
): EventCandidatePayload["time"] {
  const hasToday = /今天/.test(text);
  const hasYesterday = /昨天/.test(text);
  const hasTomorrow = /明天/.test(text);
  const period = /中午/.test(text)
    ? { hour: 12, expression: "中午", precision: "period_of_day" }
    : /早上|上午/.test(text)
      ? { hour: 9, expression: "上午", precision: "period_of_day" }
      : /下午/.test(text)
        ? { hour: 15, expression: "下午", precision: "period_of_day" }
        : /晚上|夜里/.test(text)
          ? { hour: 20, expression: "晚上", precision: "period_of_day" }
          : null;

  if (!hasToday && !hasYesterday && !hasTomorrow && !period) {
    return {
      start: null,
      end: null,
      timezone,
      precision: "unknown",
      sourceExpression: null,
    };
  }

  const referenceParts = calendarParts(referenceTime, timezone);
  const calendarDate = new Date(Date.UTC(referenceParts.year, referenceParts.month - 1, referenceParts.day));
  if (hasYesterday) calendarDate.setUTCDate(calendarDate.getUTCDate() - 1);
  if (hasTomorrow) calendarDate.setUTCDate(calendarDate.getUTCDate() + 1);
  const inferredParts: CalendarParts = {
    year: calendarDate.getUTCFullYear(),
    month: calendarDate.getUTCMonth() + 1,
    day: calendarDate.getUTCDate(),
    hour: period?.hour ?? referenceParts.hour,
    minute: period ? 0 : referenceParts.minute,
    second: 0,
  };

  return {
    start: zonedWallTimeToIso(inferredParts, timezone),
    end: null,
    timezone,
    precision: period?.precision ?? "day",
    sourceExpression: [
      hasYesterday ? "昨天" : hasToday ? "今天" : hasTomorrow ? "明天" : null,
      period?.expression,
    ]
      .filter(Boolean)
      .join(" "),
  };
}

export class MockEventParser implements EventParser {
  readonly provider = "mock" as const;
  readonly configured = true;
  readonly retentionPolicy = "local-development-parser";
  readonly modelVersion = "rules-zh-v1";

  async parse(context: EventParserContext): Promise<EventParserResult> {
    const eventType = inferActivityType(context.text);

    const candidates: EventCandidatePayload[] = [{
        schemaVersion: "event-candidate/v1",
        eventType,
        title: context.text,
        factualStatus: inferFactualStatus(context.text),
        time: inferTime(context.text, context.timezone, context.referenceTime),
        participants: extractParticipants(context.text),
        entities: extractEntities(context.text),
        subjectiveExperience: {},
        extensions: { parserMode: "development-fallback" },
        confidence: eventType === "activity" ? 0.48 : 0.78,
      }];
    return {
      candidates: applyEventParserConstraints(candidates, context),
      resolvedModelVersion: this.modelVersion,
    };
  }
}
