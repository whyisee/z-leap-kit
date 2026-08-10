import { randomUUID } from "node:crypto";
import webPush from "web-push";
import type { PoolClient } from "pg";
import { config, quoteIdentifier } from "../config";

const schema = quoteIdentifier(config.DB_SCHEMA);
export const webPushConfigured = Boolean(config.WEB_PUSH_VAPID_PUBLIC_KEY && config.WEB_PUSH_VAPID_PRIVATE_KEY);
if (webPushConfigured) {
  webPush.setVapidDetails(config.WEB_PUSH_VAPID_SUBJECT, config.WEB_PUSH_VAPID_PUBLIC_KEY!, config.WEB_PUSH_VAPID_PRIVATE_KEY!);
}

export async function savePushSubscription(client: PoolClient, ownerUserId: string, input: {
  endpoint: string; expirationTime: number | null; keys: { p256dh: string; auth: string }; userAgent?: string;
}) {
  if (!webPushConfigured) throw Object.assign(new Error("服务器尚未配置 Web Push VAPID 密钥"), { statusCode: 503 });
  await client.query(
    `INSERT INTO ${schema}.web_push_subscriptions (
       id, owner_user_id, endpoint, p256dh, auth_secret, user_agent, status
     ) VALUES ($1,$2,$3,$4,$5,$6,'active')
     ON CONFLICT (owner_user_id, endpoint) DO UPDATE SET
       p256dh = EXCLUDED.p256dh, auth_secret = EXCLUDED.auth_secret,
       user_agent = EXCLUDED.user_agent, status = 'active', failure_count = 0, updated_at = now()`,
    [randomUUID(), ownerUserId, input.endpoint, input.keys.p256dh, input.keys.auth, input.userAgent ?? null],
  );
}

export async function revokePushSubscription(client: PoolClient, ownerUserId: string, endpoint: string) {
  await client.query(
    `UPDATE ${schema}.web_push_subscriptions SET status = 'revoked', updated_at = now()
     WHERE owner_user_id = $1 AND endpoint = $2`, [ownerUserId, endpoint],
  );
}

export async function deliverPendingWebPush(client: PoolClient): Promise<{ delivered: number; failed: number }> {
  if (!webPushConfigured) return { delivered: 0, failed: 0 };
  const pending = await client.query<{
    notificationId: string; subscriptionId: string; endpoint: string; p256dh: string; auth: string;
    title: string; body: string; resourceId: string;
  }>(
    `SELECT notification.id AS "notificationId", subscription.id AS "subscriptionId",
            subscription.endpoint, subscription.p256dh, subscription.auth_secret AS auth,
            notification.title, notification.body, notification.resource_id AS "resourceId"
     FROM ${schema}.notifications notification
     JOIN ${schema}.notification_preferences preference ON preference.owner_user_id = notification.owner_user_id
       AND preference.browser_notifications_enabled
     JOIN ${schema}.web_push_subscriptions subscription ON subscription.owner_user_id = notification.owner_user_id
       AND subscription.status = 'active'
     LEFT JOIN ${schema}.web_push_deliveries delivery
       ON delivery.notification_id = notification.id AND delivery.subscription_id = subscription.id
     WHERE notification.status = 'pending'
       AND (delivery.id IS NULL OR (delivery.status = 'failed' AND delivery.attempted_at < now() - interval '15 minutes'))
     ORDER BY notification.created_at LIMIT 100`,
  );
  let delivered = 0;
  let failed = 0;
  for (const item of pending.rows) {
    const deliveryId = randomUUID();
    await client.query(
      `INSERT INTO ${schema}.web_push_deliveries (id,notification_id,subscription_id,status)
       VALUES ($1,$2,$3,'pending')
       ON CONFLICT (notification_id,subscription_id) DO UPDATE SET status = 'pending', attempted_at = now(), error_message = NULL`,
      [deliveryId, item.notificationId, item.subscriptionId],
    );
    try {
      const response = await webPush.sendNotification(
        { endpoint: item.endpoint, keys: { p256dh: item.p256dh, auth: item.auth } },
        JSON.stringify({ title: item.title, body: item.body, tag: `traceweave-${item.notificationId}`, url: "/?view=drafts", notificationId: item.notificationId }),
        { TTL: 24 * 60 * 60, urgency: "normal" },
      );
      await client.query(
        `UPDATE ${schema}.web_push_deliveries SET status = 'delivered', response_status = $3, delivered_at = now()
         WHERE notification_id = $1 AND subscription_id = $2`, [item.notificationId, item.subscriptionId, response.statusCode],
      );
      await client.query(`UPDATE ${schema}.web_push_subscriptions SET failure_count = 0, last_success_at = now(), updated_at = now() WHERE id = $1`, [item.subscriptionId]);
      await client.query(`UPDATE ${schema}.notifications SET status = 'delivered', delivered_at = COALESCE(delivered_at, now()), updated_at = now() WHERE id = $1`, [item.notificationId]);
      delivered += 1;
    } catch (error) {
      const statusCode = typeof error === "object" && error && "statusCode" in error ? Number((error as { statusCode: unknown }).statusCode) : null;
      const expired = statusCode === 404 || statusCode === 410;
      await client.query(
        `UPDATE ${schema}.web_push_deliveries SET status = $3, response_status = $4, error_message = $5
         WHERE notification_id = $1 AND subscription_id = $2`,
        [item.notificationId, item.subscriptionId, expired ? "expired" : "failed", statusCode,
          error instanceof Error ? error.message.slice(0, 1000) : "Web Push delivery failed"],
      );
      await client.query(
        `UPDATE ${schema}.web_push_subscriptions SET status = CASE WHEN $2 THEN 'expired' ELSE status END,
           failure_count = failure_count + 1, last_failure_at = now(), updated_at = now() WHERE id = $1`,
        [item.subscriptionId, expired],
      );
      failed += 1;
    }
  }
  return { delivered, failed };
}
