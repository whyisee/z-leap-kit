import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { ZodError } from "zod";
import { config, quoteIdentifier } from "./config";
import { pool } from "./db/pool";
import { authRoutes } from "./routes/auth";
import { dataGovernanceRoutes } from "./routes/data-governance";
import { contactRoutes } from "./routes/contacts";
import { entityRoutes } from "./routes/entities";
import { DraftLimitError, EntryConflictError, entryRoutes } from "./routes/entries";
import { eventRoutes } from "./routes/events";
import { graphRoutes } from "./routes/graph";
import { notificationRoutes } from "./routes/notifications";
import { privacyRoutes } from "./routes/privacy";
import { reviewRoutes } from "./routes/review";
import { socialRoutes } from "./routes/social";
import { sharedEventRoutes } from "./routes/shared-events";
import { AuthError } from "./services/auth-service";
import { DataGovernanceError } from "./services/data-governance-service";
import { EntityResolutionError } from "./services/entity-resolver";
import { EntityMemoryError } from "./services/entity-memory-service";
import { MediaScanError } from "./services/media-scanner";
import { AiConfigurationError, AiProviderError } from "./services/event-parser";
import { eventParser } from "./services/parser-factory";
import { speechToTextService } from "./services/speech-to-text-service";
import { webPushConfigured } from "./services/web-push-service";
import { observeHttpRequest, prometheusMetrics } from "./services/metrics-service";
import { EventLifecycleError } from "./services/event-lifecycle-service";
import { MediaValidationError } from "./services/media-storage";
import { PrivacyManagementError } from "./services/privacy-management-service";
import { SocialMatchError } from "./services/social-service";
import { SharedInviteError } from "./services/shared-occurrence-service";
import { ContactError } from "./services/contact-service";

export async function buildApp() {
  const app = Fastify({ logger: true });
  await app.register(cors, {
    origin: config.WEB_ORIGIN,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
  });
  await app.register(multipart, {
    limits: {
      files: config.MEDIA_MAX_FILES,
      fields: 12,
      parts: config.MEDIA_MAX_FILES + 12,
      fileSize: config.MEDIA_MAX_BYTES,
    },
  });

  app.addHook("onResponse", async (request, reply) => {
    observeHttpRequest({
      method: request.method,
      route: request.routeOptions.url ?? "unmatched",
      statusCode: reply.statusCode,
      durationMs: reply.elapsedTime,
    });
  });

  app.get("/api/health", async () => {
    const schema = quoteIdentifier(config.DB_SCHEMA);
    const result = await pool.query<{ now: string }>("SELECT now()::text AS now");
    const migration = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM ${schema}.schema_migrations`,
    );

    return {
      status: "ok",
      databaseTime: result.rows[0]?.now,
      appliedMigrations: Number(migration.rows[0]?.count ?? 0),
      ai: {
        provider: eventParser.provider,
        model: eventParser.modelVersion,
        configured: eventParser.configured,
      },
      speechToText: { provider: speechToTextService.provider, model: speechToTextService.model, configured: speechToTextService.configured },
      webPush: { configured: webPushConfigured },
    };
  });

  app.get("/api/metrics", async (request, reply) => {
    const localDevelopment = config.APP_ENV !== "production" && ["127.0.0.1", "::1"].includes(request.ip);
    const token = request.headers.authorization?.replace(/^Bearer\s+/i, "");
    if (!localDevelopment && (!config.METRICS_TOKEN || token !== config.METRICS_TOKEN)) return reply.code(404).send({ message: "Not found" });
    reply.header("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
    return prometheusMetrics();
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        message: "请求内容不合法",
        issues: error.issues,
      });
    }
    if ((error as { statusCode?: number }).statusCode === undefined || (error as { statusCode?: number }).statusCode! >= 500) {
      request.log.error({ err: error, route: request.routeOptions.url, userId: request.authUser?.id }, "Unhandled request error");
    }

    if (error instanceof DraftLimitError) {
      return reply.code(409).send({ message: error.message, code: "DRAFT_LIMIT_REACHED" });
    }

    if (error instanceof AuthError) {
      return reply.code(error.statusCode).send({ message: error.message, code: error.code });
    }

    if (error instanceof EntryConflictError) {
      return reply.code(409).send({ message: error.message, code: "ENTRY_CONFLICT" });
    }

    if (error instanceof EventLifecycleError) {
      return reply.code(error.statusCode).send({ message: error.message, code: "EVENT_LIFECYCLE_ERROR" });
    }

    if (error instanceof SocialMatchError) {
      return reply.code(error.statusCode).send({ message: error.message, code: "SOCIAL_MATCH_ERROR" });
    }

    if (error instanceof SharedInviteError) {
      return reply.code(error.statusCode).send({ message: error.message, code: "SHARED_INVITE_ERROR" });
    }

    if (error instanceof ContactError) {
      return reply.code(error.statusCode).send({ message: error.message, code: error.code });
    }

    if (error instanceof AiConfigurationError) {
      return reply.code(503).send({ message: error.message, code: "AI_NOT_CONFIGURED" });
    }

    if (error instanceof AiProviderError) {
      return reply.code(502).send({
        message: error.message,
        code: "AI_PROVIDER_ERROR",
        retryable: error.retryable,
      });
    }

    if (error instanceof MediaValidationError) {
      return reply.code(error.statusCode).send({ message: error.message, code: "INVALID_MEDIA" });
    }

    if (error instanceof MediaScanError) {
      return reply.code(422).send({ message: error.message, code: "MEDIA_SCAN_FAILED" });
    }

    if (error instanceof PrivacyManagementError) {
      return reply.code(error.statusCode).send({ message: error.message, code: "PRIVACY_MANAGEMENT_ERROR" });
    }

    if (error instanceof DataGovernanceError) {
      return reply.code(error.statusCode).send({ message: error.message, code: "DATA_GOVERNANCE_ERROR" });
    }

    if (error instanceof EntityResolutionError) {
      return reply.code(error.statusCode).send({ message: error.message, code: "ENTITY_RESOLUTION_ERROR" });
    }

    if (error instanceof EntityMemoryError) {
      return reply.code(error.statusCode).send({ message: error.message, code: "ENTITY_MEMORY_ERROR" });
    }

    if ((error as { code?: string }).code === "FST_REQ_FILE_TOO_LARGE") {
      return reply.code(413).send({
        message: `单个附件不能超过 ${Math.floor(config.MEDIA_MAX_BYTES / 1024 / 1024)} MB`,
        code: "MEDIA_TOO_LARGE",
      });
    }

    app.log.error(error);
    return reply.code(500).send({ message: "服务暂时无法处理该请求" });
  });

  await app.register(authRoutes);
  await app.register(contactRoutes);
  await app.register(dataGovernanceRoutes);
  await app.register(entityRoutes);
  await app.register(entryRoutes);
  await app.register(eventRoutes);
  await app.register(graphRoutes);
  await app.register(notificationRoutes);
  await app.register(privacyRoutes);
  await app.register(reviewRoutes);
  await app.register(socialRoutes);
  await app.register(sharedEventRoutes);

  return app;
}
