import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { config, quoteIdentifier } from "../config";
import { refreshSocialProjectionsForUser } from "./social-service";
import { resolveEventEntity } from "./entity-resolver";
import type { EventCandidatePayload } from "../domain/event-candidate";

const schema = quoteIdentifier(config.DB_SCHEMA);

export class EventLifecycleError extends Error {
  constructor(
    message: string,
    readonly statusCode: 404 | 409 = 409,
  ) {
    super(message);
    this.name = "EventLifecycleError";
  }
}

export type EventUpdateInput = {
  expectedVersion: number;
  title: string;
  eventType: string;
  factualStatus: "occurred" | "ongoing" | "planned" | "cancelled" | "negated" | "uncertain" | "inferred";
  occurredStart: string | null;
  occurredEnd: string | null;
  timePrecision: string;
  timezone: string | null;
  sourceTimeExpression: string | null;
};

export type EventRelationsInput = {
  expectedVersion: number;
  participants: Array<EventCandidatePayload["participants"][number] & { existingParticipantId?: string }>;
  entities: EventCandidatePayload["entities"];
  location: { observationId: string; role: "occurred_at" | "recorded_at" } | null;
};

async function loadEventSnapshot(client: PoolClient, eventId: string): Promise<Record<string, unknown>> {
  const result = await client.query<{ snapshot: Record<string, unknown> }>(
    `
      SELECT jsonb_build_object(
        'id', e.id,
        'version', e.version,
        'eventType', e.event_type,
        'title', e.title,
        'factualStatus', e.factual_status,
        'occurredStart', e.occurred_start,
        'occurredEnd', e.occurred_end,
        'timePrecision', e.time_precision,
        'timezone', e.timezone,
        'sourceTimeExpression', e.source_time_expression,
        'deletedAt', e.deleted_at,
        'participants', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', ep.id,
            'accountUserId', ep.account_user_id,
            'userEntityId', ep.user_entity_id,
            'role', ep.participant_role,
            'identityConfirmed', ep.identity_confirmed
          ) ORDER BY ep.created_at)
          FROM ${schema}.event_participants ep
          WHERE ep.event_id = e.id
        ), '[]'::jsonb),
        'entities', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', eer.id,
            'userEntityId', eer.user_entity_id,
            'canonicalEntityId', eer.canonical_entity_id,
            'role', eer.relation_role,
            'quantity', eer.quantity,
            'unit', eer.unit,
            'amount', eer.amount,
            'currency', eer.currency
          ) ORDER BY eer.created_at)
          FROM ${schema}.event_entity_relations eer
          WHERE eer.event_id = e.id
        ), '[]'::jsonb),
        'locations', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', ell.id,
            'observationId', ell.location_observation_id,
            'role', ell.location_role,
            'socialMatchEligible', ell.social_match_eligible
          ) ORDER BY ell.created_at)
          FROM ${schema}.event_location_links ell
          WHERE ell.event_id = e.id
        ), '[]'::jsonb),
        'eventRelations', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', relation.id,
            'sourceEventId', relation.source_event_id,
            'targetEventId', relation.target_event_id,
            'relationType', relation.relation_type,
            'direction', CASE WHEN relation.source_event_id = e.id THEN 'outgoing' ELSE 'incoming' END
          ) ORDER BY relation.created_at)
          FROM ${schema}.event_relations relation
          WHERE relation.source_event_id = e.id OR relation.target_event_id = e.id
        ), '[]'::jsonb)
      ) AS snapshot
      FROM ${schema}.events e
      WHERE e.id = $1
    `,
    [eventId],
  );
  return result.rows[0]?.snapshot ?? {};
}

function changedFields(
  current: {
    title: string;
    eventType: string;
    factualStatus: string;
    occurredStart: string | null;
    occurredEnd: string | null;
    timePrecision: string;
    timezone: string | null;
    sourceTimeExpression: string | null;
  },
  next: EventUpdateInput,
): string[] {
  const fields: Array<[string, unknown, unknown]> = [
    ["title", current.title, next.title],
    ["eventType", current.eventType, next.eventType],
    ["factualStatus", current.factualStatus, next.factualStatus],
    ["occurredStart", current.occurredStart, next.occurredStart],
    ["occurredEnd", current.occurredEnd, next.occurredEnd],
    ["timePrecision", current.timePrecision, next.timePrecision],
    ["timezone", current.timezone, next.timezone],
    ["sourceTimeExpression", current.sourceTimeExpression, next.sourceTimeExpression],
  ];
  const normalize = (value: unknown) => {
    if (value instanceof Date) return value.toISOString();
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) return date.toISOString();
    }
    return value;
  };
  return fields.filter(([, before, after]) => normalize(before) !== normalize(after)).map(([field]) => field);
}

async function refreshAffectedUsers(client: PoolClient, userIds: Iterable<string>): Promise<void> {
  for (const userId of [...new Set(userIds)].sort()) {
    await refreshSocialProjectionsForUser(client, userId);
  }
}

export async function getOwnedEventDetail(
  client: PoolClient,
  ownerUserId: string,
  eventId: string,
): Promise<{
  event: Record<string, unknown>;
  source: Record<string, unknown>;
  revisions: Array<{
    version: number;
    operation: "created" | "updated" | "deleted";
    changedFields: string[];
    createdAt: string;
    snapshot: Record<string, unknown>;
  }>;
}> {
  const exists = await client.query(
    `SELECT 1 FROM ${schema}.events WHERE id = $1 AND owner_user_id = $2 AND deleted_at IS NULL`,
    [eventId, ownerUserId],
  );
  if (!exists.rows[0]) throw new EventLifecycleError("事件不存在或已经删除", 404);
  const event = await loadEventSnapshot(client, eventId);
  const sourceResult = await client.query<{ source: Record<string, unknown> }>(
    `SELECT jsonb_build_object(
       'entryId', entry.id,
       'inputLocale', entry.input_locale,
       'clientTimezone', entry.client_timezone,
       'clientCreatedAt', entry.client_created_at,
       'createdAt', entry.created_at,
       'confirmedAt', entry.confirmed_at,
       'contents', COALESCE((
         SELECT jsonb_agg(jsonb_build_object(
           'id', content.id,
           'position', content.position,
           'kind', content.content_kind,
           'text', content.text_content,
           'transcript', transcript.transcript_text,
           'transcriptProvider', transcript.provider,
           'attachment', CASE WHEN media.id IS NULL THEN NULL ELSE jsonb_build_object(
             'id', media.id, 'kind', media.media_kind, 'filename', media.original_filename,
             'mimeType', media.mime_type, 'byteSize', media.byte_size,
             'durationMs', media.duration_ms, 'url', '/api/media/' || media.id
           ) END
         ) ORDER BY content.position)
         FROM ${schema}.raw_entry_contents content
         LEFT JOIN ${schema}.speech_transcripts transcript ON transcript.raw_entry_content_id = content.id
         LEFT JOIN ${schema}.media_attachments media ON media.id = content.media_attachment_id AND media.deleted_at IS NULL
         WHERE content.raw_entry_id = entry.id
       ), '[]'::jsonb)
     ) AS source
     FROM ${schema}.events event
     JOIN ${schema}.raw_entries entry ON entry.id = event.raw_entry_id
     WHERE event.id = $1 AND event.owner_user_id = $2`,
    [eventId, ownerUserId],
  );
  const revisions = await client.query<{
    version: number;
    operation: "created" | "updated" | "deleted";
    changedFields: string[];
    createdAt: string;
    snapshot: Record<string, unknown>;
  }>(
    `
      SELECT
        version,
        operation,
        changed_fields AS "changedFields",
        snapshot,
        created_at AS "createdAt"
      FROM ${schema}.event_revisions
      WHERE event_id = $1 AND owner_user_id = $2
      ORDER BY version DESC
    `,
    [eventId, ownerUserId],
  );
  return { event, source: sourceResult.rows[0]?.source ?? {}, revisions: revisions.rows };
}

export async function updateOwnedEvent(
  client: PoolClient,
  ownerUserId: string,
  eventId: string,
  input: EventUpdateInput,
): Promise<{ version: number; changedFields: string[] }> {
  const currentResult = await client.query<{
    version: number;
    title: string;
    eventType: string;
    factualStatus: string;
    occurredStart: string | null;
    occurredEnd: string | null;
    timePrecision: string;
    timezone: string | null;
    sourceTimeExpression: string | null;
  }>(
    `
      SELECT
        version,
        title,
        event_type AS "eventType",
        factual_status AS "factualStatus",
        occurred_start AS "occurredStart",
        occurred_end AS "occurredEnd",
        time_precision AS "timePrecision",
        timezone,
        source_time_expression AS "sourceTimeExpression"
      FROM ${schema}.events
      WHERE id = $1 AND owner_user_id = $2 AND deleted_at IS NULL
      FOR UPDATE
    `,
    [eventId, ownerUserId],
  );
  const current = currentResult.rows[0];
  if (!current) throw new EventLifecycleError("事件不存在或已经删除", 404);
  if (current.version !== input.expectedVersion) {
    throw new EventLifecycleError("这条事件已经在其他页面被修改，请刷新后重试", 409);
  }

  const fields = changedFields(current, input);
  if (!fields.length) return { version: current.version, changedFields: [] };

  const nextVersion = current.version + 1;
  await client.query(
    `
      UPDATE ${schema}.events
      SET title = $3,
          event_type = $4,
          factual_status = $5,
          occurred_start = $6::timestamptz,
          occurred_end = $7::timestamptz,
          time_precision = $8,
          timezone = $9,
          source_time_expression = $10,
          version = $11,
          updated_at = now()
      WHERE id = $1 AND owner_user_id = $2
    `,
    [
      eventId,
      ownerUserId,
      input.title,
      input.eventType,
      input.factualStatus,
      input.occurredStart,
      input.occurredEnd,
      input.timePrecision,
      input.timezone,
      input.sourceTimeExpression,
      nextVersion,
    ],
  );

  await client.query(
    `
      UPDATE ${schema}.shared_occurrences occurrence
      SET occurred_start = $2::timestamptz,
          occurred_end = $3::timestamptz,
          time_precision = $4,
          shared_facts = occurrence.shared_facts || jsonb_build_object(
            'eventType', $5::text,
            'title', $6::text
          ),
          version = occurrence.version + 1,
          updated_at = now()
      FROM ${schema}.event_occurrence_links link
      WHERE link.event_id = $1
        AND link.occurrence_id = occurrence.id
        AND link.link_status = 'active'
        AND occurrence.status = 'active'
    `,
    [eventId, input.occurredStart, input.occurredEnd, input.timePrecision, input.eventType, input.title],
  );

  const snapshot = await loadEventSnapshot(client, eventId);
  await client.query(
    `
      INSERT INTO ${schema}.event_revisions (
        id, event_id, owner_user_id, version, operation, snapshot, changed_fields
      ) VALUES ($1, $2, $3, $4, 'updated', $5::jsonb, $6::jsonb)
    `,
    [randomUUID(), eventId, ownerUserId, nextVersion, JSON.stringify(snapshot), JSON.stringify(fields)],
  );
  await client.query(
    `
      INSERT INTO ${schema}.user_feedback (
        id, owner_user_id, raw_entry_id, feedback_type, before_value, after_value
      )
      SELECT $1, $2, raw_entry_id, 'event_correction', $4::jsonb, $5::jsonb
      FROM ${schema}.events WHERE id = $3
    `,
    [randomUUID(), ownerUserId, eventId, JSON.stringify(current), JSON.stringify(input)],
  );
  await client.query(
    `
      INSERT INTO ${schema}.outbox_events (
        id, aggregate_type, aggregate_id, event_type, payload
      ) VALUES ($1, 'event', $2, 'event.updated', $3::jsonb)
    `,
    [randomUUID(), eventId, JSON.stringify({ eventId, ownerUserId, version: nextVersion, changedFields: fields })],
  );

  const memberResult = await client.query<{ userId: string }>(
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
  await refreshAffectedUsers(client, [ownerUserId, ...memberResult.rows.map((row) => row.userId)]);
  return { version: nextVersion, changedFields: fields };
}

export async function replaceOwnedEventRelations(
  client: PoolClient,
  ownerUserId: string,
  eventId: string,
  input: EventRelationsInput,
): Promise<{ version: number; changedFields: string[] }> {
  const eventResult = await client.query<{ version: number; rawEntryId: string }>(
    `SELECT version, raw_entry_id AS "rawEntryId" FROM ${schema}.events
     WHERE id = $1 AND owner_user_id = $2 AND deleted_at IS NULL FOR UPDATE`,
    [eventId, ownerUserId],
  );
  const event = eventResult.rows[0];
  if (!event) throw new EventLifecycleError("事件不存在或已经删除", 404);
  if (event.version !== input.expectedVersion) throw new EventLifecycleError("这条事件已经在其他页面被修改，请刷新后重试", 409);
  const before = await loadEventSnapshot(client, eventId);

  const currentParticipants = await client.query<{
    id: string; accountUserId: string | null; userEntityId: string | null;
  }>(`SELECT id, account_user_id AS "accountUserId", user_entity_id AS "userEntityId" FROM ${schema}.event_participants WHERE event_id = $1`, [eventId]);
  const currentById = new Map(currentParticipants.rows.map((row) => [row.id, row]));
  const preservedIds = new Set<string>();
  for (const participant of input.participants) {
    const current = participant.existingParticipantId ? currentById.get(participant.existingParticipantId) : undefined;
    const canPreserve = current && (
      (participant.isCurrentUser && current.accountUserId === ownerUserId) ||
      (!participant.isCurrentUser && participant.resolvedUserEntityId && current.userEntityId === participant.resolvedUserEntityId)
    );
    if (canPreserve) {
      preservedIds.add(current.id);
      await client.query(
        `UPDATE ${schema}.event_participants SET participant_role = $2,
           attributes = attributes || jsonb_build_object('mention', $3::text, 'confidence', $4::numeric)
         WHERE id = $1`,
        [current.id, participant.role, participant.mention, participant.confidence ?? null],
      );
      continue;
    }
    if (participant.isCurrentUser) {
      await client.query(
        `INSERT INTO ${schema}.event_participants (id, event_id, account_user_id, participant_role, identity_confirmed, attributes)
         VALUES ($1, $2, $3, $4, true, $5::jsonb)`,
        [randomUUID(), eventId, ownerUserId, participant.role, JSON.stringify({ mention: participant.mention, confidence: participant.confidence })],
      );
    } else {
      const resolved = await resolveEventEntity(client, ownerUserId, {
        mention: participant.mention, entityType: "person", role: participant.role,
        confidence: participant.confidence, attributes: {}, resolvedUserEntityId: participant.resolvedUserEntityId,
      });
      await client.query(
        `INSERT INTO ${schema}.event_participants (id, event_id, user_entity_id, participant_role, identity_confirmed, attributes)
         VALUES ($1, $2, $3, $4, false, $5::jsonb)`,
        [randomUUID(), eventId, resolved.userEntityId, participant.role, JSON.stringify({ mention: participant.mention, confidence: participant.confidence })],
      );
    }
  }
  const removedParticipantIds = currentParticipants.rows.map((row) => row.id).filter((id) => !preservedIds.has(id));
  if (removedParticipantIds.length) {
    await client.query(
      `UPDATE ${schema}.event_participant_account_invites SET status = 'revoked', responded_at = now(), updated_at = now()
       WHERE event_participant_id = ANY($1::uuid[]) AND status IN ('invited', 'accepted')`,
      [removedParticipantIds],
    );
    await client.query(`DELETE FROM ${schema}.event_participants WHERE id = ANY($1::uuid[])`, [removedParticipantIds]);
  }

  await client.query(`DELETE FROM ${schema}.event_entity_relations WHERE event_id = $1`, [eventId]);
  for (const entity of input.entities) {
    const resolved = await resolveEventEntity(client, ownerUserId, entity);
    await client.query(
      `INSERT INTO ${schema}.event_entity_relations (
         id, event_id, user_entity_id, canonical_entity_id, relation_role, quantity, unit, amount, currency, confidence, attributes
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)`,
      [randomUUID(), eventId, resolved.userEntityId, resolved.canonicalEntityId, entity.role,
        entity.quantity ?? null, entity.unit ?? null, entity.amount ?? null, entity.currency ?? null,
        entity.confidence ?? null, JSON.stringify(entity.attributes)],
    );
  }

  await client.query(`DELETE FROM ${schema}.event_location_links WHERE event_id = $1`, [eventId]);
  if (input.location) {
    const locationResult = await client.query<{ matchEligible: boolean; sensitivity: string }>(
      `SELECT match_eligible AS "matchEligible", sensitivity FROM ${schema}.location_observations
       WHERE id = $1 AND raw_entry_id = $2 AND owner_user_id = $3 AND deleted_at IS NULL`,
      [input.location.observationId, event.rawEntryId, ownerUserId],
    );
    const location = locationResult.rows[0];
    if (!location) throw new EventLifecycleError("事件定位来源不存在", 409);
    await client.query(
      `INSERT INTO ${schema}.event_location_links (
         id, event_id, location_observation_id, location_role, user_confirmed, social_match_eligible, attributes
       ) VALUES ($1,$2,$3,$4,true,$5,'{"source":"event_correction"}'::jsonb)`,
      [randomUUID(), eventId, input.location.observationId, input.location.role,
        input.location.role === "occurred_at" && location.matchEligible && location.sensitivity === "normal"],
    );
  }

  const nextVersion = event.version + 1;
  await client.query(`UPDATE ${schema}.events SET version = $2, updated_at = now() WHERE id = $1`, [eventId, nextVersion]);
  const after = await loadEventSnapshot(client, eventId);
  await client.query(
    `INSERT INTO ${schema}.event_revisions (id,event_id,owner_user_id,version,operation,snapshot,changed_fields)
     VALUES ($1,$2,$3,$4,'updated',$5::jsonb,'["participants","entities","locations"]'::jsonb)`,
    [randomUUID(), eventId, ownerUserId, nextVersion, JSON.stringify(after)],
  );
  await client.query(
    `INSERT INTO ${schema}.user_feedback (id,owner_user_id,raw_entry_id,feedback_type,before_value,after_value)
     VALUES ($1,$2,$3,'event_relation_correction',$4::jsonb,$5::jsonb)`,
    [randomUUID(), ownerUserId, event.rawEntryId, JSON.stringify(before), JSON.stringify(after)],
  );
  await client.query(
    `INSERT INTO ${schema}.outbox_events (id,aggregate_type,aggregate_id,event_type,payload)
     VALUES ($1,'event',$2,'event.updated',$3::jsonb)`,
    [randomUUID(), eventId, JSON.stringify({ eventId, ownerUserId, version: nextVersion, changedFields: ["participants", "entities", "locations"] })],
  );
  await refreshSocialProjectionsForUser(client, ownerUserId);
  return { version: nextVersion, changedFields: ["participants", "entities", "locations"] };
}

type GraphEventMutationResult = {
  changed: boolean;
  eventIds: string[];
  versions: Record<string, number>;
  undo?: { type: "event_participant" | "event_entity" | "event_location" | "event_relation"; payload: Record<string, unknown> };
};

async function lockOwnedGraphEvents(
  client: PoolClient,
  ownerUserId: string,
  eventIds: string[],
): Promise<Array<{ id: string; version: number; rawEntryId: string }>> {
  const uniqueIds = [...new Set(eventIds)].sort();
  const result = await client.query<{ id: string; version: number; rawEntryId: string }>(
    `SELECT id, version, raw_entry_id AS "rawEntryId"
       FROM ${schema}.events
      WHERE id = ANY($1::uuid[]) AND owner_user_id = $2 AND deleted_at IS NULL
      ORDER BY id
      FOR UPDATE`,
    [uniqueIds, ownerUserId],
  );
  if (result.rows.length !== uniqueIds.length) {
    throw new EventLifecycleError("只能修改属于你的有效事件", 404);
  }
  return result.rows;
}

async function finishGraphEventMutation(
  client: PoolClient,
  ownerUserId: string,
  events: Array<{ id: string; version: number; rawEntryId: string }>,
  before: Map<string, Record<string, unknown>>,
  changedFields: string[],
  operation: string,
): Promise<GraphEventMutationResult> {
  const versions: Record<string, number> = {};
  for (const event of events) {
    const nextVersion = event.version + 1;
    versions[event.id] = nextVersion;
    await client.query(
      `UPDATE ${schema}.events SET version = $2, updated_at = now() WHERE id = $1`,
      [event.id, nextVersion],
    );
    const after = await loadEventSnapshot(client, event.id);
    await client.query(
      `INSERT INTO ${schema}.event_revisions
         (id,event_id,owner_user_id,version,operation,snapshot,changed_fields)
       VALUES ($1,$2,$3,$4,'updated',$5::jsonb,$6::jsonb)`,
      [randomUUID(), event.id, ownerUserId, nextVersion, JSON.stringify(after), JSON.stringify(changedFields)],
    );
    await client.query(
      `INSERT INTO ${schema}.user_feedback
         (id,owner_user_id,raw_entry_id,feedback_type,before_value,after_value)
       VALUES ($1,$2,$3,'event_relation_correction',$4::jsonb,$5::jsonb)`,
      [randomUUID(), ownerUserId, event.rawEntryId, JSON.stringify(before.get(event.id) ?? {}), JSON.stringify(after)],
    );
    await client.query(
      `INSERT INTO ${schema}.outbox_events
         (id,aggregate_type,aggregate_id,event_type,payload)
       VALUES ($1,'event',$2,'event.updated',$3::jsonb)`,
      [randomUUID(), event.id, JSON.stringify({
        eventId: event.id,
        ownerUserId,
        version: nextVersion,
        changedFields,
        source: "graph_interaction",
        operation,
      })],
    );
  }
  await refreshSocialProjectionsForUser(client, ownerUserId);
  return { changed: true, eventIds: events.map((event) => event.id), versions };
}

export async function addGraphParticipantToOwnedEvent(
  client: PoolClient,
  ownerUserId: string,
  eventId: string,
  participant: { accountUserId?: string; userEntityId?: string; role: string; label: string },
): Promise<GraphEventMutationResult> {
  const events = await lockOwnedGraphEvents(client, ownerUserId, [eventId]);
  const event = events[0];
  const before = new Map([[eventId, await loadEventSnapshot(client, eventId)]]);
  if (participant.accountUserId) {
    const account = await client.query(
      `SELECT 1 FROM ${schema}.users WHERE id = $1 AND status = 'active'`,
      [participant.accountUserId],
    );
    if (!account.rows[0]) throw new EventLifecycleError("参与者账号已经不可用", 404);
  } else if (participant.userEntityId) {
    const entity = await client.query(
      `SELECT 1 FROM ${schema}.user_entities
        WHERE id = $1 AND owner_user_id = $2 AND entity_type = 'person' AND status = 'active'`,
      [participant.userEntityId, ownerUserId],
    );
    if (!entity.rows[0]) throw new EventLifecycleError("人物实体已经不可用", 404);
  } else {
    throw new EventLifecycleError("缺少参与者身份");
  }
  const existing = await client.query(
    `SELECT 1 FROM ${schema}.event_participants
      WHERE event_id = $1
        AND (($2::uuid IS NOT NULL AND account_user_id = $2)
          OR ($3::uuid IS NOT NULL AND user_entity_id = $3))
        AND participant_role = $4
      LIMIT 1`,
    [eventId, participant.accountUserId ?? null, participant.userEntityId ?? null, participant.role],
  );
  if (existing.rows[0]) return { changed: false, eventIds: [eventId], versions: { [eventId]: event.version } };
  const participantId = randomUUID();
  await client.query(
    `INSERT INTO ${schema}.event_participants
       (id,event_id,account_user_id,user_entity_id,participant_role,identity_confirmed,attributes)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
    [participantId, eventId, participant.accountUserId ?? null, participant.userEntityId ?? null,
      participant.role, false, JSON.stringify({
        mention: participant.label,
        source: "graph_interaction",
        identitySource: participant.accountUserId ? "owner_asserted_unconfirmed" : "private_person_entity",
      })],
  );
  return {
    ...await finishGraphEventMutation(client, ownerUserId, events, before, ["participants"], "add_participant"),
    undo: { type: "event_participant", payload: { participantId, eventId } },
  };
}

export async function addGraphEntityToOwnedEvent(
  client: PoolClient,
  ownerUserId: string,
  eventId: string,
  input: { userEntityId?: string; canonicalEntityId?: string; role: string },
): Promise<GraphEventMutationResult> {
  const events = await lockOwnedGraphEvents(client, ownerUserId, [eventId]);
  const event = events[0];
  const before = new Map([[eventId, await loadEventSnapshot(client, eventId)]]);
  let userEntityId: string;
  let canonicalEntityId: string | null;
  if (input.userEntityId) {
    const entityResult = await client.query<{ canonicalEntityId: string | null }>(
      `SELECT canonical_entity_id AS "canonicalEntityId"
         FROM ${schema}.user_entities
        WHERE id = $1 AND owner_user_id = $2 AND status = 'active'`,
      [input.userEntityId, ownerUserId],
    );
    const entity = entityResult.rows[0];
    if (!entity) throw new EventLifecycleError("实体已经不可用", 404);
    userEntityId = input.userEntityId;
    canonicalEntityId = entity.canonicalEntityId;
  } else if (input.canonicalEntityId) {
    const canonicalResult = await client.query<{ name: string; entityType: string }>(
      `SELECT canonical_name AS name, entity_type AS "entityType"
         FROM ${schema}.canonical_entities
        WHERE id = $1 AND status = 'active' AND sensitivity = 'normal'`,
      [input.canonicalEntityId],
    );
    const canonical = canonicalResult.rows[0];
    if (!canonical) throw new EventLifecycleError("公共实体已经不可用", 404);
    const resolved = await resolveEventEntity(client, ownerUserId, {
      mention: canonical.name,
      entityType: canonical.entityType,
      role: input.role,
      confidence: 1,
      attributes: { source: "graph_interaction", canonicalEntityId: input.canonicalEntityId },
    });
    userEntityId = resolved.userEntityId;
    canonicalEntityId = resolved.canonicalEntityId;
  } else {
    throw new EventLifecycleError("缺少可关联的实体");
  }
  const existing = await client.query(
    `SELECT 1 FROM ${schema}.event_entity_relations
      WHERE event_id = $1 AND user_entity_id = $2 AND relation_role = $3 LIMIT 1`,
    [eventId, userEntityId, input.role],
  );
  if (existing.rows[0]) return { changed: false, eventIds: [eventId], versions: { [eventId]: event.version } };
  const relationId = randomUUID();
  await client.query(
    `INSERT INTO ${schema}.event_entity_relations
       (id,event_id,user_entity_id,canonical_entity_id,relation_role,confidence,attributes)
     VALUES ($1,$2,$3,$4,$5,1,'{"source":"graph_interaction"}'::jsonb)`,
    [relationId, eventId, userEntityId, canonicalEntityId, input.role],
  );
  return {
    ...await finishGraphEventMutation(client, ownerUserId, events, before, ["entities"], "add_entity"),
    undo: { type: "event_entity", payload: { relationId, eventId } },
  };
}

export async function addGraphLocationToOwnedEvent(
  client: PoolClient,
  ownerUserId: string,
  eventId: string,
  input: { geohashCell: string; role: "occurred_at" | "recorded_at" },
): Promise<GraphEventMutationResult> {
  const events = await lockOwnedGraphEvents(client, ownerUserId, [eventId]);
  const event = events[0];
  const before = new Map([[eventId, await loadEventSnapshot(client, eventId)]]);
  const locationResult = await client.query<{ id: string; matchEligible: boolean; sensitivity: string }>(
    `SELECT id, match_eligible AS "matchEligible", sensitivity
       FROM ${schema}.location_observations
      WHERE owner_user_id = $1 AND deleted_at IS NULL AND left(exact_geohash, 7) = $2
      ORDER BY captured_at DESC LIMIT 1`,
    [ownerUserId, input.geohashCell],
  );
  const location = locationResult.rows[0];
  if (!location) throw new EventLifecycleError("地点定位来源已经不可用", 404);
  const existing = await client.query(
    `SELECT 1 FROM ${schema}.event_location_links link
       JOIN ${schema}.location_observations observation ON observation.id = link.location_observation_id
      WHERE link.event_id = $1 AND link.location_role = $2
        AND left(observation.exact_geohash, 7) = $3 LIMIT 1`,
    [eventId, input.role, input.geohashCell],
  );
  if (existing.rows[0]) return { changed: false, eventIds: [eventId], versions: { [eventId]: event.version } };
  const locationLinkId = randomUUID();
  await client.query(
    `INSERT INTO ${schema}.event_location_links
       (id,event_id,location_observation_id,location_role,user_confirmed,social_match_eligible,attributes)
     VALUES ($1,$2,$3,$4,true,$5,'{"source":"graph_interaction"}'::jsonb)`,
    [locationLinkId, eventId, location.id, input.role,
      input.role === "occurred_at" && location.matchEligible && location.sensitivity === "normal"],
  );
  return {
    ...await finishGraphEventMutation(client, ownerUserId, events, before, ["locations"], "add_location"),
    undo: { type: "event_location", payload: { locationLinkId, eventId } },
  };
}

export async function relateOwnedEventsFromGraph(
  client: PoolClient,
  ownerUserId: string,
  sourceEventId: string,
  targetEventId: string,
  relationType: "contains" | "before" | "after" | "simultaneous" | "causes" | "interrupts" | "continues" | "references" | "repeats",
): Promise<GraphEventMutationResult> {
  if (sourceEventId === targetEventId) throw new EventLifecycleError("不能把事件关联到自身");
  const events = await lockOwnedGraphEvents(client, ownerUserId, [sourceEventId, targetEventId]);
  const before = new Map<string, Record<string, unknown>>();
  for (const event of events) before.set(event.id, await loadEventSnapshot(client, event.id));
  const existing = await client.query(
    `SELECT 1 FROM ${schema}.event_relations
      WHERE source_event_id = $1 AND target_event_id = $2 AND relation_type = $3 LIMIT 1`,
    [sourceEventId, targetEventId, relationType],
  );
  if (existing.rows[0]) {
    return {
      changed: false,
      eventIds: events.map((event) => event.id),
      versions: Object.fromEntries(events.map((event) => [event.id, event.version])),
    };
  }
  const eventRelationId = randomUUID();
  await client.query(
    `INSERT INTO ${schema}.event_relations
       (id,owner_user_id,source_event_id,target_event_id,relation_type,attributes)
     VALUES ($1,$2,$3,$4,$5,'{"source":"graph_interaction"}'::jsonb)`,
    [eventRelationId, ownerUserId, sourceEventId, targetEventId, relationType],
  );
  return {
    ...await finishGraphEventMutation(client, ownerUserId, events, before, ["eventRelations"], `relate_${relationType}`),
    undo: { type: "event_relation", payload: { eventRelationId, eventIds: [sourceEventId, targetEventId] } },
  };
}

export async function undoGraphEventMutation(
  client: PoolClient,
  ownerUserId: string,
  undo: { type: "event_participant" | "event_entity" | "event_location" | "event_relation"; payload: Record<string, unknown> },
): Promise<GraphEventMutationResult> {
  const eventIds = undo.type === "event_relation"
    ? (Array.isArray(undo.payload.eventIds) ? undo.payload.eventIds.filter((id): id is string => typeof id === "string") : [])
    : typeof undo.payload.eventId === "string" ? [undo.payload.eventId] : [];
  if (!eventIds.length) throw new EventLifecycleError("撤销信息不完整");
  const events = await lockOwnedGraphEvents(client, ownerUserId, eventIds);
  const before = new Map<string, Record<string, unknown>>();
  for (const event of events) before.set(event.id, await loadEventSnapshot(client, event.id));
  let removed = 0;
  if (undo.type === "event_participant" && typeof undo.payload.participantId === "string") {
    const result = await client.query(
      `DELETE FROM ${schema}.event_participants participant
        USING ${schema}.events event
       WHERE participant.id = $1 AND participant.event_id = event.id AND event.owner_user_id = $2`,
      [undo.payload.participantId, ownerUserId],
    );
    removed = result.rowCount ?? 0;
  } else if (undo.type === "event_entity" && typeof undo.payload.relationId === "string") {
    const result = await client.query(
      `DELETE FROM ${schema}.event_entity_relations relation
        USING ${schema}.events event
       WHERE relation.id = $1 AND relation.event_id = event.id AND event.owner_user_id = $2`,
      [undo.payload.relationId, ownerUserId],
    );
    removed = result.rowCount ?? 0;
  } else if (undo.type === "event_location" && typeof undo.payload.locationLinkId === "string") {
    const result = await client.query(
      `DELETE FROM ${schema}.event_location_links link
        USING ${schema}.events event
       WHERE link.id = $1 AND link.event_id = event.id AND event.owner_user_id = $2`,
      [undo.payload.locationLinkId, ownerUserId],
    );
    removed = result.rowCount ?? 0;
  } else if (undo.type === "event_relation" && typeof undo.payload.eventRelationId === "string") {
    const result = await client.query(
      `DELETE FROM ${schema}.event_relations WHERE id = $1 AND owner_user_id = $2`,
      [undo.payload.eventRelationId, ownerUserId],
    );
    removed = result.rowCount ?? 0;
  }
  if (!removed) throw new EventLifecycleError("相关内容已经变化，不能再撤销", 409);
  return finishGraphEventMutation(client, ownerUserId, events, before, [
    undo.type === "event_participant" ? "participants"
      : undo.type === "event_entity" ? "entities"
        : undo.type === "event_location" ? "locations"
          : "eventRelations",
  ], `undo_${undo.type}`);
}

export async function deleteOwnedEvent(
  client: PoolClient,
  ownerUserId: string,
  eventId: string,
  expectedVersion: number,
): Promise<{ deletedMediaStorageKeys: string[]; affectedUserIds: string[] }> {
  const currentResult = await client.query<{ version: number; rawEntryId: string }>(
    `
      SELECT version, raw_entry_id AS "rawEntryId"
      FROM ${schema}.events
      WHERE id = $1 AND owner_user_id = $2 AND deleted_at IS NULL
      FOR UPDATE
    `,
    [eventId, ownerUserId],
  );
  const current = currentResult.rows[0];
  if (!current) throw new EventLifecycleError("事件不存在或已经删除", 404);
  if (current.version !== expectedVersion) {
    throw new EventLifecycleError("这条事件已经在其他页面被修改，请刷新后重试", 409);
  }

  const targetResult = await client.query<{ userId: string }>(
    `
      SELECT DISTINCT invite.target_user_id AS "userId"
      FROM ${schema}.event_participant_account_invites invite
      JOIN ${schema}.event_participants participant
        ON participant.id = invite.event_participant_id
      WHERE participant.event_id = $1
        AND invite.status IN ('invited', 'accepted')
    `,
    [eventId],
  );
  const occurrenceResult = await client.query<{ occurrenceId: string; userId: string | null }>(
    `
      SELECT link.occurrence_id AS "occurrenceId", membership.user_id AS "userId"
      FROM ${schema}.event_occurrence_links link
      LEFT JOIN ${schema}.occurrence_memberships membership
        ON membership.occurrence_id = link.occurrence_id
        AND membership.membership_status = 'accepted'
      WHERE link.event_id = $1 AND link.link_status = 'active'
    `,
    [eventId],
  );
  const affectedUserIds = [
    ownerUserId,
    ...targetResult.rows.map((row) => row.userId),
    ...occurrenceResult.rows.flatMap((row) => (row.userId ? [row.userId] : [])),
  ];

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
  const occurrenceIds = [...new Set(occurrenceResult.rows.map((row) => row.occurrenceId))];
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

  const nextVersion = current.version + 1;
  await client.query(
    `
      UPDATE ${schema}.events
      SET deleted_at = now(), updated_at = now(), version = $3
      WHERE id = $1 AND owner_user_id = $2
    `,
    [eventId, ownerUserId, nextVersion],
  );
  const snapshot = await loadEventSnapshot(client, eventId);
  await client.query(
    `
      INSERT INTO ${schema}.event_revisions (
        id, event_id, owner_user_id, version, operation, snapshot, changed_fields
      ) VALUES ($1, $2, $3, $4, 'deleted', $5::jsonb, '["deletedAt"]'::jsonb)
    `,
    [randomUUID(), eventId, ownerUserId, nextVersion, JSON.stringify(snapshot)],
  );
  await client.query(
    `
      INSERT INTO ${schema}.outbox_events (
        id, aggregate_type, aggregate_id, event_type, payload
      ) VALUES ($1, 'event', $2, 'event.deleted', $3::jsonb)
    `,
    [randomUUID(), eventId, JSON.stringify({ eventId, ownerUserId, version: nextVersion })],
  );
  await client.query(
    `
      UPDATE ${schema}.privacy_policies
      SET revoked_at = now(), updated_at = now(), version = version + 1
      WHERE owner_user_id = $1
        AND policy_level = 'event'
        AND subject_key = $2
        AND revoked_at IS NULL
    `,
    [ownerUserId, eventId],
  );

  let deletedMediaStorageKeys: string[] = [];
  const activeSiblingResult = await client.query<{ count: string }>(
    `
      SELECT count(*)::text AS count
      FROM ${schema}.events
      WHERE raw_entry_id = $1 AND deleted_at IS NULL
    `,
    [current.rawEntryId],
  );
  if (Number(activeSiblingResult.rows[0]?.count ?? 0) === 0) {
    await client.query(
      `
        UPDATE ${schema}.raw_entries
        SET status = 'deleted', deleted_at = now(), updated_at = now(), version = version + 1
        WHERE id = $1 AND deleted_at IS NULL
      `,
      [current.rawEntryId],
    );
    const mediaResult = await client.query<{ storageKey: string }>(
      `
        UPDATE ${schema}.media_attachments
        SET deleted_at = now()
        WHERE raw_entry_id = $1 AND deleted_at IS NULL
        RETURNING storage_key AS "storageKey"
      `,
      [current.rawEntryId],
    );
    deletedMediaStorageKeys = mediaResult.rows.map((row) => row.storageKey);
    await client.query(
      `
        UPDATE ${schema}.location_observations
        SET deleted_at = now(), updated_at = now(), match_eligible = false, social_cell = NULL
        WHERE raw_entry_id = $1 AND deleted_at IS NULL
      `,
      [current.rawEntryId],
    );
    await client.query(
      `
        UPDATE ${schema}.notifications
        SET status = 'dismissed', updated_at = now()
        WHERE owner_user_id = $1
          AND resource_type = 'raw_entry'
          AND resource_id = $2
          AND status IN ('pending', 'delivered', 'read')
      `,
      [ownerUserId, current.rawEntryId],
    );
  }

  await refreshAffectedUsers(client, affectedUserIds);
  return { deletedMediaStorageKeys, affectedUserIds: [...new Set(affectedUserIds)] };
}
