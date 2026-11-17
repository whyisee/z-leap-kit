import { Hono } from "hono";
import { countTargetLikes, toggleBookmark, toggleFollow, toggleReaction } from "@server/services/interactions";
import { recordUserContentEvent } from "@server/services/recommendations";
import { takeToken } from "@lib/rateLimit";
import { fail, ok, type ApiContext, type ApiEnv } from "../http";
import { requireAuth } from "../middleware";

const interactions = new Hono<ApiEnv>();

interactions.use("*", requireAuth);

const writeRateLimit = { limit: 30, windowMs: 60 * 1000 };

interactions.post("/like", async (c) => {
  const session = c.get("session");
  const limited = guardWrite(c, session.userId);
  if (limited) return limited;

  const body = await readJson<{ targetType?: string; targetId?: number }>(c.req.raw);
  const targetType = body?.targetType === "post" ? "post" : body?.targetType === "topic" ? "topic" : undefined;
  const targetId = Number(body?.targetId || 0);

  if (!targetType || targetId <= 0) {
    return fail(c, "validation_failed", "targetType / targetId 不合法");
  }

  const liked = await toggleReaction({ userId: session.userId, targetType, targetId, reactionType: "like" });

  if (liked) {
    await recordUserContentEvent({
      userId: session.userId,
      eventType: "like",
      targetType,
      targetId,
      sourceSurface: "app",
    });
  }

  return ok(c, { liked, likeCount: await countTargetLikes(targetType, targetId) });
});

interactions.post("/bookmark", async (c) => {
  const session = c.get("session");
  const limited = guardWrite(c, session.userId);
  if (limited) return limited;

  const body = await readJson<{ topicId?: number }>(c.req.raw);
  const topicId = Number(body?.topicId || 0);

  if (topicId <= 0) {
    return fail(c, "validation_failed", "topicId 不合法");
  }

  const bookmarked = await toggleBookmark(session.userId, topicId);

  return ok(c, { bookmarked });
});

interactions.post("/follow", async (c) => {
  const session = c.get("session");
  const limited = guardWrite(c, session.userId);
  if (limited) return limited;

  const body = await readJson<{ targetType?: string; targetId?: number }>(c.req.raw);
  const targetType = body?.targetType;
  const targetId = Number(body?.targetId || 0);

  if (!targetType || !["topic", "category", "tag", "user"].includes(targetType) || targetId <= 0) {
    return fail(c, "validation_failed", "targetType / targetId 不合法");
  }

  const following = await toggleFollow(session.userId, targetType as "topic" | "category" | "tag" | "user", targetId);

  return ok(c, { following });
});

function guardWrite(c: ApiContext, userId: number) {
  const limit = takeToken(`write:${userId}`, writeRateLimit.limit, writeRateLimit.windowMs);
  if (limit.allowed) return undefined;

  c.header("retry-after", String(limit.retryAfterSeconds));
  return fail(c, "rate_limited", "操作太频繁，稍等一会儿");
}

async function readJson<T>(request: Request): Promise<T | undefined> {
  try {
    return (await request.json()) as T;
  } catch {
    return undefined;
  }
}

export default interactions;
