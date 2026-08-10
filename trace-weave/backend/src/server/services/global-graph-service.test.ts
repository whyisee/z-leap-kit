import { describe, expect, it } from "vitest";
import { buildGlobalGraph } from "./global-graph-service";

describe("buildGlobalGraph", () => {
  it("connects A, confirmed B and anonymous C through authorized shared features", () => {
    const graph = buildGlobalGraph({
      viewer: { id: "a", username: "a_user", displayName: "用户 A" },
      matches: [{
        id: "match-c", score: 78, status: "anonymous_candidate", connectionState: "candidate",
        identityRevealed: false, otherUser: null, anonymousLabel: "匿名用户 C",
        reasons: [
          { canonicalEntityId: "store-a", featureType: "place", entityType: "place", label: "共同地点：商店 A", contribution: 2 },
          { canonicalEntityId: "bun", featureType: "object", entityType: "food", label: "猪肉包子", contribution: 1 },
        ],
      }],
      occurrences: [{
        id: "occurrence-ab", occurredDate: "2026-08-10",
        members: [
          { user: { id: "a", username: "a_user", displayName: "用户 A" }, permissions: {} },
          { user: { id: "b", username: "b_user", displayName: "用户 B" }, permissions: {} },
        ],
        events: [{
          id: "event-b", ownerUserId: "b", title: "在商店 A 吃包子", eventType: "eat",
          entities: [{ canonicalEntityId: "store-a", name: "商店 A", type: "place", role: "occurred_at" }],
        }],
      }],
    });

    expect(graph.nodes.map((node) => node.id)).toEqual(expect.arrayContaining([
      "user:a", "user:b", "match:match-c", "canonical:store-a", "canonical:bun", "occurrence:occurrence-ab",
    ]));
    expect(graph.relationshipEdges).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: "user:b", target: "canonical:store-a" }),
      expect.objectContaining({ source: "match:match-c", target: "canonical:store-a" }),
    ]));
    expect(graph.evidenceEdges).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: "user:a", target: "occurrence:occurrence-ab", type: "participated" }),
      expect.objectContaining({ source: "user:b", target: "occurrence:occurrence-ab", type: "participated" }),
      expect.objectContaining({ source: "occurrence:occurrence-ab", target: "canonical:store-a", type: "evidence" }),
    ]));
    expect(graph.nodes.find((node) => node.id === "match:match-c")?.metadata).not.toHaveProperty("userId");
  });
});
