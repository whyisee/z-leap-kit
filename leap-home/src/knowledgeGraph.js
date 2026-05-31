const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { getLeapComponentDataPath } = require('./storage');
const { hashText, normalizePath } = require('./utils');

const GRAPH_VERSION = 4;
const MAX_SOURCE_ITEMS = 90;
const MAX_NODES = 40;
const MAX_EDGES = 80;
const MAX_EDGES_PER_NODE = 8;
const MIN_EDGE_WEIGHT = 30;
const GRAPH_DOCUMENT_EXTENSIONS = new Set(['.md', '.mdx', '.mdc', '.markdown']);

function buildKnowledgeGraph(context, items, favorites) {
  const sourceItems = prepareGraphItems(items);
  const indexSignature = createIndexSignature(sourceItems);
  const cached = readKnowledgeGraphCache(context);
  if (cached && cached.indexSignature === indexSignature) {
    return cached;
  }

  const graph = buildGraphModel(sourceItems, favorites || [], indexSignature);
  writeKnowledgeGraphCache(context, graph);
  return graph;
}

function buildGraphModel(items, favorites, indexSignature) {
  const favoritePaths = new Set((favorites || []).map((item) => normalizePath(item.filePath || item)));
  const nodes = items.map((item) => createNode(item, favoritePaths));
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const itemById = new Map(items.map((item) => [getNodeId(item), item]));
  const aliases = buildAliasIndex(items);
  const edgeMap = new Map();

  for (const item of items) {
    addExplicitLinkEdges(edgeMap, item, aliases);
  }

  for (let leftIndex = 0; leftIndex < items.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < items.length; rightIndex += 1) {
      addPairEdge(edgeMap, items[leftIndex], items[rightIndex]);
    }
  }

  const rankedEdges = Array.from(edgeMap.values())
    .filter((edge) => edge.weight >= MIN_EDGE_WEIGHT && byId.has(edge.source) && byId.has(edge.target))
    .sort(compareEdges);
  const limitedEdges = limitEdgesPerNode(rankedEdges).slice(0, MAX_EDGES);
  const connectedNodeIds = new Set(limitedEdges.flatMap((edge) => [edge.source, edge.target]));
  const rankedNodes = nodes
    .map((node) => Object.assign({}, node, {
      weight: node.weight + getNodeDegreeWeight(node.id, limitedEdges)
    }))
    .sort(compareNodes);
  const selectedNodes = rankedNodes
    .filter((node) => connectedNodeIds.has(node.id))
    .concat(rankedNodes.filter((node) => !connectedNodeIds.has(node.id)))
    .slice(0, MAX_NODES);
  const selectedIds = new Set(selectedNodes.map((node) => node.id));
  const selectedEdges = limitedEdges.filter((edge) => selectedIds.has(edge.source) && selectedIds.has(edge.target));
  const insights = buildGraphInsights(selectedNodes, selectedEdges);

  return {
    version: GRAPH_VERSION,
    generatedAt: new Date().toISOString(),
    indexSignature,
    nodes: selectedNodes,
    edges: selectedEdges,
    isolated: selectedNodes.filter((node) => !selectedEdges.some((edge) => edge.source === node.id || edge.target === node.id)).slice(0, 12),
    stats: {
      indexedNodes: nodes.length,
      nodes: selectedNodes.length,
      edges: selectedEdges.length,
      isolated: selectedNodes.filter((node) => !selectedEdges.some((edge) => edge.source === node.id || edge.target === node.id)).length,
      strongestEdge: selectedEdges[0] ? selectedEdges[0].weight : 0,
      insights: insights.length
    },
    insights,
    relationTypes: summarizeRelationTypes(selectedEdges),
    updatedAt: Math.max(0, ...items.map((item) => item.updatedAt || 0)),
    nodeTitles: Object.fromEntries(selectedNodes.map((node) => [node.id, node.title])),
    itemById: Object.fromEntries(selectedNodes.map((node) => {
      const item = itemById.get(node.id);
      return [node.id, item ? { title: item.title, relativePath: item.relativePath } : {}];
    }))
  };
}

function buildGraphInsights(nodes, edges) {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const degree = buildDegreeMap(edges);
  const insights = []
    .concat(buildMissingLinkInsights(edges, nodeMap))
    .concat(buildHubInsights(nodes, edges, degree))
    .concat(buildStaleHubInsights(nodes, degree))
    .concat(buildIsolatedInsights(nodes, degree));
  const seen = new Set();
  return insights
    .filter((item) => {
      if (!item || seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    })
    .sort((left, right) => right.priority - left.priority || left.title.localeCompare(right.title))
    .slice(0, 8);
}

function buildMissingLinkInsights(edges, nodeMap) {
  return edges
    .filter((edge) => {
      const types = Array.isArray(edge.types) ? edge.types : [edge.type];
      return edge.weight >= 54 && !types.some((type) => type === 'markdown-link' || type === 'wikilink');
    })
    .slice(0, 4)
    .map((edge) => {
      const source = nodeMap.get(edge.source);
      const target = nodeMap.get(edge.target);
      if (!source || !target) return undefined;
      return {
        id: `missing-link:${edge.id}`,
        type: 'missing-link',
        title: `补链接：${source.title} ↔ ${target.title}`,
        reason: `关系很强但没有显式链接：${edge.reasons.join('、')}。`,
        priority: 80 + Math.min(20, edge.weight / 10),
        nodeId: source.id,
        edgeId: edge.id,
        filePath: source.filePath,
        relatedFiles: [toRelatedFile(source), toRelatedFile(target)],
        query: `${source.title} ${target.title}`,
        taskText: `为「${source.title}」和「${target.title}」补充知识链接`
      };
    })
    .filter(Boolean);
}

function buildHubInsights(nodes, edges, degree) {
  return nodes
    .filter((node) => (degree.get(node.id) || 0) >= 4)
    .slice(0, 3)
    .map((node) => ({
      id: `hub:${node.id}`,
      type: 'hub',
      title: `建立入口：${node.title}`,
      reason: `它连接了 ${degree.get(node.id)} 条关系，适合整理成主题入口或 README。`,
      priority: 70 + (degree.get(node.id) || 0),
      nodeId: node.id,
      filePath: node.filePath,
      relatedFiles: [toRelatedFile(node)],
      query: node.title,
      taskText: `为「${node.title}」整理主题入口和相关链接`
    }));
}

function buildStaleHubInsights(nodes, degree) {
  const staleBefore = Date.now() - 90 * 24 * 60 * 60 * 1000;
  return nodes
    .filter((node) => (degree.get(node.id) || 0) >= 3 && node.updatedAt && node.updatedAt < staleBefore)
    .slice(0, 3)
    .map((node) => ({
      id: `stale-hub:${node.id}`,
      type: 'stale-hub',
      title: `复查旧核心文档：${node.title}`,
      reason: `它仍连接 ${degree.get(node.id)} 条关系，但已经超过 90 天未更新。`,
      priority: 66 + (degree.get(node.id) || 0),
      nodeId: node.id,
      filePath: node.filePath,
      relatedFiles: [toRelatedFile(node)],
      query: node.title,
      taskText: `复查并更新核心文档「${node.title}」`
    }));
}

function buildIsolatedInsights(nodes, degree) {
  return nodes
    .filter((node) => (degree.get(node.id) || 0) === 0)
    .slice(0, 3)
    .map((node) => ({
      id: `isolated:${node.id}`,
      type: 'isolated',
      title: `处理孤岛：${node.title}`,
      reason: '它没有进入任何关系，可能需要补链接、归档或合并到主题入口。',
      priority: 46,
      nodeId: node.id,
      filePath: node.filePath,
      relatedFiles: [toRelatedFile(node)],
      query: node.title,
      taskText: `整理孤岛文档「${node.title}」`
    }));
}

function buildDegreeMap(edges) {
  const degree = new Map();
  for (const edge of edges) {
    degree.set(edge.source, (degree.get(edge.source) || 0) + 1);
    degree.set(edge.target, (degree.get(edge.target) || 0) + 1);
  }
  return degree;
}

function toRelatedFile(node) {
  return {
    title: node.title,
    filePath: node.filePath,
    relativePath: node.relativePath
  };
}

function prepareGraphItems(items) {
  return (Array.isArray(items) ? items : [])
    .filter((item) => item && item.filePath)
    .filter(isGraphDocumentItem)
    .map((item) => Object.assign({}, item, {
      normalizedPath: normalizePath(item.filePath),
      normalizedRelativePath: normalizePath(item.relativePath || path.basename(item.filePath)),
      searchContent: String(item.searchContent || '')
    }))
    .sort(compareSourceItems)
    .slice(0, MAX_SOURCE_ITEMS);
}

function isGraphDocumentItem(item) {
  if (!item || !item.filePath || item.category === 'code') {
    return false;
  }
  return GRAPH_DOCUMENT_EXTENSIONS.has(path.extname(item.filePath).toLowerCase());
}

function createNode(item, favoritePaths) {
  const favorite = favoritePaths.has(normalizePath(item.filePath));
  const topics = extractFrontmatterValues(item.frontmatterText, 'leap_topics').slice(0, 6);
  return {
    id: getNodeId(item),
    type: item.isPrompt ? 'prompt' : 'document',
    title: cleanTitle(item.title || item.fileName),
    filePath: item.filePath,
    relativePath: item.relativePath || item.fileName,
    sourceName: item.sourceName || '',
    category: item.category || 'document',
    tags: Array.isArray(item.tags) ? item.tags.slice(0, 8) : [],
    topics,
    summary: extractFrontmatterScalar(item.frontmatterText, 'leap_summary'),
    favorite,
    updatedAt: item.updatedAt || 0,
    weight: getBaseNodeWeight(item, favorite)
  };
}

function buildAliasIndex(items) {
  const aliases = new Map();
  for (const item of items) {
    const id = getNodeId(item);
    for (const alias of getItemAliases(item)) {
      if (!aliases.has(alias)) {
        aliases.set(alias, id);
      }
    }
  }
  return aliases;
}

function addExplicitLinkEdges(edgeMap, item, aliases) {
  const source = getNodeId(item);
  const content = item.searchContent || '';
  for (const targetText of extractMarkdownLinks(content)) {
    const target = resolveLinkTarget(item, targetText, aliases);
    if (target && target !== source) {
      addEdge(edgeMap, source, target, 'markdown-link', 90, 'Markdown 链接');
    }
  }
  for (const targetText of extractWikiLinks(content)) {
    const target = resolveLinkTarget(item, targetText, aliases);
    if (target && target !== source) {
      addEdge(edgeMap, source, target, 'wikilink', 86, 'Wikilink');
    }
  }
  for (const targetText of extractFrontmatterValues(item.frontmatterText, 'leap_related')) {
    const target = resolveLinkTarget(item, targetText, aliases);
    if (target && target !== source) {
      addEdge(edgeMap, source, target, 'metadata-related', 96, 'AI 元数据关联');
    }
  }
}

function addPairEdge(edgeMap, left, right) {
  const leftId = getNodeId(left);
  const rightId = getNodeId(right);
  const sharedTags = intersect(left.tags, right.tags).slice(0, 3);
  if (sharedTags.length > 0) {
    addEdge(edgeMap, leftId, rightId, 'shared-tags', Math.min(66, sharedTags.length * 22), `共享标签：${sharedTags.join(', ')}`);
  }

  if (sameDirectory(left, right)) {
    addEdge(edgeMap, leftId, rightId, 'same-directory', 16, '同目录');
  } else if (sameDocsModule(left, right)) {
    addEdge(edgeMap, leftId, rightId, 'same-module', 12, '同模块');
  }

  addReferenceEdge(edgeMap, left, right);
  addReferenceEdge(edgeMap, right, left);
}

function addReferenceEdge(edgeMap, sourceItem, targetItem) {
  const content = normalizeText(sourceItem.searchContent || '');
  if (!content) return;
  const source = getNodeId(sourceItem);
  const target = getNodeId(targetItem);
  const title = normalizeText(targetItem.title || '');
  const fileName = normalizeText(path.basename(targetItem.fileName || targetItem.filePath || '', path.extname(targetItem.fileName || targetItem.filePath || '')));
  if (title && title.length >= 4 && content.includes(title)) {
    addEdge(edgeMap, source, target, 'title-reference', 54, '标题引用');
  } else if (fileName && fileName.length >= 4 && content.includes(fileName)) {
    addEdge(edgeMap, source, target, 'filename-reference', 44, '文件名引用');
  }
}

function addEdge(edgeMap, source, target, type, weight, reason) {
  const ordered = type === 'markdown-link' || type === 'wikilink' || type.endsWith('reference')
    ? [source, target]
    : [source, target].sort();
  const key = `${ordered[0]}->${ordered[1]}`;
  const existing = edgeMap.get(key) || {
    id: `edge:${hashText(key)}`,
    source: ordered[0],
    target: ordered[1],
    type,
    relationGroup: getRelationGroup(type),
    weight: 0,
    reasons: [],
    types: []
  };
  existing.weight += weight;
  if (!existing.reasons.includes(reason)) existing.reasons.push(reason);
  if (!existing.types.includes(type)) existing.types.push(type);
  existing.type = existing.types[0] || type;
  existing.relationGroup = getRelationGroup(existing.type);
  edgeMap.set(key, existing);
}

function limitEdgesPerNode(edges) {
  const counts = new Map();
  const result = [];
  for (const edge of edges) {
    const sourceCount = counts.get(edge.source) || 0;
    const targetCount = counts.get(edge.target) || 0;
    if (sourceCount >= MAX_EDGES_PER_NODE || targetCount >= MAX_EDGES_PER_NODE) continue;
    counts.set(edge.source, sourceCount + 1);
    counts.set(edge.target, targetCount + 1);
    result.push(edge);
  }
  return result;
}

function readKnowledgeGraphCache(context) {
  try {
    const value = JSON.parse(fs.readFileSync(getLeapComponentDataPath(context, 'knowledgeGraph'), 'utf8'));
    return value && value.version === GRAPH_VERSION && Array.isArray(value.nodes) && Array.isArray(value.edges) ? value : undefined;
  } catch (error) {
    return undefined;
  }
}

function writeKnowledgeGraphCache(context, graph) {
  const filePath = getLeapComponentDataPath(context, 'knowledgeGraph');
  if (!filePath) return;
  fsp.mkdir(path.dirname(filePath), { recursive: true })
    .then(() => fsp.writeFile(filePath, JSON.stringify(graph, null, 2) + '\n', 'utf8'))
    .catch(() => {});
}

function createIndexSignature(items) {
  return hashText(items.map((item) => [
    item.filePath,
    item.updatedAt || 0,
    item.searchContent.length,
    (item.tags || []).join(','),
    item.frontmatterText || ''
  ].join(':')).join('|'));
}

function resolveLinkTarget(item, targetText, aliases) {
  const raw = String(targetText || '').split('#')[0].trim();
  if (!raw || raw.startsWith('http:') || raw.startsWith('https:') || raw.startsWith('mailto:')) return '';
  const candidates = [];
  const withoutQuery = raw.split('?')[0];
  const decoded = decodeLinkText(withoutQuery);
  candidates.push(decoded);
  candidates.push(normalizePath(path.normalize(path.join(path.dirname(item.normalizedRelativePath || ''), decoded))));
  candidates.push(path.basename(decoded));
  candidates.push(path.basename(decoded, path.extname(decoded)));
  for (const candidate of candidates.map(normalizeAlias)) {
    if (aliases.has(candidate)) return aliases.get(candidate);
  }
  return '';
}

function extractMarkdownLinks(content) {
  const result = [];
  const expression = /\[[^\]]+\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  let match;
  while ((match = expression.exec(content))) {
    result.push(match[1]);
  }
  return result.slice(0, 80);
}

function extractWikiLinks(content) {
  const result = [];
  const expression = /\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]/g;
  let match;
  while ((match = expression.exec(content))) {
    result.push(match[1]);
  }
  return result.slice(0, 80);
}

function extractFrontmatterScalar(frontmatterText, key) {
  const values = extractFrontmatterValues(frontmatterText, key);
  return values[0] || '';
}

function extractFrontmatterValues(frontmatterText, key) {
  const text = String(frontmatterText || '').replace(/\r?\n/g, ' ');
  if (!text) return [];
  const expression = new RegExp('(?:^|\\s)' + escapeRegExp(key) + '\\s*:\\s*([\\s\\S]*?)(?=\\s+[A-Za-z0-9_-]+\\s*:|$)', 'i');
  const match = text.match(expression);
  if (!match) return [];
  const raw = match[1].trim();
  if (!raw) return [];
  const values = [];
  for (const item of raw.matchAll(/-\s*(?:"([^"]+)"|'([^']+)'|([^\s]+))/g)) {
    values.push(item[1] || item[2] || item[3] || '');
  }
  if (values.length === 0) {
    const inline = raw.startsWith('[') && raw.endsWith(']') ? raw.slice(1, -1) : raw;
    values.push(...inline.split(/[,，]/));
  }
  return values
    .map((value) => String(value || '').replace(/^['"]|['"]$/g, '').trim())
    .filter(Boolean)
    .slice(0, 40);
}

function getItemAliases(item) {
  const relative = item.normalizedRelativePath || normalizePath(item.relativePath || '');
  const fileName = item.fileName || path.basename(item.filePath || '');
  const base = path.basename(fileName, path.extname(fileName));
  return [item.filePath, item.normalizedPath, relative, path.basename(relative), base, item.title]
    .concat(extractFrontmatterValues(item.frontmatterText, 'leap_aliases'))
    .filter(Boolean)
    .map(normalizeAlias);
}

function getNodeId(item) {
  return `file:${hashText(normalizePath(item.filePath || item.id || item.title || ''))}`;
}

function getBaseNodeWeight(item, favorite) {
  let weight = 6;
  if (item.category === 'document') weight += 2;
  if (item.isPrompt || item.category === 'prompt') weight += 2;
  if (favorite) weight += 4;
  if (isRecent(item.updatedAt)) weight += 2;
  if ((item.tags || []).length) weight += 1;
  return weight;
}

function getNodeDegreeWeight(nodeId, edges) {
  return edges.filter((edge) => edge.source === nodeId || edge.target === nodeId)
    .reduce((sum, edge) => sum + Math.min(6, Math.round(edge.weight / 24)), 0);
}

function getRelationGroup(type) {
  if (type === 'metadata-related') return 'metadata';
  if (type === 'markdown-link' || type === 'wikilink') return 'link';
  if (type === 'shared-tags') return 'tag';
  if (type === 'title-reference' || type === 'filename-reference') return 'reference';
  return 'path';
}

function summarizeRelationTypes(edges) {
  return edges.reduce((result, edge) => {
    result[edge.relationGroup] = (result[edge.relationGroup] || 0) + 1;
    return result;
  }, {});
}

function compareSourceItems(left, right) {
  return getSourcePriority(left) - getSourcePriority(right) ||
    (right.updatedAt || 0) - (left.updatedAt || 0) ||
    String(left.relativePath || '').localeCompare(String(right.relativePath || ''));
}

function getSourcePriority(item) {
  if (item.category === 'document') return 0;
  if (item.isPrompt || item.category === 'prompt') return 1;
  if (String(item.relativePath || '').startsWith('docs/')) return 2;
  return 5;
}

function compareEdges(left, right) {
  return right.weight - left.weight || left.id.localeCompare(right.id);
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function compareNodes(left, right) {
  return right.weight - left.weight || String(left.title).localeCompare(String(right.title));
}

function intersect(left, right) {
  const rightSet = new Set((right || []).map((item) => String(item).toLowerCase()));
  return (left || []).map((item) => String(item).toLowerCase()).filter((item) => rightSet.has(item));
}

function sameDirectory(left, right) {
  return path.dirname(left.normalizedRelativePath || '') === path.dirname(right.normalizedRelativePath || '');
}

function sameDocsModule(left, right) {
  const leftParts = String(left.normalizedRelativePath || '').split('/');
  const rightParts = String(right.normalizedRelativePath || '').split('/');
  return leftParts[0] === 'docs' && rightParts[0] === 'docs' && leftParts[1] && leftParts[1] === rightParts[1];
}

function isRecent(updatedAt) {
  const value = Number(updatedAt) || 0;
  return value > 0 && Date.now() - value < 14 * 24 * 60 * 60 * 1000;
}

function decodeLinkText(value) {
  try {
    return decodeURIComponent(String(value || ''));
  } catch (error) {
    return String(value || '');
  }
}

function normalizeAlias(value) {
  return normalizePath(String(value || '').replace(/^file:/, '').trim()).toLowerCase();
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function cleanTitle(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 80) || '未命名文档';
}

module.exports = {
  buildKnowledgeGraph
};
