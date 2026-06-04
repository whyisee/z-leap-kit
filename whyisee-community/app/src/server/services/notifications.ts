import { sendEmail } from "./mailer.ts";
import { execute, query, queryOne } from "../db/client.ts";

export interface NotificationItem {
  id: number;
  type: string;
  title: string;
  body: string;
  href: string;
  readAt: string | null;
  createdAt: string;
  actorName: string | null;
}

interface NotificationRow {
  id: number;
  type: string;
  title: string;
  body: string;
  href: string;
  read_at: string | null;
  created_at: string;
  actor_name: string | null;
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

export async function listNotifications(userId: number, limit = 50): Promise<NotificationItem[]> {
  const rows = await query<NotificationRow>(
    `
    SELECT
      notifications.id,
      notifications.type,
      notifications.title,
      notifications.body,
      notifications.href,
      notifications.read_at,
      notifications.created_at,
      users.display_name AS actor_name
    FROM notifications
    LEFT JOIN users ON users.id = notifications.actor_id
    WHERE notifications.user_id = $1
    ORDER BY notifications.created_at DESC, notifications.id DESC
    LIMIT $2
    `,
    [userId, limit],
  );

  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    href: row.href,
    readAt: row.read_at,
    createdAt: row.created_at,
    actorName: row.actor_name,
  }));
}

export async function countUnreadNotifications(userId: number) {
  const row = await queryOne<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM notifications WHERE user_id = $1 AND read_at IS NULL",
    [userId],
  );

  return Number(row?.count || 0);
}

export async function markNotificationsRead(userId: number) {
  await execute("UPDATE notifications SET read_at = $1 WHERE user_id = $2 AND read_at IS NULL", [
    new Date().toISOString(),
    userId,
  ]);
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
