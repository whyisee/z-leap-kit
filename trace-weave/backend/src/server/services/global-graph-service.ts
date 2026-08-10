import type { SocialMatchView } from "./social-service";

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

type SharedOccurrenceView = {
  id: string;
  occurredDate: string | null;
  members: Array<{
    user: { id: string; username: string; displayName: string };
    permissions: Record<string, boolean>;
  }>;
  events: Array<{
    id: string;
    ownerUserId: string;
    title: string;
    eventType: string;
    entities: Array<{
      canonicalEntityId?: string;
      name: string;
      type: string;
      role: string;
    }>;
  }>;
};

function featureKind(entityType: string): GlobalGraphNode["kind"] {
  if (entityType === "place" || entityType === "geo_cell") return "location";
  if (entityType === "person") return "person";
  return "entity";
}

function cleanFeatureLabel(label: string): string {
  return label.replace(/^共同地点：/, "").replace(/^共同/, "");
}

export function buildGlobalGraph(input: {
  viewer: { id: string; username: string; displayName: string };
  matches: SocialMatchView[];
  occurrences: SharedOccurrenceView[];
}) {
  const rootId = `user:${input.viewer.id}`;
  const nodes = new Map<string, GlobalGraphNode>();
  const edges = new Map<string, GlobalGraphEdge>();
  const evidenceEdges = new Map<string, GlobalGraphEdge>();
  const addEdge = (edge: GlobalGraphEdge) => {
    const existing = edges.get(edge.id);
    if (!existing) {
      edges.set(edge.id, edge);
      return;
    }
    existing.weight += edge.weight;
    existing.evidenceEventIds = [...new Set([...existing.evidenceEventIds, ...edge.evidenceEventIds])];
  };
  const addFeature = (canonicalEntityId: string, label: string, entityType: string) => {
    const id = `canonical:${canonicalEntityId}`;
    const current = nodes.get(id);
    nodes.set(id, {
      id,
      kind: featureKind(entityType),
      label: cleanFeatureLabel(label),
      category: entityType,
      weight: (current?.weight ?? 0) + 1,
      metadata: { canonicalEntityId, entityType, privacy: "authorized_projection" },
    });
    return id;
  };
  const addEvidenceEdge = (edge: GlobalGraphEdge) => {
    const existing = evidenceEdges.get(edge.id);
    if (!existing) {
      evidenceEdges.set(edge.id, edge);
      return;
    }
    existing.weight += edge.weight;
    existing.evidenceEventIds = [...new Set([...existing.evidenceEventIds, ...edge.evidenceEventIds])];
  };

  nodes.set(rootId, {
    id: rootId,
    kind: "user",
    label: input.viewer.displayName,
    category: "self",
    weight: Math.max(1, input.matches.length + input.occurrences.length),
    metadata: { username: input.viewer.username, identityRevealed: true },
  });

  for (const match of input.matches) {
    const otherNodeId = match.otherUser ? `user:${match.otherUser.id}` : `match:${match.id}`;
    nodes.set(otherNodeId, {
      id: otherNodeId,
      kind: match.otherUser ? "user" : "match",
      label: match.otherUser?.displayName ?? match.anonymousLabel,
      category: match.otherUser ? "connected_account" : "anonymous_match",
      weight: Math.max(1, match.score / 20),
      metadata: match.otherUser
        ? { username: match.otherUser.username, identityRevealed: true, matchId: match.id, score: match.score }
        : { identityRevealed: false, matchId: match.id, score: match.score },
    });
    addEdge({
      id: `match:${match.id}`,
      source: rootId,
      target: otherNodeId,
      type: "relationship",
      label: match.status === "connected" ? "已建立联系" : `潜在关联 ${Math.round(match.score)}%`,
      weight: Math.max(1, match.score / 25),
      evidenceEventIds: [],
    });
    for (const reason of match.reasons) {
      const featureId = addFeature(reason.canonicalEntityId, reason.label, reason.entityType);
      addEdge({
        id: `viewer-feature:${reason.canonicalEntityId}:${reason.featureType}`,
        source: rootId,
        target: featureId,
        type: "relationship",
        label: reason.featureType,
        weight: reason.contribution,
        evidenceEventIds: [],
      });
      addEdge({
        id: `match-feature:${match.id}:${reason.canonicalEntityId}:${reason.featureType}`,
        source: otherNodeId,
        target: featureId,
        type: "relationship",
        label: reason.label,
        weight: reason.contribution,
        evidenceEventIds: [],
      });
    }
  }

  for (const occurrence of input.occurrences) {
    const occurrenceId = `occurrence:${occurrence.id}`;
    const firstTitle = occurrence.events[0]?.title;
    nodes.set(occurrenceId, {
      id: occurrenceId,
      kind: "occurrence",
      label: firstTitle ? `共同经历：${firstTitle}` : "共同经历",
      category: "shared_occurrence",
      weight: Math.max(1, occurrence.members.length),
      metadata: { occurrenceId: occurrence.id, occurredDate: occurrence.occurredDate },
    });
    for (const member of occurrence.members) {
      const memberId = `user:${member.user.id}`;
      if (!nodes.has(memberId)) {
        nodes.set(memberId, {
          id: memberId,
          kind: "user",
          label: member.user.displayName,
          category: member.user.id === input.viewer.id ? "self" : "shared_account",
          weight: 1,
          metadata: { username: member.user.username, identityRevealed: true },
        });
      }
      addEdge({
        id: `occurrence-member:${occurrence.id}:${member.user.id}`,
        source: memberId,
        target: occurrenceId,
        type: "participated",
        label: "共同参与",
        weight: 1,
        evidenceEventIds: [],
      });
      addEvidenceEdge({
        id: `occurrence-evidence-member:${occurrence.id}:${member.user.id}`,
        source: memberId,
        target: occurrenceId,
        type: "participated",
        label: "参与共同经历",
        weight: 1,
        evidenceEventIds: occurrence.events
          .filter((event) => event.ownerUserId === member.user.id)
          .map((event) => event.id),
      });
    }
    for (const event of occurrence.events) {
      const ownerId = `user:${event.ownerUserId}`;
      for (const entity of event.entities) {
        if (!entity.canonicalEntityId) continue;
        const featureId = addFeature(entity.canonicalEntityId, entity.name, entity.type);
        addEdge({
          id: `occurrence-feature:${occurrence.id}:${entity.canonicalEntityId}`,
          source: occurrenceId,
          target: featureId,
          type: "relationship",
          label: entity.role,
          weight: 1,
          evidenceEventIds: [event.id],
        });
        addEvidenceEdge({
          id: `occurrence-evidence-feature:${occurrence.id}:${entity.canonicalEntityId}`,
          source: occurrenceId,
          target: featureId,
          type: "evidence",
          label: entity.role,
          weight: 1,
          evidenceEventIds: [event.id],
        });
        if (nodes.has(ownerId)) {
          addEdge({
            id: `member-feature:${occurrence.id}:${event.ownerUserId}:${entity.canonicalEntityId}`,
            source: ownerId,
            target: featureId,
            type: "relationship",
            label: entity.role,
            weight: 1,
            evidenceEventIds: [event.id],
          });
        }
      }
    }
  }

  const values = [...nodes.values()];
  return {
    nodes: values,
    evidenceEdges: [...evidenceEdges.values()],
    relationshipEdges: [...edges.values()],
    stats: {
      events: 0,
      entities: values.filter((node) => node.kind === "entity").length,
      people: values.filter((node) => node.kind === "person").length,
      locations: values.filter((node) => node.kind === "location").length,
      socialMatches: input.matches.length,
      users: values.filter((node) => node.kind === "user" || node.kind === "match").length,
      occurrences: input.occurrences.length,
      sharedFeatures: values.filter((node) => ["entity", "person", "location"].includes(node.kind)).length,
    },
  };
}
