import { describe, expect, it } from "vitest";
import type { CandidateRecord } from "./api";
import { mergeCandidatePayloads, prepareCandidates } from "./candidate-resolution";

function candidate(id: string, title: string, start: string, entity: string): CandidateRecord {
  return { id, payload: { schemaVersion: "event-candidate/v1", eventType: "activity", title,
    factualStatus: "occurred", time: { start, end: null, timezone: "Asia/Shanghai", precision: "minute", sourceExpression: title },
    participants: [{ mention: "我", role: "actor", isCurrentUser: true }],
    entities: [{ mention: entity, entityType: "object", role: "object", attributes: {} }],
    subjectiveExperience: {}, extensions: {}, confidence: 0.8 } };
}

describe("candidate resolution", () => {
  it("assigns a distinct local resolution while preserving the AI source", () => {
    const prepared = prepareCandidates([candidate("a", "A", "2026-08-10T10:00:00Z", "甲")], () => "resolution");
    expect(prepared[0]).toMatchObject({ id: "a", resolutionId: "resolution", sourceCandidateIds: ["a"] });
  });

  it("merges time bounds and de-duplicates participants without losing entities", () => {
    const first = candidate("a", "先做甲", "2026-08-10T10:00:00Z", "甲").payload;
    const second = candidate("b", "再做乙", "2026-08-10T11:00:00Z", "乙").payload;
    const merged = mergeCandidatePayloads(first, second);
    expect(merged.title).toBe("先做甲；再做乙");
    expect(merged.time.start).toBe("2026-08-10T10:00:00Z");
    expect(merged.participants).toHaveLength(1);
    expect(merged.entities.map((item) => item.mention)).toEqual(["甲", "乙"]);
  });
});
