import { describe, expect, it } from "vitest";
import { confirmEntrySchema, eventCandidatePayloadSchema } from "./event-candidate";

function payload() {
  return {
    schemaVersion: "event-candidate/v1",
    eventType: "eat",
    title: "和王哥吃饭",
    factualStatus: "occurred",
    time: {
      start: "2026-08-10T12:00:00+08:00",
      end: "2026-08-10T13:00:00+08:00",
      timezone: "Asia/Shanghai",
      precision: "minute",
      sourceExpression: "今天中午",
    },
    participants: [{
      mention: "王哥",
      role: "companion",
      isCurrentUser: false,
      resolvedUserEntityId: "71000000-0000-4000-8000-000000000001",
    }],
    entities: [{
      mention: "猪肉包子",
      entityType: "food",
      role: "consumed",
      quantity: 2,
      unit: "个",
      amount: 8,
      currency: "CNY",
      attributes: { taste: "好吃" },
    }],
    subjectiveExperience: { mood: "happy" },
    extensions: { source: "manual_correction" },
    confidence: 1,
  };
}

describe("event candidate confirmation schema", () => {
  it("accepts full user corrections and an explicit long-term entity", () => {
    expect(eventCandidatePayloadSchema.safeParse(payload()).success).toBe(true);
  });

  it("rejects an end time earlier than the start time", () => {
    const input = payload();
    input.time.end = "2026-08-10T11:00:00+08:00";
    const parsed = eventCandidatePayloadSchema.safeParse(input);
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues.some((issue) => issue.path.join(".") === "time.end")).toBe(true);
  });

  it("supports explicit rejection, split and merge resolutions", () => {
    const a = "71000000-0000-4000-8000-000000000011";
    const b = "71000000-0000-4000-8000-000000000012";
    const result = confirmEntrySchema.safeParse({
      accepted: [
        { resolutionId: "71000000-0000-4000-8000-000000000021", sourceCandidateIds: [a], payload: payload() },
        { resolutionId: "71000000-0000-4000-8000-000000000022", sourceCandidateIds: [a, b], payload: payload() },
      ],
      rejectedCandidateIds: [],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a source that is both accepted and rejected", () => {
    const id = "71000000-0000-4000-8000-000000000011";
    expect(confirmEntrySchema.safeParse({
      accepted: [{ resolutionId: "71000000-0000-4000-8000-000000000021", sourceCandidateIds: [id], payload: payload() }],
      rejectedCandidateIds: [id],
    }).success).toBe(false);
  });
});
