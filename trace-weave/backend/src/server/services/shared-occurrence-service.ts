import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { config, quoteIdentifier } from "../config";
import { evaluateEventPrivacy } from "./privacy-policy-service";
import { refreshSocialProjectionsForUser } from "./social-service";

const schema = quoteIdentifier(config.DB_SCHEMA);

export class SharedInviteError extends Error {
  constructor(message: string, readonly statusCode: 400 | 403 | 404 | 409 = 400) {
    super(message);
    this.name = "SharedInviteError";
  }
}

export type SharedParticipantInvite = {
  id: string;
  status: "invited" | "accepted";
  participantMention: string;
  event: {
    id: string;
    title: string;
    eventType: string;
    occurredDate: string | null;
  };
  inviter: { id: string; username: string; displayName: string };
  candidateEvents: Array<{ id: string; title: string; eventType: string; occurredStart: string | null }>;
};

export type SharedFactPermissions = { eventTitle: boolean; entities: boolean; coarseTime: boolean; coarseLocation: boolean };

export async function inviteEventParticipant(
  client: PoolClient,
  ownerUserId: string,
  eventId: string,
  eventParticipantId: string,
  targetUsername: string,
): Promise<string> {
  const participantResult = await client.query<{
    userEntityId: string;
    participantMention: string;
    linkedAccountUserId: string | null;
  }>(
    `
      SELECT
        ep.user_entity_id AS "userEntityId",
        ue.display_name AS "participantMention",
        ep.account_user_id AS "linkedAccountUserId"
      FROM ${schema}.event_participants ep
      JOIN ${schema}.events e ON e.id = ep.event_id
      JOIN ${schema}.user_entities ue ON ue.id = ep.user_entity_id
      WHERE ep.id = $1 AND ep.event_id = $2
        AND e.owner_user_id = $3 AND e.deleted_at IS NULL
      FOR UPDATE OF ep
    `,
    [eventParticipantId, eventId, ownerUserId],
  );
  const participant = participantResult.rows[0];
  if (!participant) throw new SharedInviteError("事件参与者不存在", 404);
  if (participant.linkedAccountUserId) throw new SharedInviteError("这个人物已经关联到账户", 409);

  const privacy = await evaluateEventPrivacy(client, ownerUserId, eventId);
  if (!privacy?.allowSharedOccurrence) {
    throw new SharedInviteError("这条事件的隐私设置不允许建立共同经历", 409);
  }

  const targetResult = await client.query<{ id: string }>(
    `SELECT id FROM ${schema}.users WHERE lower(username) = $1 AND status = 'active' LIMIT 1`,
    [targetUsername.trim().toLocaleLowerCase("zh-CN")],
  );
  const target = targetResult.rows[0];
  if (!target || target.id === ownerUserId) {
    throw new SharedInviteError("找不到可邀请的账户，请核对完整用户名", 404);
  }

  const acceptedLink = await client.query<{ id: string }>(
    `
      SELECT id
      FROM ${schema}.event_participant_account_invites
      WHERE event_participant_id = $1 AND status = 'accepted' AND target_user_id <> $2
      LIMIT 1
    `,
    [eventParticipantId, target.id],
  );
  if (acceptedLink.rows[0]) throw new SharedInviteError("这个人物已经由其他账户确认", 409);
  const pendingOtherInvite = await client.query<{ id: string }>(
    `
      SELECT id
      FROM ${schema}.event_participant_account_invites
      WHERE event_participant_id = $1 AND status = 'invited' AND target_user_id <> $2
      LIMIT 1
    `,
    [eventParticipantId, target.id],
  );
  if (pendingOtherInvite.rows[0]) {
    throw new SharedInviteError("这个人物已经有一条待确认邀请，请先撤回", 409);
  }

  const inviteId = randomUUID();
  const inviteResult = await client.query<{ id: string }>(
    `
      INSERT INTO ${schema}.event_participant_account_invites (
        id, owner_user_id, event_participant_id, target_user_id, status
      ) VALUES ($1, $2, $3, $4, 'invited')
      ON CONFLICT (event_participant_id, target_user_id) DO UPDATE
      SET status = 'invited', responded_at = NULL, updated_at = now()
      RETURNING id
    `,
    [inviteId, ownerUserId, eventParticipantId, target.id],
  );
  await client.query(
    `
      INSERT INTO ${schema}.person_account_links (
        id, owner_user_id, person_entity_id, linked_account_user_id, status
      ) VALUES ($1, $2, $3, $4, 'invited')
      ON CONFLICT (owner_user_id, person_entity_id, linked_account_user_id) DO UPDATE
      SET status = CASE
        WHEN ${schema}.person_account_links.status = 'accepted' THEN 'accepted'
        ELSE 'invited'
      END
    `,
    [randomUUID(), ownerUserId, participant.userEntityId, target.id],
  );
  return inviteResult.rows[0].id;
}

export async function getSharedParticipantInvites(
  client: PoolClient,
  targetUserId: string,
): Promise<SharedParticipantInvite[]> {
  const result = await client.query<SharedParticipantInvite>(
    `
      SELECT
        invite.id,
        invite.status,
        ue.display_name AS "participantMention",
        json_build_object(
          'id', e.id,
          'title', e.title,
          'eventType', e.event_type,
          'occurredDate', e.occurred_start::date::text
        ) AS event,
        json_build_object(
          'id', inviter.id,
          'username', inviter.username,
          'displayName', inviter.display_name
        ) AS inviter,
        COALESCE((
          SELECT json_agg(json_build_object(
            'id', own_event.id, 'title', own_event.title, 'eventType', own_event.event_type,
            'occurredStart', own_event.occurred_start
          ) ORDER BY own_event.occurred_start DESC NULLS LAST, own_event.created_at DESC)
          FROM ${schema}.events own_event
          WHERE own_event.owner_user_id = $1 AND own_event.deleted_at IS NULL
            AND own_event.factual_status IN ('occurred','ongoing')
            AND (e.occurred_start IS NULL OR own_event.occurred_start IS NULL
                 OR own_event.occurred_start BETWEEN e.occurred_start - interval '2 days' AND e.occurred_start + interval '2 days')
          LIMIT 20
        ), '[]'::json) AS "candidateEvents"
      FROM ${schema}.event_participant_account_invites invite
      JOIN ${schema}.event_participants ep ON ep.id = invite.event_participant_id
      JOIN ${schema}.events e ON e.id = ep.event_id AND e.deleted_at IS NULL
      JOIN ${schema}.user_entities ue ON ue.id = ep.user_entity_id
      JOIN ${schema}.users inviter ON inviter.id = invite.owner_user_id
      WHERE invite.target_user_id = $1 AND invite.status = 'invited'
      ORDER BY invite.created_at DESC
    `,
    [targetUserId],
  );
  return result.rows;
}

async function acceptInvite(
  client: PoolClient,
  invite: {
    id: string;
    ownerUserId: string;
    targetUserId: string;
    eventParticipantId: string;
    currentAccountUserId: string | null;
    userEntityId: string;
    eventId: string;
    occurredStart: string | null;
    occurredEnd: string | null;
    timePrecision: string;
    eventType: string;
    title: string;
  },
  options: { linkedEventId?: string; permissions: SharedFactPermissions },
): Promise<void> {
  await client.query(
    `
      UPDATE ${schema}.event_participant_account_invites
      SET status = 'accepted', responded_at = now(), updated_at = now()
      WHERE id = $1
    `,
    [invite.id],
  );
  await client.query(
    `
      UPDATE ${schema}.event_participants
      SET account_user_id = $2, identity_confirmed = true,
          attributes = attributes || '{"identitySource":"shared_invite_acceptance"}'::jsonb
      WHERE id = $1
    `,
    [invite.eventParticipantId, invite.targetUserId],
  );
  await client.query(
    `
      INSERT INTO ${schema}.person_account_links (
        id, owner_user_id, person_entity_id, linked_account_user_id, status, accepted_at
      ) VALUES ($1, $2, $3, $4, 'accepted', now())
      ON CONFLICT (owner_user_id, person_entity_id, linked_account_user_id) DO UPDATE
      SET status = 'accepted', accepted_at = now()
    `,
    [randomUUID(), invite.ownerUserId, invite.userEntityId, invite.targetUserId],
  );

  const existingOccurrence = await client.query<{ occurrenceId: string }>(
    `
      SELECT occurrence_id AS "occurrenceId"
      FROM ${schema}.event_occurrence_links
      WHERE event_id = $1 AND link_status = 'active'
      LIMIT 1
      FOR UPDATE
    `,
    [invite.eventId],
  );
  const occurrenceId = existingOccurrence.rows[0]?.occurrenceId ?? randomUUID();
  if (!existingOccurrence.rows[0]) {
    await client.query(
      `
        INSERT INTO ${schema}.shared_occurrences (
          id, occurred_start, occurred_end, time_precision, shared_facts, created_by_user_id
        ) VALUES ($1, $2::timestamptz, $3::timestamptz, $4, $5::jsonb, $6)
      `,
      [
        occurrenceId,
        invite.occurredStart,
        invite.occurredEnd,
        invite.timePrecision,
        JSON.stringify({ eventType: invite.eventType, title: invite.title }),
        invite.ownerUserId,
      ],
    );
    await client.query(
      `
        INSERT INTO ${schema}.event_occurrence_links (
          id, event_id, occurrence_id, owner_user_id, link_status
        ) VALUES ($1, $2, $3, $4, 'active')
      `,
      [randomUUID(), invite.eventId, occurrenceId, invite.ownerUserId],
    );
    await client.query(
      `
        INSERT INTO ${schema}.occurrence_memberships (
          id, occurrence_id, user_id, membership_status, shared_fact_permissions,
          invited_by_user_id, responded_at
        ) VALUES ($1, $2, $3, 'accepted', $4::jsonb, $3, now())
      `,
      [
        randomUUID(),
        occurrenceId,
        invite.ownerUserId,
        JSON.stringify({ eventTitle: true, entities: true, coarseTime: true, coarseLocation: true }),
      ],
    );
  }
  await client.query(
    `
      INSERT INTO ${schema}.occurrence_memberships (
        id, occurrence_id, user_id, membership_status, shared_fact_permissions,
        invited_by_user_id, responded_at
      ) VALUES ($1, $2, $3, 'accepted', $4::jsonb, $5, now())
      ON CONFLICT (occurrence_id, user_id) DO UPDATE
      SET membership_status = 'accepted',
          shared_fact_permissions = EXCLUDED.shared_fact_permissions,
          invited_by_user_id = EXCLUDED.invited_by_user_id,
          responded_at = now()
    `,
    [
      randomUUID(),
      occurrenceId,
      invite.targetUserId,
      JSON.stringify(options.permissions),
      invite.ownerUserId,
    ],
  );

  if (options.linkedEventId) {
    const linkedEvent = await client.query<{ id: string }>(
      `SELECT id FROM ${schema}.events WHERE id = $1 AND owner_user_id = $2 AND deleted_at IS NULL FOR UPDATE`,
      [options.linkedEventId, invite.targetUserId],
    );
    if (!linkedEvent.rows[0]) throw new SharedInviteError("你选择的关联事件不存在", 404);
    const linkedPrivacy = await evaluateEventPrivacy(client, invite.targetUserId, options.linkedEventId);
    if (!linkedPrivacy?.allowSharedOccurrence) throw new SharedInviteError("你选择的事件不允许加入共同经历", 409);
    const existingLink = await client.query<{ occurrenceId: string }>(
      `SELECT occurrence_id AS "occurrenceId" FROM ${schema}.event_occurrence_links
       WHERE event_id = $1 AND link_status = 'active' LIMIT 1`, [options.linkedEventId],
    );
    if (existingLink.rows[0] && existingLink.rows[0].occurrenceId !== occurrenceId) {
      throw new SharedInviteError("你选择的事件已经属于另一条共同经历", 409);
    }
    await client.query(
      `INSERT INTO ${schema}.event_occurrence_links (id,event_id,occurrence_id,owner_user_id,link_status)
       VALUES ($1,$2,$3,$4,'active') ON CONFLICT (event_id,occurrence_id) DO UPDATE SET link_status = 'active'`,
      [randomUUID(), options.linkedEventId, occurrenceId, invite.targetUserId],
    );
  }

  await refreshSocialProjectionsForUser(client, invite.ownerUserId);
  await refreshSocialProjectionsForUser(client, invite.targetUserId);
}

export async function decideSharedParticipantInvite(
  client: PoolClient,
  actorUserId: string,
  inviteId: string,
  decision: "accept" | "decline" | "revoke",
  options?: { linkedEventId?: string; permissions?: SharedFactPermissions },
): Promise<void> {
  const result = await client.query<{
    id: string;
    ownerUserId: string;
    targetUserId: string;
    status: "invited" | "accepted" | "declined" | "revoked";
    eventParticipantId: string;
    currentAccountUserId: string | null;
    userEntityId: string;
    eventId: string;
    occurredStart: string | null;
    occurredEnd: string | null;
    timePrecision: string;
    eventType: string;
    title: string;
  }>(
    `
      SELECT
        invite.id,
        invite.owner_user_id AS "ownerUserId",
        invite.target_user_id AS "targetUserId",
        invite.status,
        ep.id AS "eventParticipantId",
        ep.account_user_id AS "currentAccountUserId",
        ep.user_entity_id AS "userEntityId",
        e.id AS "eventId",
        e.occurred_start AS "occurredStart",
        e.occurred_end AS "occurredEnd",
        e.time_precision AS "timePrecision",
        e.event_type AS "eventType",
        e.title
      FROM ${schema}.event_participant_account_invites invite
      JOIN ${schema}.event_participants ep ON ep.id = invite.event_participant_id
      JOIN ${schema}.events e ON e.id = ep.event_id
      WHERE invite.id = $1 AND e.deleted_at IS NULL
      FOR UPDATE OF invite, ep
    `,
    [inviteId],
  );
  const invite = result.rows[0];
  if (!invite) throw new SharedInviteError("共同经历邀请不存在", 404);
  if (decision !== "revoke" && actorUserId !== invite.targetUserId) {
    throw new SharedInviteError("只有被邀请人可以处理这条邀请", 403);
  }
  if (decision === "revoke" && actorUserId !== invite.targetUserId && actorUserId !== invite.ownerUserId) {
    throw new SharedInviteError("你不能撤销这条邀请", 403);
  }

  if (decision === "accept") {
    if (invite.status !== "invited") throw new SharedInviteError("邀请当前状态不能接受", 409);
    if (invite.currentAccountUserId && invite.currentAccountUserId !== invite.targetUserId) {
      throw new SharedInviteError("这个人物已经由其他账户确认", 409);
    }
    await acceptInvite(client, invite, {
      linkedEventId: options?.linkedEventId,
      permissions: options?.permissions ?? { eventTitle: true, entities: true, coarseTime: true, coarseLocation: false },
    });
    return;
  }
  if (decision === "decline") {
    if (invite.status !== "invited") throw new SharedInviteError("邀请当前状态不能拒绝", 409);
    await client.query(
      `
        UPDATE ${schema}.event_participant_account_invites
        SET status = 'declined', responded_at = now(), updated_at = now()
        WHERE id = $1
      `,
      [invite.id],
    );
    await client.query(
      `
        UPDATE ${schema}.person_account_links
        SET status = 'declined'
        WHERE owner_user_id = $1 AND person_entity_id = $2
          AND linked_account_user_id = $3 AND status = 'invited'
      `,
      [invite.ownerUserId, invite.userEntityId, invite.targetUserId],
    );
    return;
  }

  if (invite.status !== "invited" && invite.status !== "accepted") {
    throw new SharedInviteError("邀请已经结束", 409);
  }
  await client.query(
    `
      UPDATE ${schema}.event_participant_account_invites
      SET status = 'revoked', responded_at = now(), updated_at = now()
      WHERE id = $1
    `,
    [invite.id],
  );
  await client.query(
    `
      UPDATE ${schema}.event_participants
      SET account_user_id = NULL, identity_confirmed = false,
          attributes = attributes - 'identitySource'
      WHERE id = $1 AND account_user_id = $2
    `,
    [invite.eventParticipantId, invite.targetUserId],
  );
  await client.query(
    `
      UPDATE ${schema}.occurrence_memberships membership
      SET membership_status = CASE WHEN $2 = $3 THEN 'left' ELSE 'removed' END,
          responded_at = now()
      FROM ${schema}.event_occurrence_links link
      WHERE link.event_id = $1 AND link.occurrence_id = membership.occurrence_id
        AND membership.user_id = $2 AND link.link_status = 'active'
    `,
    [invite.eventId, invite.targetUserId, actorUserId],
  );
  await client.query(
    `
      UPDATE ${schema}.person_account_links link
      SET status = 'revoked'
      WHERE link.owner_user_id = $1 AND link.person_entity_id = $2
        AND link.linked_account_user_id = $3
        AND NOT EXISTS (
          SELECT 1
          FROM ${schema}.event_participant_account_invites other_invite
          JOIN ${schema}.event_participants other_ep ON other_ep.id = other_invite.event_participant_id
          WHERE other_invite.owner_user_id = $1
            AND other_ep.user_entity_id = $2
            AND other_invite.target_user_id = $3
            AND other_invite.status = 'accepted'
        )
    `,
    [invite.ownerUserId, invite.userEntityId, invite.targetUserId],
  );
  await refreshSocialProjectionsForUser(client, invite.ownerUserId);
  await refreshSocialProjectionsForUser(client, invite.targetUserId);
}

export async function getSharedOccurrences(client: PoolClient, userId: string) {
  const result = await client.query(
    `SELECT occurrence.id, occurrence.version, occurrence.status,
            CASE WHEN viewer_permissions->>'coarseTime' = 'true' THEN occurrence.occurred_start::date::text ELSE NULL END AS "occurredDate",
            json_build_object(
              'eventTitle', COALESCE((membership.shared_fact_permissions->>'eventTitle')::boolean, false),
              'entities', COALESCE((membership.shared_fact_permissions->>'entities')::boolean, false),
              'coarseTime', COALESCE((membership.shared_fact_permissions->>'coarseTime')::boolean, false),
              'coarseLocation', COALESCE((membership.shared_fact_permissions->>'coarseLocation')::boolean, false)
            ) AS "myPermissions",
            COALESCE((SELECT json_agg(json_build_object(
              'user', json_build_object('id', member_user.id, 'username', member_user.username, 'displayName', member_user.display_name),
              'permissions', member.shared_fact_permissions,
              'joinedAt', member.responded_at
            ) ORDER BY member.responded_at)
            FROM ${schema}.occurrence_memberships member
            JOIN ${schema}.users member_user ON member_user.id = member.user_id
            WHERE member.occurrence_id = occurrence.id AND member.membership_status = 'accepted'), '[]'::json) AS members,
            COALESCE((SELECT json_agg(json_build_object(
              'id', linked_event.id,
              'ownerUserId', link.owner_user_id,
              'title', CASE WHEN link.owner_user_id = $1 OR COALESCE((owner_membership.shared_fact_permissions->>'eventTitle')::boolean,false) THEN linked_event.title ELSE '共同经历事件' END,
              'eventType', linked_event.event_type,
              'occurredDate', CASE WHEN link.owner_user_id = $1 OR COALESCE((owner_membership.shared_fact_permissions->>'coarseTime')::boolean,false) THEN linked_event.occurred_start::date::text ELSE NULL END,
              'entities', CASE WHEN link.owner_user_id = $1 OR COALESCE((owner_membership.shared_fact_permissions->>'entities')::boolean,false) THEN COALESCE((
                 SELECT json_agg(json_build_object(
                   'canonicalEntityId', canonical.id,
                   'name', canonical.canonical_name,
                   'type', canonical.entity_type,
                   'role', relation.relation_role
                 ))
                 FROM ${schema}.event_entity_relations relation JOIN ${schema}.canonical_entities canonical ON canonical.id = relation.canonical_entity_id
                 WHERE relation.event_id = linked_event.id AND canonical.sensitivity = 'normal'
               ), '[]'::json) ELSE '[]'::json END
            ) ORDER BY linked_event.created_at)
            FROM ${schema}.event_occurrence_links link
            JOIN ${schema}.events linked_event ON linked_event.id = link.event_id AND linked_event.deleted_at IS NULL
            JOIN ${schema}.occurrence_memberships owner_membership ON owner_membership.occurrence_id = occurrence.id AND owner_membership.user_id = link.owner_user_id
            WHERE link.occurrence_id = occurrence.id AND link.link_status = 'active'), '[]'::json) AS events
     FROM ${schema}.shared_occurrences occurrence
     JOIN ${schema}.occurrence_memberships membership ON membership.occurrence_id = occurrence.id
       AND membership.user_id = $1 AND membership.membership_status = 'accepted'
     CROSS JOIN LATERAL (SELECT membership.shared_fact_permissions AS viewer_permissions) viewer
     WHERE occurrence.status = 'active' ORDER BY occurrence.updated_at DESC`,
    [userId],
  );
  return { occurrences: result.rows };
}

export async function updateOccurrencePermissions(
  client: PoolClient, userId: string, occurrenceId: string, permissions: SharedFactPermissions,
) {
  const result = await client.query(
    `UPDATE ${schema}.occurrence_memberships SET shared_fact_permissions = $3::jsonb
     WHERE occurrence_id = $1 AND user_id = $2 AND membership_status = 'accepted' RETURNING id`,
    [occurrenceId, userId, JSON.stringify(permissions)],
  );
  if (!result.rows[0]) throw new SharedInviteError("共同经历不存在", 404);
}
