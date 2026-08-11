import { describe, expect, it } from "vitest";
import { aggregateCircleRelations } from "./circle-service";

describe("圈子匿名关联聚合", () => {
  it("只返回至少由三位授权用户支持的关联", () => {
    const candidates = [
      { eventId: "e1", ownerUserId: "u1", canonicalEntityId: "food", name: "猪肉包子", entityType: "food" },
      { eventId: "e2", ownerUserId: "u2", canonicalEntityId: "food", name: "猪肉包子", entityType: "food" },
      { eventId: "e3", ownerUserId: "u3", canonicalEntityId: "food", name: "猪肉包子", entityType: "food" },
      { eventId: "e4", ownerUserId: "u1", canonicalEntityId: "video", name: "沙雕视频", entityType: "topic" },
      { eventId: "e5", ownerUserId: "u2", canonicalEntityId: "video", name: "沙雕视频", entityType: "topic" },
    ];
    const result = aggregateCircleRelations(candidates, new Set(candidates.map((item) => item.eventId)));
    expect(result).toEqual([{ id: "food", name: "猪肉包子", entityType: "food", eventCount: 3, participantCountLowerBound: 3 }]);
  });

  it("忽略没有匿名统计授权的事件", () => {
    const candidates = [
      { eventId: "e1", ownerUserId: "u1", canonicalEntityId: "food", name: "猪肉包子", entityType: "food" },
      { eventId: "e2", ownerUserId: "u2", canonicalEntityId: "food", name: "猪肉包子", entityType: "food" },
      { eventId: "e3", ownerUserId: "u3", canonicalEntityId: "food", name: "猪肉包子", entityType: "food" },
    ];
    expect(aggregateCircleRelations(candidates, new Set(["e1", "e2"]))).toEqual([]);
  });
});
