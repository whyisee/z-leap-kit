import { hostname } from "node:os";
import { randomUUID } from "node:crypto";
import type { FastifyBaseLogger } from "fastify";
import type { PoolClient } from "pg";
import { config, quoteIdentifier } from "../config";
import { pool } from "../db/pool";
import { withTransaction } from "../db/transaction";
import { refreshSocialProjectionsForUser } from "./social-service";

const schema = quoteIdentifier(config.DB_SCHEMA);
const leaseMinutes = 5;

type OutboxRecord = {
  id: string;
  eventType: string;
  payload: Record<string, unknown>;
  attempts: number;
};

export function outboxRetryDelaySeconds(attempts: number): number {
  return Math.min(3600, 2 ** Math.min(Math.max(attempts - 1, 0), 12));
}

function payloadUserIds(record: OutboxRecord): string[] {
  const values = [record.payload.ownerUserId, record.payload.userId];
  if (Array.isArray(record.payload.affectedUserIds)) values.push(...record.payload.affectedUserIds);
  return [...new Set(values.filter((value): value is string => typeof value === "string"))].sort();
}

async function handleOutboxRecord(client: PoolClient, record: OutboxRecord): Promise<void> {
  switch (record.eventType) {
    case "event.confirmed":
    case "event.updated":
    case "event.deleted":
    case "event.privacy_updated":
    case "privacy_policy.updated":
    case "shared_occurrence.updated":
    case "entity_memory.updated":
    case "account.deleted":
      for (const userId of payloadUserIds(record)) {
        await refreshSocialProjectionsForUser(client, userId);
      }
      return;
    default:
      // Forward-compatible consumers may not know every domain event. Treating an
      // unknown event as delivered prevents an old deployment from poisoning the queue.
      return;
  }
}

async function claimOutboxBatch(workerId: string): Promise<OutboxRecord[]> {
  return withTransaction(async (client) => {
    const result = await client.query<OutboxRecord>(
      `
        WITH candidates AS (
          SELECT id
          FROM ${schema}.outbox_events
          WHERE published_at IS NULL
            AND dead_lettered_at IS NULL
            AND available_at <= now()
            AND (locked_at IS NULL OR locked_at < now() - ($3 * interval '1 minute'))
          ORDER BY occurred_at, id
          FOR UPDATE SKIP LOCKED
          LIMIT $1
        )
        UPDATE ${schema}.outbox_events event
        SET locked_at = now(), locked_by = $2, attempts = event.attempts + 1
        FROM candidates
        WHERE event.id = candidates.id
        RETURNING event.id,
                  event.event_type AS "eventType",
                  event.payload,
                  event.attempts
      `,
      [config.OUTBOX_BATCH_SIZE, workerId, leaseMinutes],
    );
    return result.rows;
  });
}

async function deliverOutboxRecord(record: OutboxRecord, workerId: string): Promise<boolean> {
  try {
    await withTransaction(async (client) => {
      const current = await client.query<{ deliverable: boolean }>(
        `
          SELECT (published_at IS NULL AND dead_lettered_at IS NULL AND locked_by = $2) AS deliverable
          FROM ${schema}.outbox_events
          WHERE id = $1
          FOR UPDATE
        `,
        [record.id, workerId],
      );
      if (!current.rows[0]?.deliverable) return;
      await handleOutboxRecord(client, record);
      await client.query(
        `
          UPDATE ${schema}.outbox_events
          SET published_at = now(), locked_at = NULL, locked_by = NULL, last_error = NULL
          WHERE id = $1 AND locked_by = $2
        `,
        [record.id, workerId],
      );
    });
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 4000) : "Unknown outbox delivery error";
    const deadLetter = record.attempts >= config.OUTBOX_MAX_ATTEMPTS;
    const retrySeconds = outboxRetryDelaySeconds(record.attempts);
    await pool.query(
      `
        UPDATE ${schema}.outbox_events
        SET last_error = $3,
            locked_at = NULL,
            locked_by = NULL,
            available_at = CASE WHEN $4 THEN available_at ELSE now() + ($5 * interval '1 second') END,
            dead_lettered_at = CASE WHEN $4 THEN now() ELSE dead_lettered_at END
        WHERE id = $1 AND locked_by = $2 AND published_at IS NULL
      `,
      [record.id, workerId, message, deadLetter, retrySeconds],
    );
    return false;
  }
}

export async function processOutboxBatch(
  logger?: Pick<FastifyBaseLogger, "info" | "error">,
  workerId = `${hostname()}:${process.pid}:${randomUUID()}`,
): Promise<{ claimed: number; delivered: number }> {
  const records = await claimOutboxBatch(workerId);
  let delivered = 0;
  for (const record of records) {
    if (await deliverOutboxRecord(record, workerId)) delivered += 1;
  }
  if (records.length) logger?.info({ workerId, claimed: records.length, delivered }, "Outbox batch processed");
  return { claimed: records.length, delivered };
}

export function startOutboxWorker(logger: FastifyBaseLogger): () => void {
  const workerId = `${hostname()}:${process.pid}:${randomUUID()}`;
  let running = false;
  let stopped = false;
  const sweep = async () => {
    if (running || stopped) return;
    running = true;
    try {
      do {
        const result = await processOutboxBatch(logger, workerId);
        if (result.claimed < config.OUTBOX_BATCH_SIZE) break;
      } while (!stopped);
    } catch (error) {
      logger.error({ err: error, workerId }, "Outbox worker sweep failed");
    } finally {
      running = false;
    }
  };
  const timer = setInterval(() => void sweep(), config.OUTBOX_SWEEP_SECONDS * 1000);
  timer.unref();
  void sweep();
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
