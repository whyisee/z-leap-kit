import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { withTransaction } from "../db/transaction";
import { authenticateRequest, clearSessionCookie } from "../services/auth-service";
import { exportAccountData, requestAccountDeletion } from "../services/data-governance-service";

const deletionSchema = z.object({
  password: z.string().min(1).max(128),
  usernameConfirmation: z.string().trim().min(3).max(80),
});

export const dataGovernanceRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", authenticateRequest);

  app.get("/api/data/export", async (request, reply) => {
    const exported = await withTransaction((client) => exportAccountData(client, request.authUser.id));
    const date = new Date().toISOString().slice(0, 10);
    reply.header("Content-Disposition", `attachment; filename="traceweave-export-${date}.json"`);
    reply.header("Cache-Control", "no-store");
    return exported;
  });

  app.post("/api/data/deletion", async (request, reply) => {
    const body = deletionSchema.parse(request.body);
    const result = await withTransaction((client) =>
      requestAccountDeletion(
        client,
        request.authUser.id,
        body.password,
        body.usernameConfirmation,
      ),
    );
    clearSessionCookie(reply);
    return reply.code(202).send({
      ...result,
      message: "删除任务已受理，账号已冻结，后台将撤销关系并清除生活记录与附件。",
    });
  });
};
