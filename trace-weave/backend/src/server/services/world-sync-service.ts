import { createHash, randomUUID } from "node:crypto";
import { hostname } from "node:os";
import type { FastifyBaseLogger } from "fastify";
import type { PoolClient } from "pg";
import { config, quoteIdentifier } from "../config";
import {
  builtinWorldEntities,
  builtinWorldEntityCatalogVersion,
} from "../domain/builtin-world-entities";
import { pool } from "../db/pool";
import { withTransaction } from "../db/transaction";
import { normalizeEntityName } from "./entity-resolver";
import { evaluateEventPrivacy } from "./privacy-policy-service";

const schema = quoteIdentifier(config.DB_SCHEMA);
const builtinSourceKey = "traceweave_builtin";

export type EntitySeedStats = {
  catalogVersion: string;
  total: number;
  created: number;
  reused: number;
  aliases: number;
};

export type PublicGraphSyncStats = {
  scanned: number;
  published: number;
  updated: number;
  revoked: number;
  entityEdges: number;
};

type ProjectionRefreshResult = {
  status: "published" | "updated" | "revoked" | "unchanged";
  entityEdges: number;
};

type SyncRunKind = "entity_seed" | "projection_reconcile";

function checksum(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 4000) : "Unknown world sync error";
}

async function runTrackedSync<T extends Record<string, unknown>>(
  sourceKey: string,
  runKind: SyncRunKind,
  operation: (client: PoolClient) => Promise<T>,
): Promise<{ skipped: boolean; stats: T | null }> {
  const runId = randomUUID();
  const workerId = `${hostname()}:${process.pid}`;
  try {
    return await withTransaction(async (client) => {
      const lock = await client.query<{ locked: boolean }>(
        "SELECT pg_try_advisory_xact_lock(hashtextextended($1, 0)) AS locked",
        [`world-sync:${sourceKey}:${runKind}`],
      );
      if (!lock.rows[0]?.locked) {
        await client.query(
          `INSERT INTO ${schema}.world_sync_runs (
             id, source_key, run_kind, status, stats, worker_id, completed_at
           ) VALUES ($1,$2,$3,'skipped','{"reason":"lock_not_acquired"}'::jsonb,$4,now())`,
          [runId, sourceKey, runKind, workerId],
        );
        return { skipped: true, stats: null };
      }

      await client.query(
        `INSERT INTO ${schema}.world_sync_runs (id,source_key,run_kind,status,worker_id)
         VALUES ($1,$2,$3,'running',$4)`,
        [runId, sourceKey, runKind, workerId],
      );
      await client.query(
        `INSERT INTO ${schema}.world_sync_state (source_key,last_started_at,updated_at)
         VALUES ($1,now(),now())
         ON CONFLICT (source_key) DO UPDATE
         SET last_started_at=now(), updated_at=now()`,
        [sourceKey],
      );
      const stats = await operation(client);
      await client.query(
        `UPDATE ${schema}.world_sync_runs
         SET status='succeeded', stats=$2::jsonb, completed_at=now()
         WHERE id=$1`,
        [runId, JSON.stringify(stats)],
      );
      await client.query(
        `UPDATE ${schema}.world_sync_state
         SET last_success_at=now(), last_error=NULL, updated_at=now()
         WHERE source_key=$1`,
        [sourceKey],
      );
      return { skipped: false, stats };
    });
  } catch (error) {
    const message = errorMessage(error);
    await pool.query(
      `INSERT INTO ${schema}.world_sync_runs (
         id,source_key,run_kind,status,error_message,worker_id,completed_at
       ) VALUES ($1,$2,$3,'failed',$4,$5,now())
       ON CONFLICT (id) DO UPDATE
       SET status='failed',error_message=EXCLUDED.error_message,completed_at=now()`,
      [runId, sourceKey, runKind, message, workerId],
    );
    await pool.query(
      `INSERT INTO ${schema}.world_sync_state (
         source_key,last_failure_at,last_error,updated_at
       ) VALUES ($1,now(),$2,now())
       ON CONFLICT (source_key) DO UPDATE
       SET last_failure_at=now(),last_error=EXCLUDED.last_error,updated_at=now()`,
      [sourceKey, message],
    );
    throw error;
  }
}

async function seedBuiltinEntities(client: PoolClient): Promise<EntitySeedStats> {
  const stats: EntitySeedStats = {
    catalogVersion: builtinWorldEntityCatalogVersion,
    total: builtinWorldEntities.length,
    created: 0,
    reused: 0,
    aliases: 0,
  };

  for (const item of builtinWorldEntities) {
    const normalizedName = normalizeEntityName(item.canonicalName);
    const source = await client.query<{ canonicalEntityId: string }>(
      `SELECT canonical_entity_id AS "canonicalEntityId"
       FROM ${schema}.canonical_entity_sources
       WHERE source_key=$1 AND external_id=$2
       FOR UPDATE`,
      [builtinSourceKey, item.externalId],
    );
    let canonicalEntityId = source.rows[0]?.canonicalEntityId;
    if (!canonicalEntityId) {
      const existing = await client.query<{ id: string }>(
        `SELECT id FROM ${schema}.canonical_entities
         WHERE entity_type=$1 AND normalized_name=$2 AND status='active'
         ORDER BY created_at LIMIT 1`,
        [item.entityType, normalizedName],
      );
      canonicalEntityId = existing.rows[0]?.id;
      if (canonicalEntityId) {
        stats.reused += 1;
      } else {
        canonicalEntityId = randomUUID();
        await client.query(
          `INSERT INTO ${schema}.canonical_entities (
             id,entity_type,canonical_name,normalized_name,match_eligible,metadata
           ) VALUES ($1,$2,$3,$4,true,$5::jsonb)`,
          [canonicalEntityId, item.entityType, item.canonicalName, normalizedName, JSON.stringify({
            managedBy: builtinSourceKey,
            catalogVersion: builtinWorldEntityCatalogVersion,
            ...(item.metadata ?? {}),
          })],
        );
        stats.created += 1;
      }
    } else {
      stats.reused += 1;
    }

    await client.query(
      `INSERT INTO ${schema}.canonical_entity_sources (
         id,canonical_entity_id,source_key,external_id,source_version,raw_checksum,metadata
       ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)
       ON CONFLICT (source_key,external_id) DO UPDATE
       SET canonical_entity_id=EXCLUDED.canonical_entity_id,
           source_version=EXCLUDED.source_version,
           raw_checksum=EXCLUDED.raw_checksum,
           metadata=EXCLUDED.metadata,
           last_seen_at=now()`,
      [
        randomUUID(), canonicalEntityId, builtinSourceKey, item.externalId,
        builtinWorldEntityCatalogVersion, checksum(item), JSON.stringify(item.metadata ?? {}),
      ],
    );

    for (const alias of [item.canonicalName, ...(item.aliases ?? [])]) {
      const result = await client.query(
        `INSERT INTO ${schema}.canonical_entity_aliases (
           id,canonical_entity_id,alias,normalized_alias,locale,source_key
         ) VALUES ($1,$2,$3,$4,'zh-CN',$5)
         ON CONFLICT (canonical_entity_id,normalized_alias,locale) DO UPDATE
         SET alias=EXCLUDED.alias,source_key=EXCLUDED.source_key,updated_at=now()`,
        [randomUUID(), canonicalEntityId, alias, normalizeEntityName(alias), builtinSourceKey],
      );
      if (result.rowCount) stats.aliases += 1;
    }
  }
  return stats;
}

export async function runBuiltinWorldEntitySeed() {
  return runTrackedSync(builtinSourceKey, "entity_seed", seedBuiltinEntities);
}

export async function refreshPublicEventProjection(
  client: PoolClient,
  eventId: string,
): Promise<ProjectionRefreshResult> {
  const existing = await client.query<{ exists: boolean }>(
    `SELECT EXISTS(SELECT 1 FROM ${schema}.public_event_projections WHERE event_id=$1) AS exists`,
    [eventId],
  );
  const eventResult = await client.query<{
    ownerUserId: string;
    title: string;
    eventType: string;
    factualStatus: string;
    occurredDay: string | null;
    createdDay: string;
  }>(
    `SELECT event.owner_user_id AS "ownerUserId",event.title,
            event.event_type AS "eventType",event.factual_status AS "factualStatus",
            event.occurred_start::date::text AS "occurredDay",
            event.created_at::date::text AS "createdDay"
     FROM ${schema}.events event
     JOIN ${schema}.users owner ON owner.id=event.owner_user_id AND owner.status='active'
     WHERE event.id=$1 AND event.deleted_at IS NULL`,
    [eventId],
  );
  const event = eventResult.rows[0];
  const privacy = event
    ? await evaluateEventPrivacy(client, event.ownerUserId, eventId)
    : null;
  if (!event || privacy?.contentVisibility !== "public") {
    const deleted = await client.query(
      `DELETE FROM ${schema}.public_event_projections WHERE event_id=$1`,
      [eventId],
    );
    return { status: deleted.rowCount ? "revoked" : "unchanged", entityEdges: 0 };
  }

  await client.query(
    `INSERT INTO ${schema}.public_event_projections (
       event_id,owner_user_id,title,event_type,factual_status,
       occurred_day,created_day,policy_version,projected_at,updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6::date,$7::date,$8,now(),now())
     ON CONFLICT (event_id) DO UPDATE
     SET owner_user_id=EXCLUDED.owner_user_id,title=EXCLUDED.title,
         event_type=EXCLUDED.event_type,factual_status=EXCLUDED.factual_status,
         occurred_day=EXCLUDED.occurred_day,created_day=EXCLUDED.created_day,
         policy_version=EXCLUDED.policy_version,updated_at=now()`,
    [
      eventId, event.ownerUserId, event.title, event.eventType, event.factualStatus,
      event.occurredDay, event.createdDay, privacy.policyVersion,
    ],
  );
  await client.query(
    `DELETE FROM ${schema}.public_event_entity_projections WHERE event_id=$1`,
    [eventId],
  );
  const edges = await client.query(
    `INSERT INTO ${schema}.public_event_entity_projections (
       event_id,canonical_entity_id,relation_role
     )
     SELECT DISTINCT relation.event_id,canonical.id,relation.relation_role
     FROM ${schema}.event_entity_relations relation
     JOIN ${schema}.canonical_entities canonical ON canonical.id=relation.canonical_entity_id
     WHERE relation.event_id=$1 AND canonical.status='active' AND canonical.sensitivity='normal'
     ON CONFLICT DO NOTHING`,
    [eventId],
  );
  return {
    status: existing.rows[0]?.exists ? "updated" : "published",
    entityEdges: edges.rowCount ?? 0,
  };
}

export async function refreshPublicGraphProjectionsForUser(
  client: PoolClient,
  ownerUserId: string,
): Promise<PublicGraphSyncStats> {
  const result = await client.query<{ eventId: string }>(
    `SELECT event.id AS "eventId" FROM ${schema}.events event
     WHERE event.owner_user_id=$1
     UNION
     SELECT projection.event_id AS "eventId" FROM ${schema}.public_event_projections projection
     WHERE projection.owner_user_id=$1
     ORDER BY "eventId"`,
    [ownerUserId],
  );
  return refreshProjectionIds(client, result.rows.map((row) => row.eventId));
}

async function refreshProjectionIds(
  client: PoolClient,
  eventIds: string[],
): Promise<PublicGraphSyncStats> {
  const stats: PublicGraphSyncStats = {
    scanned: 0, published: 0, updated: 0, revoked: 0, entityEdges: 0,
  };
  for (const eventId of [...new Set(eventIds)].sort()) {
    const result = await refreshPublicEventProjection(client, eventId);
    stats.scanned += 1;
    stats.entityEdges += result.entityEdges;
    if (result.status === "published") stats.published += 1;
    if (result.status === "updated") stats.updated += 1;
    if (result.status === "revoked") stats.revoked += 1;
  }
  return stats;
}

async function reconcilePublicGraph(client: PoolClient): Promise<PublicGraphSyncStats> {
  const result = await client.query<{ eventId: string }>(
    `SELECT id AS "eventId" FROM ${schema}.events
     UNION
     SELECT event_id AS "eventId" FROM ${schema}.public_event_projections
     ORDER BY "eventId"`,
  );
  return refreshProjectionIds(client, result.rows.map((row) => row.eventId));
}

export async function runPublicGraphReconciliation() {
  return runTrackedSync("public_graph", "projection_reconcile", reconcilePublicGraph);
}

export async function runWorldMaintenance() {
  const entities = await runBuiltinWorldEntitySeed();
  const graph = await runPublicGraphReconciliation();
  return { entities, graph };
}

export function startWorldSyncWorker(logger: FastifyBaseLogger): () => void {
  let running = false;
  let stopped = false;
  const sweep = async () => {
    if (running || stopped) return;
    running = true;
    try {
      const result = await runWorldMaintenance();
      logger.info({ result }, "World entity catalog and public graph maintenance completed");
    } catch (error) {
      logger.error({ err: error }, "World entity catalog and public graph maintenance failed");
    } finally {
      running = false;
    }
  };
  const timer = setInterval(() => void sweep(), config.WORLD_SYNC_INTERVAL_SECONDS * 1000);
  timer.unref();
  void sweep();
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
