import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { config, quoteIdentifier } from "../config";
import { withTransaction } from "../db/transaction";
import { deliverPendingWebPush } from "./web-push-service";

const schema = quoteIdentifier(config.DB_SCHEMA);

export async function materializeDueDraftNotifications(client: PoolClient): Promise<number> {
  await client.query(
    `
      UPDATE ${schema}.draft_reminders reminder
      SET status = 'cancelled'
      FROM ${schema}.raw_entries entry
      WHERE reminder.raw_entry_id = entry.id
        AND reminder.status = 'scheduled'
        AND (
          entry.status NOT IN ('parsing', 'awaiting_confirmation', 'failed')
          OR entry.deleted_at IS NOT NULL
        )
    `,
  );

  const due = await client.query<{
    reminderId: string;
    rawEntryId: string;
    ownerUserId: string;
    remindAt: string;
    text: string | null;
  }>(
    `
      SELECT
        reminder.id AS "reminderId",
        reminder.raw_entry_id AS "rawEntryId",
        reminder.owner_user_id AS "ownerUserId",
        reminder.remind_at AS "remindAt",
        source.text
      FROM ${schema}.draft_reminders reminder
      JOIN ${schema}.raw_entries entry
        ON entry.id = reminder.raw_entry_id
       AND entry.deleted_at IS NULL
       AND entry.status IN ('parsing', 'awaiting_confirmation', 'failed')
      LEFT JOIN LATERAL (
        SELECT COALESCE(
          (SELECT content.text_content
           FROM ${schema}.raw_entry_contents content
           WHERE content.raw_entry_id = entry.id AND content.content_kind = 'text'
           ORDER BY content.position LIMIT 1),
          (SELECT transcript.transcript_text
           FROM ${schema}.raw_entry_contents content
           JOIN ${schema}.speech_transcripts transcript
             ON transcript.raw_entry_content_id = content.id
           WHERE content.raw_entry_id = entry.id AND content.content_kind = 'voice'
           ORDER BY content.position LIMIT 1)
        ) AS text
      ) source ON true
      WHERE reminder.status = 'scheduled'
        AND reminder.remind_at <= now()
      ORDER BY reminder.remind_at
      LIMIT 100
      FOR UPDATE OF reminder SKIP LOCKED
    `,
  );

  for (const reminder of due.rows) {
    const preview = reminder.text?.trim().slice(0, 80);
    await client.query(
      `
        INSERT INTO ${schema}.notifications (
          id, owner_user_id, notification_type, resource_type, resource_id,
          title, body, scheduled_at
        ) VALUES ($1, $2, 'draft_due', 'raw_entry', $3, $4, $5, $6)
        ON CONFLICT (owner_user_id, notification_type, resource_type, resource_id) DO NOTHING
      `,
      [
        randomUUID(),
        reminder.ownerUserId,
        reminder.rawEntryId,
        "有一条生活记录等待确认",
        preview ? `“${preview}${(reminder.text?.length ?? 0) > 80 ? "…" : ""}”还没有正式入账。` : "一条带附件的生活记录还没有正式入账。",
        reminder.remindAt,
      ],
    );
    await client.query(
      `
        UPDATE ${schema}.draft_reminders
        SET status = 'sent', sent_at = now()
        WHERE id = $1 AND status = 'scheduled'
      `,
      [reminder.reminderId],
    );
  }
  return due.rowCount ?? 0;
}

export async function getNotifications(client: PoolClient, ownerUserId: string) {
  await materializeDueDraftNotifications(client);
  const notifications = await client.query(
      `
        SELECT
          id,
          notification_type AS "notificationType",
          resource_type AS "resourceType",
          resource_id AS "resourceId",
          title,
          body,
          status,
          scheduled_at AS "scheduledAt",
          delivered_at AS "deliveredAt",
          read_at AS "readAt",
          created_at AS "createdAt"
        FROM ${schema}.notifications
        WHERE owner_user_id = $1 AND status IN ('pending', 'delivered', 'read')
        ORDER BY status IN ('pending', 'delivered') DESC, created_at DESC
        LIMIT 100
      `,
      [ownerUserId],
    );
  const preferences = await getNotificationPreferences(client, ownerUserId);
  return { notifications: notifications.rows, preferences };
}

export async function getNotificationPreferences(client: PoolClient, ownerUserId: string) {
  const result = await client.query<{
    browserNotificationsEnabled: boolean;
    draftReminderDelayMinutes: number;
  }>(
    `
      SELECT
        browser_notifications_enabled AS "browserNotificationsEnabled",
        draft_reminder_delay_minutes AS "draftReminderDelayMinutes"
      FROM ${schema}.notification_preferences
      WHERE owner_user_id = $1
    `,
    [ownerUserId],
  );
  return (
    result.rows[0] ?? {
      browserNotificationsEnabled: false,
      draftReminderDelayMinutes: 1440,
    }
  );
}

export async function setNotificationPreferences(
  client: PoolClient,
  ownerUserId: string,
  input: { browserNotificationsEnabled: boolean; draftReminderDelayMinutes: number },
) {
  await client.query(
    `
      INSERT INTO ${schema}.notification_preferences (
        owner_user_id, browser_notifications_enabled, draft_reminder_delay_minutes
      ) VALUES ($1, $2, $3)
      ON CONFLICT (owner_user_id) DO UPDATE
      SET browser_notifications_enabled = EXCLUDED.browser_notifications_enabled,
          draft_reminder_delay_minutes = EXCLUDED.draft_reminder_delay_minutes,
          updated_at = now()
    `,
    [ownerUserId, input.browserNotificationsEnabled, input.draftReminderDelayMinutes],
  );
  await client.query(
    `
      UPDATE ${schema}.draft_reminders reminder
      SET remind_at = entry.created_at + make_interval(mins => $2)
      FROM ${schema}.raw_entries entry
      WHERE reminder.raw_entry_id = entry.id
        AND reminder.owner_user_id = $1
        AND reminder.status = 'scheduled'
        AND entry.deleted_at IS NULL
        AND entry.status IN ('parsing', 'awaiting_confirmation', 'failed')
    `,
    [ownerUserId, input.draftReminderDelayMinutes],
  );
  return getNotificationPreferences(client, ownerUserId);
}

export async function updateNotificationStatus(
  client: PoolClient,
  ownerUserId: string,
  notificationId: string,
  action: "delivered" | "read" | "dismiss",
): Promise<boolean> {
  const result = await client.query(
    `
      UPDATE ${schema}.notifications
      SET status = CASE $3
            WHEN 'delivered' THEN CASE WHEN status = 'pending' THEN 'delivered' ELSE status END
            WHEN 'read' THEN 'read'
            ELSE 'dismissed'
          END,
          delivered_at = CASE
            WHEN $3 = 'delivered' AND delivered_at IS NULL THEN now()
            ELSE delivered_at
          END,
          read_at = CASE WHEN $3 = 'read' THEN now() ELSE read_at END,
          updated_at = now()
      WHERE id = $1 AND owner_user_id = $2 AND status <> 'dismissed'
      RETURNING id
    `,
    [notificationId, ownerUserId, action],
  );
  return Boolean(result.rowCount);
}

export function startDraftReminderWorker(logger: {
  info: (details: unknown, message?: string) => void;
  error: (details: unknown, message?: string) => void;
}): () => void {
  let running = false;
  const sweep = async () => {
    if (running) return;
    running = true;
    try {
      const count = await withTransaction(materializeDueDraftNotifications);
      const push = await withTransaction(deliverPendingWebPush);
      if (count) logger.info({ count }, "Draft reminder notifications materialized");
      if (push.delivered || push.failed) logger.info(push, "Web Push delivery sweep completed");
    } catch (error) {
      logger.error({ error }, "Draft reminder sweep failed");
    } finally {
      running = false;
    }
  };
  const timer = setInterval(() => void sweep(), config.NOTIFICATION_SWEEP_SECONDS * 1000);
  timer.unref();
  void sweep();
  return () => clearInterval(timer);
}
