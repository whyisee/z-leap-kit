import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { withTransaction } from "../db/transaction";
import { authenticateRequest } from "../services/auth-service";
import {
  decideSocialMatch,
  getSocialDiscoverySettings,
  getSocialMatches,
  setSocialDiscoverySetting,
} from "../services/social-service";
import { blockUser, getAnonymousCircleStats, getSocialFeed, listCircles, reportUser, setCircleMembership } from "../services/circle-service";

const settingsSchema = z.object({
  participateInDiscovery: z.boolean(),
});

const decisionSchema = z.object({
  decision: z.enum(["connect", "dismiss", "disconnect"]),
});
const circleMembershipSchema = z.object({ joined: z.boolean() });
const blockSchema = z.object({ userId: z.string().uuid(), reason: z.string().trim().max(120).optional() });
const reportSchema = z.object({
  reportedUserId: z.string().uuid(),
  reason: z.enum(["harassment","spam","impersonation","privacy","unsafe_content","other"]),
  details: z.string().trim().max(2000).optional(),
  contextType: z.string().trim().max(40).optional(),
  contextId: z.string().uuid().optional(),
});

export const socialRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", authenticateRequest);

  app.get("/api/social", async (request) =>
    withTransaction(async (client) => ({
      settings: await getSocialDiscoverySettings(client, request.authUser.id),
      matches: await getSocialMatches(client, request.authUser.id),
    })),
  );

  app.post("/api/social/settings", async (request) => {
    const body = settingsSchema.parse(request.body);
    return withTransaction(async (client) => {
      const settings = await setSocialDiscoverySetting(
        client,
        request.authUser.id,
        body.participateInDiscovery,
      );
      return {
        settings,
        matches: await getSocialMatches(client, request.authUser.id),
      };
    });
  });

  app.post<{ Params: { matchId: string } }>("/api/social/matches/:matchId/decision", async (request) => {
    const body = decisionSchema.parse(request.body);
    return withTransaction(async (client) => {
      await decideSocialMatch(client, request.authUser.id, request.params.matchId, body.decision);
      return {
        settings: await getSocialDiscoverySettings(client, request.authUser.id),
        matches: await getSocialMatches(client, request.authUser.id),
      };
    });
  });

  app.get("/api/circles", async (request) => withTransaction((client) => listCircles(client, request.authUser.id)));
  app.get("/api/circles/stats", async (request) => withTransaction((client) => getAnonymousCircleStats(client, request.authUser.id)));
  app.post<{ Params: { circleId: string } }>("/api/circles/:circleId/membership", async (request) => {
    const body = circleMembershipSchema.parse(request.body);
    await withTransaction((client) => setCircleMembership(client, request.authUser.id, z.string().uuid().parse(request.params.circleId), body.joined));
    return withTransaction((client) => listCircles(client, request.authUser.id));
  });
  app.get("/api/social/feed", async (request) => withTransaction((client) => getSocialFeed(client, request.authUser.id)));
  app.post("/api/social/block", async (request) => {
    const body = blockSchema.parse(request.body);
    await withTransaction((client) => blockUser(client, request.authUser.id, body.userId, body.reason));
    return { status: "blocked" };
  });
  app.post("/api/social/report", async (request, reply) => {
    const body = reportSchema.parse(request.body);
    await withTransaction((client) => reportUser(client, request.authUser.id, body));
    return reply.code(201).send({ status: "submitted" });
  });
};
