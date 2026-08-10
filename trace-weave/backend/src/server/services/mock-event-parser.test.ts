import { describe, expect, it } from "vitest";
import { MockEventParser } from "./mock-event-parser";

describe("MockEventParser", () => {
  it("extracts a dining event without treating it as a flat note", async () => {
    const parser = new MockEventParser();
    const result = await parser.parse({
      text: "今天中午我在商店A花了8块钱吃了两个猪肉包子",
      timezone: "Asia/Shanghai",
      referenceTime: new Date("2026-08-10T06:00:00.000Z"),
    });
    const [event] = result.candidates;

    expect(event.eventType).toBe("eat");
    expect(event.factualStatus).toBe("occurred");
    expect(event.time.precision).toBe("period_of_day");
    expect(event.time.start).toBe("2026-08-10T04:00:00.000Z");
    expect(event.entities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ entityType: "food", mention: "猪肉包子" }),
        expect.objectContaining({ entityType: "place", mention: "商店A" }),
        expect.objectContaining({ entityType: "currency", amount: 8, currency: "CNY" }),
      ]),
    );
  });

  it("keeps plans separate from occurred facts", async () => {
    const parser = new MockEventParser();
    const result = await parser.parse({
      text: "明天打算和小王去看电影",
      timezone: "Asia/Shanghai",
      referenceTime: new Date("2026-08-10T06:00:00.000Z"),
    });
    const [event] = result.candidates;

    expect(event.factualStatus).toBe("planned");
    expect(event.time.start).toBe("2026-08-11T06:00:00.000Z");
    expect(event.participants).toEqual(
      expect.arrayContaining([expect.objectContaining({ mention: "小王", role: "companion" })]),
    );
  });
});
