import { describe, expect, it, vi } from "vitest";
import { DeepSeekEventParser } from "./deepseek-event-parser";

function deepSeekResponse(content: unknown, overrides?: { status?: number; finishReason?: string }) {
  return new Response(
    JSON.stringify({
      id: "chatcmpl-test",
      model: "deepseek-v4-flash-202608",
      choices: [
        {
          finish_reason: overrides?.finishReason ?? "stop",
          message: { content: JSON.stringify(content) },
        },
      ],
      usage: {
        prompt_tokens: 320,
        completion_tokens: 180,
        total_tokens: 500,
        prompt_cache_hit_tokens: 0,
        prompt_cache_miss_tokens: 320,
      },
    }),
    { status: overrides?.status ?? 200, headers: { "Content-Type": "application/json" } },
  );
}

function createParser(fetchImpl: typeof fetch) {
  return new DeepSeekEventParser({
    apiKey: "test-key",
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-v4-flash",
    timeoutMs: 5_000,
    maxRetries: 0,
    fetchImpl,
  });
}

describe("DeepSeekEventParser", () => {
  it("uses JSON Output and validates a food-delivery event", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      deepSeekResponse({
        events: [
          {
            schemaVersion: "event-candidate/v1",
            eventType: "order_food",
            title: "我在美团点了外卖",
            factualStatus: "occurred",
            time: {
              start: "2026-08-10T16:05:00+08:00",
              end: null,
              timezone: "Asia/Shanghai",
              precision: "inferred_recording_time",
              sourceExpression: null,
            },
            participants: [{ mention: "我", role: "actor", isCurrentUser: true, confidence: 1 }],
            entities: [
              {
                mention: "美团",
                entityType: "app",
                role: "platform",
                confidence: 0.99,
                attributes: {},
              },
              {
                mention: "外卖",
                entityType: "food",
                role: "object",
                confidence: 0.8,
                attributes: {},
              },
            ],
            subjectiveExperience: {},
            extensions: {},
            confidence: 0.92,
          },
        ],
      }),
    );
    const parser = createParser(fetchImpl);

    const result = await parser.parse({
      text: "我在美团上点了个外卖",
      timezone: "Asia/Shanghai",
      referenceTime: new Date("2026-08-10T08:05:00.000Z"),
    });

    expect(result.candidates[0].eventType).toBe("order_food");
    expect(result.candidates[0].entities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ mention: "美团", entityType: "app", role: "platform" }),
      ]),
    );
    expect(result.providerRequestId).toBe("chatcmpl-test");
    expect(result.usage?.totalTokens).toBe(500);

    const [requestUrl, requestInit] = fetchImpl.mock.calls[0];
    expect(requestUrl).toBe("https://api.deepseek.com/chat/completions");
    const requestBody = JSON.parse(String(requestInit?.body));
    expect(requestBody.response_format).toEqual({ type: "json_object" });
    expect(requestBody.thinking).toEqual({ type: "disabled" });
    expect(requestBody.messages[1].content).toContain("我在美团上点了个外卖");
  });

  it("sends a strict single-event instruction for graph combinations", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      deepSeekResponse({
        events: [{
          schemaVersion: "event-candidate/v1",
          eventType: "use_app",
          title: "同时体验 B站和小红书",
          factualStatus: "occurred",
          time: { start: null, end: null, timezone: "Asia/Shanghai", precision: "unknown", sourceExpression: null },
          participants: [{ mention: "我", role: "actor", isCurrentUser: true, confidence: 1 }],
          entities: [
            { mention: "B站", entityType: "app", role: "object", attributes: {}, confidence: 0.9 },
            { mention: "小红书", entityType: "app", role: "object", attributes: {}, confidence: 0.9 },
          ],
          subjectiveExperience: {}, extensions: {}, confidence: 0.9,
        }],
      }),
    );
    const parser = createParser(fetchImpl);
    const result = await parser.parse({
      text: "我同时体验了B站和小红书",
      timezone: "Asia/Shanghai",
      referenceTime: new Date(),
      eventGrouping: "single_event",
      graphContext: {
        source: "graph_interaction",
        actionId: "record.pair.entities",
        intent: "记录一起发生",
        relationHint: "B站和小红书都是应用平台",
        nodes: [
          { label: "B站", kind: "entity", category: "app" },
          { label: "小红书", kind: "entity", category: "app" },
        ],
      },
    });
    expect(result.candidates).toHaveLength(1);
    const requestBody = JSON.parse(String(fetchImpl.mock.calls[0][1]?.body));
    expect(requestBody.messages[1].content).toContain('"eventGrouping":"single_event"');
    expect(requestBody.messages[1].content).toContain('"category":"app"');
    expect(requestBody.messages[1].content).toContain("events 必须且只能有一个事件");
  });

  it("rejects output that does not match the event schema", async () => {
    const parser = createParser(
      vi.fn<typeof fetch>().mockResolvedValue(
        deepSeekResponse({ events: [{ eventType: "order_food", factualStatus: "wrong" }] }),
      ),
    );

    await expect(
      parser.parse({
        text: "点了外卖",
        timezone: "Asia/Shanghai",
        referenceTime: new Date(),
      }),
    ).rejects.toMatchObject({
      name: "AiProviderError",
      message: "DeepSeek 返回的数据未通过事件 Schema 校验",
    });
  });

  it("returns a safe authentication error without exposing provider response content", async () => {
    const parser = createParser(
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response('{"error":{"message":"secret provider detail"}}', { status: 401 }),
      ),
    );

    await expect(
      parser.parse({
        text: "点了外卖",
        timezone: "Asia/Shanghai",
        referenceTime: new Date(),
      }),
    ).rejects.toMatchObject({ message: "DeepSeek API Key 无效或没有访问权限" });
  });
});
