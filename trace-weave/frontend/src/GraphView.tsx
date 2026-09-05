import { useEffect, useMemo, useRef, useState } from "react";
import type {
  Graph as G6Graph,
  GraphData as G6GraphData,
  IElementDragEvent,
  IElementEvent,
  Point as G6Point,
} from "@antv/g6";
import { api } from "./api";
import type {
  GlobalGraph,
  GraphActionItem,
  GraphActionResolution,
  GraphActionResult,
  GraphEdge,
  GraphNode,
  PersonalGraph,
} from "./api";

type GraphMode = "relationships" | "evidence";
type GraphScope = "global" | "personal";
type WorldEntityScope = "connected" | "catalog";
type PositionedNode = GraphNode & { x: number; y: number };
type GraphPoint = { x: number; y: number };
type GraphNodeGroup = "people" | "events" | "locations" | "entities";
type GraphTimeRange = "all" | "30d" | "90d" | "365d";
type GraphFilters = {
  query: string;
  nodeGroups: GraphNodeGroup[];
  timeRange: GraphTimeRange;
  minStrength: number;
  hideAnonymous: boolean;
  directOnly: boolean;
};

type GraphActionRequest = {
  gesture: "node_context" | "node_drop" | "multi_select";
  sourceNodeId: string;
  targetNodeId?: string;
  nodeIds?: string[];
};

type CollisionHint = {
  sourceId: string;
  targetId: string;
  targetLabel: string;
  ready: boolean;
};

type SpringMotion = {
  id: string;
  destination: G6Point;
  vector: G6Point;
  waveform: "release" | "return";
};

const allNodeGroups: GraphNodeGroup[] = ["people", "events", "locations", "entities"];

const defaultGraphFilters: GraphFilters = {
  query: "",
  nodeGroups: allNodeGroups,
  timeRange: "all",
  minStrength: 1,
  hideAnonymous: false,
  directOnly: false,
};

const nodeGroupLabels: Record<GraphNodeGroup, string> = {
  people: "人物",
  events: "事件",
  locations: "地点",
  entities: "事物",
};

function nodeGroup(node: GraphNode): GraphNodeGroup {
  if (node.kind === "user" || node.kind === "person" || node.kind === "match") return "people";
  if (node.kind === "event" || node.kind === "occurrence") return "events";
  if (node.kind === "location" || node.category === "place" || node.category === "geo_cell") return "locations";
  return "entities";
}

const nodeColors: Record<GraphNode["kind"], string> = {
  user: "#25231f",
  event: "#bd4e32",
  occurrence: "#b5425c",
  entity: "#a76d38",
  person: "#486653",
  location: "#53758a",
  match: "#735887",
};

const entityCategoryColors: Record<string, string> = {
  app: "#55758b",
  platform: "#55758b",
  food: "#b66b45",
  drink: "#4f7c73",
  game: "#755f8e",
  brand: "#9b7a43",
  book: "#7d654d",
  song: "#9b5d78",
  movie: "#665f83",
};

const categoryLabels: Record<string, string> = {
  self: "自己",
  person: "人物",
  account: "已关联用户",
  location: "地点",
  place: "地点",
  food: "食物",
  song: "歌曲",
  book: "书籍",
  movie: "影视",
  game: "游戏",
  app: "应用",
  drink: "饮品",
  brand: "品牌",
  platform: "平台",
  activity: "活动",
  topic: "主题",
  event: "事件",
  anonymous_match: "匿名潜在关系",
  connected_account: "已连接用户",
  public_account: "平台用户",
  shared_account: "共同经历成员",
  shared_occurrence: "共同经历",
};

const relationLabels: Record<string, string> = {
  actor: "参与",
  companion: "同行",
  occurred_at: "发生于",
  recorded_at: "记录于",
  object: "涉及",
  consumed: "消费",
  listened_to: "听过",
  watched: "看过",
  played: "玩过",
  read: "读过",
};

function relationLabel(value: string): string {
  return value
    .split(" / ")
    .map((part) => relationLabels[part] ?? part)
    .join(" / ");
}

function shortLabel(label: string, length = 12): string {
  return label.length > length ? `${label.slice(0, length)}…` : label;
}

function positionRing(nodes: GraphNode[], radius: number, startAngle: number): PositionedNode[] {
  return nodes.map((node, index) => {
    const angle = startAngle + (Math.PI * 2 * index) / Math.max(1, nodes.length);
    const ringOffset = nodes.length > 24 ? (index % 3) * 48 : 0;
    return {
      ...node,
      x: Math.cos(angle) * (radius + ringOffset),
      y: Math.sin(angle) * (radius + ringOffset) * 0.78,
    };
  });
}

function layoutNodes(nodes: GraphNode[], mode: GraphMode): PositionedNode[] {
  const root = nodes.find((node) => node.kind === "user" && node.category === "self")
    ?? nodes.find((node) => node.kind === "user");
  const relatedUsers = nodes.filter(
    (node) => node.id !== root?.id && (node.kind === "user" || node.kind === "match"),
  );
  const events = mode === "evidence" ? nodes.filter((node) => node.kind === "event") : [];
  const occurrences = nodes.filter((node) => node.kind === "occurrence");
  const concepts = nodes.filter(
    (node) => node.id !== root?.id
      && node.kind !== "user"
      && node.kind !== "match"
      && node.kind !== "event"
      && node.kind !== "occurrence",
  );
  return [
    ...(root ? [{ ...root, x: 0, y: 0 }] : []),
    ...positionRing(relatedUsers, 170, -Math.PI / 2),
    ...positionRing(events, 205, -Math.PI / 2),
    ...positionRing(occurrences, relatedUsers.length ? 285 : 190, -Math.PI / 2),
    ...positionRing(concepts, mode === "evidence" ? 400 : relatedUsers.length ? 400 : 285, -Math.PI / 2),
  ];
}

type GraphVisualStates = {
  nodes: Record<string, string[]>;
  edges: Record<string, string[]>;
};

async function applyGraphVisualStates(graph: G6Graph, states: GraphVisualStates): Promise<void> {
  await Promise.all([
    graph.setElementState(states.nodes, false),
    graph.setElementState(states.edges, false),
  ]);
}

function graphNodeSize(node: GraphNode): number {
  if (node.kind === "user") return node.category === "self" ? 64 : 48;
  if (node.kind === "person") return Math.min(44, 32 + Math.sqrt(node.weight) * 3);
  if (node.kind === "match") return Math.min(42, 34 + Math.sqrt(node.weight) * 2.5);
  if (node.kind === "event") return 28;
  if (node.kind === "occurrence") return 40;
  return Math.min(46, 25 + Math.sqrt(node.weight) * 4.4);
}

type GraphNodeVisual = {
  type: "circle" | "diamond" | "hexagon" | "rect";
  size: number | [number, number];
  style?: Record<string, unknown>;
};

function graphNodeVisual(node: GraphNode): GraphNodeVisual {
  const size = graphNodeSize(node);
  if (node.kind === "event") {
    return { type: "diamond", size: [size, size] };
  }
  if (node.kind === "occurrence") {
    return { type: "hexagon", size };
  }
  if (node.kind === "location" || node.category === "place" || node.category === "geo_cell") {
    const side = Math.max(34, size);
    return {
      type: "rect",
      size: [side, side],
      style: {
        radius: Math.max(8, side * 0.27),
        iconText: "⌖",
        iconFill: "rgba(255, 253, 248, 0.92)",
        iconFontSize: Math.max(13, side * 0.4),
        iconFontWeight: 700,
      },
    };
  }
  if (node.kind === "entity") {
    return {
      type: "rect",
      size: [Math.max(38, size * 1.28), Math.max(27, size * 0.84)],
      style: { radius: 9 },
    };
  }
  if (node.kind === "match") {
    return { type: "circle", size, style: { lineDash: [5, 4] } };
  }
  return { type: "circle", size };
}

function collisionRadius(node: GraphNode): number {
  const size = graphNodeVisual(node).size;
  return (Array.isArray(size) ? Math.max(...size) : size) / 2;
}

function interactionKind(node: GraphNode): "self" | "person" | "event" | "occurrence" | "entity" | "location" | "unsupported" {
  if (node.category === "self") return "self";
  if (node.kind === "user" || node.kind === "person") return "person";
  if (node.kind === "event") return "event";
  if (node.kind === "occurrence") return "occurrence";
  if (node.kind === "location" || node.category === "place" || node.category === "geo_cell") return "location";
  if (node.kind === "entity") return "entity";
  return "unsupported";
}

function supportsDropInteraction(source: GraphNode, target: GraphNode): boolean {
  if (source.id === target.id) return false;
  const sourceKind = interactionKind(source);
  const targetKind = interactionKind(target);
  if (sourceKind === "unsupported" || targetKind === "unsupported") return false;
  if (sourceKind === "self" || targetKind === "self") return true;
  if (sourceKind === "event" || targetKind === "event") return true;
  if (sourceKind === "occurrence" || targetKind === "occurrence") return false;
  const pair = [sourceKind, targetKind].sort().join(":");
  return ["entity:entity", "entity:location", "entity:person", "location:location", "location:person", "person:person"].includes(pair);
}

function GraphCanvas({
  data,
  mode,
  filters,
  includeIsolatedUsers = false,
  includeIsolatedCatalog = false,
  onRequestActions,
  onOpenTimeline,
  layoutStorageKey,
}: {
  data: PersonalGraph;
  mode: GraphMode;
  filters: GraphFilters;
  includeIsolatedUsers?: boolean;
  includeIsolatedCatalog?: boolean;
  onRequestActions: (request: GraphActionRequest) => void;
  onOpenTimeline: () => void;
  layoutStorageKey: string;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [multiSelectedIds, setMultiSelectedIds] = useState<string[]>([]);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [customPositions, setCustomPositions] = useState<Record<string, GraphPoint>>(() => {
    try {
      return JSON.parse(window.localStorage.getItem(layoutStorageKey) ?? "{}") as Record<string, GraphPoint>;
    } catch {
      return {};
    }
  });
  const [contextMenu, setContextMenu] = useState<{ nodeId: string; x: number; y: number } | null>(null);
  const [edgeContextMenu, setEdgeContextMenu] = useState<{ edgeId: string; x: number; y: number } | null>(null);
  const [hiddenEdgeIds, setHiddenEdgeIds] = useState<string[]>([]);
  const [localNotice, setLocalNotice] = useState<string | null>(null);
  const [collisionHint, setCollisionHint] = useState<CollisionHint | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const graphRef = useRef<G6Graph | null>(null);
  const graphDataRef = useRef<G6GraphData>({ nodes: [], edges: [] });
  const topologyKeyRef = useRef("");
  const visualStatesRef = useRef<GraphVisualStates>({ nodes: {}, edges: {} });
  const lastRenderedTopologyRef = useRef("");
  const positionedRef = useRef<PositionedNode[]>([]);
  const requestActionsRef = useRef(onRequestActions);
  const collisionRef = useRef<{
    sourceId: string;
    targetId: string | null;
    ready: boolean;
    targetOrigin: G6Point | null;
    targetOffset: G6Point;
    sourceNormal: G6Point;
    impactStrength: number;
  } | null>(null);
  const dragKineticsRef = useRef<{
    sourceId: string;
    lastPosition: G6Point;
    lastAt: number;
    velocity: G6Point;
  } | null>(null);
  const collisionTimerRef = useRef<number | null>(null);
  const edges = mode === "relationships" ? data.relationshipEdges : data.evidenceEdges;
  const modeNodes = useMemo(
    () => mode === "relationships"
      ? data.nodes.filter((node) => node.kind !== "event")
      : data.nodes.filter((node) => node.kind !== "match"),
    [data.nodes, mode],
  );
  const rootId = modeNodes.find((node) => node.category === "self")?.id;
  const nodeById = useMemo(() => new Map(data.nodes.map((node) => [node.id, node])), [data.nodes]);
  const eventDates = useMemo(() => {
    const result = new Map<string, number>();
    for (const node of data.nodes) {
      if (node.kind !== "event") continue;
      const eventId = typeof node.metadata.eventId === "string" ? node.metadata.eventId : node.id.replace(/^event:/, "");
      const value = typeof node.metadata.occurredStart === "string" ? Date.parse(node.metadata.occurredStart) : Number.NaN;
      if (Number.isFinite(value)) result.set(eventId, value);
    }
    return result;
  }, [data.nodes]);
  const timeCutoff = useMemo(() => {
    if (filters.timeRange === "all") return null;
    const days = filters.timeRange === "30d" ? 30 : filters.timeRange === "90d" ? 90 : 365;
    return Date.now() - days * 86_400_000;
  }, [filters.timeRange]);
  const structurallyFilteredEdges = useMemo(() => edges.filter((edge) => {
    if (edge.weight < filters.minStrength) return false;
    if (filters.directOnly && rootId && edge.source !== rootId && edge.target !== rootId) return false;
    if (timeCutoff === null) return true;
    const dates = edge.evidenceEventIds.flatMap((eventId) => {
      const value = eventDates.get(eventId);
      return value === undefined ? [] : [value];
    });
    for (const nodeId of [edge.source, edge.target]) {
      const node = nodeById.get(nodeId);
      const rawDate = node?.kind === "occurrence" && typeof node.metadata.occurredDate === "string"
        ? Date.parse(node.metadata.occurredDate)
        : Number.NaN;
      if (Number.isFinite(rawDate)) dates.push(rawDate);
    }
    return dates.length === 0 || dates.some((date) => date >= timeCutoff);
  }), [edges, eventDates, filters.directOnly, filters.minStrength, nodeById, rootId, timeCutoff]);
  const visibleNodes = useMemo(
    () => {
      const groupEligible = new Set(modeNodes
        .filter((node) => {
          if (node.id === rootId) return true;
          if (!filters.nodeGroups.includes(nodeGroup(node))) return false;
          if (filters.hideAnonymous && node.kind === "match") return false;
          const unconnectedCatalogNode = node.metadata.catalog === true
            && node.metadata.visibility !== "public_projection";
          return !unconnectedCatalogNode || includeIsolatedCatalog;
        })
        .map((node) => node.id));
      const normalizedQuery = filters.query.trim().toLocaleLowerCase("zh-CN");
      const queryMatches = new Set(modeNodes
        .filter((node) => groupEligible.has(node.id) && node.label.toLocaleLowerCase("zh-CN").includes(normalizedQuery))
        .map((node) => node.id));
      const allowed = normalizedQuery ? new Set<string>([...(rootId ? [rootId] : []), ...queryMatches]) : groupEligible;
      if (normalizedQuery) {
        for (const edge of structurallyFilteredEdges) {
          if (queryMatches.has(edge.source) && groupEligible.has(edge.target)) allowed.add(edge.target);
          if (queryMatches.has(edge.target) && groupEligible.has(edge.source)) allowed.add(edge.source);
        }
      }
      const visibleWorldUsers = includeIsolatedUsers && !normalizedQuery && !filters.directOnly
        ? modeNodes
          .filter((node) => node.kind === "user" && groupEligible.has(node.id))
          .map((node) => node.id)
        : [];
      const visibleCatalogEntities = includeIsolatedCatalog
        && !normalizedQuery
        && !filters.directOnly
        && filters.minStrength <= 1
        ? modeNodes
          .filter((node) => node.metadata.catalog === true && groupEligible.has(node.id))
          .map((node) => node.id)
        : [];
      const visibleIds = new Set<string>([
        ...(rootId ? [rootId] : []),
        ...visibleWorldUsers,
        ...visibleCatalogEntities,
        ...(normalizedQuery ? queryMatches : []),
      ]);
      for (const edge of structurallyFilteredEdges) {
        if (!allowed.has(edge.source) || !allowed.has(edge.target)) continue;
        visibleIds.add(edge.source);
        visibleIds.add(edge.target);
      }
      return modeNodes.filter((node) => visibleIds.has(node.id));
    },
    [filters.directOnly, filters.hideAnonymous, filters.minStrength, filters.nodeGroups, filters.query, includeIsolatedCatalog, includeIsolatedUsers, modeNodes, rootId, structurallyFilteredEdges],
  );
  const positioned = useMemo(() => layoutNodes(visibleNodes, mode), [visibleNodes, mode]);
  positionedRef.current = positioned;
  requestActionsRef.current = onRequestActions;
  const positions = useMemo(
    () => new Map(positioned.map((node) => {
      const custom = customPositions[node.id];
      return [node.id, custom ? { ...node, ...custom } : node] as const;
    })),
    [customPositions, positioned],
  );

  useEffect(() => {
    setSelectedId((current) => current && !positions.has(current) ? null : current);
    setMultiSelectedIds((current) => current.filter((nodeId) => positions.has(nodeId)));
    setFocusedId((current) => current && !positions.has(current) ? null : current);
    setContextMenu((current) => current && !positions.has(current.nodeId) ? null : current);
  }, [positions]);

  const visibleEdges = useMemo(
    () => structurallyFilteredEdges.filter(
      (edge) => positions.has(edge.source) && positions.has(edge.target) && !hiddenEdgeIds.includes(edge.id),
    ),
    [hiddenEdgeIds, positions, structurallyFilteredEdges],
  );
  useEffect(() => {
    setSelectedEdgeId((current) => current && !visibleEdges.some((edge) => edge.id === current) ? null : current);
    setEdgeContextMenu((current) => current && !visibleEdges.some((edge) => edge.id === current.edgeId) ? null : current);
  }, [visibleEdges]);
  const selected = selectedId ? positions.get(selectedId) : undefined;
  const selectedEdges = selected
    ? visibleEdges.filter((edge) => edge.source === selected.id || edge.target === selected.id)
    : [];
  const selectedEdge = selectedEdgeId ? visibleEdges.find((edge) => edge.id === selectedEdgeId) : undefined;
  const focusedNodeIds = useMemo(() => {
    if (!focusedId) return null;
    const ids = new Set([focusedId]);
    for (const edge of visibleEdges) {
      if (edge.source === focusedId) ids.add(edge.target);
      if (edge.target === focusedId) ids.add(edge.source);
    }
    return ids;
  }, [focusedId, visibleEdges]);
  const focused = focusedId ? positions.get(focusedId) : undefined;
  const menuNode = contextMenu ? positions.get(contextMenu.nodeId) : undefined;
  const menuEdge = edgeContextMenu ? visibleEdges.find((edge) => edge.id === edgeContextMenu.edgeId) : undefined;

  const graphData = useMemo<G6GraphData>(() => ({
    nodes: positioned.map((defaultNode) => {
      const node = positions.get(defaultNode.id) ?? defaultNode;
      const visual = graphNodeVisual(node);
      const isRoot = node.category === "self";
      return {
        id: node.id,
        type: visual.type,
        data: {
          kind: node.kind,
          category: node.category,
          label: node.label,
        },
        style: {
          x: node.x,
          y: node.y,
          size: visual.size,
          ...visual.style,
          fill: isRoot
            ? "#25231f"
            : node.kind === "user"
              ? nodeColors.person
              : entityCategoryColors[node.category] ?? nodeColors[node.kind],
          stroke: isRoot ? "#fff7ef" : "rgba(255, 253, 248, 0.96)",
          lineWidth: isRoot ? 4 : 3,
          labelText: shortLabel(node.label, node.kind === "event" ? 9 : 12),
          labelPlacement: "bottom",
          labelOffsetY: 7,
          labelFill: "#25231f",
          labelFontSize: 11,
          labelFontWeight: isRoot ? 600 : 400,
          cursor: "grab",
          zIndex: isRoot ? 10 : 1,
          ...(isRoot ? {
            halo: true,
            haloStroke: "#bd4e32",
            haloStrokeOpacity: 0.72,
            haloLineWidth: 9,
            iconText: "我",
            iconFill: "#fff7ef",
            iconFontSize: 15,
            iconFontWeight: 700,
            shadowColor: "rgba(37, 35, 31, 0.2)",
            shadowBlur: 14,
          } : {}),
        },
      };
    }),
    edges: visibleEdges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      data: { weight: edge.weight, label: edge.label },
      style: {
        stroke: "rgba(72, 66, 56, 0.44)",
        lineWidth: Math.min(4.5, 0.8 + edge.weight * 0.5),
        lineDash: [7, 5],
        opacity: 0.92,
      },
    })),
  }), [positioned, positions, visibleEdges]);
  const topologyKey = useMemo(
    () => `${positioned.map((node) => node.id).join("|")}::${visibleEdges.map((edge) => edge.id).join("|")}`,
    [positioned, visibleEdges],
  );
  const visualStates = useMemo<GraphVisualStates>(() => {
    const nodes: Record<string, string[]> = {};
    const graphEdges: Record<string, string[]> = {};
    for (const node of positioned) {
      const states: string[] = [];
      if (selectedId === node.id) states.push("selected");
      if (multiSelectedIds.includes(node.id)) states.push("multiSelected");
      if (focusedId) {
        if (node.id === focusedId) states.push("focused");
        else if (focusedNodeIds?.has(node.id)) states.push("neighbor");
        else states.push("dimmed");
      }
      nodes[node.id] = states;
    }
    for (const edge of visibleEdges) {
      const states: string[] = [];
      const relatedToSelection = selectedId === edge.source || selectedId === edge.target;
      const relatedToFocus = focusedId === edge.source || focusedId === edge.target;
      if (relatedToSelection || relatedToFocus) states.push("highlighted");
      if (selectedEdgeId === edge.id) states.push("selected");
      if (focusedId && !relatedToFocus) states.push("dimmed");
      graphEdges[edge.id] = states;
    }
    return { nodes, edges: graphEdges };
  }, [focusedId, focusedNodeIds, multiSelectedIds, positioned, selectedEdgeId, selectedId, visibleEdges]);

  graphDataRef.current = graphData;
  topologyKeyRef.current = topologyKey;
  visualStatesRef.current = visualStates;

  useEffect(() => {
    const closeMenu = (event: PointerEvent) => {
      if (event.button === 0) {
        setContextMenu(null);
        setEdgeContextMenu(null);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setContextMenu(null);
        setEdgeContextMenu(null);
        setFocusedId(null);
      }
    };
    window.addEventListener("pointerdown", closeMenu);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", closeMenu);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    let disposed = false;
    let resizeObserver: ResizeObserver | null = null;

    void import("./g6-runtime").then(async ({ CanvasRenderer, EdgeEvent, Graph, GraphEvent, NodeEvent }) => {
      if (disposed) return;
      const initialData = graphDataRef.current;
      let paintFrame: number | null = null;
      let transformSettleTimer: number | null = null;
      let springFrame: number | null = null;
      let springGeneration = 0;
      let activeSpringMotions: SpringMotion[] = [];
      let lastCollisionPaintAt = 0;
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const paint = () => {
        if (disposed) return;
        for (const layer of Object.values(graph.getCanvas().getLayers())) layer.render();
      };
      const schedulePaint = () => {
        if (disposed || paintFrame !== null) return;
        paintFrame = window.requestAnimationFrame(() => {
          paintFrame = null;
          paint();
        });
      };
      const scheduleTransformPaint = () => {
        schedulePaint();
        if (transformSettleTimer !== null) window.clearTimeout(transformSettleTimer);
        // optimize-viewport-transform restores edges after its debounce window.
        // Auto rendering is disabled, so explicitly paint once that restore settles.
        transformSettleTimer = window.setTimeout(() => {
          transformSettleTimer = null;
          schedulePaint();
        }, 150);
      };
      const runSpring = (motions: SpringMotion[], duration: number, onFinish: () => void) => {
        springGeneration += 1;
        const generation = springGeneration;
        if (springFrame !== null) {
          window.cancelAnimationFrame(springFrame);
          if (activeSpringMotions.length) {
            const priorDestinations = Object.fromEntries(activeSpringMotions.map((motion) => [motion.id, motion.destination]));
            void graph.translateElementTo(priorDestinations, false).then(schedulePaint);
          }
        }
        activeSpringMotions = motions;
        const finish = () => {
          const positions = Object.fromEntries(motions.map((motion) => [motion.id, motion.destination]));
          void graph.translateElementTo(positions, false).then(schedulePaint);
          springFrame = null;
          activeSpringMotions = [];
          onFinish();
        };
        if (reducedMotion) {
          finish();
          return;
        }
        const startedAt = performance.now();
        let lastRenderedAt = startedAt - 34;
        const step = (now: number) => {
          if (disposed || generation !== springGeneration) return;
          const progress = Math.min(1, (now - startedAt) / duration);
          if (progress >= 1) {
            finish();
            return;
          }
          if (now - lastRenderedAt < 30) {
            springFrame = window.requestAnimationFrame(step);
            return;
          }
          lastRenderedAt = now;
          const positions: Record<string, G6Point> = {};
          for (const motion of motions) {
            const damping = motion.waveform === "return" ? 6.6 : 7.8;
            const frequency = motion.waveform === "return" ? 12.5 : 9.5;
            const wave = Math.exp(-damping * progress) * Math.cos(frequency * progress);
            positions[motion.id] = [
              motion.destination[0] + motion.vector[0] * wave,
              motion.destination[1] + motion.vector[1] * wave,
            ];
          }
          void graph.translateElementTo(positions, false).then(schedulePaint);
          springFrame = window.requestAnimationFrame(step);
        };
        springFrame = window.requestAnimationFrame(step);
      };
      const graph = new Graph({
        container,
        data: initialData,
        animation: false,
        autoResize: false,
        canvas: { enableMultiLayer: false },
        renderer: () => new CanvasRenderer({ enableAutoRendering: false }),
        // Retina screens otherwise quadruple the pixels repainted while dragging/zooming.
        // 1.5 keeps labels crisp enough while cutting interactive fill work substantially.
        devicePixelRatio: Math.min(window.devicePixelRatio || 1, 1.5),
        padding: 48,
        zoomRange: [0.25, 4],
        behaviors: [
          { type: "drag-canvas", key: "drag-canvas" },
          { type: "zoom-canvas", key: "zoom-canvas", animation: { duration: 0 }, sensitivity: 0.7 },
          {
            type: "drag-element",
            key: "drag-element",
            enable: (event: IElementDragEvent) => event.targetType === "node",
            trigger: [],
            animation: false,
            dropEffect: "none",
            hideEdge: "none",
            shadow: false,
            cursor: { default: "default", grab: "grab", grabbing: "grabbing" },
          },
          { type: "optimize-viewport-transform", key: "optimize-viewport", debounce: 120 },
        ],
        node: {
          animation: false,
          state: {
            selected: {
              stroke: "#e9b19f",
              lineWidth: 5,
              halo: true,
              haloStroke: "#bd4e32",
              haloStrokeOpacity: 0.45,
              haloLineWidth: 9,
            },
            multiSelected: {
              stroke: "#4e7967",
              lineWidth: 5,
              halo: true,
              haloStroke: "#4e7967",
              haloStrokeOpacity: 0.36,
              haloLineWidth: 10,
            },
            focused: {
              stroke: "#bd4e32",
              lineWidth: 5,
              halo: true,
              haloStroke: "#bd4e32",
              haloStrokeOpacity: 0.52,
              haloLineWidth: 10,
            },
            collisionCandidate: {
              halo: true,
              haloStroke: "#d79a59",
              haloStrokeOpacity: 0.32,
              haloLineWidth: 8,
            },
            dropReady: {
              stroke: "#fff7ef",
              lineWidth: 5,
              halo: true,
              haloStroke: "#bd4e32",
              haloStrokeOpacity: 0.72,
              haloLineWidth: 12,
            },
            dragging: {
              stroke: "#fff7ef",
              lineWidth: 5,
              halo: true,
              haloStroke: "#bd4e32",
              haloStrokeOpacity: 0.24,
              haloLineWidth: 8,
              shadowColor: "rgba(37, 35, 31, 0.3)",
              shadowBlur: 18,
              shadowOffsetY: 7,
            },
            neighbor: { opacity: 1, labelOpacity: 1 },
            dimmed: { opacity: 0.13, labelOpacity: 0.13 },
          },
        },
        edge: {
          type: "line",
          animation: false,
          state: {
            highlighted: { stroke: "rgba(189, 78, 50, 0.78)", opacity: 1 },
            selected: { stroke: "#bd4e32", lineWidth: 4, opacity: 1 },
            dimmed: { opacity: 0.06 },
          },
        },
      });

      graph.on(GraphEvent.AFTER_DRAW, schedulePaint);
      graph.on(GraphEvent.AFTER_RENDER, schedulePaint);
      graph.on(GraphEvent.AFTER_TRANSFORM, scheduleTransformPaint);
      graph.on(GraphEvent.AFTER_SIZE_CHANGE, schedulePaint);

      const applyCollisionState = (nodeId: string, state?: "collisionCandidate" | "dropReady") => {
        const baseStates = visualStatesRef.current.nodes[nodeId] ?? [];
        void graph.setElementState(nodeId, state ? [...baseStates, state] : baseStates, false).then(schedulePaint);
      };
      const applyDraggingState = (nodeId: string, active: boolean) => {
        const baseStates = visualStatesRef.current.nodes[nodeId] ?? [];
        void graph.setElementState(nodeId, active ? [...baseStates, "dragging"] : baseStates, false).then(schedulePaint);
      };
      const clearCollisionTarget = (restorePosition = true) => {
        if (collisionTimerRef.current !== null) window.clearTimeout(collisionTimerRef.current);
        collisionTimerRef.current = null;
        const current = collisionRef.current;
        if (current?.targetId) {
          applyCollisionState(current.targetId);
          if (restorePosition && current.targetOrigin) {
            void graph.translateElementTo(current.targetId, current.targetOrigin, false).then(schedulePaint);
          }
        }
        if (current) {
          current.targetId = null;
          current.ready = false;
          current.targetOrigin = null;
          current.targetOffset = [0, 0];
          current.impactStrength = 0;
        }
        setCollisionHint(null);
      };

      graph.on(NodeEvent.DRAG_START, (event: IElementDragEvent) => {
        const sourceId = String(event.target.id);
        const source = positionedRef.current.find((node) => node.id === sourceId);
        if (!source) return;
        springGeneration += 1;
        if (springFrame !== null) {
          window.cancelAnimationFrame(springFrame);
          if (activeSpringMotions.length) {
            const destinations = Object.fromEntries(activeSpringMotions.map((motion) => [motion.id, motion.destination]));
            void graph.translateElementTo(destinations, false).then(schedulePaint);
          }
        }
        springFrame = null;
        activeSpringMotions = [];
        const sourcePosition = graph.getElementPosition(sourceId);
        dragKineticsRef.current = {
          sourceId,
          lastPosition: sourcePosition,
          lastAt: performance.now(),
          velocity: [0, 0],
        };
        lastCollisionPaintAt = 0;
        applyDraggingState(sourceId, true);
        clearCollisionTarget();
        collisionRef.current = {
          sourceId,
          targetId: null,
          ready: false,
          targetOrigin: null,
          targetOffset: [0, 0],
          sourceNormal: [0, 0],
          impactStrength: 0,
        };
      });

      graph.on(NodeEvent.DRAG, (event: IElementDragEvent) => {
        const sourceId = String(event.target.id);
        const now = performance.now();
        const kinetics = dragKineticsRef.current;
        const sourcePosition = graph.getElementPosition(sourceId);
        if (kinetics?.sourceId === sourceId) {
          const elapsed = Math.max(4, Math.min(40, now - kinetics.lastAt));
          const instantX = (sourcePosition[0] - kinetics.lastPosition[0]) * 16 / elapsed;
          const instantY = (sourcePosition[1] - kinetics.lastPosition[1]) * 16 / elapsed;
          kinetics.velocity = [
            kinetics.velocity[0] * 0.55 + instantX * 0.45,
            kinetics.velocity[1] * 0.55 + instantY * 0.45,
          ];
          kinetics.lastPosition = sourcePosition;
          kinetics.lastAt = now;
        }
        const current = collisionRef.current;
        if (!current || current.sourceId !== sourceId) return;
        const source = positionedRef.current.find((node) => node.id === sourceId);
        if (!source) return;
        const [sourceX, sourceY] = sourcePosition;
        let closest: { node: PositionedNode; distance: number; threshold: number; contact: number } | null = null;
        for (const target of positionedRef.current) {
          if (!supportsDropInteraction(source, target)) continue;
          const [targetX, targetY] = graph.getElementPosition(target.id);
          const distance = Math.hypot(sourceX - targetX, sourceY - targetY);
          const radii = collisionRadius(source) + collisionRadius(target);
          const threshold = radii * 1.5;
          if (distance > threshold) continue;
          if (!closest || distance / threshold < closest.distance / closest.threshold) {
            closest = { node: target, distance, threshold, contact: radii * 0.96 };
          }
        }
        const nextTarget = closest?.node ?? null;
        if (nextTarget?.id !== current.targetId) {
          clearCollisionTarget();
        }
        if (!nextTarget) return;
        if (nextTarget.id !== current.targetId) {
          current.targetId = nextTarget.id;
          current.ready = false;
          current.targetOrigin = graph.getElementPosition(nextTarget.id);
          collisionRef.current = current;
          applyCollisionState(nextTarget.id, "collisionCandidate");
          setCollisionHint({ sourceId, targetId: nextTarget.id, targetLabel: nextTarget.label, ready: false });
        }
        const origin = current.targetOrigin ?? graph.getElementPosition(nextTarget.id);
        const deltaX = origin[0] - sourceX;
        const deltaY = origin[1] - sourceY;
        const normalLength = Math.max(1, Math.hypot(deltaX, deltaY));
        const normal: G6Point = [deltaX / normalLength, deltaY / normalLength];
        const contactProgress = closest ? Math.max(0, Math.min(1, (closest.contact - closest.distance) / closest.contact)) : 0;
        const attractionProgress = closest && closest.distance > closest.contact
          ? Math.max(0, Math.min(1, (closest.threshold - closest.distance) / Math.max(1, closest.threshold - closest.contact)))
          : 0;
        const push = contactProgress > 0 ? 4 + contactProgress * 12 : -attractionProgress * 5;
        const targetOffset: G6Point = [normal[0] * push, normal[1] * push];
        current.sourceNormal = normal;
        current.targetOffset = targetOffset;
        current.impactStrength = Math.max(contactProgress, attractionProgress * 0.35);
        if (now - lastCollisionPaintAt >= 30) {
          lastCollisionPaintAt = now;
          void graph.translateElementTo(nextTarget.id, [origin[0] + targetOffset[0], origin[1] + targetOffset[1]], false).then(schedulePaint);
        }

        if (closest && closest.distance <= closest.contact && collisionTimerRef.current === null && !current.ready) {
          collisionTimerRef.current = window.setTimeout(() => {
            const active = collisionRef.current;
            if (!active || active.sourceId !== sourceId || active.targetId !== nextTarget.id) return;
            collisionTimerRef.current = null;
            active.ready = true;
            applyCollisionState(nextTarget.id, "dropReady");
            setCollisionHint({ sourceId, targetId: nextTarget.id, targetLabel: nextTarget.label, ready: true });
            if (typeof navigator.vibrate === "function") navigator.vibrate(12);
          }, 460);
        } else if (closest && closest.distance > closest.contact && collisionTimerRef.current !== null) {
          window.clearTimeout(collisionTimerRef.current);
          collisionTimerRef.current = null;
        }
      });

      graph.on(NodeEvent.DRAG_END, (event: IElementDragEvent) => {
        const sourceId = String(event.target.id);
        applyDraggingState(sourceId, false);
        const kinetics = dragKineticsRef.current?.sourceId === sourceId ? dragKineticsRef.current : null;
        dragKineticsRef.current = null;
        const [x, y] = graph.getElementPosition(sourceId);
        const velocity = kinetics?.velocity ?? [0, 0];
        const speed = Math.hypot(velocity[0], velocity[1]);
        const velocityScale = speed > 16 ? 16 / speed : 1;
        const coastDestination: G6Point = [x + velocity[0] * velocityScale * 0.9, y + velocity[1] * velocityScale * 0.9];
        const coastMotion: SpringMotion = {
          id: sourceId,
          destination: coastDestination,
          vector: [x - coastDestination[0], y - coastDestination[1]],
          waveform: "release",
        };
        const current = collisionRef.current;
        if (!current || current.sourceId !== sourceId) {
          runSpring([coastMotion], 220, () => {
            setCustomPositions((positions) => ({ ...positions, [sourceId]: { x: coastDestination[0], y: coastDestination[1] } }));
          });
          return;
        }
        const activeTargetId = current.targetId;
        const targetId = current.ready ? current.targetId : null;
        const targetOrigin = current.targetOrigin;
        const targetPosition = activeTargetId ? graph.getElementPosition(activeTargetId) : null;
        const normal = current.sourceNormal;
        const impact = current.impactStrength;
        clearCollisionTarget(false);
        collisionRef.current = null;
        if (!targetId || !targetOrigin || !targetPosition) {
          if (activeTargetId && targetOrigin && targetPosition) {
            runSpring([
              coastMotion,
              { id: activeTargetId, destination: targetOrigin, vector: [targetPosition[0] - targetOrigin[0], targetPosition[1] - targetOrigin[1]], waveform: "return" },
            ], 240, () => {
              setCustomPositions((positions) => ({ ...positions, [sourceId]: { x: coastDestination[0], y: coastDestination[1] } }));
            });
          } else {
            runSpring([coastMotion], 220, () => {
              setCustomPositions((positions) => ({ ...positions, [sourceId]: { x: coastDestination[0], y: coastDestination[1] } }));
            });
          }
          return;
        }
        const recoil = 9 + impact * 9;
        const sourceDestination: G6Point = [x - normal[0] * recoil, y - normal[1] * recoil];
        runSpring([
          { id: sourceId, destination: sourceDestination, vector: [x - sourceDestination[0], y - sourceDestination[1]], waveform: "release" },
          { id: targetId, destination: targetOrigin, vector: [targetPosition[0] - targetOrigin[0], targetPosition[1] - targetOrigin[1]], waveform: "return" },
        ], 280, () => {
          setCustomPositions((positions) => ({ ...positions, [sourceId]: { x: sourceDestination[0], y: sourceDestination[1] } }));
          requestActionsRef.current({ gesture: "node_drop", sourceNodeId: sourceId, targetNodeId: targetId });
        });
      });

      graph.on(NodeEvent.CLICK, (event: IElementEvent) => {
        const nodeId = String(event.target.id);
        if (event.shiftKey) {
          setMultiSelectedIds((current) => current.includes(nodeId)
            ? current.filter((id) => id !== nodeId)
            : current.length < 12 ? [...current, nodeId] : current);
        } else {
          setSelectedId(nodeId);
          setSelectedEdgeId(null);
        }
      });
      graph.on(NodeEvent.CONTEXT_MENU, (event: IElementEvent) => {
        const nodeId = String(event.target.id);
        const rect = container.getBoundingClientRect();
        const clientX = Number.isFinite(event.clientX) ? event.clientX : rect.left + rect.width / 2;
        const clientY = Number.isFinite(event.clientY) ? event.clientY : rect.top + rect.height / 2;
        setSelectedId(nodeId);
        setEdgeContextMenu(null);
        setContextMenu({
          nodeId,
          x: Math.max(8, Math.min(clientX, window.innerWidth - 208)),
          y: Math.max(8, Math.min(clientY, window.innerHeight - 230)),
        });
      });
      graph.on(EdgeEvent.CLICK, (event: IElementEvent) => {
        setSelectedEdgeId(String(event.target.id));
        setSelectedId(null);
      });
      graph.on(EdgeEvent.CONTEXT_MENU, (event: IElementEvent) => {
        const edgeId = String(event.target.id);
        const rect = container.getBoundingClientRect();
        const clientX = Number.isFinite(event.clientX) ? event.clientX : rect.left + rect.width / 2;
        const clientY = Number.isFinite(event.clientY) ? event.clientY : rect.top + rect.height / 2;
        setSelectedEdgeId(edgeId);
        setContextMenu(null);
        setEdgeContextMenu({
          edgeId,
          x: Math.max(8, Math.min(clientX, window.innerWidth - 224)),
          y: Math.max(8, Math.min(clientY, window.innerHeight - 240)),
        });
      });

      const handleVisibilityChange = () => {
        if (!document.hidden) schedulePaint();
      };
      document.addEventListener("visibilitychange", handleVisibilityChange);

      await graph.render();
      if (disposed) {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
        graph.destroy();
        return;
      }
      if (graphDataRef.current !== initialData) {
        graph.setData(graphDataRef.current);
        await graph.render();
      }
      graphRef.current = graph;
      lastRenderedTopologyRef.current = topologyKeyRef.current;
      await graph.fitView({ when: "always", direction: "both" }, false);
      await applyGraphVisualStates(graph, visualStatesRef.current);
      paint();

      resizeObserver = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry || disposed) return;
        const width = Math.floor(entry.contentRect.width);
        const height = Math.floor(entry.contentRect.height);
        if (width > 0 && height > 0) graph.resize(width, height);
      });
      resizeObserver.observe(container);

      graph.on(GraphEvent.BEFORE_DESTROY, () => {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
        if (paintFrame !== null) window.cancelAnimationFrame(paintFrame);
        if (transformSettleTimer !== null) window.clearTimeout(transformSettleTimer);
        if (springFrame !== null) window.cancelAnimationFrame(springFrame);
        if (collisionTimerRef.current !== null) window.clearTimeout(collisionTimerRef.current);
        paintFrame = null;
        transformSettleTimer = null;
        springFrame = null;
        collisionTimerRef.current = null;
      });
    }).catch((error) => {
      console.error("关系图渲染器加载失败", error);
    });

    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      const graph = graphRef.current;
      graphRef.current = null;
      graph?.destroy();
    };
  }, []);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return undefined;
    let cancelled = false;
    const frame = window.requestAnimationFrame(() => {
      const shouldFit = lastRenderedTopologyRef.current !== topologyKey;
      graph.setData(graphData);
      void graph.render().then(async () => {
        if (cancelled) return;
        lastRenderedTopologyRef.current = topologyKey;
        if (shouldFit) await graph.fitView({ when: "always", direction: "both" }, false);
        await applyGraphVisualStates(graph, visualStatesRef.current);
      });
    });
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, [graphData, topologyKey]);

  useEffect(() => {
    const graph = graphRef.current;
    if (graph) void applyGraphVisualStates(graph, visualStates);
  }, [visualStates]);

  const fitGraph = () => {
    const graph = graphRef.current;
    if (graph) void graph.fitView({ when: "always", direction: "both" }, false);
  };

  const resetAllPositions = () => {
    const graph = graphRef.current;
    const defaults: Record<string, G6Point> = Object.fromEntries(
      positioned.map((node) => [node.id, [node.x, node.y] as G6Point]),
    );
    setCustomPositions({});
    setFocusedId(null);
    setContextMenu(null);
    window.localStorage.removeItem(layoutStorageKey);
    if (graph) {
      void graph.translateElementTo(defaults, false).then(() => graph.fitView({ when: "always", direction: "both" }, false));
    }
  };

  const saveLayout = () => {
    window.localStorage.setItem(layoutStorageKey, JSON.stringify(customPositions));
    setLocalNotice("当前布局已保存在这台设备上");
  };

  const exportVisibleGraph = () => {
    const source = containerRef.current?.querySelector("canvas");
    if (!source) {
      setLocalNotice("画布还没有准备好，请稍后再试");
      return;
    }
    const output = document.createElement("canvas");
    output.width = source.width;
    output.height = source.height;
    const context = output.getContext("2d");
    if (!context) return;
    context.fillStyle = "#fffdf8";
    context.fillRect(0, 0, output.width, output.height);
    context.drawImage(source, 0, 0);
    const stamp = `织络关系图 · 当前可见范围 · ${new Date().toLocaleString("zh-CN")}`;
    context.font = `${Math.max(12, Math.round(output.width / 90))}px sans-serif`;
    const metrics = context.measureText(stamp);
    context.fillStyle = "rgba(255,253,248,0.88)";
    context.fillRect(output.width - metrics.width - 28, output.height - 38, metrics.width + 20, 28);
    context.fillStyle = "rgba(55,49,40,0.72)";
    context.fillText(stamp, output.width - metrics.width - 18, output.height - 19);
    const anchor = document.createElement("a");
    anchor.download = `织络关系图-${new Date().toISOString().slice(0, 10)}.png`;
    anchor.href = output.toDataURL("image/png");
    anchor.click();
    setLocalNotice("已按当前筛选和隐私范围导出图片");
  };

  const toggleMultiSelection = (nodeId: string) => {
    setMultiSelectedIds((current) => current.includes(nodeId)
      ? current.filter((id) => id !== nodeId)
      : current.length < 12 ? [...current, nodeId] : current);
  };

  return (
    <>
      <div className="graph-stage">
        <div className="graph-canvas-wrap">
          <div className={`graph-canvas-tip ${focused ? "focused" : ""}`}>
            {focused ? (
              <>
                <span>正在聚焦：{shortLabel(focused.label, 16)}</span>
                <button type="button" onClick={() => setFocusedId(null)}>恢复全图</button>
              </>
            ) : <span>显示 {visibleNodes.length}/{modeNodes.length} 个节点 · 拖拽节点 · 滚轮缩放 · 右键更多</span>}
          </div>
          {collisionHint ? (
            <div className={`graph-collision-hint ${collisionHint.ready ? "ready" : ""}`}>
              <span>{collisionHint.ready ? "松开以组合节点" : "靠近并停留以组合"}</span>
              <strong>{shortLabel(collisionHint.targetLabel, 18)}</strong>
            </div>
          ) : null}
          {multiSelectedIds.length ? (
            <div className="graph-multi-selection" role="status">
              <span>已选 {multiSelectedIds.length}/12 个节点</span>
              <button type="button" disabled={multiSelectedIds.length < 2} onClick={() => onRequestActions({
                gesture: "multi_select",
                sourceNodeId: multiSelectedIds[0],
                nodeIds: multiSelectedIds,
              })}>组合记录</button>
              <button type="button" onClick={() => setMultiSelectedIds([])}>清除</button>
            </div>
          ) : null}
          <div className="graph-viewport-actions" aria-label="图谱视图操作">
            <button type="button" onClick={fitGraph}>适应画布</button>
            <button type="button" onClick={saveLayout}>保存布局</button>
            <button type="button" onClick={exportVisibleGraph}>导出视图</button>
            <button type="button" onClick={resetAllPositions}>重置布局</button>
          </div>
          <details className="graph-shape-legend">
            <summary>节点图例</summary>
            <div>
              <span><i className="self" />当前用户</span>
              <span><i className="people" />人物</span>
              <span><i className="event" />事件</span>
              <span><i className="occurrence" />共同经历</span>
              <span><i className="location" />地点</span>
              <span><i className="entity" />事物</span>
            </div>
          </details>
          <div
            ref={containerRef}
            className="graph-canvas"
            role="img"
            aria-label={mode === "relationships" ? "关系聚合图" : "事件证据图"}
            onContextMenu={(event) => event.preventDefault()}
          />
          <div className="graph-a11y-node-list" aria-label="可见图谱节点">
            {positioned.map((node) => (
              <button
                key={node.id}
                type="button"
                aria-pressed={multiSelectedIds.includes(node.id)}
                onClick={() => setSelectedId(node.id)}
                onKeyDown={(event) => { if (event.key === " ") { event.preventDefault(); toggleMultiSelection(node.id); } }}
              >{node.label}</button>
            ))}
          </div>
        </div>

        <aside className="graph-inspector">
          {selected ? (
            <>
              <span className="eyebrow">节点详情</span>
              <h2>{selected.label}</h2>
              <div className="graph-node-type">
                {selected.kind === "event"
                  ? "事件"
                  : categoryLabels[selected.category] ?? selected.category}
              </div>
              <dl>
                <div>
                  <dt>关联强度</dt>
                  <dd>{selected.weight}</dd>
                </div>
                <div>
                  <dt>关系数量</dt>
                  <dd>{selectedEdges.length}</dd>
                </div>
              </dl>
              <div className="graph-inspector-actions">
                <button type="button" onClick={() => toggleMultiSelection(selected.id)}>
                  {multiSelectedIds.includes(selected.id) ? "移出组合" : "加入组合"}
                </button>
                {selected.category !== "self" ? (
                  <button type="button" onClick={() => onRequestActions({ gesture: "node_context", sourceNodeId: selected.id })}>快捷操作</button>
                ) : null}
              </div>
              {selectedEdges.length ? (
                <div className="graph-evidence-list">
                  <strong>关系与证据</strong>
                  {selectedEdges.slice(0, 12).map((edge: GraphEdge) => (
                    <div key={edge.id}>
                      <span>{relationLabel(edge.label)}</span>
                      <small>
                        {edge.evidenceEventIds.length
                          ? `${edge.evidenceEventIds.length} 件事`
                          : "匿名共同特征"}
                      </small>
                    </div>
                  ))}
                </div>
              ) : null}
            </>
          ) : selectedEdge ? (
            <>
              <span className="eyebrow">关系详情</span>
              <h2>{relationLabel(selectedEdge.label)}</h2>
              <div className="graph-node-type">
                {positions.get(selectedEdge.source)?.label} → {positions.get(selectedEdge.target)?.label}
              </div>
              <dl>
                <div><dt>关联强度</dt><dd>{selectedEdge.weight}</dd></div>
                <div><dt>证据事件</dt><dd>{selectedEdge.evidenceEventIds.length}</dd></div>
              </dl>
              <div className="graph-inspector-actions">
                <button type="button" onClick={() => {
                  setFocusedId(selectedEdge.source);
                  void graphRef.current?.focusElement(selectedEdge.source, false);
                }}>聚焦关系</button>
                {selectedEdge.evidenceEventIds.length ? <button type="button" onClick={onOpenTimeline}>查看时间线</button> : null}
              </div>
            </>
          ) : (
            <div className="graph-inspector-empty">
              <strong>点击或拖拽一个节点</strong>
              <p>查看关系证据；右键节点可以聚焦关联或复位位置。</p>
            </div>
          )}
        </aside>
      </div>

      {contextMenu && menuNode ? (
        <div
          className="graph-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          role="menu"
          aria-label={`${menuNode.label} 节点操作`}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <strong>{shortLabel(menuNode.label, 18)}</strong>
          <button type="button" role="menuitem" onClick={() => { setSelectedId(menuNode.id); setContextMenu(null); }}>查看节点详情</button>
          <button type="button" role="menuitem" onClick={() => {
            setSelectedId(menuNode.id);
            setFocusedId(menuNode.id);
            setContextMenu(null);
            void graphRef.current?.focusElement(menuNode.id, false);
          }}>展开直接关系</button>
          {customPositions[menuNode.id] ? (
            <button type="button" role="menuitem" onClick={() => {
              const defaultPosition = positioned.find((node) => node.id === menuNode.id);
              if (defaultPosition) void graphRef.current?.translateElementTo(menuNode.id, [defaultPosition.x, defaultPosition.y], false);
              setCustomPositions((current) => {
                const next = { ...current };
                delete next[menuNode.id];
                return next;
              });
              setContextMenu(null);
            }}>重置此节点位置</button>
          ) : null}
          {menuNode.category !== "self" && ["user", "person", "entity", "location", "event"].includes(menuNode.kind) ? (
            <button type="button" role="menuitem" onClick={() => {
              setContextMenu(null);
              requestActionsRef.current({ gesture: "node_context", sourceNodeId: menuNode.id });
            }}>更多快捷操作…</button>
          ) : null}
          <button type="button" role="menuitem" onClick={resetAllPositions}>恢复默认布局</button>
        </div>
      ) : null}
      {edgeContextMenu && menuEdge ? (
        <div
          className="graph-context-menu graph-edge-context-menu"
          style={{ left: edgeContextMenu.x, top: edgeContextMenu.y }}
          role="menu"
          aria-label="关系操作"
          onPointerDown={(event) => event.stopPropagation()}
        >
          <strong>{relationLabel(menuEdge.label)}</strong>
          <button type="button" role="menuitem" onClick={() => { setSelectedEdgeId(menuEdge.id); setEdgeContextMenu(null); }}>查看关系证据</button>
          <button type="button" role="menuitem" onClick={() => {
            setFocusedId(menuEdge.source);
            setEdgeContextMenu(null);
            void graphRef.current?.focusElement(menuEdge.source, false);
          }}>聚焦两端节点</button>
          {menuEdge.evidenceEventIds.length ? <button type="button" role="menuitem" onClick={() => { setEdgeContextMenu(null); onOpenTimeline(); }}>在时间线查看</button> : null}
          <button type="button" role="menuitem" onClick={() => {
            setHiddenEdgeIds((current) => [...current, menuEdge.id]);
            setSelectedEdgeId(null);
            setEdgeContextMenu(null);
            setLocalNotice("已在当前视图隐藏这条关系");
          }}>隐藏这条关系</button>
        </div>
      ) : null}
      {localNotice ? (
        <div className="graph-local-notice" role="status">
          <span>{localNotice}</span>
          {hiddenEdgeIds.length ? <button type="button" onClick={() => { setHiddenEdgeIds([]); setLocalNotice("隐藏的关系已恢复"); }}>撤销隐藏</button> : null}
          <button type="button" aria-label="关闭提示" onClick={() => setLocalNotice(null)}>×</button>
        </div>
      ) : null}
    </>
  );
}

export function GraphView({
  personal,
  global,
  onQuickRecord,
  onOpenContacts,
  onOpenDiscovery,
  onOpenMemory,
  onOpenTimeline,
  onDataChanged,
}: {
  personal: PersonalGraph;
  global: GlobalGraph;
  onQuickRecord: (text: string, graphContext: Extract<GraphActionResult, { type: "entry_template" }>["graphContext"]) => Promise<void>;
  onOpenContacts: (tab: "friends" | "messages") => void;
  onOpenDiscovery: () => void;
  onOpenMemory: () => void;
  onOpenTimeline: () => void;
  onDataChanged: () => Promise<void>;
}) {
  const [scope, setScope] = useState<GraphScope>("global");
  const [mode, setMode] = useState<GraphMode>("relationships");
  const [worldEntityScope, setWorldEntityScope] = useState<WorldEntityScope>("catalog");
  const [filters, setFilters] = useState<GraphFilters>(defaultGraphFilters);
  const [actionResolution, setActionResolution] = useState<GraphActionResolution | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionNote, setActionNote] = useState("");
  const [dangerConfirmed, setDangerConfirmed] = useState(false);
  const [undoNotice, setUndoNotice] = useState<{ id: string; message: string; expiresAt: string } | null>(null);
  const data = scope === "global" ? global : personal;
  useEffect(() => {
    setActionResolution(null);
    setActionError(null);
    setActionMessage(null);
    setActionNote("");
    setDangerConfirmed(false);
  }, [scope, mode]);
  const activeFilterCount = [
    mode !== "relationships",
    filters.query.trim().length > 0,
    filters.nodeGroups.length < allNodeGroups.length,
    filters.timeRange !== "all",
    filters.minStrength > 1,
    filters.hideAnonymous,
    filters.directOnly,
    scope === "global" && worldEntityScope !== "catalog",
  ].filter(Boolean).length;
  const toggleNodeGroup = (group: GraphNodeGroup) => {
    setFilters((current) => ({
      ...current,
      nodeGroups: current.nodeGroups.includes(group)
        ? current.nodeGroups.filter((item) => item !== group)
        : [...current.nodeGroups, group],
    }));
  };
  const requestActions = async (request: GraphActionRequest) => {
    if (actionBusy) return;
    setActionBusy(true);
    setActionError(null);
    setActionMessage(null);
    setActionNote("");
    setDangerConfirmed(false);
    try {
      const resolution = await api.resolveGraphActions({
        scope: scope === "global" ? "world" : "personal",
        mode,
        ...request,
      });
      setActionResolution(resolution);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "无法读取快捷操作");
    } finally {
      setActionBusy(false);
    }
  };
  const executeAction = async (action: GraphActionItem) => {
    if (!actionResolution || actionBusy || !action.enabled) return;
    setActionBusy(true);
    setActionError(null);
    try {
      const result = await api.executeGraphAction({
        contextId: actionResolution.contextId,
        actionId: action.id,
        message: action.presentation === "contact" ? actionNote.trim() || undefined : undefined,
      });
      if (result.type === "entry_template") {
        const text = actionNote.trim() ? `${result.text}，${actionNote.trim()}` : result.text;
        await onQuickRecord(text, result.graphContext);
        setActionResolution(null);
      } else if (result.type === "friend_request") {
        setActionMessage(`已经向 ${result.user.label} 发送好友申请`);
        await onDataChanged();
      } else if (result.type === "conversation") {
        setActionResolution(null);
        onOpenContacts("messages");
      } else if (result.type === "navigation") {
        setActionResolution(null);
        if (result.destination === "contacts") onOpenContacts(result.tab as "friends" | "messages");
        else if (result.destination === "discover") onOpenDiscovery();
        else onOpenMemory();
      } else if (result.type === "graph_mutation") {
        setActionResolution(null);
        setActionMessage(null);
        if (result.undo) setUndoNotice({ id: result.undo.id, expiresAt: result.undo.expiresAt, message: result.changed ? "关系已经写入图谱" : "这条关系已经存在" });
        else setUndoNotice({ id: "", expiresAt: "", message: result.changed ? "关系已经写入图谱" : "这条关系已经存在" });
        await onDataChanged();
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "快捷操作失败");
    } finally {
      setActionBusy(false);
    }
  };
  const undoLastAction = async () => {
    if (!undoNotice?.id || actionBusy) return;
    setActionBusy(true);
    setActionError(null);
    try {
      await api.undoGraphAction(undoNotice.id);
      setUndoNotice({ id: "", expiresAt: "", message: "操作已撤销" });
      await onDataChanged();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "撤销失败");
    } finally {
      setActionBusy(false);
    }
  };
  return (
    <section className="graph-page">
      <div className="graph-toolbar">
        <div className="graph-toolbar-controls">
          <div className="graph-mode-switch" aria-label="图谱范围">
            <button
              className={scope === "global" ? "active" : ""}
              type="button"
              onClick={() => setScope("global")}
            >
              世界
            </button>
            <button
              className={scope === "personal" ? "active" : ""}
              type="button"
              onClick={() => setScope("personal")}
            >
              我
            </button>
          </div>
        </div>
        <div className="graph-toolbar-search">
          <div className="graph-toolbar-search-field">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="10.5" cy="10.5" r="6" />
              <path d="m15 15 4.5 4.5" />
            </svg>
            <input
              type="search"
              aria-label="搜索图谱节点"
              value={filters.query}
              onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))}
              placeholder="搜索人物、地点、书、App…"
            />
            {filters.query ? (
              <button type="button" aria-label="清除图谱搜索" onClick={() => setFilters((current) => ({ ...current, query: "" }))}>×</button>
            ) : null}
          </div>
          <details className="graph-filter-menu">
            <summary className={activeFilterCount ? "active" : ""}>
              <svg className="graph-filter-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 6h16M7 12h10M10 18h4" />
              </svg>
              <span className="graph-filter-label">更多筛选</span>
              {activeFilterCount ? <span className="graph-filter-count">{activeFilterCount}</span> : null}
              <svg className="graph-filter-chevron" viewBox="0 0 24 24" aria-hidden="true">
                <path d="m8 10 4 4 4-4" />
              </svg>
            </summary>
            <div className="graph-filter-popover" onPointerDown={(event) => event.stopPropagation()}>
              <div className="graph-filter-heading">
                <strong>筛选图谱</strong>
                <small>只影响当前展示</small>
              </div>
              <fieldset className="graph-filter-view-mode">
                <legend>查看方式</legend>
                <div>
                  <button className={mode === "relationships" ? "active" : ""} type="button" onClick={() => setMode("relationships")}>
                    <strong>关系</strong>
                    <small>聚合人物、地点与事物</small>
                  </button>
                  <button className={mode === "evidence" ? "active" : ""} type="button" onClick={() => setMode("evidence")}>
                    <strong>事件</strong>
                    <small>查看关系背后的事件链</small>
                  </button>
                </div>
              </fieldset>
              {scope === "global" ? (
                <fieldset className="graph-filter-view-mode graph-filter-entity-scope">
                  <legend>世界实体范围</legend>
                  <div>
                    <button className={worldEntityScope === "catalog" ? "active" : ""} type="button" onClick={() => setWorldEntityScope("catalog")}>
                      <strong>全部实体</strong>
                      <small>浏览实体库中的所有内容</small>
                    </button>
                    <button className={worldEntityScope === "connected" ? "active" : ""} type="button" onClick={() => setWorldEntityScope("connected")}>
                      <strong>关联实体</strong>
                      <small>只看已有公开事件连接</small>
                    </button>
                  </div>
                </fieldset>
              ) : null}
              <fieldset className="graph-filter-groups">
                <legend>节点类型</legend>
                <div>
                  {allNodeGroups.map((group) => (
                    <label key={group}>
                      <input type="checkbox" checked={filters.nodeGroups.includes(group)} onChange={() => toggleNodeGroup(group)} />
                      <span>{nodeGroupLabels[group]}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="graph-filter-selects">
                <label>
                  <span>事件时间</span>
                  <select value={filters.timeRange} onChange={(event) => setFilters((current) => ({ ...current, timeRange: event.target.value as GraphTimeRange }))}>
                    <option value="all">全部时间</option>
                    <option value="30d">最近 30 天</option>
                    <option value="90d">最近 90 天</option>
                    <option value="365d">最近一年</option>
                  </select>
                </label>
                <label>
                  <span>最低关联强度</span>
                  <select value={filters.minStrength} onChange={(event) => setFilters((current) => ({ ...current, minStrength: Number(event.target.value) }))}>
                    <option value={1}>不限</option>
                    <option value={2}>至少 2</option>
                    <option value={3}>至少 3</option>
                    <option value={5}>至少 5</option>
                  </select>
                </label>
              </div>
              <div className="graph-filter-toggles">
                <label><input type="checkbox" checked={filters.hideAnonymous} onChange={(event) => setFilters((current) => ({ ...current, hideAnonymous: event.target.checked }))} /><span>隐藏匿名关系</span></label>
                <label><input type="checkbox" checked={filters.directOnly} onChange={(event) => setFilters((current) => ({ ...current, directOnly: event.target.checked }))} /><span>只看与我的直接连接</span></label>
              </div>
              <div className="graph-filter-actions">
                <button type="button" onClick={() => { setFilters(defaultGraphFilters); setMode("relationships"); setWorldEntityScope("catalog"); }}>清除筛选</button>
                <button className="primary" type="button" onClick={(event) => event.currentTarget.closest("details")?.removeAttribute("open")}>完成</button>
              </div>
            </div>
          </details>
        </div>
        <div className="graph-stats" aria-label={scope === "global" ? "世界关系统计" : "个人关系统计"}>
          {scope === "global" ? (
            <>
              <div><strong>{data.stats.users ?? 1}</strong><span>用户</span></div>
              <div><strong>{data.stats.events}</strong><span>公开事件</span></div>
              <div><strong>{data.stats.connectedEntities ?? data.stats.entities}</strong><span>关联实体</span></div>
              <div><strong>{data.stats.catalogEntities ?? data.stats.entities}</strong><span>实体库</span></div>
            </>
          ) : (
            <>
              <div><strong>{data.stats.events}</strong><span>事件</span></div>
              <div><strong>{data.stats.people}</strong><span>人物</span></div>
              <div><strong>{data.stats.entities}</strong><span>事物</span></div>
              <div><strong>{data.stats.locations}</strong><span>地点</span></div>
            </>
          )}
        </div>
      </div>

      <GraphCanvas
        key={`${scope}:${mode}`}
        data={data}
        mode={mode}
        filters={filters}
        includeIsolatedUsers={scope === "global"}
        includeIsolatedCatalog={scope === "global" && worldEntityScope === "catalog"}
        layoutStorageKey={`trace-weave:graph-layout:${scope}:${mode}`}
        onOpenTimeline={onOpenTimeline}
        onRequestActions={(request) => void requestActions(request)}
      />

      {actionBusy && !actionResolution ? (
        <div className="graph-action-loading" role="status">正在读取可用操作…</div>
      ) : null}
      {actionError && !actionResolution ? (
        <div className="graph-action-toast" role="status">
          <span>{actionError}</span>
          <button type="button" onClick={() => setActionError(null)}>关闭</button>
        </div>
      ) : null}
      {actionResolution ? (
        <div className="graph-action-backdrop" role="presentation" onPointerDown={(event) => {
          if (event.target === event.currentTarget && !actionBusy) setActionResolution(null);
        }}>
          <section className="graph-action-sheet" role="dialog" aria-modal="true" aria-label="图谱快捷操作">
            <header>
              <div>
                <span>{actionResolution.nodes.length > 1 && !actionResolution.target ? "多节点组合" : actionResolution.target ? "组合操作" : "节点操作"}</span>
                <h2>{actionResolution.nodes.length > 1 && !actionResolution.target
                  ? actionResolution.nodes.map((node) => node.label).join(" × ")
                  : actionResolution.target
                  ? `${actionResolution.source.label} × ${actionResolution.target.label}`
                  : actionResolution.source.label}</h2>
              </div>
              <button type="button" aria-label="关闭快捷操作" disabled={actionBusy} onClick={() => setActionResolution(null)}>×</button>
            </header>
            {actionResolution.relationship ? (
              <div className="graph-action-relationship">
                <span>{({
                  none: "还不认识",
                  friend: "已经是好友",
                  incoming: "对方向你发送了申请",
                  outgoing: "好友申请等待处理中",
                  blocked: "当前无法建立联系",
                } as const)[actionResolution.relationship]}</span>
                {actionResolution.commonPoints.length ? <small>共同点：{actionResolution.commonPoints.join("、")}</small> : <small>暂时没有公开共同点</small>}
              </div>
            ) : null}
            {actionResolution.actions.some((action) => action.id === "contact.request") ? (
              <label className="graph-action-note">
                <span>好友申请留言</span>
                <textarea value={actionNote} maxLength={240} onChange={(event) => setActionNote(event.target.value)} placeholder="介绍一下自己，或者说说为什么想认识对方（可选）" />
              </label>
            ) : actionResolution.actions.some((action) => action.presentation === "quick_record") ? (
              <label className="graph-action-note compact">
                <span>补充一句</span>
                <textarea value={actionNote} maxLength={500} onChange={(event) => setActionNote(event.target.value)} placeholder="可以补充原因、感受或时间（可选）" />
              </label>
            ) : null}
            {actionResolution.actions.some((action) => action.presentation === "graph_mutation") ? (
              <div className="graph-action-mutation-note">
                <span>直接更新图谱</span>
                <small>只会修改属于你的事件；操作会生成事件新版本，可在时间线中继续编辑。</small>
              </div>
            ) : null}
            {actionResolution.actions.some((action) => action.id === "entity.merge") ? (
              <label className="graph-action-danger-confirm">
                <input type="checkbox" checked={dangerConfirmed} onChange={(event) => setDangerConfirmed(event.target.checked)} />
                <span>我确认这两个条目代表同一个实体。合并会迁移别名、事件证据与隐私策略。</span>
              </label>
            ) : null}
            <div className="graph-action-list">
              {actionResolution.actions.map((action) => (
                <button
                  key={action.id}
                  className={action.tone ?? "default"}
                  type="button"
                  disabled={actionBusy || !action.enabled || Boolean(actionMessage) || (action.id === "entity.merge" && !dangerConfirmed)}
                  onClick={() => void executeAction(action)}
                >
                  <span><strong>{action.label}</strong><small>{action.description}</small></span>
                  <i aria-hidden="true">→</i>
                </button>
              ))}
            </div>
            {actionError ? <div className="graph-action-status error">{actionError}</div> : null}
            {actionMessage ? <div className="graph-action-status success">{actionMessage}</div> : null}
          </section>
        </div>
      ) : null}
      {undoNotice ? (
        <div className="graph-undo-notice" role="status">
          <span>{undoNotice.message}</span>
          {undoNotice.id && new Date(undoNotice.expiresAt).getTime() > Date.now() ? (
            <button type="button" disabled={actionBusy} onClick={() => void undoLastAction()}>撤销</button>
          ) : null}
          <button type="button" aria-label="关闭提示" onClick={() => setUndoNotice(null)}>×</button>
        </div>
      ) : null}
    </section>
  );
}
