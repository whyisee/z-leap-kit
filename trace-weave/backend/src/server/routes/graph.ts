import type { FastifyPluginAsync } from "fastify";
import { config, quoteIdentifier } from "../config";
import { pool } from "../db/pool";
import { withTransaction } from "../db/transaction";
import { authenticateRequest } from "../services/auth-service";
import { getSocialMatches } from "../services/social-service";
import { getPublicWorldGraph } from "../services/global-graph-service";

const schema = quoteIdentifier(config.DB_SCHEMA);

type GraphNode = {
  id: string;
  kind: "user" | "event" | "occurrence" | "entity" | "person" | "location" | "match";
  label: string;
  category: string;
  weight: number;
  metadata: Record<string, unknown>;
};

type GraphEdge = {
  id: string;
  source: string;
  target: string;
  type: "participated" | "evidence" | "relationship";
  label: string;
  weight: number;
  evidenceEventIds: string[];
};

export const graphRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", authenticateRequest);

  app.get("/api/graph/global", async (request) =>
    withTransaction((client) => getPublicWorldGraph(client, request.authUser)),
  );

  app.get("/api/graph", async (request) => {
    const ownerUserId = request.authUser.id;
    const rootId = `user:${ownerUserId}`;
    const [eventResult, socialMatches, occurrenceResult] = await Promise.all([
      pool.query<{
      id: string;
      title: string;
      eventType: string;
      occurredStart: string | null;
      createdAt: string;
      isOwned: boolean;
      }>(
      `
        SELECT
          e.id,
          e.title,
          e.event_type AS "eventType",
          CASE
            WHEN e.owner_user_id = $1 THEN e.occurred_start
            ELSE date_trunc('day', e.occurred_start)
          END AS "occurredStart",
          CASE
            WHEN e.owner_user_id = $1 THEN e.created_at
            ELSE date_trunc('day', e.created_at)
          END AS "createdAt",
          (e.owner_user_id = $1) AS "isOwned"
        FROM ${schema}.events e
        WHERE e.deleted_at IS NULL
          AND (
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
            )
          )
        ORDER BY e.occurred_start DESC NULLS LAST, e.created_at DESC
        LIMIT 150
      `,
      [ownerUserId],
      ),
      withTransaction((client) => getSocialMatches(client, ownerUserId)),
      pool.query<{
        id: string;
        occurredStart: string | null;
        memberCount: number;
        eventCount: number;
      }>(
        `SELECT occurrence.id,
                occurrence.occurred_start AS "occurredStart",
                count(DISTINCT member.user_id)::int AS "memberCount",
                count(DISTINCT link.event_id)::int AS "eventCount"
           FROM ${schema}.shared_occurrences occurrence
           JOIN ${schema}.occurrence_memberships viewer
             ON viewer.occurrence_id = occurrence.id AND viewer.user_id = $1
            AND viewer.membership_status = 'accepted'
           LEFT JOIN ${schema}.occurrence_memberships member
             ON member.occurrence_id = occurrence.id AND member.membership_status = 'accepted'
           LEFT JOIN ${schema}.event_occurrence_links link
             ON link.occurrence_id = occurrence.id AND link.link_status = 'active'
          WHERE occurrence.status = 'active'
          GROUP BY occurrence.id
          ORDER BY occurrence.updated_at DESC`,
        [ownerUserId],
      ),
    ]);

    const nodes = new Map<string, GraphNode>();
    const evidenceEdges: GraphEdge[] = [];
    const occurrenceEdges: GraphEdge[] = [];
    const aggregate = new Map<
      string,
      { target: string; labels: Set<string>; eventIds: Set<string>; category: string }
    >();
    nodes.set(rootId, {
      id: rootId,
      kind: "user",
      label: request.authUser.displayName,
      category: "self",
      weight: Math.max(1, eventResult.rows.length),
      metadata: { username: request.authUser.username },
    });

    for (const occurrence of occurrenceResult.rows) {
      const nodeId = `occurrence:${occurrence.id}`;
      nodes.set(nodeId, {
        id: nodeId,
        kind: "occurrence",
        label: occurrence.occurredStart
          ? `${new Date(occurrence.occurredStart).toLocaleDateString("zh-CN")} 的共同经历`
          : "共同经历",
        category: "shared_occurrence",
        weight: Math.max(1, occurrence.memberCount + occurrence.eventCount),
        metadata: {
          occurrenceId: occurrence.id,
          occurredDate: occurrence.occurredStart,
          memberCount: occurrence.memberCount,
          eventCount: occurrence.eventCount,
        },
      });
      occurrenceEdges.push({
        id: `occurrence-membership:${occurrence.id}`,
        source: rootId,
        target: nodeId,
        type: "relationship",
        label: "共同经历成员",
        weight: Math.max(1, occurrence.memberCount),
        evidenceEventIds: [],
      });
    }

    for (const event of eventResult.rows) {
      const nodeId = `event:${event.id}`;
      nodes.set(nodeId, {
        id: nodeId,
        kind: "event",
        label: event.title,
        category: event.eventType,
        weight: 1,
        metadata: {
          eventId: event.id,
          eventType: event.eventType,
          occurredStart: event.occurredStart,
          createdAt: event.createdAt,
          isOwned: event.isOwned,
        },
      });
      evidenceEdges.push({
        id: `participated:${event.id}`,
        source: rootId,
        target: nodeId,
        type: "participated",
        label: "参与事件",
        weight: 1,
        evidenceEventIds: [event.id],
      });
    }

    const eventIds = eventResult.rows.map((event) => event.id);
    const [entityResult, participantResult, locationResult, eventRelationResult] = await Promise.all([
      pool.query<{
        eventId: string;
        entityId: string;
        canonicalEntityId: string | null;
        name: string;
        entityType: string;
        role: string;
        isOwned: boolean;
      }>(
        `
          SELECT
            eer.event_id AS "eventId",
            ue.id AS "entityId",
            eer.canonical_entity_id AS "canonicalEntityId",
            CASE WHEN e.owner_user_id = $2 THEN ue.display_name ELSE ce.canonical_name END AS name,
            CASE WHEN e.owner_user_id = $2 THEN ue.entity_type ELSE ce.entity_type END AS "entityType",
            eer.relation_role AS role,
            (e.owner_user_id = $2) AS "isOwned"
          FROM ${schema}.event_entity_relations eer
          JOIN ${schema}.events e ON e.id = eer.event_id
          JOIN ${schema}.user_entities ue ON ue.id = eer.user_entity_id
          LEFT JOIN ${schema}.canonical_entities ce ON ce.id = eer.canonical_entity_id
          WHERE eer.event_id = ANY($1::uuid[]) AND ue.status = 'active'
            AND (e.owner_user_id = $2 OR (ce.id IS NOT NULL AND ce.sensitivity = 'normal'))
        `,
        [eventIds, ownerUserId],
      ),
      pool.query<{
        eventId: string;
        participantId: string;
        name: string;
        role: string;
        isAccount: boolean;
      }>(
        `
          SELECT
            ep.event_id AS "eventId",
            COALESCE(ep.account_user_id, ep.user_entity_id)::text AS "participantId",
            COALESCE(u.display_name, ue.display_name) AS name,
            ep.participant_role AS role,
            (ep.account_user_id IS NOT NULL) AS "isAccount"
          FROM ${schema}.event_participants ep
          JOIN ${schema}.events e ON e.id = ep.event_id
          LEFT JOIN ${schema}.users u ON u.id = ep.account_user_id
          LEFT JOIN ${schema}.user_entities ue ON ue.id = ep.user_entity_id
          WHERE ep.event_id = ANY($1::uuid[])
            AND (ep.account_user_id IS NULL OR ep.account_user_id <> $2)
            AND (e.owner_user_id = $2 OR (ep.account_user_id IS NOT NULL AND ep.identity_confirmed))
        `,
        [eventIds, ownerUserId],
      ),
      pool.query<{
        eventId: string;
        cell: string;
        label: string | null;
        role: string;
        latitude: number;
        longitude: number;
      }>(
        `
          SELECT
            ell.event_id AS "eventId",
            left(lo.exact_geohash, 7) AS cell,
            lo.user_label AS label,
            ell.location_role AS role,
            lo.latitude::double precision AS latitude,
            lo.longitude::double precision AS longitude
          FROM ${schema}.event_location_links ell
          JOIN ${schema}.events e ON e.id = ell.event_id
          JOIN ${schema}.location_observations lo ON lo.id = ell.location_observation_id
          WHERE ell.event_id = ANY($1::uuid[])
            AND e.owner_user_id = $2
            AND lo.deleted_at IS NULL
        `,
        [eventIds, ownerUserId],
      ),
      pool.query<{
        id: string;
        sourceEventId: string;
        targetEventId: string;
        relationType: string;
      }>(
        `SELECT relation.id,
                relation.source_event_id AS "sourceEventId",
                relation.target_event_id AS "targetEventId",
                relation.relation_type AS "relationType"
           FROM ${schema}.event_relations relation
          WHERE relation.owner_user_id = $2
            AND relation.source_event_id = ANY($1::uuid[])
            AND relation.target_event_id = ANY($1::uuid[])
          ORDER BY relation.created_at, relation.id`,
        [eventIds, ownerUserId],
      ),
    ]);

    const eventRelationLabels: Record<string, string> = {
      contains: "包含",
      before: "早于",
      after: "晚于",
      simultaneous: "同时发生",
      causes: "导致",
      interrupts: "中断",
      continues: "延续",
      references: "关联",
      repeats: "再次发生",
    };
    for (const relation of eventRelationResult.rows) {
      evidenceEdges.push({
        id: `event-relation:${relation.id}`,
        source: `event:${relation.sourceEventId}`,
        target: `event:${relation.targetEventId}`,
        type: "evidence",
        label: eventRelationLabels[relation.relationType] ?? relation.relationType,
        weight: 1,
        evidenceEventIds: [relation.sourceEventId, relation.targetEventId],
      });
    }

    const addEvidence = (input: {
      eventId: string;
      targetId: string;
      label: string;
      category: string;
    }) => {
      evidenceEdges.push({
        id: `evidence:${input.eventId}:${input.targetId}:${input.label}`,
        source: `event:${input.eventId}`,
        target: input.targetId,
        type: "evidence",
        label: input.label,
        weight: 1,
        evidenceEventIds: [input.eventId],
      });
      const key = `${input.targetId}`;
      const current = aggregate.get(key) ?? {
        target: input.targetId,
        labels: new Set<string>(),
        eventIds: new Set<string>(),
        category: input.category,
      };
      current.labels.add(input.label);
      current.eventIds.add(input.eventId);
      aggregate.set(key, current);
    };

    for (const entity of entityResult.rows) {
      const nodeId = entity.isOwned
        ? `entity:${entity.entityId}`
        : `canonical:${entity.canonicalEntityId}`;
      const existing = nodes.get(nodeId);
      nodes.set(nodeId, {
        id: nodeId,
        kind:
          entity.entityType === "person"
            ? "person"
            : entity.entityType === "place"
              ? "location"
              : "entity",
        label: entity.name,
        category: entity.entityType,
        weight: (existing?.weight ?? 0) + 1,
        metadata: {
          entityId: entity.isOwned ? entity.entityId : undefined,
          canonicalEntityId: entity.canonicalEntityId,
          entityType: entity.entityType,
          isOwned: entity.isOwned,
        },
      });
      addEvidence({
        eventId: entity.eventId,
        targetId: nodeId,
        label: entity.role,
        category: entity.entityType,
      });
    }

    for (const participant of participantResult.rows) {
      const nodeId = `${participant.isAccount ? "account" : "person"}:${participant.participantId}`;
      const existing = nodes.get(nodeId);
      nodes.set(nodeId, {
        id: nodeId,
        kind: "person",
        label: participant.name,
        category: participant.isAccount ? "account" : "person",
        weight: (existing?.weight ?? 0) + 1,
        metadata: { participantId: participant.participantId, isAccount: participant.isAccount },
      });
      addEvidence({
        eventId: participant.eventId,
        targetId: nodeId,
        label: participant.role,
        category: "person",
      });
    }

    for (const location of locationResult.rows) {
      const nodeId = `location:${location.cell}`;
      const existing = nodes.get(nodeId);
      nodes.set(nodeId, {
        id: nodeId,
        kind: "location",
        label: location.label || `位置 ${location.cell}`,
        category: "location",
        weight: (existing?.weight ?? 0) + 1,
        metadata: {
          cell: location.cell,
          latitude: location.latitude,
          longitude: location.longitude,
        },
      });
      addEvidence({
        eventId: location.eventId,
        targetId: nodeId,
        label: location.role,
        category: "location",
      });
    }

    const relationshipEdges: GraphEdge[] = [...aggregate.values()].map((relationship) => ({
      id: `relationship:${relationship.target}`,
      source: rootId,
      target: relationship.target,
      type: "relationship",
      label: [...relationship.labels].join(" / "),
      weight: relationship.eventIds.size,
      evidenceEventIds: [...relationship.eventIds],
    }));
    relationshipEdges.push(...occurrenceEdges);

    for (const match of socialMatches) {
      const nodeId = `match:${match.id}`;
      nodes.set(nodeId, {
        id: nodeId,
        kind: "match",
        label: match.otherUser?.displayName ?? match.anonymousLabel,
        category: match.status === "connected" ? "connected_account" : "anonymous_match",
        weight: Math.max(1, match.score / 20),
        metadata: {
          matchId: match.id,
          score: match.score,
          status: match.status,
          identityRevealed: match.identityRevealed,
          reasons: match.reasons,
        },
      });
      relationshipEdges.push({
        id: `social-relationship:${match.id}`,
        source: rootId,
        target: nodeId,
        type: "relationship",
        label: match.reasons.map((reason) => reason.label).join(" / ") || "匿名共同经历",
        weight: Math.max(1, match.reasons.length),
        evidenceEventIds: [],
      });
    }

    const values = [...nodes.values()];
    return {
      nodes: values,
      evidenceEdges,
      relationshipEdges,
      stats: {
        events: eventResult.rows.length,
        entities: values.filter((node) => node.kind === "entity").length,
        people: values.filter((node) => node.kind === "person").length,
        locations: values.filter((node) => node.kind === "location").length,
        socialMatches: values.filter((node) => node.kind === "match").length,
        occurrences: values.filter((node) => node.kind === "occurrence").length,
      },
    };
  });
};
