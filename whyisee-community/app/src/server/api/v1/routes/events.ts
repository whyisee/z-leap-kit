import { Hono } from "hono";
import { recordRecommendationImpressions, recordUserContentEvent } from "@server/services/recommendations";
import { fail, langOf, ok, type ApiEnv } from "../http";
import { optionalAuth, sessionOf } from "../middleware";

const events = new Hono<ApiEnv>();

const maxBatch = 50;

interface ClientEvent {
  type?: string;
  targetType?: string;
  targetId?: number;
  surface?: string;
  position?: number;
  dwellMs?: number;
  score?: number;
  reasons?: string[];
  topicIds?: number[];
}

/**
 * 埋点批量上报。
 *
 * 只接受"客户端才知道的信息"：曝光、点击、停留时长。
 * 点赞/回复/关注这类写操作由对应接口在服务端自行记录，这里重复上报会双计。
 */
events.post("/", optionalAuth, async (c) => {
  const body = await readJson<{ events?: ClientEvent[] }>(c.req.raw);
  const list = Array.isArray(body?.events) ? body!.events!.slice(0, maxBatch) : [];

  if (list.length === 0) {
    return fail(c, "validation_failed", "events 不能为空");
  }

  const session = sessionOf(c);
  const userId = session?.userId;
  const accepted: string[] = [];

  for (const event of list) {
    switch (event.type) {
      case "feed_impression": {
        // 首屏曝光可能一次带多个 topicId，position 从 0 开始
        const ids = Array.isArray(event.topicIds) ? event.topicIds : [];
        const items = ids
          .map((id) => ({ targetType: "topic", targetId: Number(id), score: event.score, reasons: event.reasons }))
          .filter((item) => Number.isFinite(item.targetId) && item.targetId > 0);

        if (items.length > 0) {
          await recordRecommendationImpressions({
            userId,
            surface: readSurface(event.surface),
            items,
          });
          accepted.push(`impression:${items.length}`);
        }
        break;
      }

      case "feed_click":
        await recordUserContentEvent({
          userId,
          eventType: "recommendation_click",
          targetType: "topic",
          targetId: Number(event.targetId || 0),
          sourceSurface: "app",
          sourceReason: typeof event.position === "number" ? `position:${event.position}` : undefined,
        });
        accepted.push("click");
        break;

      case "topic_read":
        await recordUserContentEvent({
          userId,
          eventType: "view",
          targetType: "topic",
          targetId: Number(event.targetId || 0),
          sourceSurface: "app",
          dwellSeconds: typeof event.dwellMs === "number" ? Math.round(event.dwellMs / 1000) : undefined,
        });
        accepted.push("read");
        break;

      default:
        // 未识别类型静默丢弃：老客户端可能上报已下线的事件
        break;
    }
  }

  return ok(c, { accepted: accepted.length, detail: accepted, lang: langOf(c) });
});

function readSurface(value: string | undefined) {
  const allowed = ["see", "go", "following", "related", "reading", "search"] as const;
  return allowed.includes(value as (typeof allowed)[number]) ? (value as (typeof allowed)[number]) : "see";
}

async function readJson<T>(request: Request): Promise<T | undefined> {
  try {
    return (await request.json()) as T;
  } catch {
    return undefined;
  }
}

export default events;
