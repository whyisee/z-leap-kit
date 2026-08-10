import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { config, quoteIdentifier } from "../config";
import { withdrawEventSharing } from "./event-privacy-service";
import {
  evaluateEventPrivacy,
  type ContentVisibility,
  type PrivacyPolicyLayer,
} from "./privacy-policy-service";
import { refreshSocialProjectionsForUser } from "./social-service";

const schema = quoteIdentifier(config.DB_SCHEMA);

export class PrivacyManagementError extends Error {
  constructor(message: string, readonly statusCode: 400 | 404 = 400) {
    super(message);
    this.name = "PrivacyManagementError";
  }
}

export type PrivacyPolicyMutation = {
  contentVisibility: ContentVisibility | null;
  allowAnonymousStats: boolean | null;
  allowMatching: boolean | null;
  allowIdentityDisclosure: boolean | null;
  allowSharedOccurrence: boolean | null;
};

type ManagedLevel = "user_default" | "activity_category" | "entity";

async function affectedOwnedEventIds(
  client: PoolClient,
  ownerUserId: string,
  level: ManagedLevel,
  subjectKey: string,
): Promise<string[]> {
  if (level === "entity") {
    const entity = await client.query<{ id: string }>(
      `SELECT id FROM ${schema}.user_entities WHERE id = $1 AND owner_user_id = $2 AND status = 'active'`,
      [subjectKey, ownerUserId],
    );
    if (!entity.rows[0]) throw new PrivacyManagementError("实体不存在", 404);
  }
  const result = await client.query<{ id: string }>(
    `
      SELECT DISTINCT event.id
      FROM ${schema}.events event
      LEFT JOIN ${schema}.event_entity_relations relation ON relation.event_id = event.id
      LEFT JOIN ${schema}.event_participants participant ON participant.event_id = event.id
      WHERE event.owner_user_id = $1 AND event.deleted_at IS NULL
        AND (
          $2 = 'user_default'
          OR ($2 = 'activity_category' AND event.event_type = $3)
          OR ($2 = 'entity' AND (
            relation.user_entity_id::text = $3 OR participant.user_entity_id::text = $3
          ))
        )
      ORDER BY event.id
    `,
    [ownerUserId, level, subjectKey],
  );
  return result.rows.map((row) => row.id);
}

async function reconcileAffectedEvents(
  client: PoolClient,
  ownerUserId: string,
  eventIds: string[],
): Promise<void> {
  const affectedUsers = new Set<string>([ownerUserId]);
  for (const eventId of eventIds) {
    const privacy = await evaluateEventPrivacy(client, ownerUserId, eventId);
    if (privacy && !privacy.allowSharedOccurrence) {
      for (const userId of await withdrawEventSharing(client, ownerUserId, eventId)) {
        affectedUsers.add(userId);
      }
    }
  }
  for (const userId of [...affectedUsers].sort()) {
    await refreshSocialProjectionsForUser(client, userId);
  }
}

function normalizedMutation(input: PrivacyPolicyMutation): PrivacyPolicyMutation {
  if (input.contentVisibility !== "isolated") return input;
  return {
    ...input,
    allowAnonymousStats: false,
    allowMatching: false,
    allowIdentityDisclosure: false,
    allowSharedOccurrence: false,
  };
}

export async function setManagedPrivacyPolicy(
  client: PoolClient,
  ownerUserId: string,
  level: ManagedLevel,
  subjectKey: string,
  input: PrivacyPolicyMutation,
): Promise<void> {
  const normalized = normalizedMutation(input);
  const eventIds = await affectedOwnedEventIds(client, ownerUserId, level, subjectKey);
  await client.query(
    `
      INSERT INTO ${schema}.privacy_policies (
        id, owner_user_id, policy_level, subject_key, content_visibility,
        allow_anonymous_stats, allow_matching, allow_identity_disclosure,
        allow_shared_occurrence, version
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 1)
      ON CONFLICT (owner_user_id, policy_level, subject_key) DO UPDATE
      SET content_visibility = EXCLUDED.content_visibility,
          allow_anonymous_stats = EXCLUDED.allow_anonymous_stats,
          allow_matching = EXCLUDED.allow_matching,
          allow_identity_disclosure = EXCLUDED.allow_identity_disclosure,
          allow_shared_occurrence = EXCLUDED.allow_shared_occurrence,
          version = ${schema}.privacy_policies.version + 1,
          effective_from = now(), revoked_at = NULL, updated_at = now()
    `,
    [
      randomUUID(),
      ownerUserId,
      level,
      subjectKey,
      normalized.contentVisibility,
      normalized.allowAnonymousStats,
      normalized.allowMatching,
      normalized.allowIdentityDisclosure,
      normalized.allowSharedOccurrence,
    ],
  );
  await client.query(
    `
      INSERT INTO ${schema}.outbox_events (id, aggregate_type, aggregate_id, event_type, payload)
      VALUES ($1, 'privacy_policy', $2, 'privacy_policy.updated', $3::jsonb)
    `,
    [
      randomUUID(),
      ownerUserId,
      JSON.stringify({ ownerUserId, level, subjectKey, affectedEventIds: eventIds }),
    ],
  );
  await reconcileAffectedEvents(client, ownerUserId, eventIds);
}

export async function removeManagedPrivacyPolicy(
  client: PoolClient,
  ownerUserId: string,
  level: Exclude<ManagedLevel, "user_default">,
  subjectKey: string,
): Promise<boolean> {
  const eventIds = await affectedOwnedEventIds(client, ownerUserId, level, subjectKey);
  const result = await client.query(
    `
      UPDATE ${schema}.privacy_policies
      SET revoked_at = now(), version = version + 1, updated_at = now()
      WHERE owner_user_id = $1 AND policy_level = $2 AND subject_key = $3 AND revoked_at IS NULL
    `,
    [ownerUserId, level, subjectKey],
  );
  if (!result.rowCount) return false;
  await reconcileAffectedEvents(client, ownerUserId, eventIds);
  return true;
}

export async function getPrivacyManagementOverview(client: PoolClient, ownerUserId: string) {
  const policies = await client.query<PrivacyPolicyLayer>(
      `
        SELECT policy_level AS level, subject_key AS "subjectKey", version,
               content_visibility AS "contentVisibility",
               allow_anonymous_stats AS "allowAnonymousStats",
               allow_matching AS "allowMatching",
               allow_identity_disclosure AS "allowIdentityDisclosure",
               allow_shared_occurrence AS "allowSharedOccurrence"
        FROM ${schema}.privacy_policies
        WHERE owner_user_id = $1 AND revoked_at IS NULL
          AND policy_level IN ('user_default', 'activity_category', 'entity')
        ORDER BY policy_level, subject_key
      `,
      [ownerUserId],
    );
  const categories = await client.query<{ eventType: string; eventCount: number }>(
      `
        SELECT event_type AS "eventType", count(*)::int AS "eventCount"
        FROM ${schema}.events
        WHERE owner_user_id = $1 AND deleted_at IS NULL
        GROUP BY event_type ORDER BY count(*) DESC, event_type
      `,
      [ownerUserId],
    );
  const entities = await client.query<{ id: string; name: string; entityType: string; eventCount: number }>(
      `
        SELECT entity.id, entity.display_name AS name, entity.entity_type AS "entityType",
               count(DISTINCT evidence.event_id)::int AS "eventCount"
        FROM ${schema}.user_entities entity
        LEFT JOIN LATERAL (
          SELECT relation.event_id FROM ${schema}.event_entity_relations relation WHERE relation.user_entity_id = entity.id
          UNION
          SELECT participant.event_id FROM ${schema}.event_participants participant WHERE participant.user_entity_id = entity.id
        ) evidence ON true
        WHERE entity.owner_user_id = $1 AND entity.status = 'active'
        GROUP BY entity.id
        ORDER BY count(DISTINCT evidence.event_id) DESC, entity.display_name
        LIMIT 200
      `,
      [ownerUserId],
    );
  const defaultPolicy = policies.rows.find((policy) => policy.level === "user_default") ?? {
    level: "user_default" as const,
    subjectKey: "*",
    version: 0,
    contentVisibility: "private" as const,
    allowAnonymousStats: false,
    allowMatching: false,
    allowIdentityDisclosure: false,
    allowSharedOccurrence: false,
  };
  const categoryPolicies = new Map(
    policies.rows
      .filter((policy) => policy.level === "activity_category")
      .map((policy) => [policy.subjectKey, policy]),
  );
  const entityPolicies = new Map(
    policies.rows
      .filter((policy) => policy.level === "entity")
      .map((policy) => [policy.subjectKey, policy]),
  );
  return {
    defaultPolicy,
    categories: categories.rows.map((category) => ({
      ...category,
      policy: categoryPolicies.get(category.eventType) ?? null,
    })),
    entities: entities.rows.map((entity) => ({
      ...entity,
      policy: entityPolicies.get(entity.id) ?? null,
    })),
  };
}
