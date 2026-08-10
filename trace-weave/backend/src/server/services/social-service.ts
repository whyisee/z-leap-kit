import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { config, quoteIdentifier } from "../config";
import { evaluateEventPrivacyBatch } from "./privacy-policy-service";

const schema = quoteIdentifier(config.DB_SCHEMA);

type ProjectionFeature = {
  eventId: string;
  canonicalEntityId: string;
  featureType: string;
  coarseTimeBucket: string | null;
};

export type SocialReason = {
  canonicalEntityId: string;
  featureType: string;
  entityType: string;
  label: string;
  contribution: number;
};

export type SocialMatchView = {
  id: string;
  score: number;
  status: "anonymous_candidate" | "contact_pending" | "connected";
  connectionState: "candidate" | "incoming" | "waiting_other" | "connected";
  identityRevealed: boolean;
  otherUser: { id: string; username: string; displayName: string } | null;
  anonymousLabel: string;
  reasons: SocialReason[];
};

export type SocialDiscoverySettings = {
  participateInDiscovery: boolean;
  policyVersion: number;
};

export class SocialMatchError extends Error {
  constructor(message: string, readonly statusCode: 404 | 409 = 404) {
    super(message);
    this.name = "SocialMatchError";
  }
}

export function socialReasonLabel(entityType: string, canonicalName: string): string {
  if (entityType === "geo_cell") return "共同到访过相近区域（约 1 公里）";
  if (entityType === "place") return `共同地点：${canonicalName}`;
  return canonicalName;
}

export function calculateSocialScore(reasons: Array<Pick<SocialReason, "contribution">>): number {
  const totalStrength = reasons.reduce((sum, reason) => sum + reason.contribution, 0);
  return Math.min(99, Math.round(32 + reasons.length * 15 + Math.min(22, totalStrength * 4)));
}

export async function getSocialDiscoverySettings(
  client: PoolClient,
  userId: string,
): Promise<SocialDiscoverySettings> {
  const result = await client.query<{ allowMatching: boolean | null; version: number }>(
    `
      SELECT allow_matching AS "allowMatching", version
      FROM ${schema}.privacy_policies
      WHERE owner_user_id = $1
        AND policy_level = 'user_default'
        AND subject_key = '*'
        AND revoked_at IS NULL
      LIMIT 1
    `,
    [userId],
  );
  return {
    participateInDiscovery: result.rows[0]?.allowMatching === true,
    policyVersion: result.rows[0]?.version ?? 1,
  };
}

async function ensureLocationCellEntity(client: PoolClient, socialCell: string): Promise<string> {
  const normalizedName = `geo:${socialCell}`;
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [
    `social-location:${normalizedName}`,
  ]);
  const existing = await client.query<{ id: string }>(
    `
      SELECT id
      FROM ${schema}.canonical_entities
      WHERE entity_type = 'geo_cell'
        AND normalized_name = $1
        AND status = 'active'
      ORDER BY created_at
      LIMIT 1
    `,
    [normalizedName],
  );
  if (existing.rows[0]) return existing.rows[0].id;

  const id = randomUUID();
  await client.query(
    `
      INSERT INTO ${schema}.canonical_entities (
        id, entity_type, canonical_name, normalized_name, match_eligible, metadata
      ) VALUES ($1, 'geo_cell', '匿名地点网格', $2, true, '{"precision":"coarse"}'::jsonb)
    `,
    [id, normalizedName],
  );
  return id;
}

async function recomputeSocialMatchesForUser(client: PoolClient, userId: string): Promise<void> {
  const sharedResult = await client.query<{
    otherUserId: string;
    canonicalEntityId: string;
    featureType: string;
    entityType: string;
    canonicalName: string;
    contribution: number;
    myProjectionId: string;
  }>(
    `
      WITH mine AS (
        SELECT
          canonical_entity_id,
          feature_type,
          sum(weight) AS total_weight,
          (array_agg(id ORDER BY created_at))[1] AS projection_id
        FROM ${schema}.social_projections
        WHERE owner_user_id = $1 AND status = 'active'
        GROUP BY canonical_entity_id, feature_type
      ), other_features AS (
        SELECT
          sp.owner_user_id,
          sp.canonical_entity_id,
          sp.feature_type,
          sum(sp.weight) AS total_weight
        FROM ${schema}.social_projections sp
        JOIN ${schema}.privacy_policies pp
          ON pp.owner_user_id = sp.owner_user_id
         AND pp.policy_level = 'user_default'
         AND pp.subject_key = '*'
         AND pp.allow_matching = true
         AND pp.revoked_at IS NULL
        JOIN ${schema}.users u ON u.id = sp.owner_user_id AND u.status = 'active'
        WHERE sp.owner_user_id <> $1 AND sp.status = 'active'
        GROUP BY sp.owner_user_id, sp.canonical_entity_id, sp.feature_type
      )
      SELECT
        other_features.owner_user_id AS "otherUserId",
        mine.canonical_entity_id AS "canonicalEntityId",
        mine.feature_type AS "featureType",
        ce.entity_type AS "entityType",
        ce.canonical_name AS "canonicalName",
        least(mine.total_weight, other_features.total_weight)::double precision AS contribution,
        mine.projection_id AS "myProjectionId"
      FROM mine
      JOIN other_features
        ON other_features.canonical_entity_id = mine.canonical_entity_id
       AND other_features.feature_type = mine.feature_type
      JOIN ${schema}.canonical_entities ce ON ce.id = mine.canonical_entity_id
      WHERE NOT EXISTS (
        SELECT 1
        FROM ${schema}.person_account_links direct_link
        WHERE direct_link.status = 'accepted'
          AND (
            (direct_link.owner_user_id = $1 AND direct_link.linked_account_user_id = other_features.owner_user_id)
            OR
            (direct_link.owner_user_id = other_features.owner_user_id AND direct_link.linked_account_user_id = $1)
          )
      )
      AND NOT EXISTS (
        SELECT 1 FROM ${schema}.social_blocks block
        WHERE (block.blocker_user_id = $1 AND block.blocked_user_id = other_features.owner_user_id)
           OR (block.blocker_user_id = other_features.owner_user_id AND block.blocked_user_id = $1)
      )
      ORDER BY other_features.owner_user_id, contribution DESC, ce.canonical_name
    `,
    [userId],
  );

  const grouped = new Map<string, typeof sharedResult.rows>();
  for (const row of sharedResult.rows) {
    const rows = grouped.get(row.otherUserId) ?? [];
    rows.push(row);
    grouped.set(row.otherUserId, rows);
  }

  for (const [otherUserId, features] of grouped) {
    const candidateReasons = features.map((feature) => ({ contribution: feature.contribution }));
    if (calculateSocialScore(candidateReasons) < config.SOCIAL_MATCH_MIN_SCORE) {
      grouped.delete(otherUserId);
    }
  }

  const validOtherUserIds = [...grouped.keys()];
  await client.query(
    `
      UPDATE ${schema}.social_matches
      SET status = 'revoked', updated_at = now()
      WHERE (user_low_id = $1 OR user_high_id = $1)
        AND status <> 'connected'
        AND NOT (
          CASE WHEN user_low_id = $1 THEN user_high_id ELSE user_low_id END
          = ANY($2::uuid[])
        )
    `,
    [userId, validOtherUserIds],
  );

  for (const [otherUserId, features] of grouped) {
    const [userLowId, userHighId] = [userId, otherUserId].sort();
    const reasons: SocialReason[] = features.map((feature) => ({
      canonicalEntityId: feature.canonicalEntityId,
      featureType: feature.featureType,
      entityType: feature.entityType,
      label: socialReasonLabel(feature.entityType, feature.canonicalName),
      contribution: feature.contribution,
    }));
    const totalStrength = reasons.reduce((sum, reason) => sum + reason.contribution, 0);
    const score = calculateSocialScore(reasons);
    const reasonSummary = {
      version: "social-match/v1",
      sharedFeatureCount: reasons.length,
      totalStrength,
      sharedFeatures: reasons,
    };

    const existing = await client.query<{ id: string; status: string }>(
      `
        SELECT id, status
        FROM ${schema}.social_matches
        WHERE user_low_id = $1 AND user_high_id = $2
        FOR UPDATE
      `,
      [userLowId, userHighId],
    );
    const matchId = existing.rows[0]?.id ?? randomUUID();
    const previousStatus = existing.rows[0]?.status;
    const nextStatus =
      previousStatus === "connected" || previousStatus === "contact_pending" || previousStatus === "dismissed"
        ? previousStatus
        : "anonymous_candidate";

    await client.query(
      `
        INSERT INTO ${schema}.social_matches (
          id, user_low_id, user_high_id, score, status, reason_summary
        ) VALUES ($1, $2, $3, $4, $5, $6::jsonb)
        ON CONFLICT (user_low_id, user_high_id) DO UPDATE
        SET score = EXCLUDED.score,
            status = EXCLUDED.status,
            reason_summary = EXCLUDED.reason_summary,
            calculated_at = now(),
            updated_at = now()
      `,
      [matchId, userLowId, userHighId, score, nextStatus, JSON.stringify(reasonSummary)],
    );
    await client.query(`DELETE FROM ${schema}.user_relation_evidence WHERE match_id = $1`, [matchId]);
    for (const feature of features) {
      await client.query(
        `
          INSERT INTO ${schema}.user_relation_evidence (
            id, match_id, evidence_type, opaque_projection_ref, contribution, explanation
          ) VALUES ($1, $2, $3, $4, $5, $6::jsonb)
        `,
        [
          randomUUID(),
          matchId,
          feature.featureType,
          feature.myProjectionId,
          feature.contribution,
          JSON.stringify({
            canonicalEntityId: feature.canonicalEntityId,
            entityType: feature.entityType,
            label: socialReasonLabel(feature.entityType, feature.canonicalName),
          }),
        ],
      );
    }
  }
}

export async function refreshSocialProjectionsForUser(
  client: PoolClient,
  userId: string,
): Promise<SocialDiscoverySettings> {
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [
    `social-projection:${userId}`,
  ]);
  const settings = await getSocialDiscoverySettings(client, userId);
  await client.query(
    `
      UPDATE ${schema}.social_projections
      SET status = 'revoked', revoked_at = now()
      WHERE owner_user_id = $1 AND status = 'active'
    `,
    [userId],
  );

  if (settings.participateInDiscovery) {
    const entityFeatures = await client.query<ProjectionFeature>(
      `
        SELECT DISTINCT
          e.id AS "eventId",
          eer.canonical_entity_id AS "canonicalEntityId",
          ('entity:' || ce.entity_type) AS "featureType",
          e.occurred_start::date::text AS "coarseTimeBucket"
        FROM ${schema}.events e
        JOIN ${schema}.event_entity_relations eer ON eer.event_id = e.id
        JOIN ${schema}.canonical_entities ce ON ce.id = eer.canonical_entity_id
        JOIN ${schema}.user_entities ue ON ue.id = eer.user_entity_id
        WHERE (
            e.owner_user_id = $1
            OR EXISTS (
              SELECT 1
              FROM ${schema}.event_occurrence_links occurrence_link
              JOIN ${schema}.occurrence_memberships membership
                ON membership.occurrence_id = occurrence_link.occurrence_id
              WHERE occurrence_link.event_id = e.id
                AND occurrence_link.link_status = 'active'
                AND membership.user_id = $1
                AND membership.membership_status = 'accepted'
                AND COALESCE((membership.shared_fact_permissions->>'entities')::boolean, false)
            )
          )
          AND e.deleted_at IS NULL
          AND e.factual_status IN ('occurred', 'ongoing')
          AND ce.status = 'active'
          AND ce.match_eligible = true
          AND ce.sensitivity = 'normal'
          AND ue.sensitivity = 'normal'
      `,
      [userId],
    );

    const locationFeatures = await client.query<{
      eventId: string;
      socialCell: string;
      coarseTimeBucket: string | null;
    }>(
      `
        SELECT DISTINCT
          e.id AS "eventId",
          lo.social_cell AS "socialCell",
          e.occurred_start::date::text AS "coarseTimeBucket"
        FROM ${schema}.events e
        JOIN ${schema}.event_location_links ell ON ell.event_id = e.id
        JOIN ${schema}.location_observations lo ON lo.id = ell.location_observation_id
        WHERE (
            e.owner_user_id = $1
            OR EXISTS (
              SELECT 1
              FROM ${schema}.event_occurrence_links occurrence_link
              JOIN ${schema}.occurrence_memberships membership
                ON membership.occurrence_id = occurrence_link.occurrence_id
              WHERE occurrence_link.event_id = e.id
                AND occurrence_link.link_status = 'active'
                AND membership.user_id = $1
                AND membership.membership_status = 'accepted'
                AND COALESCE((membership.shared_fact_permissions->>'coarseLocation')::boolean, false)
            )
          )
          AND e.deleted_at IS NULL
          AND e.factual_status IN ('occurred', 'ongoing')
          AND ell.location_role = 'occurred_at'
          AND ell.social_match_eligible = true
          AND lo.match_eligible = true
          AND lo.sensitivity = 'normal'
          AND lo.social_cell IS NOT NULL
          AND lo.deleted_at IS NULL
      `,
      [userId],
    );
    const effectivePolicies = await evaluateEventPrivacyBatch(
      client,
      userId,
      [...entityFeatures.rows, ...locationFeatures.rows].map((feature) => feature.eventId),
    );
    const features = entityFeatures.rows.filter(
      (feature) => effectivePolicies.get(feature.eventId)?.effectiveMatching === true,
    );
    for (const location of locationFeatures.rows.filter(
      (feature) => effectivePolicies.get(feature.eventId)?.effectiveMatching === true,
    )) {
      features.push({
        eventId: location.eventId,
        canonicalEntityId: await ensureLocationCellEntity(client, location.socialCell),
        featureType: "location:coarse_cell",
        coarseTimeBucket: location.coarseTimeBucket,
      });
    }

    for (const feature of features) {
      await client.query(
        `
          INSERT INTO ${schema}.social_projections (
            id, owner_user_id, source_event_id, canonical_entity_id, feature_type,
            coarse_time_bucket, weight, policy_version, opaque_evidence_ref
          ) VALUES ($1, $2, $3, $4, $5, $6::date, 1, $7, $8)
        `,
        [
          randomUUID(),
          userId,
          feature.eventId,
          feature.canonicalEntityId,
          feature.featureType,
          feature.coarseTimeBucket,
          effectivePolicies.get(feature.eventId)?.policyVersion ?? settings.policyVersion,
          randomUUID(),
        ],
      );
    }
  }

  await recomputeSocialMatchesForUser(client, userId);
  return settings;
}

export async function setSocialDiscoverySetting(
  client: PoolClient,
  userId: string,
  participateInDiscovery: boolean,
): Promise<SocialDiscoverySettings> {
  await client.query(
    `
      INSERT INTO ${schema}.privacy_policies (
        id, owner_user_id, policy_level, subject_key, content_visibility,
        allow_anonymous_stats, allow_matching, allow_identity_disclosure,
        allow_shared_occurrence, version
      ) VALUES ($1, $2, 'user_default', '*', 'private', false, $3, false, false, 1)
      ON CONFLICT (owner_user_id, policy_level, subject_key) DO UPDATE
      SET allow_matching = EXCLUDED.allow_matching,
          version = ${schema}.privacy_policies.version + 1,
          effective_from = now(),
          revoked_at = NULL,
          updated_at = now()
    `,
    [randomUUID(), userId, participateInDiscovery],
  );
  return refreshSocialProjectionsForUser(client, userId);
}

export async function getSocialMatches(
  client: PoolClient,
  userId: string,
): Promise<SocialMatchView[]> {
  const result = await client.query<{
    id: string;
    score: number;
    status: "anonymous_candidate" | "contact_pending" | "connected";
    reasonSummary: { sharedFeatures?: SocialReason[] } | null;
    otherUserId: string;
    otherUsername: string;
    otherDisplayName: string;
    myConnectGranted: boolean;
    otherConnectGranted: boolean;
    bothRevealGranted: boolean;
  }>(
    `
      SELECT
        sm.id,
        sm.score::double precision AS score,
        sm.status,
        sm.reason_summary AS "reasonSummary",
        other_user.id AS "otherUserId",
        other_user.username AS "otherUsername",
        other_user.display_name AS "otherDisplayName",
        EXISTS (
          SELECT 1 FROM ${schema}.match_consents mc
          WHERE mc.match_id = sm.id AND mc.user_id = $1
            AND mc.consent_type = 'connect' AND mc.status = 'granted'
        ) AS "myConnectGranted",
        EXISTS (
          SELECT 1 FROM ${schema}.match_consents mc
          WHERE mc.match_id = sm.id AND mc.user_id = other_user.id
            AND mc.consent_type = 'connect' AND mc.status = 'granted'
        ) AS "otherConnectGranted",
        (
          SELECT count(DISTINCT mc.user_id) = 2
          FROM ${schema}.match_consents mc
          WHERE mc.match_id = sm.id
            AND mc.consent_type = 'reveal_identity' AND mc.status = 'granted'
        ) AS "bothRevealGranted"
      FROM ${schema}.social_matches sm
      JOIN ${schema}.users other_user
        ON other_user.id = CASE WHEN sm.user_low_id = $1 THEN sm.user_high_id ELSE sm.user_low_id END
      WHERE (sm.user_low_id = $1 OR sm.user_high_id = $1)
        AND sm.status IN ('anonymous_candidate', 'contact_pending', 'connected')
        AND other_user.status = 'active'
      ORDER BY sm.status = 'connected' DESC, sm.score DESC, sm.updated_at DESC
    `,
    [userId],
  );

  return result.rows.map((row, index) => {
    const identityRevealed = row.status === "connected" || row.bothRevealGranted;
    const connectionState =
      row.status === "connected"
        ? "connected"
        : row.myConnectGranted
          ? "waiting_other"
          : row.otherConnectGranted
            ? "incoming"
            : "candidate";
    return {
      id: row.id,
      score: row.score,
      status: row.status,
      connectionState,
      identityRevealed,
      otherUser: identityRevealed
        ? {
            id: row.otherUserId,
            username: row.otherUsername,
            displayName: row.otherDisplayName,
          }
        : null,
      anonymousLabel: `匿名生活记录者 ${String(index + 1).padStart(2, "0")}`,
      reasons: Array.isArray(row.reasonSummary?.sharedFeatures)
        ? row.reasonSummary.sharedFeatures
        : [],
    };
  });
}

export async function decideSocialMatch(
  client: PoolClient,
  userId: string,
  matchId: string,
  decision: "connect" | "dismiss" | "disconnect",
): Promise<void> {
  const matchResult = await client.query<{
    userLowId: string;
    userHighId: string;
    status: string;
  }>(
    `
      SELECT user_low_id AS "userLowId", user_high_id AS "userHighId", status
      FROM ${schema}.social_matches
      WHERE id = $1 AND (user_low_id = $2 OR user_high_id = $2)
      FOR UPDATE
    `,
    [matchId, userId],
  );
  const match = matchResult.rows[0];
  if (!match || match.status === "revoked" || match.status === "dismissed") {
    throw new SocialMatchError("关系候选不存在或已经失效");
  }

  const upsertConsent = async (
    consentType: "participate" | "reveal_identity" | "connect",
    status: "granted" | "revoked" | "declined",
  ) => {
    await client.query(
      `
        INSERT INTO ${schema}.match_consents (id, match_id, user_id, consent_type, status)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (match_id, user_id, consent_type) DO UPDATE
        SET status = EXCLUDED.status, decided_at = now()
      `,
      [randomUUID(), matchId, userId, consentType, status],
    );
  };

  if (decision === "dismiss") {
    await upsertConsent("participate", "declined");
    await client.query(
      `UPDATE ${schema}.social_matches SET status = 'dismissed', updated_at = now() WHERE id = $1`,
      [matchId],
    );
    return;
  }

  if (decision === "disconnect") {
    await upsertConsent("connect", "revoked");
    await upsertConsent("reveal_identity", "revoked");
    await client.query(
      `
        UPDATE ${schema}.social_connections
        SET status = 'ended', ended_at = now()
        WHERE match_id = $1 AND status <> 'ended'
      `,
      [matchId],
    );
    await client.query(
      `UPDATE ${schema}.social_matches SET status = 'anonymous_candidate', updated_at = now() WHERE id = $1`,
      [matchId],
    );
    return;
  }

  await upsertConsent("participate", "granted");
  await upsertConsent("reveal_identity", "granted");
  await upsertConsent("connect", "granted");
  const consentResult = await client.query<{ count: string }>(
    `
      SELECT count(DISTINCT user_id)::text AS count
      FROM ${schema}.match_consents
      WHERE match_id = $1 AND consent_type = 'connect' AND status = 'granted'
    `,
    [matchId],
  );
  if (Number(consentResult.rows[0]?.count ?? 0) < 2) {
    await client.query(
      `UPDATE ${schema}.social_matches SET status = 'contact_pending', updated_at = now() WHERE id = $1`,
      [matchId],
    );
    return;
  }

  await client.query(
    `
      INSERT INTO ${schema}.social_connections (
        id, match_id, user_low_id, user_high_id, status
      ) VALUES ($1, $2, $3, $4, 'active')
      ON CONFLICT (match_id) DO UPDATE
      SET status = 'active', connected_at = now(), ended_at = NULL
    `,
    [randomUUID(), matchId, match.userLowId, match.userHighId],
  );
  await client.query(
    `UPDATE ${schema}.social_matches SET status = 'connected', updated_at = now() WHERE id = $1`,
    [matchId],
  );
}
