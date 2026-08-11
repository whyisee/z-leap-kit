import { describe, expect, it } from "vitest";
import { buildGlobalGraph } from "./global-graph-service";

describe("buildGlobalGraph", () => {
  it("shows every active account and connects public events to their public features", () => {
    const graph = buildGlobalGraph({
      viewerId: "a",
      users: [
        { id: "a", username: "a_user", displayName: "用户 A", createdAt: "2026-08-01T00:00:00.000Z" },
        { id: "b", username: "b_user", displayName: "用户 B", createdAt: "2026-08-02T00:00:00.000Z" },
        { id: "c", username: "c_user", displayName: "用户 C", createdAt: "2026-08-03T00:00:00.000Z" },
      ],
      events: [{
        id: "event-b",
        ownerUserId: "b",
        title: "在商店 A 吃包子",
        eventType: "eat",
        factualStatus: "occurred",
        occurredStart: "2026-08-10T00:00:00.000Z",
        createdAt: "2026-08-10T00:00:00.000Z",
        entities: [
          { canonicalEntityId: "store-a", name: "商店 A", type: "place", role: "occurred_at" },
          { canonicalEntityId: "bun", name: "猪肉包子", type: "food", role: "consumed" },
        ],
      }],
    });

    expect(graph.nodes.map((node) => node.id)).toEqual(expect.arrayContaining([
      "user:a", "user:b", "user:c", "event:event-b", "canonical:store-a", "canonical:bun",
    ]));
    expect(graph.nodes.find((node) => node.id === "user:a")?.category).toBe("self");
    expect(graph.nodes.find((node) => node.id === "user:c")?.category).toBe("public_account");
    expect(graph.evidenceEdges).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: "user:b", target: "event:event-b", label: "公开记录" }),
      expect.objectContaining({ source: "event:event-b", target: "canonical:store-a", label: "occurred_at" }),
    ]));
    expect(graph.relationshipEdges).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: "user:b", target: "canonical:store-a" }),
      expect.objectContaining({ source: "user:b", target: "canonical:bun" }),
    ]));
    expect(graph.stats).toMatchObject({ users: 3, events: 1, locations: 1, entities: 1 });
  });

  it("keeps users visible in the world dataset even when they have no public events", () => {
    const graph = buildGlobalGraph({
      viewerId: "new-user",
      users: [
        { id: "new-user", username: "new", displayName: "新用户", createdAt: "2026-08-11T00:00:00.000Z" },
        { id: "quiet-user", username: "quiet", displayName: "暂无公开记录", createdAt: "2026-08-10T00:00:00.000Z" },
      ],
      events: [],
    });

    expect(graph.nodes).toHaveLength(2);
    expect(graph.relationshipEdges).toHaveLength(0);
    expect(graph.stats).toMatchObject({ users: 2, events: 0 });
  });

  it("includes safe catalog entities without inventing relationships", () => {
    const graph = buildGlobalGraph({
      viewerId: "a",
      users: [{ id: "a", username: "a_user", displayName: "用户 A", createdAt: "2026-08-01T00:00:00.000Z" }],
      events: [],
      catalogEntities: [
        { id: "bilibili", name: "哔哩哔哩", type: "app", sourceKey: "traceweave_builtin" },
        { id: "coffee", name: "咖啡", type: "drink", sourceKey: "traceweave_builtin" },
      ],
    });

    expect(graph.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "canonical:bilibili", weight: 0, metadata: expect.objectContaining({ catalog: true }) }),
      expect.objectContaining({ id: "canonical:coffee", weight: 0, metadata: expect.objectContaining({ visibility: "catalog" }) }),
    ]));
    expect(graph.relationshipEdges).toHaveLength(0);
    expect(graph.evidenceEdges).toHaveLength(0);
    expect(graph.stats).toMatchObject({ catalogEntities: 2, connectedEntities: 0 });
  });
});
