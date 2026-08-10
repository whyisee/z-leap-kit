import type { PoolClient } from "pg";
import { config, quoteIdentifier } from "../config";

const schema = quoteIdentifier(config.DB_SCHEMA);

export type ContentVisibility = "private" | "friends" | "circle" | "public" | "isolated";
export type PrivacyPolicyLevel = "system_default" | "user_default" | "activity_category" | "entity" | "event";
export type PrivacyDimension =
  | "contentVisibility"
  | "allowAnonymousStats"
  | "allowMatching"
  | "allowIdentityDisclosure"
  | "allowSharedOccurrence";

export type PrivacyPolicyLayer = {
  level: Exclude<PrivacyPolicyLevel, "system_default">;
  subjectKey: string;
  version: number;
  contentVisibility: ContentVisibility | null;
  allowAnonymousStats: boolean | null;
  allowMatching: boolean | null;
  allowIdentityDisclosure: boolean | null;
  allowSharedOccurrence: boolean | null;
};

export type PrivacyPolicySource = {
  level: PrivacyPolicyLevel | "system_forced";
  subjectKeys: string[];
  version: number;
  reason?: string;
};

export type EffectiveEventPrivacy = {
  eventId: string;
  policyOwnerUserId: string;
  eventOwnerUserId: string;
  eventType: string;
  contentVisibility: ContentVisibility;
  allowAnonymousStats: boolean;
  allowMatching: boolean;
  effectiveMatching: boolean;
  allowIdentityDisclosure: boolean;
  allowSharedOccurrence: boolean;
  globalDiscoveryEnabled: boolean;
  sensitiveMatchExcluded: boolean;
  eligibleMatchingFact: boolean;
  policyVersion: number;
  hasEventOverride: boolean;
  sources: Record<PrivacyDimension, PrivacyPolicySource>;
};

type PolicyLayers = {
  userDefault?: PrivacyPolicyLayer;
  category?: PrivacyPolicyLayer;
  entities: PrivacyPolicyLayer[];
  event?: PrivacyPolicyLayer;
};

type ResolvedValue<T> = { value: T; source: PrivacyPolicySource };

const systemDefaults = {
  contentVisibility: "private" as ContentVisibility,
  allowAnonymousStats: false,
  allowMatching: false,
  allowIdentityDisclosure: false,
  allowSharedOccurrence: false,
};

const visibilityRank: Record<ContentVisibility, number> = {
  isolated: 0,
  private: 1,
  friends: 2,
  circle: 3,
  public: 4,
};

function sourceFor(layer: PrivacyPolicyLayer): PrivacyPolicySource {
  return { level: layer.level, subjectKeys: [layer.subjectKey], version: layer.version };
}

function combinedEntityValue<T>(
  layers: PrivacyPolicyLayer[],
  read: (layer: PrivacyPolicyLayer) => T | null,
  combine: (values: T[]) => T,
): ResolvedValue<T> | null {
  const explicit = layers
    .map((layer) => ({ layer, value: read(layer) }))
    .filter((item): item is { layer: PrivacyPolicyLayer; value: T } => item.value !== null);
  if (!explicit.length) return null;
  return {
    value: combine(explicit.map((item) => item.value)),
    source: {
      level: "entity",
      subjectKeys: explicit.map((item) => item.layer.subjectKey).sort(),
      version: Math.max(...explicit.map((item) => item.layer.version)),
      reason: explicit.length > 1 ? "同层实体策略采用最严格值" : undefined,
    },
  };
}

function resolveDimension<T>(input: {
  layers: PolicyLayers;
  read: (layer: PrivacyPolicyLayer) => T | null;
  entityCombine: (values: T[]) => T;
  systemValue: T;
}): ResolvedValue<T> {
  const eventValue = input.layers.event ? input.read(input.layers.event) : null;
  if (eventValue !== null && input.layers.event) {
    return { value: eventValue, source: sourceFor(input.layers.event) };
  }
  const entityValue = combinedEntityValue(input.layers.entities, input.read, input.entityCombine);
  if (entityValue) return entityValue;
  const categoryValue = input.layers.category ? input.read(input.layers.category) : null;
  if (categoryValue !== null && input.layers.category) {
    return { value: categoryValue, source: sourceFor(input.layers.category) };
  }
  const userValue = input.layers.userDefault ? input.read(input.layers.userDefault) : null;
  if (userValue !== null && input.layers.userDefault) {
    return { value: userValue, source: sourceFor(input.layers.userDefault) };
  }
  return {
    value: input.systemValue,
    source: { level: "system_default", subjectKeys: ["*"], version: 1 },
  };
}

export function resolveEffectiveEventPrivacy(input: {
  eventId: string;
  policyOwnerUserId: string;
  eventOwnerUserId: string;
  eventType: string;
  layers: PolicyLayers;
  sensitiveMatchExcluded: boolean;
  eligibleMatchingFact: boolean;
}): EffectiveEventPrivacy {
  const boolCombine = (values: boolean[]) => values.every(Boolean);
  const visibilityCombine = (values: ContentVisibility[]) =>
    [...values].sort((left, right) => visibilityRank[left] - visibilityRank[right])[0];
  const content = resolveDimension({
    layers: input.layers,
    read: (layer) => layer.contentVisibility,
    entityCombine: visibilityCombine,
    systemValue: systemDefaults.contentVisibility,
  });
  const anonymousStats = resolveDimension({
    layers: input.layers,
    read: (layer) => layer.allowAnonymousStats,
    entityCombine: boolCombine,
    systemValue: systemDefaults.allowAnonymousStats,
  });
  const matching = resolveDimension({
    layers: input.layers,
    read: (layer) => layer.allowMatching,
    entityCombine: boolCombine,
    systemValue: systemDefaults.allowMatching,
  });
  const identityDisclosure = resolveDimension({
    layers: input.layers,
    read: (layer) => layer.allowIdentityDisclosure,
    entityCombine: boolCombine,
    systemValue: systemDefaults.allowIdentityDisclosure,
  });
  const sharedOccurrence = resolveDimension({
    layers: input.layers,
    read: (layer) => layer.allowSharedOccurrence,
    entityCombine: boolCombine,
    systemValue: systemDefaults.allowSharedOccurrence,
  });

  const isolated = content.value === "isolated";
  const globalDiscoveryEnabled = input.layers.userDefault?.allowMatching === true;
  const sources: EffectiveEventPrivacy["sources"] = {
    contentVisibility: content.source,
    allowAnonymousStats: anonymousStats.source,
    allowMatching: matching.source,
    allowIdentityDisclosure: identityDisclosure.source,
    allowSharedOccurrence: sharedOccurrence.source,
  };
  if (isolated) {
    const forced: PrivacyPolicySource = {
      level: "system_forced",
      subjectKeys: [input.eventId],
      version: Math.max(1, content.source.version),
      reason: "完全隔离事件不参与任何派生用途",
    };
    sources.allowAnonymousStats = forced;
    sources.allowMatching = forced;
    sources.allowIdentityDisclosure = forced;
    sources.allowSharedOccurrence = forced;
  } else if (input.sensitiveMatchExcluded) {
    sources.allowMatching = {
      level: "system_forced",
      subjectKeys: [input.eventId],
      version: Math.max(1, matching.source.version),
      reason: "敏感实体或地点强制排除关系匹配",
    };
  } else if (!globalDiscoveryEnabled && matching.value) {
    sources.allowMatching = {
      level: "system_forced",
      subjectKeys: ["*"],
      version: input.layers.userDefault?.version ?? 1,
      reason: "全局关系发现尚未开启",
    };
  } else if (!input.eligibleMatchingFact && matching.value) {
    sources.allowMatching = {
      level: "system_forced",
      subjectKeys: [input.eventId],
      version: Math.max(1, matching.source.version),
      reason: "只有已发生或进行中的事件可以参与匹配",
    };
  }

  const allowMatching = isolated ? false : matching.value;
  return {
    eventId: input.eventId,
    policyOwnerUserId: input.policyOwnerUserId,
    eventOwnerUserId: input.eventOwnerUserId,
    eventType: input.eventType,
    contentVisibility: content.value,
    allowAnonymousStats: isolated ? false : anonymousStats.value,
    allowMatching,
    effectiveMatching:
      allowMatching &&
      globalDiscoveryEnabled &&
      !input.sensitiveMatchExcluded &&
      input.eligibleMatchingFact,
    allowIdentityDisclosure: isolated ? false : identityDisclosure.value,
    allowSharedOccurrence: isolated ? false : sharedOccurrence.value,
    globalDiscoveryEnabled,
    sensitiveMatchExcluded: input.sensitiveMatchExcluded,
    eligibleMatchingFact: input.eligibleMatchingFact,
    policyVersion: Math.max(
      1,
      ...[
        input.layers.userDefault,
        input.layers.category,
        ...input.layers.entities,
        input.layers.event,
      ].flatMap((layer) => layer ? [layer.version] : []),
    ),
    hasEventOverride: Boolean(input.layers.event),
    sources,
  };
}

export async function evaluateEventPrivacy(
  client: PoolClient,
  policyOwnerUserId: string,
  eventId: string,
): Promise<EffectiveEventPrivacy | null> {
  const eventResult = await client.query<{
    eventOwnerUserId: string;
    eventType: string;
    factualStatus: string;
    sensitiveMatchExcluded: boolean;
    entitySubjectKeys: string[];
  }>(
    `
      WITH involved_entity AS (
        SELECT relation.user_entity_id, relation.canonical_entity_id
        FROM ${schema}.event_entity_relations relation
        WHERE relation.event_id = $1
        UNION
        SELECT participant.user_entity_id, user_entity.canonical_entity_id
        FROM ${schema}.event_participants participant
        JOIN ${schema}.user_entities user_entity ON user_entity.id = participant.user_entity_id
        WHERE participant.event_id = $1 AND participant.user_entity_id IS NOT NULL
      ), entity_summary AS (
        SELECT
          COALESCE(bool_or(COALESCE(user_entity.sensitivity, 'normal') <> 'normal'), false)
            OR COALESCE(bool_or(COALESCE(canonical_entity.sensitivity, 'normal') <> 'normal'), false)
            AS sensitive,
          array_remove(array_agg(DISTINCT user_entity.id::text), NULL)
            || array_remove(array_agg(DISTINCT canonical_entity.id::text), NULL)
            || array_remove(array_agg(DISTINCT CASE
                 WHEN canonical_entity.id IS NULL THEN NULL
                 ELSE 'canonical:' || canonical_entity.id::text
               END), NULL) AS subject_keys
        FROM involved_entity involved
        LEFT JOIN ${schema}.user_entities user_entity ON user_entity.id = involved.user_entity_id
        LEFT JOIN ${schema}.canonical_entities canonical_entity ON canonical_entity.id = involved.canonical_entity_id
      )
      SELECT
        event.owner_user_id AS "eventOwnerUserId",
        event.event_type AS "eventType",
        event.factual_status AS "factualStatus",
        (
          entity_summary.sensitive
          OR EXISTS (
            SELECT 1
            FROM ${schema}.event_location_links location_link
            JOIN ${schema}.location_observations observation
              ON observation.id = location_link.location_observation_id
            WHERE location_link.event_id = event.id
              AND observation.deleted_at IS NULL
              AND observation.sensitivity <> 'normal'
          )
        ) AS "sensitiveMatchExcluded",
        entity_summary.subject_keys AS "entitySubjectKeys"
      FROM ${schema}.events event
      CROSS JOIN entity_summary
      WHERE event.id = $1 AND event.deleted_at IS NULL
    `,
    [eventId],
  );
  const event = eventResult.rows[0];
  if (!event) return null;

  const policies = await client.query<PrivacyPolicyLayer>(
    `
      SELECT
        policy_level AS level,
        subject_key AS "subjectKey",
        version,
        content_visibility AS "contentVisibility",
        allow_anonymous_stats AS "allowAnonymousStats",
        allow_matching AS "allowMatching",
        allow_identity_disclosure AS "allowIdentityDisclosure",
        allow_shared_occurrence AS "allowSharedOccurrence"
      FROM ${schema}.privacy_policies
      WHERE owner_user_id = $1
        AND revoked_at IS NULL
        AND (
          (policy_level = 'user_default' AND subject_key = '*')
          OR (policy_level = 'activity_category' AND subject_key = $2)
          OR (policy_level = 'event' AND subject_key = $3)
          OR (policy_level = 'entity' AND subject_key = ANY($4::text[]))
        )
    `,
    [policyOwnerUserId, event.eventType, eventId, event.entitySubjectKeys],
  );
  const userDefault = policies.rows.find((policy) => policy.level === "user_default");
  const category = policies.rows.find((policy) => policy.level === "activity_category");
  const eventPolicy = policies.rows.find((policy) => policy.level === "event");
  return resolveEffectiveEventPrivacy({
    eventId,
    policyOwnerUserId,
    eventOwnerUserId: event.eventOwnerUserId,
    eventType: event.eventType,
    layers: {
      userDefault,
      category,
      entities: policies.rows.filter((policy) => policy.level === "entity"),
      event: eventPolicy,
    },
    sensitiveMatchExcluded: event.sensitiveMatchExcluded,
    eligibleMatchingFact: event.factualStatus === "occurred" || event.factualStatus === "ongoing",
  });
}

export async function evaluateEventPrivacyBatch(
  client: PoolClient,
  policyOwnerUserId: string,
  eventIds: string[],
): Promise<Map<string, EffectiveEventPrivacy>> {
  const result = new Map<string, EffectiveEventPrivacy>();
  for (const eventId of [...new Set(eventIds)].sort()) {
    const policy = await evaluateEventPrivacy(client, policyOwnerUserId, eventId);
    if (policy) result.set(eventId, policy);
  }
  return result;
}
