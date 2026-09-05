import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { withTransaction } from "../db/transaction";
import { authenticateRequest } from "../services/auth-service";
import { executeGraphAction, resolveGraphActions, undoGraphAction } from "../services/graph-action-service";

const resolveSchema = z.object({
  scope: z.enum(["world", "personal"]),
  mode: z.enum(["relationships", "evidence"]),
  gesture: z.enum(["node_context", "node_drop", "multi_select"]),
  sourceNodeId: z.string().min(3).max(200),
  targetNodeId: z.string().min(3).max(200).optional(),
  nodeIds: z.array(z.string().min(3).max(200)).min(2).max(12).optional(),
}).superRefine((value, context) => {
  if (value.gesture === "node_drop" && !value.targetNodeId) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["targetNodeId"], message: "拖拽组合需要目标节点" });
  }
  if (value.gesture === "multi_select" && !value.nodeIds?.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["nodeIds"], message: "批量组合需要节点列表" });
  }
});

const executeSchema = z.object({
  contextId: z.string().uuid(),
  actionId: z.string().min(3).max(100),
  idempotencyKey: z.string().uuid(),
  message: z.string().trim().max(240).optional(),
});

const undoSchema = z.object({ undoId: z.string().uuid() });

export const graphActionRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", authenticateRequest);

  app.post("/api/graph/actions/resolve", async (request) => {
    const body = resolveSchema.parse(request.body);
    return withTransaction((client) => resolveGraphActions(client, request.authUser.id, body));
  });

  app.post("/api/graph/actions/execute", async (request) => {
    const body = executeSchema.parse(request.body);
    return withTransaction((client) => executeGraphAction(client, request.authUser.id, body));
  });

  app.post("/api/graph/actions/undo", async (request) => {
    const body = undoSchema.parse(request.body);
    return withTransaction((client) => undoGraphAction(client, request.authUser.id, body.undoId));
  });
};
