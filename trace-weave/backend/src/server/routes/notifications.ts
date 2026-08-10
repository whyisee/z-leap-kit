import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { withTransaction } from "../db/transaction";
import { authenticateRequest } from "../services/auth-service";
import {
  getNotifications,
  setNotificationPreferences,
  updateNotificationStatus,
} from "../services/notification-service";
import { config } from "../config";
import { revokePushSubscription, savePushSubscription, webPushConfigured } from "../services/web-push-service";

const preferencesSchema = z.object({
  browserNotificationsEnabled: z.boolean(),
  draftReminderDelayMinutes: z.number().int().min(5).max(43_200),
});

const notificationActionSchema = z.object({
  action: z.enum(["delivered", "read", "dismiss"]),
});
const pushSubscriptionSchema = z.object({
  endpoint: z.string().url().max(4096),
  expirationTime: z.number().nullable(),
  keys: z.object({ p256dh: z.string().min(20).max(1024), auth: z.string().min(8).max(256) }),
});
const pushRevokeSchema = z.object({ endpoint: z.string().url().max(4096) });

export const notificationRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", authenticateRequest);

  app.get("/api/notifications", async (request) =>
    withTransaction((client) => getNotifications(client, request.authUser.id)),
  );

  app.get("/api/push/config", async () => ({ configured: webPushConfigured, publicKey: config.WEB_PUSH_VAPID_PUBLIC_KEY ?? null }));

  app.post("/api/push/subscriptions", async (request, reply) => {
    const body = pushSubscriptionSchema.parse(request.body);
    await withTransaction((client) => savePushSubscription(client, request.authUser.id, { ...body, userAgent: request.headers["user-agent"] }));
    return reply.code(201).send({ status: "active" });
  });

  app.delete("/api/push/subscriptions", async (request, reply) => {
    const body = pushRevokeSchema.parse(request.body);
    await withTransaction((client) => revokePushSubscription(client, request.authUser.id, body.endpoint));
    return reply.code(204).send();
  });

  app.patch("/api/notification-preferences", async (request) => {
    const body = preferencesSchema.parse(request.body);
    return withTransaction((client) =>
      setNotificationPreferences(client, request.authUser.id, body),
    );
  });

  app.post<{ Params: { notificationId: string } }>(
    "/api/notifications/:notificationId/action",
    async (request, reply) => {
      const body = notificationActionSchema.parse(request.body);
      const updated = await withTransaction((client) =>
        updateNotificationStatus(
          client,
          request.authUser.id,
          request.params.notificationId,
          body.action,
        ),
      );
      if (!updated) return reply.code(404).send({ message: "提醒不存在" });
      return { notificationId: request.params.notificationId, status: body.action };
    },
  );
};
