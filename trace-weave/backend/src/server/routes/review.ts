import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { authenticateRequest } from "../services/auth-service";
import { getPeriodReport, runLifeQuery } from "../services/life-query-service";
import { withTransaction } from "../db/transaction";
import { createUserAssertion, decideInference, getUserInsights, retractAssertion } from "../services/insight-service";

const timezoneSchema = z.string().trim().min(1).max(80).refine((timezone) => {
  try {
    new Intl.DateTimeFormat("zh-CN", { timeZone: timezone }).format();
    return true;
  } catch {
    return false;
  }
}, "时区名称无效");

const lifeQuerySchema = z.object({
  question: z.string().trim().min(1).max(500),
  timezone: timezoneSchema,
  referenceTime: z.string().datetime({ offset: true }).optional(),
});

const periodReportSchema = z.object({
  period: z.enum(["week", "month"]).default("week"),
  timezone: timezoneSchema,
  anchor: z.string().datetime({ offset: true }).optional(),
});
const assertionSchema = z.object({
  predicate: z.string().trim().min(1).max(80),
  targetEntityId: z.string().uuid().nullable().default(null),
  sourceEventId: z.string().uuid().nullable().default(null),
  value: z.record(z.string(), z.unknown()).default({}),
});
const inferenceActionSchema = z.object({ action: z.enum(["confirm", "reject", "hide"]) });

export const reviewRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", authenticateRequest);

  app.post("/api/review/query", async (request) => {
    const body = lifeQuerySchema.parse(request.body);
    return runLifeQuery(request.authUser.id, {
      question: body.question,
      timezone: body.timezone,
      referenceTime: body.referenceTime ? new Date(body.referenceTime) : new Date(),
    });
  });

  app.get("/api/review/report", async (request) => {
    const query = periodReportSchema.parse(request.query);
    return getPeriodReport(request.authUser.id, {
      period: query.period,
      timezone: query.timezone,
      anchor: query.anchor ? new Date(query.anchor) : new Date(),
    });
  });

  app.get("/api/review/insights", async (request) =>
    withTransaction((client) => getUserInsights(client, request.authUser.id)),
  );

  app.post("/api/review/assertions", async (request, reply) => {
    const body = assertionSchema.parse(request.body);
    const result = await withTransaction((client) => createUserAssertion(client, request.authUser.id, body));
    return reply.code(201).send(result);
  });

  app.post<{ Params: { inferenceId: string } }>("/api/review/inferences/:inferenceId/action", async (request) => {
    const body = inferenceActionSchema.parse(request.body);
    await withTransaction((client) => decideInference(client, request.authUser.id, z.string().uuid().parse(request.params.inferenceId), body.action));
    return { status: "ok" };
  });

  app.post<{ Params: { assertionId: string } }>("/api/review/assertions/:assertionId/retract", async (request) => {
    await withTransaction((client) => retractAssertion(client, request.authUser.id, z.string().uuid().parse(request.params.assertionId)));
    return { status: "ok" };
  });
};
