import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { withTransaction } from "../db/transaction";
import { authenticateRequest } from "../services/auth-service";
import {
  getPrivacyManagementOverview,
  removeManagedPrivacyPolicy,
  setManagedPrivacyPolicy,
} from "../services/privacy-management-service";

const nullablePolicySchema = z.object({
  contentVisibility: z.enum(["private", "friends", "circle", "public", "isolated"]).nullable(),
  allowAnonymousStats: z.boolean().nullable(),
  allowMatching: z.boolean().nullable(),
  allowIdentityDisclosure: z.boolean().nullable(),
  allowSharedOccurrence: z.boolean().nullable(),
});

const defaultPolicySchema = z.object({
  contentVisibility: z.enum(["private", "friends", "circle", "public", "isolated"]),
  allowAnonymousStats: z.boolean(),
  allowMatching: z.boolean(),
  allowIdentityDisclosure: z.boolean(),
  allowSharedOccurrence: z.boolean(),
});

const eventTypeSchema = z.string().trim().min(1).max(80);
const entityIdSchema = z.string().uuid();

export const privacyRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", authenticateRequest);

  app.get("/api/privacy/settings", async (request) =>
    withTransaction((client) => getPrivacyManagementOverview(client, request.authUser.id)),
  );

  app.patch("/api/privacy/default", async (request) => {
    const body = defaultPolicySchema.parse(request.body);
    await withTransaction((client) =>
      setManagedPrivacyPolicy(client, request.authUser.id, "user_default", "*", body),
    );
    return withTransaction((client) => getPrivacyManagementOverview(client, request.authUser.id));
  });

  app.patch<{ Params: { eventType: string } }>("/api/privacy/categories/:eventType", async (request) => {
    const eventType = eventTypeSchema.parse(request.params.eventType);
    const body = nullablePolicySchema.parse(request.body);
    await withTransaction((client) =>
      setManagedPrivacyPolicy(client, request.authUser.id, "activity_category", eventType, body),
    );
    return withTransaction((client) => getPrivacyManagementOverview(client, request.authUser.id));
  });

  app.delete<{ Params: { eventType: string } }>("/api/privacy/categories/:eventType", async (request, reply) => {
    const eventType = eventTypeSchema.parse(request.params.eventType);
    const removed = await withTransaction((client) =>
      removeManagedPrivacyPolicy(client, request.authUser.id, "activity_category", eventType),
    );
    return removed ? reply.code(204).send() : reply.code(404).send({ message: "类别策略不存在" });
  });

  app.patch<{ Params: { entityId: string } }>("/api/privacy/entities/:entityId", async (request) => {
    const entityId = entityIdSchema.parse(request.params.entityId);
    const body = nullablePolicySchema.parse(request.body);
    await withTransaction((client) =>
      setManagedPrivacyPolicy(client, request.authUser.id, "entity", entityId, body),
    );
    return withTransaction((client) => getPrivacyManagementOverview(client, request.authUser.id));
  });

  app.delete<{ Params: { entityId: string } }>("/api/privacy/entities/:entityId", async (request, reply) => {
    const entityId = entityIdSchema.parse(request.params.entityId);
    const removed = await withTransaction((client) =>
      removeManagedPrivacyPolicy(client, request.authUser.id, "entity", entityId),
    );
    return removed ? reply.code(204).send() : reply.code(404).send({ message: "实体策略不存在" });
  });
};
