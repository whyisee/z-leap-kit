import { Hono } from "hono";
import { formatRelative } from "@lib/format";
import { execute } from "@server/db/client";
import {
  countUnreadNotificationsByKind,
  listNotifications,
  markNotificationsRead,
  replyNotificationTypes,
  type NotificationItem,
} from "@server/services/notifications";
import { clampLimit, decodeCursor, encodeCursor } from "../pagination";
import { fail, langOf, ok, type ApiEnv } from "../http";
import { requireAuth, sessionOf } from "../middleware";

const notifications = new Hono<ApiEnv>();

/** App 顶部分段条的五个档，和网页版一致。 */
const filters = ["all", "replies", "mentions", "likes", "system"] as const;
type NotificationFilter = (typeof filters)[number];

function readFilter(value: string | undefined): NotificationFilter {
  return filters.includes(value as NotificationFilter) ? (value as NotificationFilter) : "all";
}

/**
 * 通知分类。
 *
 * 客户端要按分类换图标和颜色，但它不该知道 `bot_post_reply` 这种内部type ——
 * 分类规则留在服务端，以后加新 type 不用发版。
 */
function kindOf(item: NotificationItem) {
  if (item.type === "mention") return "mention";
  if (item.type === "like") return "like";
  if (replyNotificationTypes.includes(item.type)) return "reply";
  // 剩下的全归「系统」：审核通过、待审提醒、举报通知，以及以后新加的 type。
  // 不留 other 这种兜底分类 —— 否则「全部」里有的条目，五个分段里一个都找不到。
  return "system";
}

/** 「系统」= 不属于回复 / @ / 赞的那一切。 */
const socialTypes = [...replyNotificationTypes, "mention", "like"];

/** `/t/79#post-123` → 79；解析不出来就交给客户端按 href 走网页容器。 */
function readTopicId(href: string) {
  const matched = /^\/t\/(\d+)/.exec(href || "");
  if (!matched) return null;
  const id = Number(matched[1]);
  return Number.isFinite(id) && id > 0 ? id : null;
}

/**
 * 点开这一条该去哪儿。
 *
 * 判断放服务端而不是客户端，理由是权限：待审话题的 href 是 `/admin?status=pending`，
 * 客户端只能从 type 字符串猜「这是不是我能审的」，一旦猜错就是把非管理员扔进后台。
 * 这里直接用会话里的角色决定，客户端照 kind 走。
 */
function openTargetOf(item: NotificationItem, adminUser: boolean) {
  const topicId = readTopicId(item.href);

  if (item.type === "topic_pending" && adminUser && item.targetType === "topic" && item.targetId > 0) {
    return { kind: "review", topicId: item.targetId, path: item.href };
  }

  if (topicId) return { kind: "topic", topicId, path: item.href };

  return { kind: "web", topicId: null, path: item.href };
}

notifications.get("/", requireAuth, async (c) => {
  const session = sessionOf(c);
  if (!session) return fail(c, "unauthorized", "请先登录");

  const filter = readFilter(c.req.query("filter"));
  const limit = clampLimit(c.req.query("limit"), 20, 50);
  const offset = decodeCursor(c.req.query("cursor"));
  const lang = langOf(c);

  // 多取一条判断还有没有下一页，省掉一次 count
  const rows = await listNotifications(session.userId, limit + 1, {
    offset,
    outsideKinds: filter === "system" ? socialTypes : undefined,
    kinds:
      filter === "replies"
        ? replyNotificationTypes
        : filter === "mentions"
          ? ["mention"]
          : filter === "likes"
            ? ["like"]
            : undefined,
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  const counts = await countUnreadNotificationsByKind(session.userId);
  const adminUser = session.role === "admin";

  return ok(
    c,
    {
      filter,
      counts,
      items: page.map((item) => ({
        id: item.id,
        type: item.type,
        kind: kindOf(item),
        title: item.title,
        body: item.body,
        href: item.href,
        // 旧版本客户端只认这个字段（能解析出话题才算有目标），保留一版
        topicId: readTopicId(item.href),
        target: openTargetOf(item, adminUser),
        actorName: item.actorName,
        actorUsername: item.actorUsername,
        actorAvatarUrl: item.actorAvatarUrl,
        read: item.readAt !== null,
        at: item.createdAt,
        timeLabel: formatRelative(item.createdAt, lang),
      })),
    },
    {
      // 分页信息放 meta，和 feed / following 一致
      hasMore,
      nextCursor: hasMore ? encodeCursor(offset + page.length) : null,
      cache: "no-store",
    },
  );
});

/**
 * 标记已读。
 *
 * 两种调用方式：`{ ids: [...] }` 点开某几条之后精确标记；
 * `{ all: true }` 右上角一键清空。不做「访问列表即已读」——
 * 那样用户只是扫一眼就丢了未读标记，再想找回来就没线索了。
 */
notifications.post("/read", requireAuth, async (c) => {
  const session = sessionOf(c);
  if (!session) return fail(c, "unauthorized", "请先登录");

  let body: { ids?: unknown; all?: unknown } | undefined;
  try {
    body = (await c.req.json()) as { ids?: unknown; all?: unknown };
  } catch {
    body = undefined;
  }

  if (body?.all === true) {
    await markNotificationsRead(session.userId);
    return ok(c, { accepted: -1, counts: await countUnreadNotificationsByKind(session.userId) });
  }

  const ids = Array.isArray(body?.ids)
    ? body!.ids!
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0)
        .slice(0, 100)
    : [];

  if (ids.length === 0) {
    return ok(c, { accepted: 0, counts: await countUnreadNotificationsByKind(session.userId) });
  }

  await execute(
    `
    UPDATE notifications
    SET read_at = $1
    WHERE user_id = $2 AND id = ANY($3::int[]) AND read_at IS NULL
    `,
    [new Date().toISOString(), session.userId, ids],
  );

  return ok(c, { accepted: ids.length, counts: await countUnreadNotificationsByKind(session.userId) });
});

export default notifications;
