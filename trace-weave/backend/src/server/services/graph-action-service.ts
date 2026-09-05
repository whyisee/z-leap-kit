import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { config, quoteIdentifier } from "../config";
import { createFriendRequest, openConversation } from "./contact-service";
import {
  addGraphEntityToOwnedEvent,
  addGraphLocationToOwnedEvent,
  addGraphParticipantToOwnedEvent,
  relateOwnedEventsFromGraph,
  undoGraphEventMutation,
} from "./event-lifecycle-service";
import { mergeEntityMemory, undoEntityOperation } from "./entity-memory-service";
import { linkOwnedEventToOccurrenceFromGraph, undoGraphOccurrenceLink } from "./shared-occurrence-service";

const schema = quoteIdentifier(config.DB_SCHEMA);

export type GraphActionScope = "world" | "personal";
export type GraphActionMode = "relationships" | "evidence";
export type GraphActionGesture = "node_context" | "node_drop" | "multi_select";

export type GraphActionItem = {
  id: string;
  label: string;
  description: string;
  presentation: "quick_record" | "contact" | "navigation" | "graph_mutation";
  enabled: boolean;
  tone?: "default" | "primary" | "danger";
};

export type GraphActionNode = {
  id: string;
  label: string;
  kind: "user" | "person" | "entity" | "location" | "event" | "occurrence" | "match";
  category: string;
  resourceId: string;
  ownership?: "owned" | "shared" | "public" | "catalog";
};

type ResolvedGraphAction = GraphActionItem & { templateText?: string; relationHint?: string };

type CombinationResolution = {
  subject: GraphActionNode;
  actions: ResolvedGraphAction[];
  relationship?: string;
  commonPoints?: string[];
};

type GraphUndoDescriptor = {
  undoType: "event_participant" | "event_entity" | "event_location" | "event_relation" | "occurrence_link" | "entity_operation";
  payload: Record<string, unknown>;
};

export class GraphActionError extends Error {
  constructor(
    message: string,
    readonly statusCode: 400 | 403 | 404 | 409 | 410 | 429 = 400,
    readonly code = "GRAPH_ACTION_ERROR",
  ) {
    super(message);
    this.name = "GraphActionError";
  }
}

function quickAction(
  id: string,
  label: string,
  description: string,
  templateText: string,
  tone: GraphActionItem["tone"] = "default",
  relationHint?: string,
): ResolvedGraphAction {
  return { id, label, description, templateText, relationHint, presentation: "quick_record", enabled: true, tone };
}

function categorizedEntityPairText(source: GraphActionNode, target: GraphActionNode): { text: string; hint: string } {
  const nodes = [source, target];
  const platform = nodes.find((node) => ["app", "platform"].includes(node.category));
  const food = nodes.find((node) => ["food", "drink"].includes(node.category));
  const content = nodes.find((node) => ["book", "movie", "song", "video", "game"].includes(node.category));
  const product = nodes.find((node) => ["product", "object", "brand"].includes(node.category));
  if (platform && food) {
    return {
      text: `我用${platform.label}点了${food.label}`,
      hint: `${platform.label}是${platform.category === "app" ? "应用" : "平台"}，${food.label}是${food.category === "drink" ? "饮品" : "食物"}；优先理解为通过平台下单或获取食物。`,
    };
  }
  if (platform && content) {
    return {
      text: `我在${platform.label}上体验了${content.label}`,
      hint: `${platform.label}是平台，${content.label}是内容或作品；理解为通过平台观看、收听、阅读或游玩，具体动词由内容类型和用户补充决定。`,
    };
  }
  if (platform && product) {
    return {
      text: `我通过${platform.label}了解或购买了${product.label}`,
      hint: `${platform.label}是平台，${product.label}是商品或事物；不要把二者拆成两个事件，购买与否以用户补充为准。`,
    };
  }
  return {
    text: `我记录一件同时涉及${source.label}和${target.label}的事`,
    hint: `${source.label}的类型是${source.category}，${target.label}的类型是${target.category}；这是同一事件中的两个实体，关系不明确时不要强行编造具体动作。`,
  };
}

function mutationAction(
  id: string,
  label: string,
  description: string,
  tone: GraphActionItem["tone"] = "default",
): ResolvedGraphAction {
  return { id, label, description, presentation: "graph_mutation", enabled: true, tone };
}

export function quickActionsForEntity(category: string, label: string): ResolvedGraphAction[] {
  const quoted = ["game", "book", "movie", "song"].includes(category) ? `《${label}》` : label;
  switch (category) {
    case "game":
      return [
        quickAction("record.plan.play", "想玩", "生成计划记录，确认后入账", `我想玩${quoted}`, "primary"),
        quickAction("record.ongoing.play", "正在玩", "记录当前正在进行的游戏", `我最近正在玩${quoted}`),
        quickAction("record.done.play", "玩过", "记录一次已经发生的游戏经历", `我玩了${quoted}`),
        quickAction("record.like.game", "喜欢", "明确记录对这个游戏的喜爱", `我喜欢${quoted}`),
      ];
    case "book":
      return [
        quickAction("record.plan.read", "想读", "生成待读计划", `我想读${quoted}`, "primary"),
        quickAction("record.ongoing.read", "正在读", "记录当前阅读进度", `我正在读${quoted}`),
        quickAction("record.done.read", "读过", "记录已经完成的阅读", `我读了${quoted}`),
        quickAction("record.like.book", "喜欢", "记录对这本书的感受", `我喜欢${quoted}`),
      ];
    case "movie":
      return [
        quickAction("record.plan.watch", "想看", "生成待看计划", `我想看${quoted}`, "primary"),
        quickAction("record.ongoing.watch", "正在看", "记录当前观看状态", `我正在看${quoted}`),
        quickAction("record.done.watch", "看过", "记录已经发生的观看经历", `我看了${quoted}`),
        quickAction("record.like.movie", "喜欢", "记录对这部作品的感受", `我喜欢${quoted}`),
      ];
    case "song":
      return [
        quickAction("record.plan.listen", "想听", "生成待听记录", `我想听${quoted}`, "primary"),
        quickAction("record.done.listen", "听过", "记录一次收听经历", `我听了${quoted}`),
        quickAction("record.like.song", "喜欢", "记录对这首作品的喜爱", `我喜欢${quoted}`),
      ];
    case "app":
    case "platform":
      return [
        quickAction("record.plan.try_app", "想试试", "生成尝试计划", `我想试试${label}`, "primary"),
        quickAction("record.done.use_app", "使用过", "记录一次使用经历", `我使用了${label}`),
        quickAction("record.ongoing.use_app", "经常使用", "记录当前使用习惯", `我最近经常使用${label}`),
      ];
    case "food":
    case "drink":
      return [
        quickAction("record.plan.try_food", "想尝尝", "生成品尝计划", `我想尝尝${label}`, "primary"),
        quickAction("record.done.consume", category === "drink" ? "喝过" : "吃过", "记录一次已经发生的体验", `我${category === "drink" ? "喝了" : "吃了"}${label}`),
        quickAction("record.like.food", "喜欢", "记录口味偏好", `我喜欢${label}`),
      ];
    case "place":
    case "geo_cell":
    case "location":
      return [
        quickAction("record.plan.visit", "想去", "生成到访计划", `我想去${label}`, "primary"),
        quickAction("record.done.visit", "去过", "记录一次已经发生的到访", `我去过${label}`),
        quickAction("record.at_place", "记录这里发生的事", "继续补充时间、人物和活动", `我在${label}`),
      ];
    default:
      return [
        quickAction("record.interested", "感兴趣", "把它写进自己的生活计划", `我对${label}感兴趣`, "primary"),
        quickAction("record.experienced", "记录相关经历", "继续补充与它有关的事情", `我记录一下和${label}有关的事`),
      ];
  }
}

function parseUuidNode(nodeId: string, prefixes: string[]): { prefix: string; id: string } | null {
  const separator = nodeId.indexOf(":");
  if (separator < 1) return null;
  const prefix = nodeId.slice(0, separator);
  const id = nodeId.slice(separator + 1);
  if (!prefixes.includes(prefix) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return null;
  return { prefix, id };
}

async function resolveNode(
  client: PoolClient,
  viewerId: string,
  scope: GraphActionScope,
  nodeId: string,
): Promise<GraphActionNode> {
  const occurrenceNode = parseUuidNode(nodeId, ["occurrence"]);
  if (occurrenceNode && scope === "personal") {
    const result = await client.query<{ id: string; occurredStart: string | null }>(
      `SELECT occurrence.id, occurrence.occurred_start AS "occurredStart"
         FROM ${schema}.shared_occurrences occurrence
         JOIN ${schema}.occurrence_memberships membership ON membership.occurrence_id = occurrence.id
        WHERE occurrence.id = $1 AND occurrence.status = 'active'
          AND membership.user_id = $2 AND membership.membership_status = 'accepted'`,
      [occurrenceNode.id, viewerId],
    );
    const occurrence = result.rows[0];
    if (!occurrence) throw new GraphActionError("共同经历已经不可用", 404, "NODE_NOT_VISIBLE");
    return {
      id: nodeId,
      label: occurrence.occurredStart
        ? `${new Date(occurrence.occurredStart).toLocaleDateString("zh-CN")} 的共同经历`
        : "共同经历",
      kind: "occurrence",
      category: "shared_occurrence",
      resourceId: occurrence.id,
      ownership: "shared",
    };
  }
  const eventNode = parseUuidNode(nodeId, ["event"]);
  if (eventNode) {
    const result = await client.query<{
      id: string;
      title: string;
      eventType: string;
      ownerUserId: string;
    }>(
      scope === "world"
        ? `SELECT projection.event_id AS id, projection.title,
                  projection.event_type AS "eventType", projection.owner_user_id AS "ownerUserId"
             FROM ${schema}.public_event_projections projection
            WHERE projection.event_id = $1`
        : `SELECT event.id, event.title, event.event_type AS "eventType", event.owner_user_id AS "ownerUserId"
             FROM ${schema}.events event
            WHERE event.id = $1 AND event.deleted_at IS NULL
              AND (event.owner_user_id = $2 OR EXISTS (
                SELECT 1
                  FROM ${schema}.event_occurrence_links occurrence_link
                  JOIN ${schema}.occurrence_memberships membership
                    ON membership.occurrence_id = occurrence_link.occurrence_id
                 WHERE occurrence_link.event_id = event.id
                   AND occurrence_link.link_status = 'active'
                   AND membership.user_id = $2
                   AND membership.membership_status = 'accepted'
              ))`,
      scope === "world" ? [eventNode.id] : [eventNode.id, viewerId],
    );
    const event = result.rows[0];
    if (!event) throw new GraphActionError("事件节点已经不可用", 404, "NODE_NOT_VISIBLE");
    return {
      id: nodeId,
      label: event.title,
      kind: "event",
      category: event.eventType,
      resourceId: event.id,
      ownership: event.ownerUserId === viewerId ? "owned" : scope === "world" ? "public" : "shared",
    };
  }

  const userNode = parseUuidNode(nodeId, ["user", "account"]);
  if (userNode) {
    if (scope === "world" && userNode.prefix !== "user") throw new GraphActionError("世界图节点引用无效", 404, "NODE_NOT_VISIBLE");
    const result = await client.query<{ id: string; displayName: string }>(
      `SELECT id, display_name AS "displayName" FROM ${schema}.users WHERE id = $1 AND status = 'active'`,
      [userNode.id],
    );
    const user = result.rows[0];
    if (!user) throw new GraphActionError("用户节点已经不可用", 404, "NODE_NOT_VISIBLE");
    if (scope === "personal" && user.id !== viewerId && userNode.prefix === "account") {
      const visible = await client.query(
        `SELECT 1
           FROM ${schema}.event_participants participant
           JOIN ${schema}.events event ON event.id = participant.event_id
          WHERE participant.account_user_id = $1 AND event.deleted_at IS NULL
            AND (event.owner_user_id = $2 OR EXISTS (
              SELECT 1
                FROM ${schema}.event_occurrence_links occurrence_link
                JOIN ${schema}.occurrence_memberships membership
                  ON membership.occurrence_id = occurrence_link.occurrence_id
               WHERE occurrence_link.event_id = event.id
                 AND occurrence_link.link_status = 'active'
                 AND membership.user_id = $2
                 AND membership.membership_status = 'accepted'
            ))
          LIMIT 1`,
        [user.id, viewerId],
      );
      if (!visible.rows[0]) throw new GraphActionError("该人物不在当前个人图谱中", 404, "NODE_NOT_VISIBLE");
    }
    return { id: nodeId, label: user.displayName, kind: "user", category: user.id === viewerId ? "self" : "public_account", resourceId: user.id, ownership: user.id === viewerId ? "owned" : "public" };
  }

  const canonicalNode = parseUuidNode(nodeId, ["canonical"]);
  if (canonicalNode) {
    const result = await client.query<{ id: string; name: string; entityType: string }>(
      `SELECT canonical.id, canonical.canonical_name AS name, canonical.entity_type AS "entityType"
         FROM ${schema}.canonical_entities canonical
        WHERE canonical.id = $1 AND canonical.status = 'active' AND canonical.sensitivity = 'normal'
          AND ($2::text <> 'world' OR EXISTS (
            SELECT 1 FROM ${schema}.canonical_entity_sources source WHERE source.canonical_entity_id = canonical.id
            UNION ALL
            SELECT 1 FROM ${schema}.public_event_entity_projections projection WHERE projection.canonical_entity_id = canonical.id
          ))`,
      [canonicalNode.id, scope],
    );
    const entity = result.rows[0];
    if (!entity) throw new GraphActionError("实体节点已经不可用", 404, "NODE_NOT_VISIBLE");
    return {
      id: nodeId,
      label: entity.name,
      kind: ["place", "geo_cell"].includes(entity.entityType) ? "location" : "entity",
      category: entity.entityType,
      resourceId: entity.id,
      ownership: scope === "world" ? "catalog" : "public",
    };
  }

  const personalEntity = parseUuidNode(nodeId, ["entity", "person"]);
  if (personalEntity && scope === "personal") {
    const result = await client.query<{ id: string; name: string; entityType: string }>(
      `SELECT id, display_name AS name, entity_type AS "entityType"
         FROM ${schema}.user_entities
        WHERE id = $1 AND owner_user_id = $2 AND status = 'active'`,
      [personalEntity.id, viewerId],
    );
    const entity = result.rows[0];
    if (!entity) throw new GraphActionError("实体节点已经不可用", 404, "NODE_NOT_VISIBLE");
    return {
      id: nodeId,
      label: entity.name,
      kind: entity.entityType === "person" ? "person" : entity.entityType === "place" ? "location" : "entity",
      category: entity.entityType,
      resourceId: entity.id,
      ownership: "owned",
    };
  }

  if (scope === "personal" && nodeId.startsWith("location:")) {
    const cell = nodeId.slice("location:".length);
    if (!/^[a-z0-9]{4,16}$/i.test(cell)) throw new GraphActionError("地点节点引用无效", 404, "NODE_NOT_VISIBLE");
    const result = await client.query<{ label: string | null }>(
      `SELECT user_label AS label FROM ${schema}.location_observations
        WHERE owner_user_id = $1 AND deleted_at IS NULL AND left(exact_geohash, 7) = $2
        ORDER BY captured_at DESC LIMIT 1`,
      [viewerId, cell],
    );
    if (!result.rows[0]) throw new GraphActionError("地点节点已经不可用", 404, "NODE_NOT_VISIBLE");
    return { id: nodeId, label: result.rows[0].label || `位置 ${cell}`, kind: "location", category: "location", resourceId: cell, ownership: "owned" };
  }

  throw new GraphActionError("当前节点暂不支持快捷操作", 404, "ACTION_NOT_SUPPORTED");
}

function eventAndOther(source: GraphActionNode, target: GraphActionNode): {
  event: GraphActionNode;
  other: GraphActionNode;
} | null {
  if (source.kind === "event" && target.kind !== "event") return { event: source, other: target };
  if (target.kind === "event" && source.kind !== "event") return { event: target, other: source };
  return null;
}

export function pairRecordActions(source: GraphActionNode, target: GraphActionNode): ResolvedGraphAction[] {
  const person = [source, target].find((node) => node.kind === "user" || node.kind === "person");
  const location = [source, target].find((node) => node.kind === "location");
  const entity = [source, target].find((node) => node.kind === "entity");
  if (person && location) {
    return [quickAction(
      "record.pair.person_place",
      "记录共同到访",
      "生成包含人物和地点的新记录，确认后入账",
      `我和${person.label}在${location.label}`,
      "primary",
    )];
  }
  if (person && entity) {
    return [quickAction(
      "record.pair.person_entity",
      "记录共同经历",
      "生成包含人物和事物的新记录，确认后入账",
      `我和${person.label}一起体验了${entity.label}`,
      "primary",
    )];
  }
  if (location && entity) {
    return [quickAction(
      "record.pair.entity_place",
      "记录在这里发生",
      "生成包含地点和事物的新记录，确认后入账",
      `我在${location.label}体验了${entity.label}`,
      "primary",
    )];
  }
  if (source.kind === "entity" && target.kind === "entity") {
    const pair = categorizedEntityPairText(source, target);
    const actions = [
      quickAction("record.pair.entities", "记录一起发生", "AI 会结合两个节点的类型理解它们在同一事件中的关系", pair.text, "primary", pair.hint),
      { id: "entity.compare", label: "在图鉴中比较", description: "打开图鉴查看两者的别名、证据和出现次数", presentation: "navigation", enabled: true } as ResolvedGraphAction,
      quickAction("record.compare.entities", "记录比较感受", "写下你对两者的比较或选择", `我比较了一下${source.label}和${target.label}`),
    ];
    if (source.ownership === "owned" && target.ownership === "owned" && source.category === target.category) {
      actions.push({
        id: "entity.merge",
        label: "合并重复条目",
        description: `把“${source.label}”的证据和别名合并到“${target.label}”，可撤销`,
        presentation: "graph_mutation",
        enabled: true,
        tone: "danger",
      });
    }
    return actions;
  }
  if (["user", "person"].includes(source.kind) && ["user", "person"].includes(target.kind)) {
    return [quickAction(
      "record.pair.people",
      "记录共同经历",
      "生成同时涉及两个人物的新记录",
      `我想记录一件和${source.label}、${target.label}都有关的事`,
      "primary",
    )];
  }
  if (source.kind === "location" && target.kind === "location") {
    return [
      quickAction("record.pair.locations", "记录两地行程", "生成同时涉及两个地点的新记录", `我从${source.label}去了${target.label}`, "primary"),
      quickAction("record.compare.locations", "比较两个地点", "记录两个地点带给你的不同感受", `我比较了一下${source.label}和${target.label}`),
    ];
  }
  return [];
}

export function multiNodeRecordActions(nodes: GraphActionNode[]): ResolvedGraphAction[] {
  const unique = [...new Map(nodes.map((node) => [node.id, node])).values()];
  if (unique.length < 2) throw new GraphActionError("至少选择两个节点", 400, "ACTION_NOT_SUPPORTED");
  if (unique.length === 2 && unique.every((node) => node.kind === "entity")) {
    const pair = categorizedEntityPairText(unique[0], unique[1]);
    return [
      quickAction("record.multi.compose", "组合成一条记录", "AI 会结合两个节点的类型理解它们在同一事件中的关系", pair.text, "primary", pair.hint),
      quickAction("record.multi.reflection", "记录它们之间的联系", "写下你观察到的关系或感受", `我发现${unique[0].label}和${unique[1].label}之间有这样的联系：`),
    ];
  }
  const people = unique.filter((node) => ["user", "person"].includes(node.kind) && node.category !== "self");
  const locations = unique.filter((node) => node.kind === "location");
  const subjects = unique.filter((node) => ["entity", "event", "occurrence"].includes(node.kind));
  const parts = [
    people.length ? `和${people.map((node) => node.label).join("、")}` : "",
    locations.length ? `在${locations.map((node) => node.label).join("、")}` : "",
    subjects.length ? `经历了${subjects.map((node) => node.label).join("、")}` : "",
  ].filter(Boolean);
  const fallbackLabels = unique.filter((node) => node.category !== "self").map((node) => node.label);
  const template = parts.length ? `我${parts.join("")}` : `我想记录一件涉及${fallbackLabels.join("、")}的事`;
  const relationHint = unique
    .filter((node) => node.category !== "self")
    .map((node) => `${node.label}是${node.category}类型`)
    .join("；");
  return [
    quickAction("record.multi.compose", "组合成一条记录", "把选中的人物、地点、事件与事物带入确认页", template, "primary", `${relationHint}；这些节点属于同一事件，结合类型推断合理角色，不要按节点拆成多件事。`),
    quickAction("record.multi.reflection", "记录它们之间的联系", "先生成一段开放式记录，再补充你的理解", `我发现${fallbackLabels.join("、")}之间有这样的联系：`),
  ];
}

async function actionsForCombination(
  client: PoolClient,
  viewerId: string,
  scope: GraphActionScope,
  source: GraphActionNode,
  target: GraphActionNode,
): Promise<CombinationResolution> {
  if (source.id === target.id) throw new GraphActionError("不能把节点拖到自身", 409, "ACTION_NOT_SUPPORTED");

  if (source.category === "self" || target.category === "self") {
    const subject = source.category === "self" ? target : source;
    const resolved = await actionsForSubject(client, viewerId, subject);
    return { subject, ...resolved };
  }

  if (source.kind === "event" && target.kind === "event") {
    if (scope !== "personal" || source.ownership !== "owned" || target.ownership !== "owned") {
      return {
        subject: target,
        actions: [quickAction(
          "record.pair.events",
          "记录相关经历",
          "根据这两件公开事件生成自己的记录，不修改原事件",
          `我想记录一件和“${source.label}”以及“${target.label}”都有关的事`,
          "primary",
        )],
      };
    }
    return {
      subject: target,
      actions: [
        mutationAction("event.relation.continues", "前者延续为后者", `建立“${source.label}”延续到“${target.label}”的关系`, "primary"),
        mutationAction("event.relation.causes", "前者导致后者", "建立有方向的因果关系"),
        mutationAction("event.relation.repeats", "标记为再次发生", "把后者标记为前者的重复经历"),
        mutationAction("event.relation.references", "建立一般关联", "后者引用前者，但不推断因果"),
        mutationAction("event.relation.simultaneous", "标记为同时发生", "建立两件事同时发生的关系"),
      ],
    };
  }

  if ((source.kind === "event" && target.kind === "occurrence") || (source.kind === "occurrence" && target.kind === "event")) {
    const event = source.kind === "event" ? source : target;
    const occurrence = source.kind === "occurrence" ? source : target;
    if (scope === "personal" && event.ownership === "owned") {
      return {
        subject: occurrence,
        actions: [mutationAction(
          "occurrence.link_event",
          "关联到共同经历",
          `把“${event.label}”作为你在这段共同经历中的事件`,
          "primary",
        )],
      };
    }
    return {
      subject: occurrence,
      actions: [quickAction(
        "record.occurrence.related",
        "创建我的相关记录",
        "先创建自己的记录，确认后才能关联共同经历",
        `关于${occurrence.label}，我想记录一件和“${event.label}”有关的事`,
        "primary",
      )],
    };
  }

  const eventPair = eventAndOther(source, target);
  if (eventPair) {
    const { event, other } = eventPair;
    const canMutate = scope === "personal" && event.ownership === "owned";
    if (!canMutate) {
      return {
        subject: event,
        actions: [quickAction(
          "record.from.public_event",
          "记录我的相关经历",
          "生成自己的新记录，不会修改公开事件",
          `我想记录一件和“${event.label}”有关的事，也涉及${other.label}`,
          "primary",
        )],
      };
    }
    if ((other.kind === "user" && other.resourceId !== viewerId) || other.kind === "person") {
      const canAttachParticipant = other.kind === "user" || other.ownership === "owned";
      return {
        subject: event,
        actions: canAttachParticipant ? [
          mutationAction("event.participant.companion", "添加为同行者", `把${other.label}加入“${event.label}”`, "primary"),
          mutationAction("event.participant.subject", "添加为涉及人物", "记录人物与事件有关，但不表示同行"),
          mutationAction("event.participant.organizer", "添加为组织者", "记录此人组织或发起了这件事"),
        ] : [
          quickAction(
            "record.from.public_person",
            "记录相关经历",
            "公共人物身份不能直接写入你的私人事件，将创建一条新记录",
            `我想记录一件和“${event.label}”有关的事，也涉及${other.label}`,
            "primary",
          ),
        ],
      };
    }
    if (other.kind === "location") {
      const hasCapturedLocation = other.id.startsWith("location:");
      return {
        subject: event,
        actions: hasCapturedLocation ? [
          mutationAction("event.location.occurred_at", "设为发生地点", `把${other.label}添加到事件定位`, "primary"),
          mutationAction("event.location.recorded_at", "设为记录地点", "仅表示在这里记录，不代表事件在此发生"),
        ] : [
          mutationAction("event.entity.occurred_at", "添加为涉及地点", `把${other.label}作为地点实体加入事件`, "primary"),
          mutationAction("event.entity.object", "添加为相关事物", "只建立一般涉及关系"),
        ],
      };
    }
    if (other.kind === "entity") {
      return {
        subject: event,
        actions: [
          mutationAction("event.entity.object", "添加为涉及事物", `把${other.label}加入“${event.label}”`, "primary"),
          mutationAction("event.entity.used", "添加为使用对象", "表示事件中使用了这个事物"),
          mutationAction("event.entity.content", "添加为内容对象", "表示观看、阅读、收听或浏览的内容"),
        ],
      };
    }
  }

  const pairActions = pairRecordActions(source, target);
  if (pairActions.length) return { subject: target, actions: pairActions };
  throw new GraphActionError("这组节点暂时没有合适的组合操作", 409, "ACTION_NOT_SUPPORTED");
}

async function contactState(client: PoolClient, viewerId: string, otherUserId: string) {
  const [blocked, connection, request] = await Promise.all([
    client.query(
      `SELECT 1 FROM ${schema}.social_blocks
        WHERE (blocker_user_id = $1 AND blocked_user_id = $2)
           OR (blocker_user_id = $2 AND blocked_user_id = $1) LIMIT 1`,
      [viewerId, otherUserId],
    ),
    client.query(
      `SELECT id FROM ${schema}.social_connections
        WHERE user_low_id = LEAST($1::uuid, $2::uuid)
          AND user_high_id = GREATEST($1::uuid, $2::uuid)
          AND status IN ('active', 'muted') LIMIT 1`,
      [viewerId, otherUserId],
    ),
    client.query<{ id: string; senderUserId: string; recipientUserId: string }>(
      `SELECT id, sender_user_id AS "senderUserId", recipient_user_id AS "recipientUserId"
         FROM ${schema}.friend_requests
        WHERE status = 'pending'
          AND ((sender_user_id = $1 AND recipient_user_id = $2)
            OR (sender_user_id = $2 AND recipient_user_id = $1))
        ORDER BY created_at DESC LIMIT 1`,
      [viewerId, otherUserId],
    ),
  ]);
  if (blocked.rows[0]) return { relationship: "blocked" as const, requestId: null };
  if (connection.rows[0]) return { relationship: "friend" as const, requestId: null };
  const pending = request.rows[0];
  if (!pending) return { relationship: "none" as const, requestId: null };
  return {
    relationship: pending.senderUserId === viewerId ? "outgoing" as const : "incoming" as const,
    requestId: pending.id,
  };
}

async function publicCommonPoints(client: PoolClient, viewerId: string, otherUserId: string): Promise<string[]> {
  const result = await client.query<{ name: string }>(
    `SELECT canonical.canonical_name AS name
       FROM ${schema}.public_event_entity_projections mine_entity
       JOIN ${schema}.public_event_projections mine ON mine.event_id = mine_entity.event_id AND mine.owner_user_id = $1
       JOIN ${schema}.public_event_entity_projections theirs_entity
         ON theirs_entity.canonical_entity_id = mine_entity.canonical_entity_id
       JOIN ${schema}.public_event_projections theirs ON theirs.event_id = theirs_entity.event_id AND theirs.owner_user_id = $2
       JOIN ${schema}.canonical_entities canonical ON canonical.id = mine_entity.canonical_entity_id
      WHERE canonical.sensitivity = 'normal'
      GROUP BY canonical.id, canonical.canonical_name
      ORDER BY count(*) DESC, canonical.canonical_name
      LIMIT 5`,
    [viewerId, otherUserId],
  );
  return result.rows.map((row) => row.name);
}

async function actionsForSubject(
  client: PoolClient,
  viewerId: string,
  subject: GraphActionNode,
): Promise<{ actions: ResolvedGraphAction[]; relationship?: string; commonPoints?: string[] }> {
  if (subject.kind === "user") {
    if (subject.resourceId === viewerId) return { actions: [] };
    const state = await contactState(client, viewerId, subject.resourceId);
    if (state.relationship === "blocked") return { actions: [], relationship: state.relationship, commonPoints: [] };
    const commonPoints = await publicCommonPoints(client, viewerId, subject.resourceId);
    if (state.relationship === "friend") {
      return {
        relationship: state.relationship,
        commonPoints,
        actions: [{ id: "contact.message", label: "发消息", description: "打开你们的一对一私聊", presentation: "contact", enabled: true, tone: "primary" }],
      };
    }
    if (state.relationship === "incoming" || state.relationship === "outgoing") {
      return {
        relationship: state.relationship,
        commonPoints,
        actions: [{
          id: "contact.review",
          label: state.relationship === "incoming" ? "处理好友申请" : "查看申请状态",
          description: state.relationship === "incoming" ? "前往消息中心接受或拒绝" : "申请已经发送，等待对方处理",
          presentation: "navigation",
          enabled: true,
          tone: "primary",
        }],
      };
    }
    return {
      relationship: state.relationship,
      commonPoints,
      actions: [{ id: "contact.request", label: "认识对方", description: "填写留言并发送好友申请", presentation: "contact", enabled: true, tone: "primary" }],
    };
  }
  if (subject.kind === "entity" || subject.kind === "location") {
    return { actions: quickActionsForEntity(subject.category, subject.label) };
  }
  if (subject.kind === "event") {
    return {
      actions: [
        quickAction("record.event.follow_up", "记录后续", "生成一条与这件事有关的新记录", `关于“${subject.label}”，后来`, "primary"),
        quickAction("record.event.reflection", "写下感受", "记录你对这件事的感受或想法", `想到“${subject.label}”，我觉得`),
      ],
    };
  }
  if (subject.kind === "person") {
    return {
      actions: [
        quickAction("record.person.together", "记录共同经历", `生成一条和${subject.label}有关的新记录`, `我和${subject.label}一起`, "primary"),
        quickAction("record.person.met", "记录见面", "记录一次已经发生的见面", `我见了${subject.label}`),
      ],
    };
  }
  if (subject.kind === "occurrence") {
    return {
      actions: [
        quickAction("record.occurrence.follow_up", "记录这段共同经历", "创建一条自己的记录，确认后再选择是否关联", `关于${subject.label}，我想记录`, "primary"),
        { id: "occurrence.manage", label: "查看成员与权限", description: "打开发现页的共同经历管理", presentation: "navigation", enabled: true },
      ],
    };
  }
  return { actions: [] };
}

async function buildResolution(
  client: PoolClient,
  viewerId: string,
  input: {
    scope: GraphActionScope;
    mode: GraphActionMode;
    gesture: GraphActionGesture;
    sourceNodeId: string;
    targetNodeId?: string;
    nodeIds?: string[];
  },
) {
  const source = await resolveNode(client, viewerId, input.scope, input.sourceNodeId);
  const target = input.targetNodeId ? await resolveNode(client, viewerId, input.scope, input.targetNodeId) : undefined;
  if (input.gesture === "multi_select") {
    const ids = [...new Set(input.nodeIds ?? [])];
    if (ids.length < 2 || ids.length > 12) throw new GraphActionError("组合记录需要选择 2 至 12 个节点", 400, "ACTION_NOT_SUPPORTED");
    const nodes = await Promise.all(ids.map((nodeId) => nodeId === source.id ? source : resolveNode(client, viewerId, input.scope, nodeId)));
    return { source, target: undefined, nodes, subject: source, actions: multiNodeRecordActions(nodes) };
  }
  if (input.gesture === "node_drop" && !target) throw new GraphActionError("请选择碰撞目标", 400, "ACTION_NOT_SUPPORTED");
  const resolved = target
    ? await actionsForCombination(client, viewerId, input.scope, source, target)
    : { subject: source, ...await actionsForSubject(client, viewerId, source) };
  if (!resolved.actions.length) throw new GraphActionError("当前节点没有可用的快捷操作", 409, "ACTION_NOT_SUPPORTED");
  return { source, target, nodes: [source, ...(target ? [target] : [])], ...resolved };
}

export async function resolveGraphActions(
  client: PoolClient,
  viewerId: string,
  input: {
    scope: GraphActionScope;
    mode: GraphActionMode;
    gesture: GraphActionGesture;
    sourceNodeId: string;
    targetNodeId?: string;
    nodeIds?: string[];
  },
) {
  const resolved = await buildResolution(client, viewerId, input);
  const contextId = randomUUID();
  const auditId = randomUUID();
  const expiresAt = new Date(Date.now() + 5 * 60_000);
  await client.query(
    `INSERT INTO ${schema}.graph_action_contexts
      (id, owner_user_id, scope, mode, gesture_type, source_node_id, target_node_id, node_ids, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)`,
    [contextId, viewerId, input.scope, input.mode, input.gesture, input.sourceNodeId, input.targetNodeId ?? null, JSON.stringify(input.nodeIds ?? []), expiresAt],
  );
  await client.query(
    `INSERT INTO ${schema}.graph_interaction_audits
      (id, owner_user_id, gesture_type, action_id, scope, source_ref, target_ref, status, result_type)
     VALUES ($1,$2,$3,'graph.resolve',$4,$5,$6,'resolved','action_set')`,
    [auditId, viewerId, input.gesture, input.scope, input.sourceNodeId, input.targetNodeId ?? null],
  );
  await client.query(`DELETE FROM ${schema}.graph_action_contexts WHERE expires_at < now() - interval '1 hour'`);
  return {
    contextId,
    expiresAt: expiresAt.toISOString(),
    source: resolved.source,
    target: resolved.target ?? null,
    nodes: resolved.nodes,
    relationship: resolved.relationship ?? null,
    commonPoints: resolved.commonPoints ?? [],
    actions: resolved.actions.map(({ templateText: _templateText, ...action }) => action),
  };
}

export async function executeGraphAction(
  client: PoolClient,
  viewerId: string,
  input: { contextId: string; actionId: string; idempotencyKey: string; message?: string },
) {
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`graph-action:${viewerId}:${input.idempotencyKey}`]);
  const previous = await client.query<{ status: string; result: unknown }>(
    `SELECT status, result FROM ${schema}.graph_interaction_audits
      WHERE owner_user_id = $1 AND idempotency_key = $2`,
    [viewerId, input.idempotencyKey],
  );
  if (previous.rows[0]?.status === "succeeded") return previous.rows[0].result;

  const contextResult = await client.query<{
    scope: GraphActionScope;
    mode: GraphActionMode;
    gesture: GraphActionGesture;
    sourceNodeId: string;
    targetNodeId: string | null;
    nodeIds: string[];
  }>(
    `SELECT scope, mode, gesture_type AS gesture, source_node_id AS "sourceNodeId", target_node_id AS "targetNodeId",
            node_ids AS "nodeIds"
       FROM ${schema}.graph_action_contexts
      WHERE id = $1 AND owner_user_id = $2 AND expires_at > now()
      FOR UPDATE`,
    [input.contextId, viewerId],
  );
  const context = contextResult.rows[0];
  if (!context) throw new GraphActionError("操作已经过期，请重新打开", 410, "ACTION_NO_LONGER_AVAILABLE");
  const resolved = await buildResolution(client, viewerId, {
    scope: context.scope,
    mode: context.mode,
    gesture: context.gesture,
    sourceNodeId: context.sourceNodeId,
    targetNodeId: context.targetNodeId ?? undefined,
    nodeIds: context.nodeIds,
  });
  const action = resolved.actions.find((item) => item.id === input.actionId && item.enabled);
  if (!action) throw new GraphActionError("操作已经不可用，请重新打开", 409, "ACTION_NO_LONGER_AVAILABLE");

  const auditId = randomUUID();
  await client.query(
    `INSERT INTO ${schema}.graph_interaction_audits
      (id, owner_user_id, gesture_type, action_id, scope, source_ref, target_ref, idempotency_key, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'resolved')`,
    [auditId, viewerId, context.gesture, action.id, context.scope, context.sourceNodeId, context.targetNodeId, input.idempotencyKey],
  );

  let result: Record<string, unknown>;
  let undoDescriptor: GraphUndoDescriptor | undefined;
  if (action.presentation === "quick_record" && action.templateText) {
    result = {
      type: "entry_template",
      text: action.templateText,
      actionId: action.id,
      entity: resolved.subject,
      graphContext: {
        source: "graph_interaction",
        actionId: action.id,
        intent: action.label,
        relationHint: action.relationHint ?? null,
        nodes: resolved.nodes.map((node) => ({ label: node.label, kind: node.kind, category: node.category })),
      },
    };
  } else if (action.id === "contact.request" && resolved.subject.kind === "user") {
    const created = await createFriendRequest(client, viewerId, resolved.subject.resourceId, input.message);
    result = { type: "friend_request", ...created, user: resolved.subject };
  } else if (action.id === "contact.message" && resolved.subject.kind === "user") {
    const conversation = await openConversation(client, viewerId, resolved.subject.resourceId);
    result = { type: "conversation", ...conversation, user: resolved.subject };
  } else if (action.id === "contact.review") {
    result = { type: "navigation", destination: "contacts", tab: "friends" };
  } else if (action.id === "occurrence.manage") {
    result = { type: "navigation", destination: "discover", tab: "occurrences" };
  } else if (action.id === "entity.compare") {
    result = { type: "navigation", destination: "memory", tab: "entities", nodeIds: resolved.nodes.map((node) => node.id) };
  } else if (action.presentation === "graph_mutation" && resolved.target) {
    const eventPair = eventAndOther(resolved.source, resolved.target);
    let mutation: {
      changed: boolean;
      eventIds: string[];
      versions: Record<string, number>;
      undo?: { type: GraphUndoDescriptor["undoType"]; payload: Record<string, unknown> };
    };
    if (action.id === "occurrence.link_event") {
      const eventNode = resolved.source.kind === "event" ? resolved.source : resolved.target;
      const occurrenceNode = resolved.source.kind === "occurrence" ? resolved.source : resolved.target;
      if (eventNode.kind !== "event" || occurrenceNode.kind !== "occurrence") {
        throw new GraphActionError("共同经历关联已经不可用", 409, "ACTION_NO_LONGER_AVAILABLE");
      }
      const linked = await linkOwnedEventToOccurrenceFromGraph(client, viewerId, eventNode.resourceId, occurrenceNode.resourceId);
      mutation = { changed: linked.changed, eventIds: [eventNode.resourceId], versions: {} };
      if (linked.changed) undoDescriptor = { undoType: "occurrence_link", payload: { linkId: linked.linkId, occurrenceId: occurrenceNode.resourceId } };
    } else if (action.id === "entity.merge" && resolved.source.kind === "entity" && resolved.target.kind === "entity") {
      if (resolved.source.ownership !== "owned" || resolved.target.ownership !== "owned" || resolved.source.category !== resolved.target.category) {
        throw new GraphActionError("只有你名下同类型的图鉴条目才能合并", 403, "ACTION_NO_LONGER_AVAILABLE");
      }
      const operationId = await mergeEntityMemory(client, viewerId, resolved.source.resourceId, resolved.target.resourceId);
      mutation = { changed: true, eventIds: [], versions: {} };
      undoDescriptor = { undoType: "entity_operation", payload: { operationId } };
    } else if (action.id.startsWith("event.relation.") && resolved.source.kind === "event" && resolved.target.kind === "event") {
      const relationType = action.id.slice("event.relation.".length) as
        "continues" | "causes" | "repeats" | "references" | "simultaneous";
      mutation = await relateOwnedEventsFromGraph(
        client,
        viewerId,
        resolved.source.resourceId,
        resolved.target.resourceId,
        relationType,
      );
    } else if (eventPair && action.id.startsWith("event.participant.")) {
      const role = action.id.slice("event.participant.".length);
      mutation = await addGraphParticipantToOwnedEvent(client, viewerId, eventPair.event.resourceId, {
        ...(eventPair.other.kind === "user"
          ? { accountUserId: eventPair.other.resourceId }
          : { userEntityId: eventPair.other.resourceId }),
        role,
        label: eventPair.other.label,
      });
    } else if (eventPair && action.id.startsWith("event.location.") && eventPair.other.kind === "location") {
      const role = action.id.slice("event.location.".length) as "occurred_at" | "recorded_at";
      mutation = await addGraphLocationToOwnedEvent(client, viewerId, eventPair.event.resourceId, {
        geohashCell: eventPair.other.resourceId,
        role,
      });
    } else if (eventPair && action.id.startsWith("event.entity.") && ["entity", "location"].includes(eventPair.other.kind)) {
      mutation = await addGraphEntityToOwnedEvent(client, viewerId, eventPair.event.resourceId, {
        ...(eventPair.other.id.startsWith("canonical:")
          ? { canonicalEntityId: eventPair.other.resourceId }
          : { userEntityId: eventPair.other.resourceId }),
        role: action.id.slice("event.entity.".length),
      });
    } else {
      throw new GraphActionError("这项图谱修改已经不可用", 409, "ACTION_NO_LONGER_AVAILABLE");
    }
    if (!undoDescriptor && mutation.undo) undoDescriptor = { undoType: mutation.undo.type, payload: mutation.undo.payload };
    result = {
      type: "graph_mutation",
      actionId: action.id,
      changed: mutation.changed,
      eventIds: mutation.eventIds,
      versions: mutation.versions,
      source: resolved.source,
      target: resolved.target,
    };
  } else {
    throw new GraphActionError("操作尚未接入执行器", 409, "ACTION_NOT_SUPPORTED");
  }

  if (undoDescriptor) {
    const undoId = randomUUID();
    const undoExpiresAt = new Date(Date.now() + 10 * 60_000);
    await client.query(
      `INSERT INTO ${schema}.graph_action_undos
        (id, owner_user_id, audit_id, undo_type, payload, expires_at)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6)`,
      [undoId, viewerId, auditId, undoDescriptor.undoType, JSON.stringify(undoDescriptor.payload), undoExpiresAt],
    );
    result.undo = { id: undoId, expiresAt: undoExpiresAt.toISOString() };
  }

  await client.query(
    `UPDATE ${schema}.graph_interaction_audits
        SET status = 'succeeded', result_type = $2, result = $3::jsonb, updated_at = now()
      WHERE id = $1`,
    [auditId, String(result.type), JSON.stringify(result)],
  );
  return result;
}

export async function undoGraphAction(client: PoolClient, viewerId: string, undoId: string) {
  const undoResult = await client.query<{
    id: string;
    undoType: GraphUndoDescriptor["undoType"];
    payload: Record<string, unknown>;
    expiresAt: string;
  }>(
    `SELECT id, undo_type AS "undoType", payload, expires_at AS "expiresAt"
       FROM ${schema}.graph_action_undos
      WHERE id = $1 AND owner_user_id = $2 AND status = 'available'
      FOR UPDATE`,
    [undoId, viewerId],
  );
  const undo = undoResult.rows[0];
  if (!undo) throw new GraphActionError("这项操作已经撤销或不可用", 409, "UNDO_NOT_AVAILABLE");
  if (new Date(undo.expiresAt).getTime() <= Date.now()) {
    await client.query(`UPDATE ${schema}.graph_action_undos SET status = 'expired' WHERE id = $1`, [undo.id]);
    throw new GraphActionError("撤销时间已经结束", 410, "UNDO_EXPIRED");
  }
  if (undo.undoType === "entity_operation") {
    await undoEntityOperation(client, viewerId, String(undo.payload.operationId));
  } else if (undo.undoType === "occurrence_link") {
    await undoGraphOccurrenceLink(client, viewerId, String(undo.payload.linkId), String(undo.payload.occurrenceId));
  } else {
    await undoGraphEventMutation(client, viewerId, { type: undo.undoType, payload: undo.payload });
  }
  await client.query(
    `UPDATE ${schema}.graph_action_undos SET status = 'used', used_at = now() WHERE id = $1`,
    [undo.id],
  );
  const auditId = randomUUID();
  const result = { type: "graph_undo", undoId: undo.id, status: "undone" as const };
  await client.query(
    `INSERT INTO ${schema}.graph_interaction_audits
      (id, owner_user_id, gesture_type, action_id, scope, source_ref, status, result_type, result)
     VALUES ($1,$2,'undo','graph.undo','personal',$3,'succeeded','graph_undo',$4::jsonb)`,
    [auditId, viewerId, undo.id, JSON.stringify(result)],
  );
  return result;
}
