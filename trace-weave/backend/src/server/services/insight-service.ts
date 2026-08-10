import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { config, quoteIdentifier } from "../config";

const schema = quoteIdentifier(config.DB_SCHEMA);
const INFERENCE_VERSION = "frequency/v1";

export function decayedInferenceConfidence(eventCount: number, ageDays: number, halfLifeDays = 90): number {
  const base = Math.min(0.98, 0.55 + Math.log2(Math.max(1, eventCount)) * 0.1);
  return Math.max(0.05, base * Math.pow(0.5, Math.max(0, ageDays) / halfLifeDays));
}

export class InsightError extends Error {
  constructor(message: string, readonly statusCode: 400 | 404 | 409 = 400) {
    super(message);
    this.name = "InsightError";
  }
}

export async function refreshUserInferences(client: PoolClient, ownerUserId: string): Promise<void> {
  const evidence = await client.query<{
    entityId: string; entityType: string; eventCount: number; lastOccurred: string; eventIds: string[];
  }>(
    `WITH evidence AS (
       SELECT relation.user_entity_id AS entity_id, event.id AS event_id,
              COALESCE(event.occurred_start, event.created_at) AS occurred_at
       FROM ${schema}.event_entity_relations relation
       JOIN ${schema}.events event ON event.id = relation.event_id
       WHERE event.owner_user_id = $1 AND event.deleted_at IS NULL
         AND event.factual_status IN ('occurred','ongoing')
         AND COALESCE(event.occurred_start, event.created_at) >= now() - interval '365 days'
       UNION
       SELECT participant.user_entity_id, event.id, COALESCE(event.occurred_start, event.created_at)
       FROM ${schema}.event_participants participant
       JOIN ${schema}.events event ON event.id = participant.event_id
       WHERE event.owner_user_id = $1 AND participant.user_entity_id IS NOT NULL
         AND event.deleted_at IS NULL AND event.factual_status IN ('occurred','ongoing')
         AND COALESCE(event.occurred_start, event.created_at) >= now() - interval '365 days'
     )
     SELECT entity.id AS "entityId", entity.entity_type AS "entityType",
            count(DISTINCT evidence.event_id)::int AS "eventCount",
            max(evidence.occurred_at)::text AS "lastOccurred",
            array_agg(DISTINCT evidence.event_id) AS "eventIds"
     FROM evidence JOIN ${schema}.user_entities entity ON entity.id = evidence.entity_id
     WHERE entity.owner_user_id = $1 AND entity.status = 'active'
     GROUP BY entity.id, entity.entity_type HAVING count(DISTINCT evidence.event_id) >= 3`,
    [ownerUserId],
  );
  const evaluatedEntityIds: string[] = [];
  for (const row of evidence.rows) {
    evaluatedEntityIds.push(row.entityId);
    const ageDays = Math.max(0, (Date.now() - new Date(row.lastOccurred).getTime()) / 86_400_000);
    const confidence = decayedInferenceConfidence(row.eventCount, ageDays);
    await client.query(
      `INSERT INTO ${schema}.inferred_relations (
         id, owner_user_id, relation_type, target_user_entity_id, confidence,
         evidence_summary, inference_version, status, generated_at, expires_at,
         last_evaluated_at, decay_half_life_days, updated_at
       ) VALUES ($1,$2,'frequent_entity',$3,$4,$5::jsonb,$6,'active',now(),$7::timestamptz,now(),90,now())
       ON CONFLICT (owner_user_id, relation_type, target_user_entity_id, inference_version)
         WHERE target_user_entity_id IS NOT NULL
       DO UPDATE SET confidence = EXCLUDED.confidence,
         evidence_summary = EXCLUDED.evidence_summary,
         expires_at = EXCLUDED.expires_at,
         last_evaluated_at = now(), updated_at = now(),
         status = CASE WHEN ${schema}.inferred_relations.status IN ('confirmed','rejected','hidden')
                       THEN ${schema}.inferred_relations.status ELSE 'active' END`,
      [randomUUID(), ownerUserId, row.entityId, confidence,
        JSON.stringify({ eventCount: row.eventCount, eventIds: row.eventIds, lastOccurred: row.lastOccurred, entityType: row.entityType }),
        INFERENCE_VERSION, new Date(new Date(row.lastOccurred).getTime() + 180 * 86_400_000).toISOString()],
    );
  }
  await client.query(
    `UPDATE ${schema}.inferred_relations SET status = 'expired', updated_at = now(), last_evaluated_at = now()
     WHERE owner_user_id = $1 AND inference_version = $2 AND status = 'active'
       AND (expires_at < now() OR NOT (target_user_entity_id = ANY($3::uuid[])))`,
    [ownerUserId, INFERENCE_VERSION, evaluatedEntityIds],
  );
}

export async function getUserInsights(client: PoolClient, ownerUserId: string) {
  await refreshUserInferences(client, ownerUserId);
  // A PoolClient owns one PostgreSQL connection. Await these sequentially so
  // pg never receives overlapping query() calls on the same connection.
  const trends = await client.query<{
      eventType: string; currentCount: number; previousCount: number;
    }>(`SELECT event_type AS "eventType",
              count(*) FILTER (WHERE COALESCE(occurred_start, created_at) >= now() - interval '7 days')::int AS "currentCount",
              count(*) FILTER (WHERE COALESCE(occurred_start, created_at) < now() - interval '7 days')::int AS "previousCount"
       FROM ${schema}.events WHERE owner_user_id = $1 AND deleted_at IS NULL
         AND factual_status IN ('occurred','ongoing')
         AND COALESCE(occurred_start, created_at) >= now() - interval '14 days'
       GROUP BY event_type ORDER BY "currentCount" DESC, "previousCount" DESC`, [ownerUserId]);
  const daily = await client.query<{ day: string; count: number }>(
      `SELECT date_trunc('day', COALESCE(occurred_start, created_at))::date::text AS day, count(*)::int AS count
       FROM ${schema}.events WHERE owner_user_id = $1 AND deleted_at IS NULL
         AND COALESCE(occurred_start, created_at) >= now() - interval '30 days'
       GROUP BY 1 ORDER BY 1`, [ownerUserId]);
  const assertions = await client.query(
      `SELECT assertion.id, assertion.predicate, assertion.value, assertion.status,
              assertion.confidence, assertion.evidence_event_ids AS "evidenceEventIds",
              assertion.created_at AS "createdAt", entity.display_name AS "targetName",
              entity.entity_type AS "targetType", entity.id AS "targetEntityId"
       FROM ${schema}.user_assertions assertion
       LEFT JOIN ${schema}.user_entities entity ON entity.id = assertion.target_user_entity_id
       WHERE assertion.owner_user_id = $1 ORDER BY assertion.created_at DESC LIMIT 100`, [ownerUserId]);
  const inferences = await client.query(
      `SELECT inference.id, inference.relation_type AS "relationType", inference.confidence,
              inference.evidence_summary AS evidence, inference.inference_version AS "inferenceVersion",
              inference.status, inference.generated_at AS "generatedAt", inference.expires_at AS "expiresAt",
              entity.display_name AS "targetName", entity.entity_type AS "targetType", entity.id AS "targetEntityId"
       FROM ${schema}.inferred_relations inference
       LEFT JOIN ${schema}.user_entities entity ON entity.id = inference.target_user_entity_id
       WHERE inference.owner_user_id = $1 AND inference.status <> 'expired'
       ORDER BY inference.confidence DESC, inference.generated_at DESC LIMIT 100`, [ownerUserId]);
  const counts = daily.rows.map((row) => row.count);
  const mean = counts.length ? counts.reduce((sum, count) => sum + count, 0) / counts.length : 0;
  const deviation = counts.length ? Math.sqrt(counts.reduce((sum, count) => sum + (count - mean) ** 2, 0) / counts.length) : 0;
  const anomalies = daily.rows.filter((row) => row.count > mean + Math.max(2, 2 * deviation)).map((row) => ({ ...row, baseline: Number(mean.toFixed(1)) }));
  return {
    trends: trends.rows.map((row) => ({ ...row, change: row.currentCount - row.previousCount })),
    anomalies,
    assertions: assertions.rows,
    inferences: inferences.rows,
    generatedAt: new Date().toISOString(),
  };
}

export async function createUserAssertion(client: PoolClient, ownerUserId: string, input: {
  predicate: string; targetEntityId: string | null; value: Record<string, unknown>; sourceEventId: string | null;
}) {
  if (input.targetEntityId) {
    const target = await client.query(`SELECT 1 FROM ${schema}.user_entities WHERE id = $1 AND owner_user_id = $2 AND status = 'active'`, [input.targetEntityId, ownerUserId]);
    if (!target.rows[0]) throw new InsightError("声明目标实体不存在", 404);
  }
  if (input.sourceEventId) {
    const source = await client.query(
      `SELECT 1 FROM ${schema}.events WHERE id = $1 AND owner_user_id = $2 AND deleted_at IS NULL`,
      [input.sourceEventId, ownerUserId],
    );
    if (!source.rows[0]) throw new InsightError("声明来源事件不存在", 404);
  }
  const id = randomUUID();
  await client.query(
    `INSERT INTO ${schema}.user_assertions (
       id, owner_user_id, source_event_id, predicate, target_user_entity_id, value,
       status, confidence, evidence_event_ids
     ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,'active',1,$7::uuid[])`,
    [id, ownerUserId, input.sourceEventId, input.predicate, input.targetEntityId,
      JSON.stringify(input.value), input.sourceEventId ? [input.sourceEventId] : []],
  );
  return { id };
}

export async function decideInference(client: PoolClient, ownerUserId: string, inferenceId: string, action: "confirm" | "reject" | "hide") {
  const status = action === "confirm" ? "confirmed" : action === "reject" ? "rejected" : "hidden";
  const result = await client.query<{ targetEntityId: string | null; relationType: string; evidence: Record<string, unknown> }>(
    `UPDATE ${schema}.inferred_relations SET status = $3, updated_at = now()
     WHERE id = $1 AND owner_user_id = $2 AND status IN ('active','confirmed','rejected','hidden')
     RETURNING target_user_entity_id AS "targetEntityId", relation_type AS "relationType", evidence_summary AS evidence`,
    [inferenceId, ownerUserId, status],
  );
  const inference = result.rows[0];
  if (!inference) throw new InsightError("推断不存在", 404);
  if (action === "confirm") {
    await client.query(
      `INSERT INTO ${schema}.user_assertions (
         id,owner_user_id,predicate,target_user_entity_id,value,status,confidence,evidence_event_ids
       ) VALUES ($1,$2,$3,$4,$5::jsonb,'active',1,$6::uuid[])`,
      [randomUUID(), ownerUserId, inference.relationType, inference.targetEntityId,
        JSON.stringify({ source: "confirmed_inference", inferenceId }),
        Array.isArray(inference.evidence.eventIds) ? inference.evidence.eventIds : []],
    );
  }
}

export async function retractAssertion(client: PoolClient, ownerUserId: string, assertionId: string) {
  const result = await client.query(
    `UPDATE ${schema}.user_assertions SET status = 'retracted', retracted_at = now(), updated_at = now()
     WHERE id = $1 AND owner_user_id = $2 AND status = 'active' RETURNING id`,
    [assertionId, ownerUserId],
  );
  if (!result.rows[0]) throw new InsightError("声明不存在或已经撤回", 404);
}
