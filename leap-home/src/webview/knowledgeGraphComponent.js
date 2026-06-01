function getKnowledgeGraphStyles() {
  return String.raw`    .knowledge-graph {
      display: grid;
      grid-template-rows: auto minmax(0, 1fr);
      gap: 8px;
      height: 100%;
      min-height: 0;
      min-width: 0;
    }
    .knowledge-graph-toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: center;
      justify-content: space-between;
    }
    .knowledge-graph-tabs {
      display: inline-flex;
      gap: 2px;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 7px;
      padding: 2px;
      background: var(--vscode-editor-background);
    }
    .knowledge-graph-tabs button,
    .knowledge-graph-actions button {
      min-height: 24px;
      height: 24px;
      border: 0;
      border-radius: 5px;
      padding: 0 7px;
      color: var(--vscode-descriptionForeground);
      background: transparent;
      font-size: 11px;
      font-weight: 700;
    }
    .knowledge-graph-tabs button.active {
      color: var(--vscode-button-foreground);
      background: var(--vscode-button-background);
    }
    .knowledge-graph-actions {
      display: inline-flex;
      gap: 4px;
      align-items: center;
    }
    .knowledge-graph-canvas {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(160px, 0.45fr);
      gap: 8px;
      align-items: stretch;
      min-height: 0;
    }
    .knowledge-graph-svg {
      display: block;
      width: 100%;
      height: 100%;
      min-height: 0;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 7px;
      background:
        radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--vscode-focusBorder) 9%, transparent), transparent 48%),
        var(--vscode-editor-background);
    }
    .knowledge-graph-node circle {
      fill: var(--vscode-editor-background);
      stroke: var(--vscode-focusBorder);
      stroke-width: 2;
    }
    .knowledge-graph-node.prompt circle { stroke: var(--vscode-charts-purple, #b180d7); }
    .knowledge-graph-node.code circle { stroke: var(--vscode-charts-blue, #3794ff); }
    .knowledge-graph-node.selected circle {
      fill: color-mix(in srgb, var(--vscode-focusBorder) 22%, var(--vscode-editor-background));
      stroke-width: 3;
    }
    .knowledge-graph-node text {
      fill: var(--vscode-foreground);
      font-size: 10px;
      font-weight: 700;
      text-anchor: middle;
      pointer-events: none;
    }
    .knowledge-graph-edge {
      stroke: var(--vscode-panel-border);
      stroke-width: 1.3;
    }
    .knowledge-graph-edge.link { stroke: var(--vscode-charts-blue, #3794ff); }
    .knowledge-graph-edge.metadata { stroke: var(--vscode-charts-orange, #d18616); }
    .knowledge-graph-edge.tag { stroke: var(--vscode-charts-green, #89d185); }
    .knowledge-graph-edge.reference { stroke: var(--vscode-charts-yellow, #d7ba7d); }
    .knowledge-graph-edge.path { stroke: var(--vscode-descriptionForeground); }
    .knowledge-graph-side {
      display: grid;
      gap: 7px;
      grid-template-rows: auto minmax(0, 1fr) auto;
      align-content: stretch;
      min-height: 0;
      min-width: 0;
      overflow: hidden;
    }
    .knowledge-graph-summary,
    .knowledge-graph-relation {
      border: 1px solid var(--vscode-panel-border);
      border-radius: 7px;
      padding: 8px;
      background: var(--vscode-editor-background);
    }
    .knowledge-graph-title {
      overflow: hidden;
      font-size: 12px;
      font-weight: 800;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .knowledge-graph-meta,
    .knowledge-graph-reason {
      color: var(--vscode-descriptionForeground);
      font-size: 11px;
      line-height: 1.4;
    }
    .knowledge-graph-relation {
      display: grid;
      gap: 3px;
    }
    .knowledge-graph-relations {
      display: grid;
      gap: 7px;
      max-height: 118px;
      min-height: 0;
      overflow: hidden;
    }
    .knowledge-graph-insights {
      display: grid;
      grid-template-rows: auto minmax(0, 1fr);
      align-content: start;
      gap: 6px;
      min-height: 0;
      overflow: hidden;
    }
    .knowledge-graph-insight-list {
      display: grid;
      align-content: start;
      gap: 6px;
      min-height: 0;
      overflow: auto;
      overscroll-behavior: auto;
      scrollbar-gutter: stable;
    }
    .knowledge-graph-ai-status {
      display: grid;
      gap: 2px;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 7px;
      padding: 7px 8px;
      color: var(--vscode-descriptionForeground);
      background: color-mix(in srgb, var(--vscode-editor-background) 88%, var(--vscode-focusBorder) 12%);
      font-size: 11px;
      line-height: 1.35;
    }
    .knowledge-graph-ai-status strong {
      color: var(--vscode-foreground);
      font-size: 11px;
    }
    .knowledge-graph-ai-status.thinking,
    .knowledge-graph-ai-status.writing,
    .knowledge-graph-ai-status.reading {
      border-color: color-mix(in srgb, var(--vscode-focusBorder) 55%, var(--vscode-panel-border));
    }
    .knowledge-graph-ai-status.done {
      border-color: var(--vscode-charts-green, #89d185);
      background: color-mix(in srgb, var(--vscode-editor-background) 84%, var(--vscode-charts-green, #89d185) 16%);
    }
    .knowledge-graph-ai-status.error {
      border-color: var(--vscode-inputValidation-errorBorder, var(--vscode-charts-red, #d94b4b));
      background: var(--vscode-inputValidation-errorBackground, var(--vscode-editor-background));
    }
    .knowledge-graph-insight {
      display: grid;
      gap: 5px;
      border: 1px solid var(--vscode-panel-border);
      border-left: 3px solid var(--graph-insight-accent, var(--vscode-focusBorder));
      border-radius: 7px;
      padding: 8px;
      background: var(--vscode-editor-background);
    }
    .knowledge-graph-insight.missing-link { --graph-insight-accent: var(--vscode-charts-yellow, #d7ba7d); }
    .knowledge-graph-insight.hub { --graph-insight-accent: var(--vscode-charts-blue, #3794ff); }
    .knowledge-graph-insight.stale-hub { --graph-insight-accent: var(--vscode-charts-red, #d94b4b); }
    .knowledge-graph-insight.isolated { --graph-insight-accent: var(--vscode-charts-purple, #b180d7); }
    .knowledge-graph-insight.metadata { --graph-insight-accent: var(--vscode-charts-orange, #d18616); }
    .knowledge-graph-insight-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
    }
    .knowledge-graph-insight-actions button {
      min-height: 23px;
      height: 23px;
      border-radius: 5px;
      padding: 0 7px;
      font-size: 11px;
    }
    .knowledge-graph-insight-actions button:disabled {
      cursor: wait;
      opacity: 0.72;
    }
`;
}

function getKnowledgeGraphScript() {
  return String.raw`    function renderKnowledgeGraph(container, block) {
      const graph = state.model.data.knowledgeGraph || { nodes: [], edges: [] };
      const wrap = div('knowledge-graph');
      const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
      const edges = Array.isArray(graph.edges) ? graph.edges : [];
      if (nodes.length === 0) {
        wrap.appendChild(empty('还没有可展示的知识关系。'));
        container.appendChild(wrap);
        return;
      }
      const view = buildKnowledgeGraphView(graph, getLimit(block, 14));
      wrap.appendChild(knowledgeGraphToolbar(graph, view));
      const canvas = div('knowledge-graph-canvas');
      canvas.append(knowledgeGraphSvg(view), knowledgeGraphSidePanel(graph, view));
      wrap.appendChild(canvas);
      container.appendChild(wrap);
    }

    function knowledgeGraphToolbar(graph, view) {
      const toolbar = div('knowledge-graph-toolbar');
      const views = div('knowledge-graph-tabs');
      for (const option of [
        ['overview', '全图'],
        ['cluster', '主题'],
        ['isolated', '孤岛'],
        ['recent', '最近']
      ]) {
        views.appendChild(knowledgeGraphToggle(option[1], state.knowledgeGraphView === option[0], () => {
          state.knowledgeGraphView = option[0];
          state.knowledgeGraphNodeId = '';
          render();
        }));
      }
      const relations = div('knowledge-graph-tabs');
      for (const option of [
        ['all', '全部'],
        ['metadata', '元数据'],
        ['link', '链接'],
        ['tag', '标签'],
        ['reference', '引用'],
        ['path', '路径']
      ]) {
        relations.appendChild(knowledgeGraphToggle(option[1], state.knowledgeGraphRelation === option[0], () => {
          state.knowledgeGraphRelation = option[0];
          render();
        }));
      }
      const actions = div('knowledge-graph-actions');
      actions.appendChild(button('刷新', () => post('refresh'), true));
      const totalNodes = (graph.stats && graph.stats.nodes) || graph.nodes.length || 0;
      const totalEdges = (graph.stats && graph.stats.edges) || graph.edges.length || 0;
      const visibleNodes = view && Array.isArray(view.nodes) ? view.nodes.length : totalNodes;
      const visibleEdges = view && Array.isArray(view.edges) ? view.edges.length : totalEdges;
      const meta = div('knowledge-graph-meta', '当前 ' + String(visibleNodes) + '/' + String(totalNodes) + ' 节点 · ' + String(visibleEdges) + '/' + String(totalEdges) + ' 关系');
      toolbar.append(views, relations, actions, meta);
      return toolbar;
    }

    function knowledgeGraphToggle(label, active, onClick) {
      const control = button(label, onClick, true);
      control.className = active ? 'active' : '';
      return control;
    }

    function buildKnowledgeGraphView(graph, limit) {
      const allNodes = Array.isArray(graph.nodes) ? graph.nodes : [];
      const allEdges = filterKnowledgeGraphEdges(Array.isArray(graph.edges) ? graph.edges : []);
      const nodeMap = new Map(allNodes.map((node) => [node.id, node]));
      const selectedId = nodeMap.has(state.knowledgeGraphNodeId) ? state.knowledgeGraphNodeId : '';
      if (state.knowledgeGraphView === 'overview') {
        const nodes = allNodes.slice();
        const ids = new Set(nodes.map((node) => node.id));
        return {
          mode: 'overview',
          selectedId,
          nodes,
          edges: allEdges.filter((edge) => ids.has(edge.source) && ids.has(edge.target))
        };
      }
      if (state.knowledgeGraphView === 'isolated') {
        const connected = new Set(allEdges.flatMap((edge) => [edge.source, edge.target]));
        return {
          mode: 'isolated',
          selectedId: '',
          nodes: allNodes.filter((node) => !connected.has(node.id)).slice(0, limit),
          edges: []
        };
      }
      if (state.knowledgeGraphView === 'recent') {
        const nodes = allNodes.slice().sort((left, right) => (right.updatedAt || 0) - (left.updatedAt || 0)).slice(0, limit);
        const ids = new Set(nodes.map((node) => node.id));
        return {
          mode: 'recent',
          selectedId,
          nodes,
          edges: allEdges.filter((edge) => ids.has(edge.source) && ids.has(edge.target)).slice(0, limit * 2)
        };
      }
      const centerId = selectedId || getGraphCenterNodeId(allNodes, allEdges);
      if (!centerId) {
        return { mode: 'cluster', selectedId: '', nodes: allNodes.slice(0, limit), edges: allEdges.slice(0, limit * 2) };
      }
      const neighborEdges = allEdges.filter((edge) => edge.source === centerId || edge.target === centerId).slice(0, Math.max(4, limit - 1));
      const ids = new Set([centerId]);
      for (const edge of neighborEdges) {
        ids.add(edge.source);
        ids.add(edge.target);
      }
      const nodes = [nodeMap.get(centerId)].concat(Array.from(ids).filter((id) => id !== centerId).map((id) => nodeMap.get(id)).filter(Boolean)).slice(0, limit);
      const visibleIds = new Set(nodes.map((node) => node.id));
      return {
        mode: 'cluster',
        selectedId: centerId,
        nodes,
        edges: allEdges.filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target)).slice(0, limit * 2)
      };
    }

    function filterKnowledgeGraphEdges(edges) {
      if (state.knowledgeGraphRelation === 'all') return edges;
      return edges.filter((edge) => edge.relationGroup === state.knowledgeGraphRelation);
    }

    function getGraphCenterNodeId(nodes, edges) {
      const scores = new Map(nodes.map((node) => [node.id, node.weight || 0]));
      for (const edge of edges) {
        scores.set(edge.source, (scores.get(edge.source) || 0) + edge.weight);
        scores.set(edge.target, (scores.get(edge.target) || 0) + edge.weight);
      }
      return Array.from(scores.entries()).sort((left, right) => right[1] - left[1])[0]?.[0] || (nodes[0] && nodes[0].id) || '';
    }

    function knowledgeGraphSvg(view) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'knowledge-graph-svg');
      svg.setAttribute('viewBox', '0 0 640 260');
      svg.setAttribute('role', 'img');
      const positions = getKnowledgeGraphPositions(view.nodes, view.selectedId, view.mode);
      for (const edge of view.edges) {
        const start = positions.get(edge.source);
        const end = positions.get(edge.target);
        if (!start || !end) continue;
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('class', 'knowledge-graph-edge ' + (edge.relationGroup || 'path'));
        line.setAttribute('x1', String(start.x));
        line.setAttribute('y1', String(start.y));
        line.setAttribute('x2', String(end.x));
        line.setAttribute('y2', String(end.y));
        line.setAttribute('stroke-width', String(Math.max(1, Math.min(4, edge.weight / 30))));
        line.appendChild(svgTitle(edge.reasons.join(' · ') + ' · ' + String(edge.weight)));
        svg.appendChild(line);
      }
      for (const node of view.nodes) {
        const position = positions.get(node.id);
        if (!position) continue;
        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        group.setAttribute('class', ['knowledge-graph-node', node.type || 'document', node.id === view.selectedId ? 'selected' : ''].filter(Boolean).join(' '));
        group.setAttribute('tabindex', '0');
        group.addEventListener('click', () => {
          state.knowledgeGraphNodeId = node.id;
          state.knowledgeGraphView = 'cluster';
          render();
        });
        group.addEventListener('dblclick', () => post('openItem', { filePath: node.filePath }));
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', String(position.x));
        circle.setAttribute('cy', String(position.y));
        circle.setAttribute('r', String(Math.max(14, Math.min(28, 12 + (node.weight || 0)))));
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', String(position.x));
        text.setAttribute('y', String(position.y + 4));
        text.textContent = truncateGraphLabel(node.title, 9);
        group.append(circle, text, svgTitle(node.title + '\\n' + node.relativePath));
        svg.appendChild(group);
      }
      return svg;
    }

    function getKnowledgeGraphPositions(nodes, centerId, mode) {
      const positions = new Map();
      if (nodes.length === 0) return positions;
      const centerNode = nodes.find((node) => node.id === centerId) || nodes[0];
      positions.set(centerNode.id, { x: 320, y: 130 });
      const rest = nodes.filter((node) => node.id !== centerNode.id);
      if (mode === 'overview') {
        rest.forEach((node, index) => {
          const ring = index < 12 ? 1 : 2;
          const ringIndex = ring === 1 ? index : index - 12;
          const ringCount = ring === 1 ? Math.min(12, rest.length) : Math.max(1, rest.length - 12);
          const radiusX = ring === 1 ? 118 : 235;
          const radiusY = ring === 1 ? 54 : 103;
          const angle = -Math.PI / 2 + ringIndex * Math.PI * 2 / ringCount;
          positions.set(node.id, {
            x: Math.round(320 + Math.cos(angle) * radiusX),
            y: Math.round(130 + Math.sin(angle) * radiusY)
          });
        });
        return positions;
      }
      const radius = rest.length > 7 ? 102 : 92;
      rest.forEach((node, index) => {
        const angle = -Math.PI / 2 + index * Math.PI * 2 / Math.max(1, rest.length);
        positions.set(node.id, {
          x: Math.round(320 + Math.cos(angle) * radius),
          y: Math.round(130 + Math.sin(angle) * radius)
        });
      });
      return positions;
    }

    function knowledgeGraphSidePanel(graph, view) {
      const side = div('knowledge-graph-side');
      const selected = view.nodes.find((node) => node.id === view.selectedId) || view.nodes[0];
      const summary = div('knowledge-graph-summary');
      if (selected) {
        summary.append(
          div('knowledge-graph-title', selected.title),
          div('knowledge-graph-meta', selected.relativePath),
          div('knowledge-graph-meta', formatKnowledgeGraphNodeMeta(selected, view.edges))
        );
        const open = button('打开', () => post('openItem', { filePath: selected.filePath }), true);
        summary.appendChild(open);
      } else {
        summary.append(div('knowledge-graph-title', '暂无节点'), div('knowledge-graph-meta', '换个关系类型试试。'));
      }
      side.appendChild(summary);
      const selectedForInsights = selected && state.knowledgeGraphNodeId === selected.id ? selected : undefined;
      const insights = knowledgeGraphInsightsPanel(graph, selectedForInsights);
      if (insights) {
        side.appendChild(insights);
      }
      const relations = view.edges.slice(0, 6);
      if (relations.length === 0) {
        side.appendChild(div('knowledge-graph-relation', '当前视图没有关系边。'));
        return side;
      }
      const nodeMap = new Map((graph.nodes || []).map((node) => [node.id, node]));
      const relationList = div('knowledge-graph-relations');
      for (const edge of relations) {
        const relation = div('knowledge-graph-relation');
        const left = nodeMap.get(edge.source);
        const right = nodeMap.get(edge.target);
        relation.append(
          div('knowledge-graph-title', truncateGraphLabel((left && left.title || '') + ' ↔ ' + (right && right.title || ''), 28)),
          div('knowledge-graph-reason', edge.reasons.join(' · ') + ' · ' + edge.weight)
        );
        relationList.appendChild(relation);
      }
      side.appendChild(relationList);
      return side;
    }

    function knowledgeGraphInsightsPanel(graph, selectedNode) {
      const insights = getKnowledgeGraphInsights(graph, selectedNode)
        .filter((insight) => !isKnowledgeGraphAiCompleted(insight))
        .slice(0, 4);
      const status = state.knowledgeGraphAi || {};
      const hasStatus = status.phase && status.phase !== 'idle';
      if (insights.length === 0 && !hasStatus && !selectedNode) return undefined;
      const panel = div('knowledge-graph-insights');
      panel.appendChild(div('knowledge-graph-title', selectedNode ? '节点洞察' : '全局洞察'));
      const list = div('knowledge-graph-insight-list');
      list.appendChild(knowledgeGraphAiStatus());
      if (insights.length === 0 && selectedNode) {
        list.appendChild(div('knowledge-graph-reason', '当前节点暂时没有需要处理的洞察。'));
      }
      for (const insight of insights) {
        list.appendChild(knowledgeGraphInsightCard(insight));
      }
      panel.appendChild(list);
      return panel;
    }

    function getKnowledgeGraphInsights(graph, selectedNode) {
      const allInsights = Array.isArray(graph.insights) ? graph.insights : [];
      if (!selectedNode) {
        return allInsights;
      }
      const related = allInsights.filter((insight) => knowledgeGraphInsightMatchesNode(insight, selectedNode));
      const generated = buildKnowledgeGraphNodeInsights(graph, selectedNode);
      return uniqueKnowledgeGraphInsights(related.concat(generated))
        .sort((left, right) => (right.priority || 0) - (left.priority || 0) || String(left.title || '').localeCompare(String(right.title || '')));
    }

    function knowledgeGraphInsightMatchesNode(insight, node) {
      if (!insight || !node) return false;
      if (insight.nodeId === node.id || insight.filePath === node.filePath) return true;
      const relatedFiles = Array.isArray(insight.relatedFiles) ? insight.relatedFiles : [];
      return relatedFiles.some((file) =>
        file && (file.filePath === node.filePath || file.relativePath === node.relativePath || file.title === node.title)
      );
    }

    function buildKnowledgeGraphNodeInsights(graph, node) {
      const edges = (Array.isArray(graph.edges) ? graph.edges : [])
        .filter((edge) => edge.source === node.id || edge.target === node.id)
        .sort((left, right) => (right.weight || 0) - (left.weight || 0));
      const nodeMap = new Map((graph.nodes || []).map((item) => [item.id, item]));
      const relatedFiles = [knowledgeGraphNodeToRelatedFile(node)]
        .concat(edges.slice(0, 5).map((edge) => knowledgeGraphNodeToRelatedFile(getKnowledgeGraphOtherNode(edge, node, nodeMap))).filter(Boolean));
      const insights = [];
      if (edges.length === 0) {
        insights.push({
          id: 'node-isolated:' + node.id,
          type: 'isolated',
          title: '处理孤岛：' + node.title,
          reason: '这个节点还没有任何关系，可以补标签、补关联文档，或者归档到主题入口。',
          priority: 65,
          nodeId: node.id,
          filePath: node.filePath,
          relatedFiles,
          query: node.title
        });
      }
      const missingLink = edges.find((edge) => {
        const types = Array.isArray(edge.types) ? edge.types : [edge.type];
        return edge.weight >= 54 && !types.some((type) => type === 'markdown-link' || type === 'wikilink');
      });
      if (missingLink) {
        const other = getKnowledgeGraphOtherNode(missingLink, node, nodeMap);
        insights.push({
          id: 'node-missing-link:' + missingLink.id + ':' + node.id,
          type: 'missing-link',
          title: '补链接：' + node.title + (other ? ' ↔ ' + other.title : ''),
          reason: '当前节点存在强关系但没有显式链接：' + (missingLink.reasons || []).join('、') + '。',
          priority: 82,
          nodeId: node.id,
          edgeId: missingLink.id,
          filePath: node.filePath,
          relatedFiles,
          query: other ? node.title + ' ' + other.title : node.title
        });
      }
      if (edges.length >= 3) {
        insights.push({
          id: 'node-hub:' + node.id,
          type: 'hub',
          title: '整理入口：' + node.title,
          reason: '当前节点连接了 ' + String(edges.length) + ' 条关系，适合补摘要、主题标签和相关文档入口。',
          priority: 72 + edges.length,
          nodeId: node.id,
          filePath: node.filePath,
          relatedFiles,
          query: node.title
        });
      }
      if (!node.summary || !Array.isArray(node.tags) || node.tags.length === 0) {
        insights.push({
          id: 'node-metadata:' + node.id,
          type: 'metadata',
          title: '补元数据：' + node.title,
          reason: '这个节点缺少摘要或标签，补齐后图谱关系和搜索排序会更稳定。',
          priority: 62,
          nodeId: node.id,
          filePath: node.filePath,
          relatedFiles,
          query: node.title
        });
      }
      return insights;
    }

    function getKnowledgeGraphOtherNode(edge, node, nodeMap) {
      if (!edge || !node) return undefined;
      const otherId = edge.source === node.id ? edge.target : edge.source;
      return nodeMap.get(otherId);
    }

    function knowledgeGraphNodeToRelatedFile(node) {
      if (!node) return undefined;
      return {
        title: node.title,
        filePath: node.filePath,
        relativePath: node.relativePath
      };
    }

    function uniqueKnowledgeGraphInsights(insights) {
      const result = [];
      const seen = new Set();
      for (const insight of insights) {
        const id = String(insight && (insight.id || insight.title) || '');
        if (!id || seen.has(id)) continue;
        seen.add(id);
        result.push(insight);
      }
      return result;
    }

    function knowledgeGraphAiStatus() {
      const status = state.knowledgeGraphAi || {};
      const phase = status.phase && status.phase !== 'idle' ? status.phase : 'hint';
      const box = div('knowledge-graph-ai-status ' + phase);
      const title = document.createElement('strong');
      title.textContent = status.message || 'AI 整理会做什么';
      const detail = div('', status.detail || '读取目标文档和相关文档片段，让 DeepSeek 补充 tags、topics、summary、related 等 frontmatter 元数据，完成后刷新知识图谱。');
      box.append(title, detail);
      return box;
    }

    function knowledgeGraphInsightCard(insight) {
      const insightId = String(insight.id || insight.title || '');
      const card = div('knowledge-graph-insight ' + (insight.type || ''));
      card.append(
        div('knowledge-graph-title', insight.title || '图谱洞察'),
        div('knowledge-graph-reason', insight.reason || '这条关系值得整理。')
      );
      const actions = div('knowledge-graph-insight-actions');
      if (insight.filePath) {
        actions.appendChild(button('打开', () => post('openItem', { filePath: insight.filePath }), true));
      }
      if (insight.query) {
        actions.appendChild(button('搜索', () => runSearchFromCommand(insight.query), true));
      }
      if (insight.filePath) {
        const ai = button(isKnowledgeGraphAiLoading(insight) ? '整理中...' : 'AI 整理', () => {
          state.knowledgeGraphAi = {
            insightId,
            phase: 'reading',
            message: '准备整理这条洞察',
            detail: '正在发送请求给扩展端，随后会读取目标文档、生成元数据并刷新图谱。',
            targetFile: String(insight.filePath || '')
          };
          render();
          post('knowledgeGraphAiOrganize', { insight });
        }, true);
        ai.title = '读取目标文档和相关文档，让 DeepSeek 生成 frontmatter 元数据并刷新知识图谱';
        ai.disabled = isKnowledgeGraphAiBusy();
        actions.appendChild(ai);
      }
      card.appendChild(actions);
      return card;
    }

    function isKnowledgeGraphAiCompleted(insight) {
      const id = String(insight && (insight.id || insight.title) || '');
      return Boolean(id && state.knowledgeGraphAiCompleted[id]);
    }

    function isKnowledgeGraphAiBusy() {
      const phase = state.knowledgeGraphAi && state.knowledgeGraphAi.phase;
      return phase === 'reading' || phase === 'thinking' || phase === 'writing' || phase === 'busy';
    }

    function isKnowledgeGraphAiLoading(insight) {
      const status = state.knowledgeGraphAi || {};
      const id = String(insight && (insight.id || insight.title) || '');
      return isKnowledgeGraphAiBusy() && String(status.insightId || '') === id;
    }

    function formatKnowledgeGraphNodeMeta(node, edges) {
      const degree = edges.filter((edge) => edge.source === node.id || edge.target === node.id).length;
      const tags = node.tags && node.tags.length ? ' · #' + node.tags.slice(0, 3).join(' #') : '';
      return formatGraphNodeType(node.type) + ' · ' + String(degree) + ' 条关系' + tags;
    }

    function formatGraphNodeType(type) {
      return { prompt: 'Prompt', code: '代码', document: '文档' }[type] || '文档';
    }

    function svgTitle(text) {
      const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      title.textContent = text;
      return title;
    }

    function truncateGraphLabel(value, max) {
      const text = String(value || '').trim();
      return text.length > max ? text.slice(0, Math.max(1, max - 1)) + '…' : text;
    }

`;
}

module.exports = {
  getKnowledgeGraphStyles,
  getKnowledgeGraphScript
};
