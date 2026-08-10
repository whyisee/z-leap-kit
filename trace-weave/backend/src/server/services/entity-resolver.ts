import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import type { EventCandidatePayload } from "../domain/event-candidate";
import { config, quoteIdentifier } from "../config";

const schema = quoteIdentifier(config.DB_SCHEMA);

const sensitivePlacePattern = /家|住址|小区|宿舍|医院|诊所|寺|庙|教堂|清真寺/;
const globallyReusableTypes = new Set([
  "food",
  "work",
  "book",
  "song",
  "album",
  "video",
  "movie",
  "series",
  "game",
  "app",
  "currency",
]);

export class EntityResolutionError extends Error {
  constructor(message: string, readonly statusCode: 400 | 409 = 400) {
    super(message);
    this.name = "EntityResolutionError";
  }
}

export function normalizeEntityName(value: string): string {
  return value.normalize("NFKC").trim().replaceAll(/\s+/g, " ").toLocaleLowerCase("zh-CN");
}

async function redirectedCanonicalEntityId(client: PoolClient, canonicalEntityId: string | null): Promise<string | null> {
  if (!canonicalEntityId) return null;
  const result = await client.query<{ id: string }>(
    `WITH RECURSIVE redirects(id, depth) AS (
       SELECT $1::uuid, 0
       UNION ALL
       SELECT redirect.target_entity_id, redirects.depth + 1
       FROM redirects
       JOIN ${schema}.canonical_entity_redirects redirect ON redirect.source_entity_id = redirects.id
       WHERE redirects.depth < 20
     )
     SELECT id FROM redirects ORDER BY depth DESC LIMIT 1`,
    [canonicalEntityId],
  );
  return result.rows[0]?.id ?? canonicalEntityId;
}

function canUseGlobalEntity(
  entity: EventCandidatePayload["entities"][number],
  hasPrivateLocationAnchor: boolean,
): boolean {
  if (entity.entityType === "person") return false;
  if (hasPrivateLocationAnchor) return false;
  if (entity.entityType === "place") return !sensitivePlacePattern.test(entity.mention);
  return globallyReusableTypes.has(entity.entityType);
}

export async function resolveEventEntity(
  client: PoolClient,
  ownerUserId: string,
  entity: EventCandidatePayload["entities"][number],
): Promise<{ userEntityId: string; canonicalEntityId: string | null }> {
  const locationObservationId =
    entity.entityType === "place" && typeof entity.attributes.locationObservationId === "string"
      ? entity.attributes.locationObservationId
      : null;
  const locationAnchorResult = locationObservationId
    ? await client.query<{ exactGeohash: string }>(
        `
          SELECT exact_geohash AS "exactGeohash"
          FROM ${schema}.location_observations
          WHERE id = $1 AND owner_user_id = $2 AND deleted_at IS NULL
        `,
        [locationObservationId, ownerUserId],
      )
    : { rows: [] };
  const locationAnchor = locationAnchorResult.rows[0]?.exactGeohash.slice(0, 7) ?? null;
  const baseNormalizedName = normalizeEntityName(entity.mention);
  const normalizedName = locationAnchor
    ? `${baseNormalizedName} @geo:${locationAnchor}`
    : baseNormalizedName;

  if (entity.resolvedUserEntityId) {
    const selected = await client.query<{ id: string; canonicalEntityId: string | null }>(
      `SELECT id, canonical_entity_id AS "canonicalEntityId"
       FROM ${schema}.user_entities
       WHERE id = $1 AND owner_user_id = $2 AND entity_type = $3 AND status = 'active'
       FOR UPDATE`,
      [entity.resolvedUserEntityId, ownerUserId, entity.entityType],
    );
    const resolved = selected.rows[0];
    if (!resolved) throw new EntityResolutionError("选择的长期实体不存在、类型不一致或已经合并");
    const aliasCollision = await client.query<{ id: string }>(
      `SELECT entity.id
       FROM ${schema}.entity_aliases alias
       JOIN ${schema}.user_entities entity ON entity.id = alias.user_entity_id
       WHERE entity.owner_user_id = $1 AND entity.entity_type = $2
         AND entity.status = 'active' AND alias.normalized_alias = $3
         AND entity.id <> $4
       LIMIT 1`,
      [ownerUserId, entity.entityType, baseNormalizedName, resolved.id],
    );
    if (aliasCollision.rows[0]) {
      throw new EntityResolutionError("这个别名已经属于同类型的另一个实体，请先在实体记忆中合并", 409);
    }
    await client.query(
      `INSERT INTO ${schema}.entity_aliases (
         id, user_entity_id, alias, normalized_alias, confirmation_status, source
       ) VALUES ($1, $2, $3, $4, 'confirmed', 'user_confirmation')
       ON CONFLICT (user_entity_id, normalized_alias) DO UPDATE
       SET alias = EXCLUDED.alias, confirmation_status = 'confirmed', source = 'user_confirmation'`,
      [randomUUID(), resolved.id, entity.mention, baseNormalizedName],
    );
    return { userEntityId: resolved.id, canonicalEntityId: await redirectedCanonicalEntityId(client, resolved.canonicalEntityId) };
  }

  const existingUserEntity = await client.query<{
    id: string;
    canonical_entity_id: string | null;
  }>(
    `
      SELECT entity.id, entity.canonical_entity_id
      FROM ${schema}.user_entities entity
      WHERE entity.owner_user_id = $1
        AND entity.entity_type = $2
        AND entity.status = 'active'
        AND (
          entity.normalized_name = $3
          OR (
            $4::boolean
            AND EXISTS (
              SELECT 1 FROM ${schema}.entity_aliases alias
              WHERE alias.user_entity_id = entity.id
                AND alias.normalized_alias = $5
                AND alias.confirmation_status = 'confirmed'
            )
          )
        )
      ORDER BY CASE WHEN entity.normalized_name = $3 THEN 0 ELSE 1 END, entity.created_at
      LIMIT 1
    `,
    [ownerUserId, entity.entityType, normalizedName, !locationAnchor, baseNormalizedName],
  );

  if (existingUserEntity.rows[0]) {
    return {
      userEntityId: existingUserEntity.rows[0].id,
      canonicalEntityId: await redirectedCanonicalEntityId(client, existingUserEntity.rows[0].canonical_entity_id),
    };
  }

  let canonicalEntityId: string | null = null;
  const reusable = canUseGlobalEntity(entity, Boolean(locationAnchor));

  if (reusable) {
    const existingCanonical = await client.query<{ id: string }>(
      `
        SELECT id
        FROM ${schema}.canonical_entities
        WHERE entity_type = $1
          AND normalized_name = $2
          AND status = 'active'
        ORDER BY created_at
        LIMIT 1
      `,
      [entity.entityType, normalizedName],
    );

    canonicalEntityId = existingCanonical.rows[0]?.id ?? randomUUID();

    if (!existingCanonical.rows[0]) {
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO ${schema}.canonical_entities (
           id, entity_type, canonical_name, normalized_name, match_eligible
         ) VALUES ($1, $2, $3, $4, true)
         ON CONFLICT (entity_type, normalized_name) WHERE status = 'active'
         DO UPDATE SET canonical_name = ${schema}.canonical_entities.canonical_name
         RETURNING id`,
        [canonicalEntityId, entity.entityType, entity.mention, normalizedName],
      );
      canonicalEntityId = inserted.rows[0].id;
    }
  }

  const userEntityId = randomUUID();
  await client.query(
    `
      INSERT INTO ${schema}.user_entities (
        id,
        owner_user_id,
        canonical_entity_id,
        entity_type,
        display_name,
        normalized_name,
        match_eligible,
        sensitivity,
        metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, false, $7, $8::jsonb)
    `,
    [
      userEntityId,
      ownerUserId,
      canonicalEntityId,
      entity.entityType,
      entity.mention,
      normalizedName,
      reusable ? "normal" : entity.entityType === "place" ? "sensitive" : "normal",
      JSON.stringify(
        locationAnchor
          ? { locationAnchor, locationObservationId, source: "user_attached_location" }
          : {},
      ),
    ],
  );

  await client.query(
    `
      INSERT INTO ${schema}.entity_aliases (
        id, user_entity_id, alias, normalized_alias, confirmation_status
      ) VALUES ($1, $2, $3, $4, 'confirmed')
    `,
    [randomUUID(), userEntityId, entity.mention, normalizedName],
  );

  return { userEntityId, canonicalEntityId };
}
