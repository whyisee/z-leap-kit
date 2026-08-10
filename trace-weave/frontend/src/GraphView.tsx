import { useEffect, useMemo, useRef, useState } from "react";
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import type { GlobalGraph, GraphEdge, GraphNode, PersonalGraph } from "./api";

type GraphMode = "relationships" | "evidence";
type GraphScope = "global" | "personal";
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
  event: "事件",
  anonymous_match: "匿名潜在关系",
  connected_account: "已连接用户",
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

function GraphCanvas({ data, mode, filters }: { data: PersonalGraph; mode: GraphMode; filters: GraphFilters }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [customPositions, setCustomPositions] = useState<Record<string, GraphPoint>>({});
  const [contextMenu, setContextMenu] = useState<{ nodeId: string; x: number; y: number } | null>(null);
  const dragRef = useRef<{
    nodeId: string;
    pointerId: number;
    offsetX: number;
    offsetY: number;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);
  const suppressClickRef = useRef(false);
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
        .filter((node) => node.id === rootId || (
          filters.nodeGroups.includes(nodeGroup(node))
          && (!filters.hideAnonymous || node.kind !== "match")
        ))
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
      const visibleIds = new Set<string>([...(rootId ? [rootId] : []), ...(normalizedQuery ? queryMatches : [])]);
      for (const edge of structurallyFilteredEdges) {
        if (!allowed.has(edge.source) || !allowed.has(edge.target)) continue;
        visibleIds.add(edge.source);
        visibleIds.add(edge.target);
      }
      return modeNodes.filter((node) => visibleIds.has(node.id));
    },
    [filters.hideAnonymous, filters.nodeGroups, filters.query, modeNodes, rootId, structurallyFilteredEdges],
  );
  const positioned = useMemo(() => layoutNodes(visibleNodes, mode), [visibleNodes, mode]);
  const positions = useMemo(
    () => new Map(positioned.map((node) => {
      const custom = customPositions[node.id];
      return [node.id, custom ? { ...node, ...custom } : node] as const;
    })),
    [customPositions, positioned],
  );

  useEffect(() => {
    setSelectedId((current) => current && !positions.has(current) ? null : current);
    setFocusedId((current) => current && !positions.has(current) ? null : current);
    setContextMenu((current) => current && !positions.has(current.nodeId) ? null : current);
  }, [positions]);

  const visibleEdges = structurallyFilteredEdges.filter(
    (edge) => positions.has(edge.source) && positions.has(edge.target),
  );
  const selected = selectedId ? positions.get(selectedId) : undefined;
  const selectedEdges = selected
    ? visibleEdges.filter((edge) => edge.source === selected.id || edge.target === selected.id)
    : [];
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

  useEffect(() => {
    const closeMenu = () => setContextMenu(null);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setContextMenu(null);
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

  const eventPoint = (event: ReactPointerEvent<SVGGElement>): GraphPoint | null => {
    const svg = event.currentTarget.ownerSVGElement;
    const matrix = svg?.getScreenCTM();
    if (!svg || !matrix) return null;
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const transformed = point.matrixTransform(matrix.inverse());
    return { x: transformed.x, y: transformed.y };
  };

  const startDrag = (event: ReactPointerEvent<SVGGElement>, node: PositionedNode) => {
    if (event.button !== 0) return;
    const point = eventPoint(event);
    if (!point) return;
    event.preventDefault();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Synthetic accessibility and test events may not own an active pointer.
    }
    dragRef.current = {
      nodeId: node.id,
      pointerId: event.pointerId,
      offsetX: point.x - node.x,
      offsetY: point.y - node.y,
      startX: point.x,
      startY: point.y,
      moved: false,
    };
    setDraggingId(node.id);
    setContextMenu(null);
  };

  const moveDrag = (event: ReactPointerEvent<SVGGElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const point = eventPoint(event);
    if (!point) return;
    if (Math.abs(point.x - drag.startX) > 2 || Math.abs(point.y - drag.startY) > 2) drag.moved = true;
    setCustomPositions((current) => ({
      ...current,
      [drag.nodeId]: {
        x: Math.max(-485, Math.min(485, point.x - drag.offsetX)),
        y: Math.max(-365, Math.min(365, point.y - drag.offsetY)),
      },
    }));
  };

  const finishDrag = (event: ReactPointerEvent<SVGGElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (drag.moved) {
      suppressClickRef.current = true;
      window.setTimeout(() => { suppressClickRef.current = false; }, 0);
    }
    dragRef.current = null;
    setDraggingId(null);
  };

  const openContextMenu = (
    event: ReactMouseEvent<SVGGElement>,
    nodeId: string,
    fallback?: { x: number; y: number },
  ) => {
    event.preventDefault();
    const x = Math.min(event.clientX || fallback?.x || 12, window.innerWidth - 208);
    const y = Math.min(event.clientY || fallback?.y || 12, window.innerHeight - 230);
    setSelectedId(nodeId);
    setContextMenu({ nodeId, x: Math.max(8, x), y: Math.max(8, y) });
  };

  const handleNodeKeyDown = (event: ReactKeyboardEvent<SVGGElement>, nodeId: string) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setSelectedId(nodeId);
    }
    if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
      const rect = event.currentTarget.getBoundingClientRect();
      openContextMenu(event as unknown as ReactMouseEvent<SVGGElement>, nodeId, {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      });
    }
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
            ) : <span>显示 {visibleNodes.length}/{modeNodes.length} 个节点 · 拖拽调整位置 · 右键更多</span>}
          </div>
          <svg
            className="graph-canvas"
            viewBox="-520 -410 1040 820"
            role="img"
            aria-label={mode === "relationships" ? "关系聚合图" : "事件证据图"}
            onPointerDown={() => setContextMenu(null)}
          >
            <g className="graph-edges">
              {visibleEdges.map((edge, index) => {
                const source = positions.get(edge.source)!;
                const target = positions.get(edge.target)!;
                const relatedToSelection = selectedId === edge.source || selectedId === edge.target;
                const relatedToFocus = focusedId === edge.source || focusedId === edge.target;
                const dimmed = Boolean(focusedId && !relatedToFocus);
                return (
                  <line
                    key={edge.id}
                    x1={source.x}
                    y1={source.y}
                    x2={target.x}
                    y2={target.y}
                    className={`${relatedToSelection || relatedToFocus ? "highlighted" : ""} ${dimmed ? "dimmed" : ""}`}
                    strokeWidth={Math.min(5, 0.8 + edge.weight * 0.55)}
                    style={{ "--edge-index": index } as CSSProperties}
                  />
                );
              })}
            </g>
            <g className="graph-nodes">
              {positioned.map((defaultNode, index) => {
                const node = positions.get(defaultNode.id) ?? defaultNode;
                const radius =
                  node.kind === "user"
                    ? 31
                    : node.kind === "event"
                      ? 11
                      : node.kind === "occurrence"
                        ? 20
                        : Math.min(25, 13 + Math.sqrt(node.weight) * 2.4);
                const dimmed = Boolean(focusedNodeIds && !focusedNodeIds.has(node.id));
                return (
                  <g
                    key={node.id}
                    className={`graph-node ${selectedId === node.id ? "selected" : ""} ${node.category === "self" ? "root" : ""} ${draggingId === node.id ? "dragging" : ""} ${dimmed ? "dimmed" : ""}`}
                    transform={`translate(${node.x} ${node.y})`}
                    role="button"
                    tabIndex={0}
                    aria-label={node.label}
                    onPointerDown={(event) => startDrag(event, node)}
                    onPointerMove={moveDrag}
                    onPointerUp={finishDrag}
                    onPointerCancel={finishDrag}
                    onClick={() => {
                      if (!suppressClickRef.current) setSelectedId(node.id);
                    }}
                    onContextMenu={(event) => openContextMenu(event, node.id)}
                    onKeyDown={(event) => handleNodeKeyDown(event, node.id)}
                  >
                    <g className="graph-node-visual" style={{ "--node-index": index } as CSSProperties}>
                      <circle r={radius} fill={nodeColors[node.kind]} />
                      <text y={radius + 16} textAnchor="middle">
                        {shortLabel(node.label, node.kind === "event" ? 9 : 12)}
                      </text>
                    </g>
                  </g>
                );
              })}
            </g>
          </svg>
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
          <button type="button" role="menuitem" onClick={() => { setSelectedId(menuNode.id); setFocusedId(menuNode.id); setContextMenu(null); }}>展开直接关系</button>
          {customPositions[menuNode.id] ? (
            <button type="button" role="menuitem" onClick={() => {
              setCustomPositions((current) => {
                const next = { ...current };
                delete next[menuNode.id];
                return next;
              });
              setContextMenu(null);
            }}>重置此节点位置</button>
          ) : null}
          <button type="button" role="menuitem" onClick={() => { setCustomPositions({}); setFocusedId(null); setContextMenu(null); }}>恢复默认布局</button>
        </div>
      ) : null}
    </>
  );
}

export function GraphView({ personal, global }: { personal: PersonalGraph; global: GlobalGraph }) {
  const [scope, setScope] = useState<GraphScope>("global");
  const [mode, setMode] = useState<GraphMode>("relationships");
  const [filters, setFilters] = useState<GraphFilters>(defaultGraphFilters);
  const data = scope === "global" ? global : personal;
  const activeFilterCount = [
    filters.query.trim().length > 0,
    filters.nodeGroups.length < allNodeGroups.length,
    filters.timeRange !== "all",
    filters.minStrength > 1,
    filters.hideAnonymous,
    filters.directOnly,
  ].filter(Boolean).length;
  const toggleNodeGroup = (group: GraphNodeGroup) => {
    setFilters((current) => ({
      ...current,
      nodeGroups: current.nodeGroups.includes(group)
        ? current.nodeGroups.filter((item) => item !== group)
        : [...current.nodeGroups, group],
    }));
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
          <div className="graph-detail-switch" aria-label="图谱显示方式">
            <button className={mode === "relationships" ? "active" : ""} type="button" onClick={() => setMode("relationships")}>关系</button>
            <button className={mode === "evidence" ? "active" : ""} type="button" onClick={() => setMode("evidence")}>事件</button>
          </div>
          <details className="graph-filter-menu">
            <summary className={activeFilterCount ? "active" : ""}>
              筛选{activeFilterCount ? <span>{activeFilterCount}</span> : null}
            </summary>
            <div className="graph-filter-popover" onPointerDown={(event) => event.stopPropagation()}>
              <div className="graph-filter-heading">
                <strong>筛选图谱</strong>
                <small>只影响当前展示</small>
              </div>
              <label className="graph-filter-search">
                <span>节点关键词</span>
                <input
                  value={filters.query}
                  onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))}
                  placeholder="搜索人物、地点、书、App…"
                />
              </label>
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
                <button type="button" onClick={() => setFilters(defaultGraphFilters)}>清除筛选</button>
                <button className="primary" type="button" onClick={(event) => event.currentTarget.closest("details")?.removeAttribute("open")}>完成</button>
              </div>
            </div>
          </details>
        </div>
        <div className="graph-stats" aria-label={scope === "global" ? "世界关系统计" : "个人关系统计"}>
          {scope === "global" ? (
            <>
              <div><strong>{data.stats.users ?? 1}</strong><span>用户</span></div>
              <div><strong>{data.stats.occurrences ?? 0}</strong><span>共同经历</span></div>
              <div><strong>{data.stats.sharedFeatures ?? 0}</strong><span>地点/事物</span></div>
              <div><strong>{data.stats.socialMatches}</strong><span>潜在关系</span></div>
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

      <GraphCanvas key={`${scope}:${mode}`} data={data} mode={mode} filters={filters} />
    </section>
  );
}
