import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { withTransaction } from "../db/transaction";
import { authenticateRequest } from "../services/auth-service";
import {
  addEntityAlias,
  listEntityEvidence,
  listEntityMemory,
  listEntityOperations,
  mergeEntityMemory,
  renameEntity,
  splitEntityMemory,
  undoEntityOperation,
} from "../services/entity-memory-service";

const entityIdSchema = z.string().uuid();
const listSchema = z.object({
  search: z.string().trim().max(120).default(""),
  entityType: z.string().trim().min(1).max(60).optional(),
});
const aliasSchema = z.object({ alias: z.string().trim().min(1).max(240) });
const renameSchema = z.object({ displayName: z.string().trim().min(1).max(240) });
const mergeSchema = z.object({ targetEntityId: z.string().uuid() });
const splitSchema = z.object({
  displayName: z.string().trim().min(1).max(240),
  evidenceIds: z.array(z.string().uuid()).min(1).max(500),
  aliasIds: z.array(z.string().uuid()).max(100).default([]),
});

export const entityRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", authenticateRequest);

  app.get("/api/entities", async (request) => {
    const query = listSchema.parse(request.query);
    return withTransaction((client) =>
      listEntityMemory(client, request.authUser.id, query.search, query.entityType),
    );
  });

  app.get<{ Params: { entityId: string } }>("/api/entities/:entityId/evidence", async (request) => {
    const entityId = entityIdSchema.parse(request.params.entityId);
    return withTransaction((client) => listEntityEvidence(client, request.authUser.id, entityId));
  });

  app.get("/api/entity-operations", async (request) =>
    withTransaction((client) => listEntityOperations(client, request.authUser.id)),
  );

  app.patch<{ Params: { entityId: string } }>("/api/entities/:entityId", async (request) => {
    const entityId = entityIdSchema.parse(request.params.entityId);
    const body = renameSchema.parse(request.body);
    await withTransaction((client) => renameEntity(client, request.authUser.id, entityId, body.displayName));
    return withTransaction((client) => listEntityMemory(client, request.authUser.id));
  });

  app.post<{ Params: { entityId: string } }>("/api/entities/:entityId/aliases", async (request, reply) => {
    const entityId = entityIdSchema.parse(request.params.entityId);
    const body = aliasSchema.parse(request.body);
    await withTransaction((client) => addEntityAlias(client, request.authUser.id, entityId, body.alias));
    return reply.code(201).send(await withTransaction((client) => listEntityMemory(client, request.authUser.id)));
  });

  app.post<{ Params: { entityId: string } }>("/api/entities/:entityId/merge", async (request) => {
    const sourceEntityId = entityIdSchema.parse(request.params.entityId);
    const body = mergeSchema.parse(request.body);
    await withTransaction((client) =>
      mergeEntityMemory(client, request.authUser.id, sourceEntityId, body.targetEntityId),
    );
    return withTransaction((client) => listEntityMemory(client, request.authUser.id));
  });

  app.post<{ Params: { entityId: string } }>("/api/entities/:entityId/split", async (request) => {
    const sourceEntityId = entityIdSchema.parse(request.params.entityId);
    const body = splitSchema.parse(request.body);
    await withTransaction((client) => splitEntityMemory(client, request.authUser.id, sourceEntityId, body));
    return withTransaction((client) => listEntityMemory(client, request.authUser.id));
  });

  app.post<{ Params: { operationId: string } }>("/api/entity-operations/:operationId/undo", async (request) => {
    const operationId = entityIdSchema.parse(request.params.operationId);
    await withTransaction((client) => undoEntityOperation(client, request.authUser.id, operationId));
    return withTransaction((client) => listEntityMemory(client, request.authUser.id));
  });
};
