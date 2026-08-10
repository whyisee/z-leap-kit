import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { candidateEntitySchema, candidateParticipantSchema, factualStatusSchema } from "../domain/event-candidate";
import { confirmedLocationLinkSchema } from "../domain/location";
import { withTransaction } from "../db/transaction";
import { authenticateRequest } from "../services/auth-service";
import {
  deleteOwnedEvent,
  getOwnedEventDetail,
  replaceOwnedEventRelations,
  updateOwnedEvent,
} from "../services/event-lifecycle-service";
import {
  getEventPrivacySettings,
  setEventPrivacySettings,
} from "../services/event-privacy-service";
import { mediaStorage } from "../services/media-storage";

const eventUpdateSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    title: z.string().trim().min(1).max(500),
    eventType: z.string().trim().min(1).max(80),
    factualStatus: factualStatusSchema,
    occurredStart: z.string().datetime({ offset: true }).nullable(),
    occurredEnd: z.string().datetime({ offset: true }).nullable(),
    timePrecision: z.string().trim().min(1).max(32),
    timezone: z.string().trim().min(1).max(80).nullable(),
    sourceTimeExpression: z.string().trim().max(240).nullable(),
  })
  .superRefine((value, context) => {
    if (
      value.occurredStart &&
      value.occurredEnd &&
      new Date(value.occurredEnd).getTime() < new Date(value.occurredStart).getTime()
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["occurredEnd"],
        message: "结束时间不能早于开始时间",
      });
    }
  });

const eventDeleteSchema = z.object({
  expectedVersion: z.number().int().positive(),
});

const eventRelationsSchema = z.object({
  expectedVersion: z.number().int().positive(),
  participants: z.array(candidateParticipantSchema.extend({ existingParticipantId: z.string().uuid().optional() })).max(100),
  entities: z.array(candidateEntitySchema).max(200),
  location: confirmedLocationLinkSchema.nullable(),
});

const eventPrivacySchema = z.object({
  expectedEventVersion: z.number().int().positive(),
  contentVisibility: z.enum(["private", "friends", "circle", "public", "isolated"]),
  allowAnonymousStats: z.boolean(),
  allowMatching: z.boolean(),
  allowIdentityDisclosure: z.boolean(),
  allowSharedOccurrence: z.boolean(),
});

export const eventRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", authenticateRequest);

  app.get<{ Params: { eventId: string } }>("/api/events/:eventId", async (request) =>
    withTransaction((client) =>
      getOwnedEventDetail(client, request.authUser.id, request.params.eventId),
    ),
  );

  app.patch<{ Params: { eventId: string } }>("/api/events/:eventId", async (request) => {
    const body = eventUpdateSchema.parse(request.body);
    const result = await withTransaction((client) =>
      updateOwnedEvent(client, request.authUser.id, request.params.eventId, body),
    );
    return { eventId: request.params.eventId, ...result };
  });

  app.put<{ Params: { eventId: string } }>("/api/events/:eventId/relations", async (request) => {
    const body = eventRelationsSchema.parse(request.body);
    const result = await withTransaction((client) => replaceOwnedEventRelations(client, request.authUser.id, request.params.eventId, body));
    return { eventId: request.params.eventId, ...result };
  });

  app.get<{ Params: { eventId: string } }>("/api/events/:eventId/privacy", async (request) =>
    withTransaction((client) =>
      getEventPrivacySettings(client, request.authUser.id, request.params.eventId),
    ),
  );

  app.patch<{ Params: { eventId: string } }>("/api/events/:eventId/privacy", async (request) => {
    const body = eventPrivacySchema.parse(request.body);
    return withTransaction((client) =>
      setEventPrivacySettings(client, request.authUser.id, request.params.eventId, body),
    );
  });

  app.delete<{ Params: { eventId: string } }>("/api/events/:eventId", async (request, reply) => {
    const body = eventDeleteSchema.parse(request.body);
    const result = await withTransaction((client) =>
      deleteOwnedEvent(
        client,
        request.authUser.id,
        request.params.eventId,
        body.expectedVersion,
      ),
    );
    await Promise.all(
      result.deletedMediaStorageKeys.map((storageKey) =>
        mediaStorage.delete(storageKey).catch((error) => {
          request.log.error({ error, storageKey }, "Failed to delete event media from storage");
        }),
      ),
    );
    return reply.code(204).send();
  });
};
