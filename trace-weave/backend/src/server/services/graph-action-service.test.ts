import { describe, expect, it } from "vitest";
import { multiNodeRecordActions, pairRecordActions, quickActionsForEntity } from "./graph-action-service";

describe("graph quick-record actions", () => {
  it("keeps future game intent separate from played facts", () => {
    const actions = quickActionsForEntity("game", "星露谷物语");
    expect(actions.map((action) => action.id)).toContain("record.plan.play");
    expect(actions.find((action) => action.id === "record.plan.play")?.templateText).toBe("我想玩《星露谷物语》");
    expect(actions.find((action) => action.id === "record.done.play")?.templateText).toBe("我玩了《星露谷物语》");
  });

  it("provides category-specific place and app actions", () => {
    expect(quickActionsForEntity("place", "西湖").map((action) => action.label)).toEqual(["想去", "去过", "记录这里发生的事"]);
    expect(quickActionsForEntity("app", "B站").map((action) => action.label)).toEqual(["想试试", "使用过", "经常使用"]);
  });
});

describe("graph node combination rules", () => {
  const node = (
    id: string,
    label: string,
    kind: "user" | "person" | "entity" | "location" | "event",
    category: string = kind,
  ) => ({ id, label, kind, category, resourceId: id });

  it("builds one record containing both a person and a place", () => {
    const actions = pairRecordActions(
      node("person:1", "小王", "person"),
      node("location:1", "西湖", "location"),
    );
    expect(actions[0]?.id).toBe("record.pair.person_place");
    expect(actions[0]?.templateText).toContain("小王");
    expect(actions[0]?.templateText).toContain("西湖");
  });

  it("supports entity comparison and person-person combinations", () => {
    expect(pairRecordActions(node("entity:1", "B站", "entity"), node("entity:2", "小红书", "entity")))
      .toHaveLength(3);
    expect(pairRecordActions(node("person:1", "小王", "person"), node("user:2", "小李", "user"))[0]?.id)
      .toBe("record.pair.people");
  });

  it("uses entity categories to express platform-food combinations naturally", () => {
    const actions = pairRecordActions(
      node("canonical:1", "牛排", "entity", "food"),
      node("canonical:2", "饿了么", "entity", "app"),
    );
    expect(actions[0]?.id).toBe("record.pair.entities");
    expect(actions[0]?.templateText).toBe("我用饿了么点了牛排");
    expect(actions[0]?.relationHint).toContain("通过平台下单");
  });

  it("builds one natural sentence from several selected nodes", () => {
    const actions = multiNodeRecordActions([
      node("person:1", "小王", "person"),
      node("location:1", "西湖", "location"),
      node("entity:1", "跑步", "entity", "activity"),
    ]);
    expect(actions[0]?.id).toBe("record.multi.compose");
    expect(actions[0]?.templateText).toContain("小王");
    expect(actions[0]?.templateText).toContain("西湖");
    expect(actions[0]?.templateText).toContain("跑步");
  });

  it("uses the same semantic relation hints for two-node multi-select", () => {
    const actions = multiNodeRecordActions([
      node("canonical:1", "牛排", "entity", "food"),
      node("canonical:2", "饿了么", "entity", "app"),
    ]);
    expect(actions[0]?.templateText).toBe("我用饿了么点了牛排");
    expect(actions[0]?.relationHint).toContain("通过平台下单");
  });
});
