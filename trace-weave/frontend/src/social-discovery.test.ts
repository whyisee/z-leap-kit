import { describe, expect, it } from "vitest";
import { filterCircles, filterDiscoverableMatches, limitMatchReasons } from "./SocialDiscoveryView";
import type { SocialCircle, SocialMatch } from "./api";

function match(id: string, connectionState: SocialMatch["connectionState"]): SocialMatch {
  return {
    id,
    score: 80,
    status: connectionState === "connected" ? "connected" : "anonymous_candidate",
    connectionState,
    identityRevealed: connectionState === "connected",
    otherUser: null,
    anonymousLabel: `匿名用户 ${id}`,
    reasons: [],
  };
}

describe("发现页推荐展示", () => {
  it("不再展示已经建立关系的用户", () => {
    expect(filterDiscoverableMatches([
      match("candidate", "candidate"),
      match("connected", "connected"),
      match("incoming", "incoming"),
    ]).map((item) => item.id)).toEqual(["candidate", "incoming"]);
  });

  it("默认只展示前五项关联原因，展开后展示全部", () => {
    const reasons = Array.from({ length: 7 }, (_, index) => ({
      canonicalEntityId: `entity-${index}`,
      featureType: "entity",
      entityType: "topic",
      label: `共同点 ${index + 1}`,
      contribution: index + 1,
    }));
    expect(limitMatchReasons(reasons, false)).toHaveLength(5);
    expect(limitMatchReasons(reasons, true)).toHaveLength(7);
  });

  it("我的圈子只展示已经加入的圈子", () => {
    const circles: SocialCircle[] = [
      { id: "joined", name: "B站兴趣圈", circleType: "interest", entityType: "app", entityName: "B站", memberCount: 3, joined: true },
      { id: "available", name: "书店地点圈", circleType: "place", entityType: "place", entityName: "书店", memberCount: 6, joined: false },
    ];
    expect(filterCircles(circles, "all")).toHaveLength(2);
    expect(filterCircles(circles, "joined").map((circle) => circle.id)).toEqual(["joined"]);
  });
});
