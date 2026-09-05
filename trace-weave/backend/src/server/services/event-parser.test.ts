import { describe, expect, it } from "vitest";
import type { EventCandidatePayload } from "../domain/event-candidate";
import { applyEventGroupingConstraint, applyGraphContextConstraint } from "./event-parser";

function candidate(title: string, eventType: string, entity: string): EventCandidatePayload {
  return {
    schemaVersion: "event-candidate/v1",
    eventType,
    title,
    factualStatus: "occurred",
    time: { start: null, end: null, timezone: "Asia/Shanghai", precision: "unknown", sourceExpression: null },
    participants: [{ mention: "我", role: "actor", isCurrentUser: true, confidence: 1 }],
    entities: [{ mention: entity, entityType: "app", role: "object", attributes: {}, confidence: 0.9 }],
    subjectiveExperience: {},
    extensions: {},
    confidence: 0.9,
  };
}

describe("event grouping constraint", () => {
  it("keeps a graph combination as one event even if the provider split it", () => {
    const result = applyEventGroupingConstraint(
      [candidate("使用 B站", "use_app", "B站"), candidate("使用小红书", "use_app", "小红书")],
      {
        text: "我同时体验了B站和小红书",
        timezone: "Asia/Shanghai",
        referenceTime: new Date("2026-08-12T06:00:00.000Z"),
        eventGrouping: "single_event",
      },
    );

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("我同时体验了B站和小红书");
    expect(result[0].entities.map((entity) => entity.mention)).toEqual(["B站", "小红书"]);
    expect(result[0].extensions).toMatchObject({ eventGrouping: "single_event", mergedParserCandidateCount: 2 });
  });

  it("does not collapse ordinary records in automatic mode", () => {
    const candidates = [candidate("先使用 B站", "use_app", "B站"), candidate("然后跑步", "exercise", "Keep")];
    expect(applyEventGroupingConstraint(candidates, {
      text: "先刷B站，然后用Keep跑步",
      timezone: "Asia/Shanghai",
      referenceTime: new Date(),
      eventGrouping: "automatic",
    })).toHaveLength(2);
  });

  it("uses trusted graph categories to repair misclassified selected nodes", () => {
    const wrong = candidate("点了牛排", "order_food", "牛排");
    wrong.entities.push({ mention: "饿了么", entityType: "food", role: "object", attributes: {}, confidence: 0.5 });
    const [result] = applyGraphContextConstraint([wrong], {
      text: "我用饿了么点了牛排",
      timezone: "Asia/Shanghai",
      referenceTime: new Date(),
      eventGrouping: "single_event",
      graphContext: {
        source: "graph_interaction",
        actionId: "record.pair.entities",
        intent: "记录一起发生",
        relationHint: "饿了么是应用，牛排是食物",
        nodes: [
          { label: "牛排", kind: "entity", category: "food" },
          { label: "饿了么", kind: "entity", category: "app" },
        ],
      },
    });
    expect(result.entities).toEqual(expect.arrayContaining([
      expect.objectContaining({ mention: "牛排", entityType: "food" }),
      expect.objectContaining({ mention: "饿了么", entityType: "app", role: "platform" }),
    ]));
  });
});
