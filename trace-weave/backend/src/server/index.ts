import { buildApp } from "./app";
import { config } from "./config";
import { closePool } from "./db/pool";
import { startDraftReminderWorker } from "./services/notification-service";
import { startDeletionWorker } from "./services/data-governance-service";
import { startOutboxWorker } from "./services/outbox-service";
import { startWorldSyncWorker } from "./services/world-sync-service";

const app = await buildApp();
let stopReminderWorker: (() => void) | undefined;
let stopOutboxWorker: (() => void) | undefined;
let stopDeletionWorker: (() => void) | undefined;
let stopWorldSyncWorker: (() => void) | undefined;

const shutdown = async (signal: string) => {
  app.log.info({ signal }, "Shutting down");
  stopReminderWorker?.();
  stopOutboxWorker?.();
  stopDeletionWorker?.();
  stopWorldSyncWorker?.();
  await app.close();
  await closePool();
  process.exit(0);
};

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

try {
  await app.listen({ host: config.API_HOST, port: config.API_PORT });
  stopReminderWorker = startDraftReminderWorker(app.log);
  stopOutboxWorker = startOutboxWorker(app.log);
  stopDeletionWorker = startDeletionWorker(app.log);
  stopWorldSyncWorker = startWorldSyncWorker(app.log);
} catch (error) {
  app.log.error(error);
  await closePool();
  process.exit(1);
}
