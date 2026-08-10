import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { config, quoteIdentifier } from "../config";
import { normalizeEntityName } from "./entity-resolver";
import { refreshSocialProjectionsForUser } from "./social-service";

const schema = quoteIdentifier(config.DB_SCHEMA);

export class EntityMemoryError extends Error {
  constructor(message: string, readonly statusCode: 400 | 404 | 409 = 400) {
    super(message);
    this.name = "EntityMemoryError";
  }
}

type EntityRow = {
  id: string;
  entityType: string;
  displayName: string;
  normalizedName: string;
  canonicalEntityId: string | null;
  sensitivity: "normal" | "sensitive" | "prohibited";
  eventCount: number;
  aliases: Array<{ id: string; alias: string; normalizedAlias: string }>;
  createdAt: string;
  updatedAt: string;
};

type EntityEvidenceRow = {
  id: string;
  evidenceType: "entity_relation" | "participant";
  eventId: string;
  eventTitle: string;
  eventType: string;
  occurredStart: string | null;
  role: string;
};

export async function listEntityMemory(
  client: PoolClient,
  ownerUserId: string,
  search = "",
  entityType?: string,
): Promise<{ entities: EntityRow[] }> {
  const normalizedSearch = normalizeEntityName(search);
  const result = await client.query<EntityRow>(
    `SELECT entity.id,
            entity.entity_type AS "entityType",
            entity.display_name AS "displayName",
            entity.normalized_name AS "normalizedName",
            entity.canonical_entity_id AS "canonicalEntityId",
            entity.sensitivity,
            entity.created_at AS "createdAt",
            entity.updated_at AS "updatedAt",
            (SELECT count(DISTINCT event_id)::int FROM (
               SELECT relation.event_id FROM ${schema}.event_entity_relations relation WHERE relation.user_entity_id = entity.id
               UNION ALL
               SELECT participant.event_id FROM ${schema}.event_participants participant WHERE participant.user_entity_id = entity.id
             ) evidence) AS "eventCount",
            COALESCE((
              SELECT json_agg(json_build_object(
                'id', alias.id,
                'alias', alias.alias,
                'normalizedAlias', alias.normalized_alias
              ) ORDER BY alias.created_at)
              FROM ${schema}.entity_aliases alias
              WHERE alias.user_entity_id = entity.id AND alias.confirmation_status = 'confirmed'
            ), '[]'::json) AS aliases
     FROM ${schema}.user_entities entity
     WHERE entity.owner_user_id = $1 AND entity.status = 'active'
       AND ($2 = '' OR entity.normalized_name LIKE '%' || $2 || '%'
         OR EXISTS (SELECT 1 FROM ${schema}.entity_aliases alias
                    WHERE alias.user_entity_id = entity.id AND alias.normalized_alias LIKE '%' || $2 || '%'))
       AND ($3::text IS NULL OR entity.entity_type = $3)
     ORDER BY "eventCount" DESC, entity.updated_at DESC, entity.display_name
     LIMIT 300`,
    [ownerUserId, normalizedSearch, entityType ?? null],
  );
  return { entities: result.rows };
}

export async function listEntityEvidence(
  client: PoolClient,
  ownerUserId: string,
  entityId: string,
): Promise<{ evidence: EntityEvidenceRow[] }> {
  await ownedActiveEntity(client, ownerUserId, entityId);
  const result = await client.query<EntityEvidenceRow>(
    `SELECT relation.id, 'entity_relation'::text AS "evidenceType", event.id AS "eventId",
            event.title AS "eventTitle", event.event_type AS "eventType",
            event.occurred_start AS "occurredStart", relation.relation_role AS role
     FROM ${schema}.event_entity_relations relation
     JOIN ${schema}.events event ON event.id = relation.event_id
     WHERE relation.user_entity_id = $1 AND event.owner_user_id = $2 AND event.deleted_at IS NULL
     UNION ALL
     SELECT participant.id, 'participant'::text, event.id, event.title, event.event_type,
            event.occurred_start, participant.participant_role
     FROM ${schema}.event_participants participant
     JOIN ${schema}.events event ON event.id = participant.event_id
     WHERE participant.user_entity_id = $1 AND event.owner_user_id = $2 AND event.deleted_at IS NULL
     ORDER BY "occurredStart" DESC NULLS LAST, "eventTitle"`,
    [entityId, ownerUserId],
  );
  return { evidence: result.rows };
}

async function ownedActiveEntity(client: PoolClient, ownerUserId: string, entityId: string, forUpdate = false) {
  const result = await client.query<{
    id: string;
    entityType: string;
    canonicalEntityId: string | null;
    displayName: string;
  }>(
    `SELECT id, entity_type AS "entityType", canonical_entity_id AS "canonicalEntityId", display_name AS "displayName"
     FROM ${schema}.user_entities
     WHERE id = $1 AND owner_user_id = $2 AND status = 'active'${forUpdate ? " FOR UPDATE" : ""}`,
    [entityId, ownerUserId],
  );
  const entity = result.rows[0];
  if (!entity) throw new EntityMemoryError("实体不存在或已经合并", 404);
  return entity;
}

async function assertAliasAvailable(
  client: PoolClient,
  ownerUserId: string,
  entityType: string,
  normalizedAlias: string,
  targetEntityId: string,
) {
  const collision = await client.query<{ id: string }>(
    `SELECT entity.id
     FROM ${schema}.user_entities entity
     LEFT JOIN ${schema}.entity_aliases alias ON alias.user_entity_id = entity.id
     WHERE entity.owner_user_id = $1 AND entity.entity_type = $2 AND entity.status = 'active'
       AND entity.id <> $4
       AND (entity.normalized_name = $3 OR alias.normalized_alias = $3)
     LIMIT 1`,
    [ownerUserId, entityType, normalizedAlias, targetEntityId],
  );
  if (collision.rows[0]) throw new EntityMemoryError("这个名称已经属于同类型的另一个实体，请改用合并", 409);
}

async function enqueueEntityRefresh(
  client: PoolClient,
  ownerUserId: string,
  entityId: string,
  action: string,
) {
  await client.query(
    `INSERT INTO ${schema}.outbox_events (id, aggregate_type, aggregate_id, event_type, payload)
     VALUES ($1, 'user_entity', $2, 'entity_memory.updated', $3::jsonb)`,
    [randomUUID(), entityId, JSON.stringify({ ownerUserId, entityId, action })],
  );
}

export async function addEntityAlias(
  client: PoolClient,
  ownerUserId: string,
  entityId: string,
  alias: string,
): Promise<void> {
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [ownerUserId]);
  const entity = await ownedActiveEntity(client, ownerUserId, entityId, true);
  const normalizedAlias = normalizeEntityName(alias);
  await assertAliasAvailable(client, ownerUserId, entity.entityType, normalizedAlias, entity.id);
  await client.query(
    `INSERT INTO ${schema}.entity_aliases (
       id, user_entity_id, alias, normalized_alias, confirmation_status, source
     ) VALUES ($1, $2, $3, $4, 'confirmed', 'user_confirmation')
     ON CONFLICT (user_entity_id, normalized_alias) DO UPDATE
     SET alias = EXCLUDED.alias, confirmation_status = 'confirmed', source = 'user_confirmation'`,
    [randomUUID(), entity.id, alias.trim(), normalizedAlias],
  );
  await client.query(`UPDATE ${schema}.user_entities SET updated_at = now() WHERE id = $1`, [entity.id]);
  await enqueueEntityRefresh(client, ownerUserId, entity.id, "alias_added");
}

export async function renameEntity(
  client: PoolClient,
  ownerUserId: string,
  entityId: string,
  displayName: string,
): Promise<void> {
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [ownerUserId]);
  const entity = await ownedActiveEntity(client, ownerUserId, entityId, true);
  const normalized = normalizeEntityName(displayName);
  await assertAliasAvailable(client, ownerUserId, entity.entityType, normalized, entity.id);
  await client.query(
    `UPDATE ${schema}.user_entities SET display_name = $2, normalized_name = $3, updated_at = now() WHERE id = $1`,
    [entity.id, displayName.trim(), normalized],
  );
  await client.query(
    `INSERT INTO ${schema}.entity_aliases (id, user_entity_id, alias, normalized_alias, confirmation_status, source)
     VALUES ($1, $2, $3, $4, 'confirmed', 'user_confirmation')
     ON CONFLICT (user_entity_id, normalized_alias) DO UPDATE SET alias = EXCLUDED.alias`,
    [randomUUID(), entity.id, displayName.trim(), normalized],
  );
  await enqueueEntityRefresh(client, ownerUserId, entity.id, "renamed");
}

function visibilityRank(value: string | null): number {
  return ["isolated", "private", "friends", "circle", "public"].indexOf(value ?? "public");
}

function strictBoolean(a: boolean | null, b: boolean | null): boolean | null {
  if (a === false || b === false) return false;
  if (a === null || b === null) return null;
  return a && b;
}

export async function mergeEntityMemory(
  client: PoolClient,
  ownerUserId: string,
  sourceEntityId: string,
  targetEntityId: string,
): Promise<void> {
  if (sourceEntityId === targetEntityId) throw new EntityMemoryError("不能把实体合并到自身");
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [ownerUserId]);
  const orderedEntityIds = [sourceEntityId, targetEntityId].sort();
  const lockedEntities = new Map<string, Awaited<ReturnType<typeof ownedActiveEntity>>>();
  for (const entityId of orderedEntityIds) {
    lockedEntities.set(entityId, await ownedActiveEntity(client, ownerUserId, entityId, true));
  }
  const source = lockedEntities.get(sourceEntityId)!;
  const target = lockedEntities.get(targetEntityId)!;
  if (source.entityType !== target.entityType) throw new EntityMemoryError("只有相同类型的实体才能合并");

  const mergeSnapshotResult = await client.query<{ snapshot: Record<string, unknown> }>(
    `SELECT jsonb_build_object(
       'source', to_jsonb(source_entity),
       'relationIds', COALESCE((SELECT jsonb_agg(id) FROM ${schema}.event_entity_relations WHERE user_entity_id = $1), '[]'::jsonb),
       'participantIds', COALESCE((SELECT jsonb_agg(id) FROM ${schema}.event_participants WHERE user_entity_id = $1), '[]'::jsonb),
       'assertionIds', COALESCE((SELECT jsonb_agg(id) FROM ${schema}.user_assertions WHERE target_user_entity_id = $1), '[]'::jsonb),
       'inferenceIds', COALESCE((SELECT jsonb_agg(id) FROM ${schema}.inferred_relations WHERE target_user_entity_id = $1), '[]'::jsonb),
       'sourceAliases', COALESCE((SELECT jsonb_agg(to_jsonb(alias)) FROM ${schema}.entity_aliases alias WHERE user_entity_id = $1), '[]'::jsonb),
       'targetAliasNames', COALESCE((SELECT jsonb_agg(normalized_alias) FROM ${schema}.entity_aliases WHERE user_entity_id = $2), '[]'::jsonb),
       'sourcePersonLinks', COALESCE((SELECT jsonb_agg(to_jsonb(link)) FROM ${schema}.person_account_links link WHERE person_entity_id = $1), '[]'::jsonb),
       'targetPersonAccountIds', COALESCE((SELECT jsonb_agg(linked_account_user_id) FROM ${schema}.person_account_links WHERE person_entity_id = $2), '[]'::jsonb),
       'sourcePolicy', (SELECT to_jsonb(policy) FROM ${schema}.privacy_policies policy WHERE policy.owner_user_id = $3 AND policy.policy_level = 'entity' AND policy.subject_key = $1::text AND policy.revoked_at IS NULL),
       'targetPolicy', (SELECT to_jsonb(policy) FROM ${schema}.privacy_policies policy WHERE policy.owner_user_id = $3 AND policy.policy_level = 'entity' AND policy.subject_key = $2::text AND policy.revoked_at IS NULL)
     ) AS snapshot
     FROM ${schema}.user_entities source_entity WHERE source_entity.id = $1`,
    [source.id, target.id, ownerUserId],
  );
  const operationId = randomUUID();
  await client.query(
    `INSERT INTO ${schema}.entity_memory_operations (
       id, owner_user_id, operation_type, source_entity_id, target_entity_id, snapshot
     ) VALUES ($1, $2, 'merge', $3, $4, $5::jsonb)`,
    [operationId, ownerUserId, source.id, target.id, JSON.stringify(mergeSnapshotResult.rows[0].snapshot)],
  );

  const policies = await client.query<{
    subjectKey: string;
    contentVisibility: string | null;
    allowAnonymousStats: boolean | null;
    allowMatching: boolean | null;
    allowIdentityDisclosure: boolean | null;
    allowSharedOccurrence: boolean | null;
  }>(
    `SELECT subject_key AS "subjectKey", content_visibility AS "contentVisibility",
            allow_anonymous_stats AS "allowAnonymousStats", allow_matching AS "allowMatching",
            allow_identity_disclosure AS "allowIdentityDisclosure",
            allow_shared_occurrence AS "allowSharedOccurrence"
     FROM ${schema}.privacy_policies
     WHERE owner_user_id = $1 AND policy_level = 'entity'
       AND subject_key = ANY($2::text[]) AND revoked_at IS NULL`,
    [ownerUserId, [source.id, target.id]],
  );
  const sourcePolicy = policies.rows.find((policy) => policy.subjectKey === source.id);
  const targetPolicy = policies.rows.find((policy) => policy.subjectKey === target.id);
  if (sourcePolicy || targetPolicy) {
    const visibility = [sourcePolicy?.contentVisibility ?? null, targetPolicy?.contentVisibility ?? null]
      .filter((value): value is string => value !== null)
      .sort((a, b) => visibilityRank(a) - visibilityRank(b))[0] ?? null;
    await client.query(
      `INSERT INTO ${schema}.privacy_policies (
         id, owner_user_id, policy_level, subject_key, content_visibility,
         allow_anonymous_stats, allow_matching, allow_identity_disclosure,
         allow_shared_occurrence, version
       ) VALUES ($1, $2, 'entity', $3, $4, $5, $6, $7, $8, 1)
       ON CONFLICT (owner_user_id, policy_level, subject_key) DO UPDATE
       SET content_visibility = EXCLUDED.content_visibility,
           allow_anonymous_stats = EXCLUDED.allow_anonymous_stats,
           allow_matching = EXCLUDED.allow_matching,
           allow_identity_disclosure = EXCLUDED.allow_identity_disclosure,
           allow_shared_occurrence = EXCLUDED.allow_shared_occurrence,
           version = ${schema}.privacy_policies.version + 1,
           effective_from = now(), revoked_at = NULL, updated_at = now()`,
      [
        randomUUID(), ownerUserId, target.id, visibility,
        strictBoolean(sourcePolicy?.allowAnonymousStats ?? null, targetPolicy?.allowAnonymousStats ?? null),
        strictBoolean(sourcePolicy?.allowMatching ?? null, targetPolicy?.allowMatching ?? null),
        strictBoolean(sourcePolicy?.allowIdentityDisclosure ?? null, targetPolicy?.allowIdentityDisclosure ?? null),
        strictBoolean(sourcePolicy?.allowSharedOccurrence ?? null, targetPolicy?.allowSharedOccurrence ?? null),
      ],
    );
  }
  await client.query(
    `UPDATE ${schema}.privacy_policies SET revoked_at = now(), version = version + 1, updated_at = now()
     WHERE owner_user_id = $1 AND policy_level = 'entity' AND subject_key = $2 AND revoked_at IS NULL`,
    [ownerUserId, source.id],
  );

  await client.query(
    `INSERT INTO ${schema}.entity_aliases (id, user_entity_id, alias, normalized_alias, confirmation_status, source)
     SELECT gen_random_uuid(), $2, alias, normalized_alias, 'confirmed', 'user_confirmation'
     FROM ${schema}.entity_aliases WHERE user_entity_id = $1
     ON CONFLICT (user_entity_id, normalized_alias) DO UPDATE
     SET confirmation_status = 'confirmed', source = 'user_confirmation'`,
    [source.id, target.id],
  );
  await client.query(`DELETE FROM ${schema}.entity_aliases WHERE user_entity_id = $1`, [source.id]);
  await client.query(
    `UPDATE ${schema}.event_entity_relations
     SET user_entity_id = $2, canonical_entity_id = $3
     WHERE user_entity_id = $1`,
    [source.id, target.id, target.canonicalEntityId],
  );
  await client.query(`UPDATE ${schema}.event_participants SET user_entity_id = $2 WHERE user_entity_id = $1`, [source.id, target.id]);
  await client.query(`UPDATE ${schema}.user_assertions SET target_user_entity_id = $2 WHERE target_user_entity_id = $1`, [source.id, target.id]);
  await client.query(`UPDATE ${schema}.inferred_relations SET target_user_entity_id = $2 WHERE target_user_entity_id = $1`, [source.id, target.id]);
  await client.query(
    `INSERT INTO ${schema}.person_account_links (
       id, owner_user_id, person_entity_id, linked_account_user_id, status, accepted_at, created_at
     ) SELECT gen_random_uuid(), owner_user_id, $2, linked_account_user_id, status, accepted_at, created_at
       FROM ${schema}.person_account_links WHERE person_entity_id = $1
     ON CONFLICT (owner_user_id, person_entity_id, linked_account_user_id) DO NOTHING`,
    [source.id, target.id],
  );
  await client.query(`DELETE FROM ${schema}.person_account_links WHERE person_entity_id = $1`, [source.id]);
  await client.query(
    `UPDATE ${schema}.user_entities
     SET status = 'merged', metadata = metadata || jsonb_build_object('mergedInto', $2::text), updated_at = now()
     WHERE id = $1`,
    [source.id, target.id],
  );
  await enqueueEntityRefresh(client, ownerUserId, target.id, "merged");
  await refreshSocialProjectionsForUser(client, ownerUserId);
}

type SplitEntityInput = {
  displayName: string;
  evidenceIds: string[];
  aliasIds: string[];
};

export async function splitEntityMemory(
  client: PoolClient,
  ownerUserId: string,
  sourceEntityId: string,
  input: SplitEntityInput,
): Promise<{ entityId: string; operationId: string }> {
  if (!input.evidenceIds.length) throw new EntityMemoryError("至少选择一条需要拆出的事件证据");
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [ownerUserId]);
  const source = await ownedActiveEntity(client, ownerUserId, sourceEntityId, true);
  const normalizedName = normalizeEntityName(input.displayName);
  await assertAliasAvailable(client, ownerUserId, source.entityType, normalizedName, source.id);

  const evidence = await client.query<{ id: string; evidenceType: "entity_relation" | "participant" }>(
    `SELECT relation.id, 'entity_relation'::text AS "evidenceType"
     FROM ${schema}.event_entity_relations relation
     JOIN ${schema}.events event ON event.id = relation.event_id
     WHERE relation.user_entity_id = $1 AND event.owner_user_id = $2 AND relation.id = ANY($3::uuid[])
     UNION ALL
     SELECT participant.id, 'participant'::text
     FROM ${schema}.event_participants participant
     JOIN ${schema}.events event ON event.id = participant.event_id
     WHERE participant.user_entity_id = $1 AND event.owner_user_id = $2 AND participant.id = ANY($3::uuid[])`,
    [source.id, ownerUserId, input.evidenceIds],
  );
  if (evidence.rows.length !== new Set(input.evidenceIds).size) {
    throw new EntityMemoryError("部分事件证据不属于这个实体或已经被移动", 409);
  }
  const aliases = input.aliasIds.length
    ? await client.query<{
        id: string; alias: string; normalized_alias: string; confirmation_status: string; source: string; created_at: string;
      }>(`SELECT * FROM ${schema}.entity_aliases WHERE user_entity_id = $1 AND id = ANY($2::uuid[])`, [source.id, input.aliasIds])
    : { rows: [] };
  if (aliases.rows.length !== new Set(input.aliasIds).size) throw new EntityMemoryError("部分别名已经不存在", 409);

  const sourceDetails = await client.query<{
    sensitivity: string; visibility: string; matchEligible: boolean;
  }>(`SELECT sensitivity, visibility, match_eligible AS "matchEligible" FROM ${schema}.user_entities WHERE id = $1`, [source.id]);
  const newEntityId = randomUUID();
  const initialAliasId = randomUUID();
  await client.query(
    `INSERT INTO ${schema}.user_entities (
       id, owner_user_id, entity_type, display_name, normalized_name, visibility,
       match_eligible, sensitivity, metadata
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, jsonb_build_object('splitFrom', $9::text))`,
    [newEntityId, ownerUserId, source.entityType, input.displayName.trim(), normalizedName,
      sourceDetails.rows[0].visibility, sourceDetails.rows[0].matchEligible, sourceDetails.rows[0].sensitivity, source.id],
  );
  await client.query(
    `INSERT INTO ${schema}.entity_aliases (id, user_entity_id, alias, normalized_alias, confirmation_status, source)
     VALUES ($1, $2, $3, $4, 'confirmed', 'user_split')`,
    [initialAliasId, newEntityId, input.displayName.trim(), normalizedName],
  );
  const relationIds = evidence.rows.filter((item) => item.evidenceType === "entity_relation").map((item) => item.id);
  const participantIds = evidence.rows.filter((item) => item.evidenceType === "participant").map((item) => item.id);
  if (relationIds.length) {
    await client.query(
      `UPDATE ${schema}.event_entity_relations SET user_entity_id = $2, canonical_entity_id = NULL WHERE id = ANY($1::uuid[])`,
      [relationIds, newEntityId],
    );
  }
  if (participantIds.length) {
    await client.query(`UPDATE ${schema}.event_participants SET user_entity_id = $2 WHERE id = ANY($1::uuid[])`, [participantIds, newEntityId]);
  }
  if (input.aliasIds.length) {
    await client.query(`UPDATE ${schema}.entity_aliases SET user_entity_id = $2 WHERE id = ANY($1::uuid[])`, [input.aliasIds, newEntityId]);
  }

  const operationId = randomUUID();
  await client.query(
    `INSERT INTO ${schema}.entity_memory_operations (
       id, owner_user_id, operation_type, source_entity_id, target_entity_id, snapshot
     ) VALUES ($1, $2, 'split', $3, $4, $5::jsonb)`,
    [operationId, ownerUserId, source.id, newEntityId, JSON.stringify({
      relationIds, participantIds, movedAliases: aliases.rows, initialAliasId,
    })],
  );
  await enqueueEntityRefresh(client, ownerUserId, source.id, "split_source");
  await enqueueEntityRefresh(client, ownerUserId, newEntityId, "split_created");
  await refreshSocialProjectionsForUser(client, ownerUserId);
  return { entityId: newEntityId, operationId };
}

type EntityOperationRow = {
  id: string;
  operationType: "merge" | "split";
  sourceEntityId: string;
  sourceName: string;
  targetEntityId: string;
  targetName: string;
  status: "active" | "undone";
  createdAt: string;
};

export async function listEntityOperations(client: PoolClient, ownerUserId: string): Promise<{ operations: EntityOperationRow[] }> {
  const result = await client.query<EntityOperationRow>(
    `SELECT operation.id, operation.operation_type AS "operationType",
            operation.source_entity_id AS "sourceEntityId", source.display_name AS "sourceName",
            operation.target_entity_id AS "targetEntityId", target.display_name AS "targetName",
            operation.status, operation.created_at AS "createdAt"
     FROM ${schema}.entity_memory_operations operation
     JOIN ${schema}.user_entities source ON source.id = operation.source_entity_id
     JOIN ${schema}.user_entities target ON target.id = operation.target_entity_id
     WHERE operation.owner_user_id = $1
     ORDER BY operation.created_at DESC LIMIT 50`,
    [ownerUserId],
  );
  return { operations: result.rows };
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export async function undoEntityOperation(client: PoolClient, ownerUserId: string, operationId: string): Promise<void> {
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [ownerUserId]);
  const result = await client.query<{
    operationType: "merge" | "split"; sourceEntityId: string; targetEntityId: string;
    snapshot: Record<string, unknown>; status: string;
  }>(
    `SELECT operation_type AS "operationType", source_entity_id AS "sourceEntityId",
            target_entity_id AS "targetEntityId", snapshot, status
     FROM ${schema}.entity_memory_operations WHERE id = $1 AND owner_user_id = $2 FOR UPDATE`,
    [operationId, ownerUserId],
  );
  const operation = result.rows[0];
  if (!operation) throw new EntityMemoryError("实体操作不存在", 404);
  if (operation.status !== "active") throw new EntityMemoryError("这个实体操作已经撤销", 409);
  const snapshot = operation.snapshot;
  const relationIds = stringArray(snapshot.relationIds);
  const participantIds = stringArray(snapshot.participantIds);

  if (operation.operationType === "split") {
    const unexpected = await client.query<{ count: string }>(
      `SELECT (
         (SELECT count(*) FROM ${schema}.event_entity_relations WHERE user_entity_id = $1 AND NOT (id = ANY($2::uuid[]))) +
         (SELECT count(*) FROM ${schema}.event_participants WHERE user_entity_id = $1 AND NOT (id = ANY($3::uuid[])))
       )::text AS count`,
      [operation.targetEntityId, relationIds, participantIds],
    );
    if (Number(unexpected.rows[0].count) > 0) throw new EntityMemoryError("拆分后的实体已经获得新证据，不能直接撤销；请再次拆分处理", 409);
    if (relationIds.length) {
      await client.query(
        `UPDATE ${schema}.event_entity_relations relation SET user_entity_id = $2, canonical_entity_id = source.canonical_entity_id
         FROM ${schema}.user_entities source WHERE relation.id = ANY($1::uuid[]) AND source.id = $2`,
        [relationIds, operation.sourceEntityId],
      );
    }
    if (participantIds.length) await client.query(`UPDATE ${schema}.event_participants SET user_entity_id = $2 WHERE id = ANY($1::uuid[])`, [participantIds, operation.sourceEntityId]);
    const movedAliases = Array.isArray(snapshot.movedAliases) ? snapshot.movedAliases as Array<{ id: string }> : [];
    if (movedAliases.length) await client.query(`UPDATE ${schema}.entity_aliases SET user_entity_id = $2 WHERE id = ANY($1::uuid[])`, [movedAliases.map((item) => item.id), operation.sourceEntityId]);
    await client.query(`DELETE FROM ${schema}.entity_aliases WHERE user_entity_id = $1`, [operation.targetEntityId]);
    await client.query(`UPDATE ${schema}.user_entities SET status = 'deleted', updated_at = now() WHERE id = $1`, [operation.targetEntityId]);
  } else {
    const source = snapshot.source as Record<string, unknown> | undefined;
    if (!source) throw new EntityMemoryError("合并快照不完整，无法安全撤销", 409);
    if (relationIds.length) await client.query(`UPDATE ${schema}.event_entity_relations SET user_entity_id = $2, canonical_entity_id = $3 WHERE id = ANY($1::uuid[])`, [relationIds, operation.sourceEntityId, source.canonical_entity_id ?? null]);
    if (participantIds.length) await client.query(`UPDATE ${schema}.event_participants SET user_entity_id = $2 WHERE id = ANY($1::uuid[])`, [participantIds, operation.sourceEntityId]);
    const assertionIds = stringArray(snapshot.assertionIds);
    const inferenceIds = stringArray(snapshot.inferenceIds);
    if (assertionIds.length) await client.query(`UPDATE ${schema}.user_assertions SET target_user_entity_id = $2 WHERE id = ANY($1::uuid[])`, [assertionIds, operation.sourceEntityId]);
    if (inferenceIds.length) await client.query(`UPDATE ${schema}.inferred_relations SET target_user_entity_id = $2 WHERE id = ANY($1::uuid[])`, [inferenceIds, operation.sourceEntityId]);
    const targetAliasNames = new Set(stringArray(snapshot.targetAliasNames));
    const sourceAliases = Array.isArray(snapshot.sourceAliases) ? snapshot.sourceAliases as Array<Record<string, unknown>> : [];
    const movedAliasNames = sourceAliases.map((alias) => String(alias.normalized_alias)).filter((name) => !targetAliasNames.has(name));
    if (movedAliasNames.length) await client.query(`DELETE FROM ${schema}.entity_aliases WHERE user_entity_id = $1 AND normalized_alias = ANY($2::text[])`, [operation.targetEntityId, movedAliasNames]);
    for (const alias of sourceAliases) {
      await client.query(
        `INSERT INTO ${schema}.entity_aliases (id, user_entity_id, alias, normalized_alias, confirmation_status, source, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7::timestamptz)
         ON CONFLICT (user_entity_id, normalized_alias) DO NOTHING`,
        [alias.id, operation.sourceEntityId, alias.alias, alias.normalized_alias, alias.confirmation_status, alias.source, alias.created_at],
      );
    }
    const targetPersonAccountIds = new Set(stringArray(snapshot.targetPersonAccountIds));
    const sourcePersonLinks = Array.isArray(snapshot.sourcePersonLinks) ? snapshot.sourcePersonLinks as Array<Record<string, unknown>> : [];
    const movedAccounts = sourcePersonLinks.map((link) => String(link.linked_account_user_id)).filter((id) => !targetPersonAccountIds.has(id));
    if (movedAccounts.length) await client.query(`DELETE FROM ${schema}.person_account_links WHERE person_entity_id = $1 AND linked_account_user_id = ANY($2::uuid[])`, [operation.targetEntityId, movedAccounts]);
    for (const link of sourcePersonLinks) {
      await client.query(
        `INSERT INTO ${schema}.person_account_links (id,owner_user_id,person_entity_id,linked_account_user_id,status,accepted_at,created_at)
         VALUES ($1,$2,$3,$4,$5,$6::timestamptz,$7::timestamptz)
         ON CONFLICT (owner_user_id,person_entity_id,linked_account_user_id) DO NOTHING`,
        [link.id, link.owner_user_id, operation.sourceEntityId, link.linked_account_user_id, link.status, link.accepted_at ?? null, link.created_at],
      );
    }
    await client.query(
      `UPDATE ${schema}.user_entities SET status = 'active', canonical_entity_id = $2,
         display_name = $3, normalized_name = $4, metadata = $5::jsonb, updated_at = now()
       WHERE id = $1`,
      [operation.sourceEntityId, source.canonical_entity_id ?? null, source.display_name, source.normalized_name, JSON.stringify(source.metadata ?? {})],
    );
    for (const [entityId, policyValue] of [[operation.sourceEntityId, snapshot.sourcePolicy], [operation.targetEntityId, snapshot.targetPolicy]] as const) {
      const policy = policyValue && typeof policyValue === "object" ? policyValue as Record<string, unknown> : null;
      if (!policy) {
        await client.query(`UPDATE ${schema}.privacy_policies SET revoked_at = now(), version = version + 1, updated_at = now() WHERE owner_user_id = $1 AND policy_level = 'entity' AND subject_key = $2 AND revoked_at IS NULL`, [ownerUserId, entityId]);
        continue;
      }
      await client.query(
        `INSERT INTO ${schema}.privacy_policies (
           id,owner_user_id,policy_level,subject_key,content_visibility,allow_anonymous_stats,
           allow_matching,allow_identity_disclosure,allow_shared_occurrence,version
         ) VALUES ($1,$2,'entity',$3,$4,$5,$6,$7,$8,1)
         ON CONFLICT (owner_user_id,policy_level,subject_key) DO UPDATE SET
           content_visibility = EXCLUDED.content_visibility, allow_anonymous_stats = EXCLUDED.allow_anonymous_stats,
           allow_matching = EXCLUDED.allow_matching, allow_identity_disclosure = EXCLUDED.allow_identity_disclosure,
           allow_shared_occurrence = EXCLUDED.allow_shared_occurrence, revoked_at = NULL,
           version = ${schema}.privacy_policies.version + 1, updated_at = now()`,
        [randomUUID(), ownerUserId, entityId, policy.content_visibility ?? null, policy.allow_anonymous_stats ?? null,
          policy.allow_matching ?? null, policy.allow_identity_disclosure ?? null, policy.allow_shared_occurrence ?? null],
      );
    }
  }
  await client.query(`UPDATE ${schema}.entity_memory_operations SET status = 'undone', undone_at = now() WHERE id = $1`, [operationId]);
  await enqueueEntityRefresh(client, ownerUserId, operation.sourceEntityId, `undo_${operation.operationType}`);
  await refreshSocialProjectionsForUser(client, ownerUserId);
}
