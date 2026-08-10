import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { withTransaction } from "../db/transaction";
import { authenticateRequest } from "../services/auth-service";
import {
  decideSharedParticipantInvite,
  getSharedParticipantInvites,
  getSharedOccurrences,
  inviteEventParticipant,
  updateOccurrencePermissions,
} from "../services/shared-occurrence-service";

const inviteSchema = z.object({
  username: z.string().trim().min(3).max(40),
});

const decisionSchema = z.object({
  decision: z.enum(["accept", "decline", "revoke"]),
  linkedEventId: z.string().uuid().optional(),
  permissions: z.object({
    eventTitle: z.boolean(), entities: z.boolean(), coarseTime: z.boolean(), coarseLocation: z.boolean(),
  }).optional(),
});
const permissionsSchema = z.object({ eventTitle: z.boolean(), entities: z.boolean(), coarseTime: z.boolean(), coarseLocation: z.boolean() });

export const sharedEventRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", authenticateRequest);

  app.get("/api/shared-invites", async (request) => ({
    invites: await withTransaction((client) => getSharedParticipantInvites(client, request.authUser.id)),
  }));

  app.get("/api/shared-occurrences", async (request) =>
    withTransaction((client) => getSharedOccurrences(client, request.authUser.id)),
  );

  app.post<{ Params: { eventId: string; participantId: string } }>(
    "/api/events/:eventId/participants/:participantId/invite",
    async (request, reply) => {
      const body = inviteSchema.parse(request.body);
      const inviteId = await withTransaction((client) =>
        inviteEventParticipant(
          client,
          request.authUser.id,
          request.params.eventId,
          request.params.participantId,
          body.username,
        ),
      );
      return reply.code(201).send({ inviteId, status: "invited" });
    },
  );

  app.post<{ Params: { inviteId: string } }>(
    "/api/shared-invites/:inviteId/decision",
    async (request) => {
      const body = decisionSchema.parse(request.body);
      await withTransaction((client) =>
        decideSharedParticipantInvite(client, request.authUser.id, request.params.inviteId, body.decision, {
          linkedEventId: body.linkedEventId,
          permissions: body.permissions,
        }),
      );
      return { inviteId: request.params.inviteId, status: body.decision };
    },
  );

  app.patch<{ Params: { occurrenceId: string } }>("/api/shared-occurrences/:occurrenceId/permissions", async (request) => {
    const permissions = permissionsSchema.parse(request.body);
    await withTransaction((client) => updateOccurrencePermissions(client, request.authUser.id, z.string().uuid().parse(request.params.occurrenceId), permissions));
    return { status: "ok" };
  });
};
