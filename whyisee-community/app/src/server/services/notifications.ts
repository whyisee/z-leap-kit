import { sendEmail } from "./mailer.ts";
import { execute, query, queryOne } from "../db/client.ts";

export interface NotificationItem {
  id: number;
  type: string;
  targetType: string;
  targetId: number;
  title: string;
  body: string;
  href: string;
  readAt: string | null;
  createdAt: string;
  actorId: number | null;
  actorUsername: string | null;
  actorName: string | null;
  actorAvatarUrl: string | null;
}

export interface NotificationGroup {
  key: string;
  actorId: number | null;
  actorUsername: string | null;
  actorName: string;
  actorAvatarUrl: string | null;
  lastTitle: string;
  lastBody: string;
  lastAt: string;
  count: number;
  unreadCount: number;
}

interface NotificationRow {
  id: number;
  type: string;
  target_type: string;
  target_id: number;
  title: string;
  body: string;
  href: string;
  read_at: string | null;
  created_at: string;
  actor_id: number | null;
  actor_username: string | null;
  actor_name: string | null;
  actor_avatar_url: string | null;
}

interface NotificationGroupRow {
  group_key: string;
  actor_id: number | null;
  actor_username: string | null;
  actor_name: string | null;
  actor_avatar_url: string | null;
  title: string;
  body: string;
  created_at: string;
  count: string;
  unread_count: string;
}

export async function createNotification(input: {
  userId: number;
  actorId?: number | null;
  type: string;
  targetType: string;
  targetId: number;
  title: string;
  body?: string;
  href: string;
  email?: boolean;
}) {
  if (input.actorId && input.actorId === input.userId) {
    return;
  }

  const now = new Date().toISOString();
  await execute(
    `
    INSERT INTO notifications (user_id, actor_id, type, target_type, target_id, title, body, href, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `,
    [
      input.userId,
      input.actorId || null,
      input.type,
      input.targetType,
      input.targetId,
      input.title,
      input.body || "",
      input.href,
      now,
    ],
  );

  if (input.email) {
    await maybeEmailNotification(input.userId, input.title, input.body || "", input.href);
  }
}

export async function notifyAdmins(input: {
  actorId?: number | null;
  type: string;
  targetType: string;
  targetId: number;
  title: string;
  body?: string;
  href: string;
}) {
  const admins = await query<{ id: number }>("SELECT id FROM users WHERE role = 'admin' AND status = 'active'");

  for (const admin of admins) {
    await createNotification({
      ...input,
      userId: admin.id,
      email: true,
    });
  }
}

export async function listNotificationGroups(userId: number, limit = 30): Promise<NotificationGroup[]> {
  const rows = await query<NotificationGroupRow>(
    `
    WITH ranked_notifications AS (
      SELECT
        notifications.*,
        users.username AS actor_username,
        users.display_name AS actor_name,
        users.avatar_url AS actor_avatar_url,
        COALESCE(notifications.actor_id::text, 'system') AS group_key,
        ROW_NUMBER() OVER (
          PARTITION BY COALESCE(notifications.actor_id::text, 'system')
          ORDER BY notifications.created_at DESC, notifications.id DESC
        ) AS row_rank,
        COUNT(*) OVER (
          PARTITION BY COALESCE(notifications.actor_id::text, 'system')
        )::text AS count,
        COUNT(*) FILTER (WHERE notifications.read_at IS NULL) OVER (
          PARTITION BY COALESCE(notifications.actor_id::text, 'system')
        )::text AS unread_count
      FROM notifications
      LEFT JOIN users ON users.id = notifications.actor_id
      WHERE notifications.user_id = $1
        AND notifications.type <> 'direct_message'
    )
    SELECT
      group_key,
      actor_id,
      actor_username,
      actor_name,
      actor_avatar_url,
      title,
      body,
      created_at,
      count,
      unread_count
    FROM ranked_notifications
    WHERE row_rank = 1
    ORDER BY created_at DESC, group_key ASC
    LIMIT $2
    `,
    [userId, limit],
  );

  return rows.map((row) => ({
    key: row.group_key,
    actorId: row.actor_id,
    actorUsername: row.actor_username,
    actorName: row.actor_name || "系统通知",
    actorAvatarUrl: row.actor_avatar_url,
    lastTitle: row.title,
    lastBody: row.body,
    lastAt: row.created_at,
    count: Number(row.count || 0),
    unreadCount: Number(row.unread_count || 0),
  }));
}

export async function listNotifications(
  userId: number,
  limit = 50,
  filter: {
    actorId?: number;
    systemOnly?: boolean;
    kinds?: string[];
    /** 排除这些 type（和 kinds 互补，用来表达「其余都算」这种分类） */
    outsideKinds?: string[];
    offset?: number;
  } = {},
): Promise<NotificationItem[]> {
  const rows = await query<NotificationRow>(
    `
    SELECT
      notifications.id,
      notifications.type,
      notifications.target_type,
      notifications.target_id,
      notifications.title,
      notifications.body,
      notifications.href,
      notifications.read_at,
      notifications.created_at,
      notifications.actor_id,
      users.username AS actor_username,
      users.display_name AS actor_name,
      users.avatar_url AS actor_avatar_url
    FROM notifications
    LEFT JOIN users ON users.id = notifications.actor_id
    WHERE notifications.user_id = $1
      AND notifications.type <> 'direct_message'
      AND (
        $3 = 'all'
        OR ($3 = 'system' AND notifications.actor_id IS NULL)
        OR ($3 = 'actor' AND notifications.actor_id = $4)
      )
      -- $5 为 null 表示不按类型过滤（网页版就是这条路）
      AND ($5::text[] IS NULL OR notifications.type = ANY($5::text[]))
      AND ($7::text[] IS NULL OR notifications.type <> ALL($7::text[]))
    ORDER BY notifications.created_at DESC, notifications.id DESC
    LIMIT $2 OFFSET $6
    `,
    [
      userId,
      limit,
      filter.systemOnly ? "system" : typeof filter.actorId === "number" ? "actor" : "all",
      filter.actorId || 0,
      filter.kinds && filter.kinds.length > 0 ? filter.kinds : null,
      filter.offset && filter.offset > 0 ? filter.offset : 0,
      filter.outsideKinds && filter.outsideKinds.length > 0 ? filter.outsideKinds : null,
    ],
  );

  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    targetType: row.target_type,
    targetId: row.target_id,
    title: row.title,
    body: row.body,
    href: row.href,
    readAt: row.read_at,
    createdAt: row.created_at,
    actorId: row.actor_id,
    actorUsername: row.actor_username,
    actorName: row.actor_name,
    actorAvatarUrl: row.actor_avatar_url,
  }));
}

export async function countUnreadNotifications(userId: number) {
  const row = await queryOne<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM notifications WHERE user_id = $1 AND read_at IS NULL AND type <> 'direct_message'",
    [userId],
  );

  return Number(row?.count || 0);
}

/**
 * 「有人在跟你说话」的那几类。回复、AI 回复、关注的话题有动静都算同一件事：
 * 有话要接。@ 和赞单独算，因为它们要的反应不一样（回话 vs 看一眼）。
 *
 * 网页版在 notifications.astro 里内联过一份同样的集合，先不动它 ——
 * 那边的过滤是取 100 条后内存筛，改成 SQL 会改变它现有的分页行为。
 */
export const replyNotificationTypes = [
  "topic_reply",
  "post_reply",
  "bot_reply",
  "bot_post_reply",
  "topic_followed_activity",
];

export interface NotificationUnreadCounts {
  total: number;
  replies: number;
  mentions: number;
  likes: number;
  system: number;
}

/**
 * 一次查出各分类的未读数。
 *
 * App 顶部的分段条要给每档标未读，分四次 count 就是四个来回；
 * 用 FILTER 聚合一条就够，代价是这条 SQL 得知道分类怎么划。
 */
export async function countUnreadNotificationsByKind(userId: number): Promise<NotificationUnreadCounts> {
  const row = await queryOne<{
    total: string;
    replies: string;
    mentions: string;
    likes: string;
    system: string;
  }>(
    `
    SELECT
      COUNT(*)::text AS total,
      COUNT(*) FILTER (WHERE type = ANY($2::text[]))::text AS replies,
      COUNT(*) FILTER (WHERE type = 'mention')::text AS mentions,
      COUNT(*) FILTER (WHERE type = 'like')::text AS likes,
      COUNT(*) FILTER (
        WHERE type <> ALL($2::text[]) AND type <> 'mention' AND type <> 'like'
      )::text AS system
    FROM notifications
    WHERE user_id = $1 AND read_at IS NULL AND type <> 'direct_message'
    `,
    [userId, replyNotificationTypes],
  );

  return {
    total: Number(row?.total || 0),
    replies: Number(row?.replies || 0),
    mentions: Number(row?.mentions || 0),
    likes: Number(row?.likes || 0),
    system: Number(row?.system || 0),
  };
}

export async function markNotificationsRead(userId: number) {
  await execute("UPDATE notifications SET read_at = $1 WHERE user_id = $2 AND read_at IS NULL", [
    new Date().toISOString(),
    userId,
  ]);
}

export async function markNotificationsReadByTarget(userId: number, targetType: string, targetId: number) {
  await execute(
    `
    UPDATE notifications
    SET read_at = $1
    WHERE user_id = $2
      AND target_type = $3
      AND target_id = $4
      AND read_at IS NULL
    `,
    [new Date().toISOString(), userId, targetType, targetId],
  );
}

async function maybeEmailNotification(userId: number, title: string, body: string, href: string) {
  const user = await queryOne<{ id: number; email: string | null; notification_email_enabled: boolean }>(
    "SELECT id, email, notification_email_enabled FROM users WHERE id = $1 LIMIT 1",
    [userId],
  );

  if (!user?.email || !user.notification_email_enabled) {
    return;
  }

  await sendEmail({
    to: user.email,
    recipientUserId: user.id,
    subject: title,
    body: `${body}\n\n${process.env.SITE_URL || "https://whyisee.xyz"}${href}`,
  });

  await execute(
    `
    UPDATE notifications
    SET emailed_at = $1
    WHERE id = (
      SELECT id FROM notifications
      WHERE user_id = $2 AND title = $3
      ORDER BY id DESC
      LIMIT 1
    )
    `,
    [new Date().toISOString(), userId, title],
  );
}
