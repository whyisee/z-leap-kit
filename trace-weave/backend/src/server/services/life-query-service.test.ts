import { describe, expect, it } from "vitest";
import { detectRelativeDatePreset, parseLifeQueryIntent } from "./life-query-service";

describe("life query intent guard", () => {
  it("accepts only the fixed query DSL and strips unknown fields", () => {
    const parsed = parseLifeQueryIntent({
      intent: "count_events",
      datePreset: "本周",
      dateRange: null,
      eventTypes: ["read"],
      entityMention: null,
      entityType: null,
      limit: "10",
      sql: "DROP TABLE events",
    });

    expect(parsed).toEqual({
      intent: "count_events",
      datePreset: "this_week",
      dateRange: { start: null, end: null },
      eventTypes: ["read"],
      entityMention: null,
      entityType: null,
      limit: 10,
    });
    expect(parsed).not.toHaveProperty("sql");
  });

  it("rejects a model attempt to request arbitrary SQL", () => {
    expect(() => parseLifeQueryIntent({ intent: "raw_sql" })).toThrow();
  });

  it("recognizes relative periods before the database calculates boundaries", () => {
    expect(detectRelativeDatePreset("我这周读了几次书？")).toBe("this_week");
    expect(detectRelativeDatePreset("上个月去了哪些地方？")).toBe("last_month");
    expect(detectRelativeDatePreset("最近 30 天玩了什么游戏？")).toBe("recent_30_days");
    expect(detectRelativeDatePreset("我最喜欢什么书？")).toBeNull();
  });
});
