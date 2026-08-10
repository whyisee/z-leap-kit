import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { config, quoteIdentifier } from "../config";
import { EventLifecycleError } from "./event-lifecycle-service";
import {
  evaluateEventPrivacy,
  type ContentVisibility,
  type PrivacyPolicySource,
} from "./privacy-policy-service";
import { refreshSocialProjectionsForUser } from "./social-service";

const schema = quoteIdentifier(config.DB_SCHEMA);

export type EventPrivacySettings = {
  contentVisibility: ContentVisibility;
  allowAnonymousStats: boolean;
  allowMatching: boolean;
  allowIdentityDisclosure: boolean;
  allowSharedOccurrence: boolean;
  policyVersion: number;
  hasOverride: boolean;
  discoveryEnabled: boolean;
  effectiveMatching: boolean;
  sensitiveMatchExcluded: boolean;
  sources: Record<
    "contentVisibility" | "allowAnonymousStats" | "allowMatching" | "allowIdentityDisclosure" | "allowSharedOccurrence",
    PrivacyPolicySource
  >;
};

async function assertOwnedEvent(
  client: PoolClient,
  ownerUserId: string,
  eventId: string,
  expectedVersion?: number,
): Promise<number> {
  const result = await client.query<{ version: number }>(
    `
      SELECT version
      FROM ${schema}.events
      WHERE id = $1 AND owner_user_id = $2 AND deleted_at IS NULL
      FOR UPDATE
    `,
    [eventId, ownerUserId],
  );
  const event = result.rows[0];
  if (!event) throw new EventLifecycleError("事件不存在或已经删除", 404);
  if (expectedVersion !== undefined && event.version !== expectedVersion) {
    throw new EventLifecycleError("这条事件已经在其他页面被修改，请刷新后重试", 409);
  }
  return event.version;
}

export async function getEventPrivacySettings(
  client: PoolClient,
  ownerUserId: string,
  eventId: string,
): Promise<EventPrivacySettings> {
  await assertOwnedEvent(client, ownerUserId, eventId);
  const policy = await evaluateEventPrivacy(client, ownerUserId, eventId);
  if (!policy) throw new EventLifecycleError("事件不存在或已经删除", 404);
  return {
    contentVisibility: policy.contentVisibility,
    allowAnonymousStats: policy.allowAnonymousStats,
    allowMatching: policy.allowMatching,
    allowIdentityDisclosure: policy.allowIdentityDisclosure,
    allowSharedOccurrence: policy.allowSharedOccurrence,
    policyVersion: policy.policyVersion,
    hasOverride: policy.hasEventOverride,
    discoveryEnabled: policy.globalDiscoveryEnabled,
    effectiveMatching: policy.effectiveMatching,
    sensitiveMatchExcluded: policy.sensitiveMatchExcluded,
    sources: policy.sources,
  };
}

export async function withdrawEventSharing(
  client: PoolClient,
  ownerUserId: string,
  eventId: string,
): Promise<string[]> {
  const affectedResult = await client.query<{ userId: string }>(
    `
      SELECT DISTINCT invite.target_user_id AS "userId"
      FROM ${schema}.event_participant_account_invites invite
      JOIN ${schema}.event_participants participant ON participant.id = invite.event_participant_id
      WHERE participant.event_id = $1 AND invite.status IN ('invited', 'accepted')
      UNION
      SELECT DISTINCT membership.user_id AS "userId"
      FROM ${schema}.event_occurrence_links link
      JOIN ${schema}.occurrence_memberships membership
        ON membership.occurrence_id = link.occurrence_id
      WHERE link.event_id = $1
        AND link.link_status = 'active'
        AND membership.membership_status = 'accepted'
    `,
    [eventId],
  );
  const occurrenceResult = await client.query<{ id: string }>(
    `
      SELECT occurrence_id AS id
      FROM ${schema}.event_occurrence_links
      WHERE event_id = $1 AND link_status = 'active'
    `,
    [eventId],
  );

  await client.query(
    `
      UPDATE ${schema}.event_participant_account_invites invite
      SET status = 'revoked', responded_at = now(), updated_at = now()
      FROM ${schema}.event_participants participant
      WHERE participant.id = invite.event_participant_id
        AND participant.event_id = $1
        AND invite.status IN ('invited', 'accepted')
    `,
    [eventId],
  );
  await client.query(
    `
      UPDATE ${schema}.event_participants
      SET account_user_id = NULL,
          identity_confirmed = false,
          attributes = attributes - 'identitySource'
      WHERE event_id = $1
        AND account_user_id IS NOT NULL
        AND user_entity_id IS NOT NULL
    `,
    [eventId],
  );
  await client.query(
    `
      UPDATE ${schema}.person_account_links link
      SET status = 'revoked'
      WHERE link.owner_user_id = $1
        AND link.status IN ('invited', 'accepted')
        AND NOT EXISTS (
          SELECT 1
          FROM ${schema}.event_participant_account_invites other_invite
          JOIN ${schema}.event_participants other_participant
            ON other_participant.id = other_invite.event_participant_id
          WHERE other_invite.owner_user_id = link.owner_user_id
            AND other_participant.user_entity_id = link.person_entity_id
            AND other_invite.target_user_id = link.linked_account_user_id
            AND other_invite.status = 'accepted'
        )
    `,
    [ownerUserId],
  );

  const occurrenceIds = occurrenceResult.rows.map((row) => row.id);
  if (occurrenceIds.length) {
    await client.query(
      `
        UPDATE ${schema}.occurrence_memberships
        SET membership_status = CASE WHEN user_id = $2 THEN 'left' ELSE 'removed' END,
            responded_at = now()
        WHERE occurrence_id = ANY($1::uuid[])
          AND membership_status IN ('invited', 'accepted')
      `,
      [occurrenceIds, ownerUserId],
    );
    await client.query(
      `
        UPDATE ${schema}.event_occurrence_links
        SET link_status = 'withdrawn'
        WHERE event_id = $1 AND link_status = 'active'
      `,
      [eventId],
    );
    await client.query(
      `
        UPDATE ${schema}.shared_occurrences
        SET status = 'deleted', version = version + 1, updated_at = now()
        WHERE id = ANY($1::uuid[]) AND status <> 'deleted'
      `,
      [occurrenceIds],
    );
  }
  return [...new Set([ownerUserId, ...affectedResult.rows.map((row) => row.userId)])];
}

export async function setEventPrivacySettings(
  client: PoolClient,
  ownerUserId: string,
  eventId: string,
  input: {
    expectedEventVersion: number;
    contentVisibility: ContentVisibility;
    allowAnonymousStats: boolean;
    allowMatching: boolean;
    allowIdentityDisclosure: boolean;
    allowSharedOccurrence: boolean;
  },
): Promise<EventPrivacySettings> {
  await assertOwnedEvent(client, ownerUserId, eventId, input.expectedEventVersion);
  const isolated = input.contentVisibility === "isolated";
  const allowAnonymousStats = isolated ? false : input.allowAnonymousStats;
  const allowMatching = isolated ? false : input.allowMatching;
  const allowIdentityDisclosure = isolated ? false : input.allowIdentityDisclosure;
  const allowSharedOccurrence = isolated ? false : input.allowSharedOccurrence;

  await client.query(
    `
      INSERT INTO ${schema}.privacy_policies (
        id, owner_user_id, policy_level, subject_key, content_visibility,
        allow_anonymous_stats, allow_matching, allow_identity_disclosure,
        allow_shared_occurrence, version
      ) VALUES ($1, $2, 'event', $3, $4, $5, $6, $7, $8, 1)
      ON CONFLICT (owner_user_id, policy_level, subject_key) DO UPDATE
      SET content_visibility = EXCLUDED.content_visibility,
          allow_anonymous_stats = EXCLUDED.allow_anonymous_stats,
          allow_matching = EXCLUDED.allow_matching,
          allow_identity_disclosure = EXCLUDED.allow_identity_disclosure,
          allow_shared_occurrence = EXCLUDED.allow_shared_occurrence,
          version = ${schema}.privacy_policies.version + 1,
          effective_from = now(),
          revoked_at = NULL,
          updated_at = now()
    `,
    [
      randomUUID(),
      ownerUserId,
      eventId,
      input.contentVisibility,
      allowAnonymousStats,
      allowMatching,
      allowIdentityDisclosure,
      allowSharedOccurrence,
    ],
  );

  let affectedUserIds: string[];
  if (!allowSharedOccurrence) {
    affectedUserIds = await withdrawEventSharing(client, ownerUserId, eventId);
  } else {
    const members = await client.query<{ userId: string }>(
      `
        SELECT DISTINCT membership.user_id AS "userId"
        FROM ${schema}.event_occurrence_links link
        JOIN ${schema}.occurrence_memberships membership
          ON membership.occurrence_id = link.occurrence_id
        WHERE link.event_id = $1
          AND link.link_status = 'active'
          AND membership.membership_status = 'accepted'
      `,
      [eventId],
    );
    affectedUserIds = [ownerUserId, ...members.rows.map((row) => row.userId)];
  }

  await client.query(
    `
      INSERT INTO ${schema}.outbox_events (
        id, aggregate_type, aggregate_id, event_type, payload
      ) VALUES ($1, 'event', $2, 'event.privacy_updated', $3::jsonb)
    `,
    [
      randomUUID(),
      eventId,
      JSON.stringify({
        eventId,
        ownerUserId,
        contentVisibility: input.contentVisibility,
        allowAnonymousStats,
        allowMatching,
        allowIdentityDisclosure,
        allowSharedOccurrence,
      }),
    ],
  );
  for (const userId of [...new Set(affectedUserIds)].sort()) {
    await refreshSocialProjectionsForUser(client, userId);
  }
  return getEventPrivacySettings(client, ownerUserId, eventId);
}
