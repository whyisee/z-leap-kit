import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { withTransaction } from "../db/transaction";
import { authenticateRequest } from "../services/auth-service";
import {
  createFriendRequest,
  decideFriendRequest,
  getContactOverview,
  getConversationMessages,
  listConversations,
  markConversationRead,
  openConversation,
  removeContact,
  searchContactUsers,
  sendDirectMessage,
} from "../services/contact-service";

const searchSchema = z.object({ q: z.string().trim().min(1).max(80) });
const friendRequestSchema = z.object({
  recipientUserId: z.string().uuid(),
  message: z.string().trim().max(240).optional(),
});
const friendDecisionSchema = z.object({ decision: z.enum(["accept", "reject", "cancel"]) });
const openConversationSchema = z.object({ userId: z.string().uuid() });
const messageQuerySchema = z.object({
  before: z.string().datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
const directMessageSchema = z.object({
  content: z.string().trim().min(1).max(4000),
  clientMessageId: z.string().uuid().optional(),
});

export const contactRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", authenticateRequest);

  app.get("/api/contacts", async (request) =>
    withTransaction((client) => getContactOverview(client, request.authUser.id)),
  );

  app.get("/api/contacts/search", async (request) => {
    const query = searchSchema.parse(request.query);
    return withTransaction((client) => searchContactUsers(client, request.authUser.id, query.q));
  });

  app.post("/api/contact-requests", async (request, reply) => {
    const body = friendRequestSchema.parse(request.body);
    const result = await withTransaction((client) =>
      createFriendRequest(client, request.authUser.id, body.recipientUserId, body.message),
    );
    return reply.code(201).send(result);
  });

  app.post<{ Params: { requestId: string } }>("/api/contact-requests/:requestId/decision", async (request) => {
    const requestId = z.string().uuid().parse(request.params.requestId);
    const body = friendDecisionSchema.parse(request.body);
    return withTransaction((client) =>
      decideFriendRequest(client, request.authUser.id, requestId, body.decision),
    );
  });

  app.delete<{ Params: { userId: string } }>("/api/contacts/:userId", async (request) => {
    const otherUserId = z.string().uuid().parse(request.params.userId);
    return withTransaction((client) => removeContact(client, request.authUser.id, otherUserId));
  });

  app.get("/api/conversations", async (request) =>
    withTransaction((client) => listConversations(client, request.authUser.id)),
  );

  app.post("/api/conversations", async (request, reply) => {
    const body = openConversationSchema.parse(request.body);
    const result = await withTransaction((client) => openConversation(client, request.authUser.id, body.userId));
    return reply.code(201).send(result);
  });

  app.get<{ Params: { conversationId: string } }>("/api/conversations/:conversationId/messages", async (request) => {
    const conversationId = z.string().uuid().parse(request.params.conversationId);
    const query = messageQuerySchema.parse(request.query);
    return withTransaction((client) =>
      getConversationMessages(client, request.authUser.id, conversationId, query.before, query.limit),
    );
  });

  app.post<{ Params: { conversationId: string } }>("/api/conversations/:conversationId/messages", async (request, reply) => {
    const conversationId = z.string().uuid().parse(request.params.conversationId);
    const body = directMessageSchema.parse(request.body);
    const result = await withTransaction((client) =>
      sendDirectMessage(client, request.authUser.id, conversationId, body.content, body.clientMessageId),
    );
    return reply.code(201).send(result);
  });

  app.post<{ Params: { conversationId: string } }>("/api/conversations/:conversationId/read", async (request) => {
    const conversationId = z.string().uuid().parse(request.params.conversationId);
    return withTransaction((client) => markConversationRead(client, request.authUser.id, conversationId));
  });
};
