import type { PoolClient } from "pg";
import { config, quoteIdentifier } from "../config";

const schema = quoteIdentifier(config.DB_SCHEMA);

export type GlobalGraphNode = {
  id: string;
  kind: "user" | "event" | "occurrence" | "entity" | "person" | "location" | "match";
  label: string;
  category: string;
  weight: number;
  metadata: Record<string, unknown>;
};

export type GlobalGraphEdge = {
  id: string;
  source: string;
  target: string;
  type: "participated" | "evidence" | "relationship";
  label: string;
  weight: number;
  evidenceEventIds: string[];
};

export type PublicWorldUser = {
  id: string;
  username: string;
  displayName: string;
  createdAt: string;
};

export type PublicWorldEvent = {
  id: string;
  ownerUserId: string;
  title: string;
  eventType: string;
  factualStatus: string;
  occurredStart: string | null;
  createdAt: string;
  entities: Array<{
    canonicalEntityId: string;
    name: string;
    type: string;
    role: string;
  }>;
};

export type PublicWorldCatalogEntity = {
  id: string;
  name: string;
  type: string;
  sourceKey: string;
};

function featureKind(entityType: string): GlobalGraphNode["kind"] {
  if (entityType === "place" || entityType === "geo_cell") return "location";
  if (entityType === "person") return "person";
  return "entity";
}

export function buildGlobalGraph(input: {
  viewerId: string;
  users: PublicWorldUser[];
  events: PublicWorldEvent[];
  catalogEntities?: PublicWorldCatalogEntity[];
}) {
  const nodes = new Map<string, GlobalGraphNode>();
  const evidenceEdges = new Map<string, GlobalGraphEdge>();
  const relationships = new Map<string, {
    source: string;
    target: string;
    labels: Set<string>;
    eventIds: Set<string>;
  }>();

  for (const user of input.users) {
    nodes.set(`user:${user.id}`, {
      id: `user:${user.id}`,
      kind: "user",
      label: user.displayName,
      category: user.id === input.viewerId ? "self" : "public_account",
      weight: 1,
      metadata: {
        userId: user.id,
        username: user.username,
        createdAt: user.createdAt,
        identityRevealed: true,
        publicProfile: true,
      },
    });
  }

  for (const event of input.events) {
    const ownerId = `user:${event.ownerUserId}`;
    if (!nodes.has(ownerId)) continue;
    const eventId = `event:${event.id}`;
    nodes.set(eventId, {
      id: eventId,
      kind: "event",
      label: event.title,
      category: event.eventType,
      weight: 1,
      metadata: {
        eventId: event.id,
        eventType: event.eventType,
        factualStatus: event.factualStatus,
        occurredStart: event.occurredStart,
        createdAt: event.createdAt,
        ownerUserId: event.ownerUserId,
        visibility: "public",
      },
    });
    const owner = nodes.get(ownerId)!;
    owner.weight += 1;
    evidenceEdges.set(`public-event-owner:${event.id}`, {
      id: `public-event-owner:${event.id}`,
      source: ownerId,
      target: eventId,
      type: "participated",
      label: "公开记录",
      weight: 1,
      evidenceEventIds: [event.id],
    });

    for (const entity of event.entities) {
      const featureId = `canonical:${entity.canonicalEntityId}`;
      const current = nodes.get(featureId);
      nodes.set(featureId, {
        id: featureId,
        kind: featureKind(entity.type),
        label: entity.name,
        category: entity.type,
        weight: (current?.weight ?? 0) + 1,
        metadata: {
          canonicalEntityId: entity.canonicalEntityId,
          entityType: entity.type,
          visibility: "public_projection",
        },
      });
      evidenceEdges.set(`public-event-entity:${event.id}:${entity.canonicalEntityId}:${entity.role}`, {
        id: `public-event-entity:${event.id}:${entity.canonicalEntityId}:${entity.role}`,
        source: eventId,
        target: featureId,
        type: "evidence",
        label: entity.role,
        weight: 1,
        evidenceEventIds: [event.id],
      });

      const relationshipKey = `${ownerId}:${featureId}`;
      const relationship = relationships.get(relationshipKey) ?? {
        source: ownerId,
        target: featureId,
        labels: new Set<string>(),
        eventIds: new Set<string>(),
      };
      relationship.labels.add(entity.role);
      relationship.eventIds.add(event.id);
      relationships.set(relationshipKey, relationship);
    }
  }

  for (const entity of input.catalogEntities ?? []) {
    const nodeId = `canonical:${entity.id}`;
    const current = nodes.get(nodeId);
    if (current) {
      nodes.set(nodeId, {
        ...current,
        metadata: {
          ...current.metadata,
          catalog: true,
          catalogSourceKey: entity.sourceKey,
        },
      });
      continue;
    }
    nodes.set(nodeId, {
      id: nodeId,
      kind: featureKind(entity.type),
      label: entity.name,
      category: entity.type,
      weight: 0,
      metadata: {
        canonicalEntityId: entity.id,
        entityType: entity.type,
        visibility: "catalog",
        catalog: true,
        catalogSourceKey: entity.sourceKey,
      },
    });
  }

  const values = [...nodes.values()];
  const relationshipEdges = [...relationships.entries()].map(([key, relationship]) => ({
    id: `public-relationship:${key}`,
    source: relationship.source,
    target: relationship.target,
    type: "relationship" as const,
    label: [...relationship.labels].sort().join(" / "),
    weight: relationship.eventIds.size,
    evidenceEventIds: [...relationship.eventIds],
  }));
  return {
    nodes: values,
    evidenceEdges: [...evidenceEdges.values()],
    relationshipEdges,
    stats: {
      events: input.events.length,
      entities: values.filter((node) => node.kind === "entity").length,
      people: values.filter((node) => node.kind === "person").length,
      locations: values.filter((node) => node.kind === "location").length,
      socialMatches: 0,
      users: input.users.length,
      occurrences: 0,
      sharedFeatures: values.filter((node) => ["entity", "person", "location"].includes(node.kind)).length,
      catalogEntities: values.filter((node) => node.metadata.catalog === true).length,
      connectedEntities: values.filter((node) => node.metadata.visibility === "public_projection").length,
    },
  };
}

export async function getPublicWorldGraph(
  client: PoolClient,
  viewer: { id: string },
) {
  const userResult = await client.query<PublicWorldUser>(
    `SELECT id, username, display_name AS "displayName", created_at AS "createdAt"
     FROM ${schema}.users
     WHERE status = 'active'
     ORDER BY created_at, id`,
  );
  const eventResult = await client.query<Omit<PublicWorldEvent, "entities">>(
    `SELECT projection.event_id AS id, projection.owner_user_id AS "ownerUserId",
            projection.title, projection.event_type AS "eventType",
            projection.factual_status AS "factualStatus",
            projection.occurred_day::text AS "occurredStart",
            projection.created_day::text AS "createdAt"
     FROM ${schema}.public_event_projections projection
     JOIN ${schema}.users owner ON owner.id=projection.owner_user_id AND owner.status='active'
     ORDER BY projection.occurred_day DESC NULLS LAST, projection.created_day DESC, projection.event_id`,
  );
  const catalogResult = await client.query<PublicWorldCatalogEntity>(
    `SELECT DISTINCT ON (canonical.id)
            canonical.id,canonical.canonical_name AS name,canonical.entity_type AS type,
            source.source_key AS "sourceKey"
     FROM ${schema}.canonical_entity_sources source
     JOIN ${schema}.canonical_entities canonical ON canonical.id=source.canonical_entity_id
     WHERE canonical.status='active' AND canonical.sensitivity='normal'
     ORDER BY canonical.id,source.source_key`,
  );

  const publicEvents: PublicWorldEvent[] = eventResult.rows.map((event) => ({ ...event, entities: [] }));

  if (publicEvents.length) {
    const entityResult = await client.query<{
      eventId: string;
      canonicalEntityId: string;
      name: string;
      type: string;
      role: string;
    }>(
      `SELECT edge.event_id AS "eventId", canonical.id AS "canonicalEntityId",
              canonical.canonical_name AS name, canonical.entity_type AS type,
              edge.relation_role AS role
       FROM ${schema}.public_event_entity_projections edge
       JOIN ${schema}.canonical_entities canonical ON canonical.id=edge.canonical_entity_id
       WHERE edge.event_id = ANY($1::uuid[])
       ORDER BY edge.event_id,canonical.entity_type,canonical.canonical_name,edge.relation_role`,
      [publicEvents.map((event) => event.id)],
    );
    const eventById = new Map(publicEvents.map((event) => [event.id, event]));
    for (const entity of entityResult.rows) {
      eventById.get(entity.eventId)?.entities.push(entity);
    }
  }

  return buildGlobalGraph({
    viewerId: viewer.id,
    users: userResult.rows,
    events: publicEvents,
    catalogEntities: catalogResult.rows,
  });
}
