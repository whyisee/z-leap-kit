const fs = require('fs/promises');
const path = require('path');
const vscode = require('vscode');
const {
  EXCLUDED_DIRECTORIES,
  FAVORITES_KEY,
  MARKDOWN_EXTENSIONS,
  MAX_INDEXED_FILE_BYTES,
  PROMPT_EXTENSIONS,
  RECENT_KEY,
  SCAN_LIMIT_PER_SOURCE,
  SEARCH_CONTENT_LIMIT,
  SKIPPED_WORKSPACE_FILE_NAMES,
  WORKSPACE_TEXT_EXTENSIONS,
  WORKSPACE_TEXT_FILE_NAMES
} = require('./constants');
const { getComponentDefinitions } = require('./components');
const { readCountdowns } = require('./countdown');
const { readFocusTimerSnapshot } = require('./focusTimer');
const { buildKnowledgeGraph } = require('./knowledgeGraph');
const { getHomeConfiguration, getTemplateSummaries } = require('./layout');
const { resolveInboxPath } = require('./inbox');
const { buildNextActionAiRecommendations, buildNextActionRecommendations, readNextActionFeedback } = require('./nextAction');
const { readQuickCaptures } = require('./quickCapture');
const { readSearchHistory } = require('./searchHistory');
const { getMaxRecentItems, getStoredPaths } = require('./state');
const { QUADRANT_DEFINITIONS, getLeapDataPaths, readLeapState } = require('./storage');
const { getWorkspaceName, hashText, normalizePath, resolveConfiguredPath } = require('./utils');

class LeapHomeIndex {
  constructor(context) {
    this.context = context;
    this.items = [];
    this.prompts = [];
    this.projectItems = [];
    this.sources = [];
    this.sourceSummaries = [];
    this.ready = false;
  }

  async ensureReady() {
    if (!this.ready) {
      await this.refresh();
    }
  }

  async refresh() {
    const sources = buildSources();
    const itemMap = new Map();
    const promptMap = new Map();
    const summaries = [];

    for (const source of sources) {
      const summary = {
        id: source.id,
        name: source.name,
        path: source.path,
        type: source.type,
        count: 0,
        latestUpdatedAt: 0,
        error: '',
        truncated: false
      };

      try {
        const scanned = await scanSource(source);
        summary.count = scanned.items.length;
        summary.latestUpdatedAt = scanned.latestUpdatedAt;
        summary.truncated = scanned.truncated;

        for (const item of scanned.items) {
          if (!itemMap.has(item.filePath)) {
            itemMap.set(item.filePath, item);
          }
          if (item.isPrompt && !promptMap.has(item.filePath)) {
            promptMap.set(item.filePath, toPromptItem(item));
          }
        }
      } catch (error) {
        summary.error = error.message;
      }

      summaries.push(summary);
    }

    await addInboxItem(this.context, itemMap);

    this.sources = sources;
    this.items = Array.from(itemMap.values()).sort(sortByUpdatedAt);
    this.prompts = Array.from(promptMap.values()).sort(sortByUpdatedAt);
    this.projectItems = getProjectItems(this.items);
    this.sourceSummaries = summaries;
    this.ready = true;
  }

  findItem(filePath) {
    const existing = this.items.find((item) => item.filePath === filePath);
    if (existing) {
      return existing;
    }

    return {
      id: hashText(filePath),
      title: path.basename(filePath),
      fileName: path.basename(filePath),
      filePath,
      relativePath: filePath,
      sourceId: 'external',
      sourceName: '外部文件',
      sourceType: 'file',
      tags: [],
      updatedAt: 0,
      isPrompt: false
    };
  }

  getModel() {
    const leapState = readLeapState(this.context);
    const focusTimer = readFocusTimerSnapshot(this.context);
    const countdown = readCountdowns(this.context);
    const nextActionFeedback = readNextActionFeedback(this.context);
    const searchHistory = readSearchHistory(this.context);
    const quickCaptures = readQuickCaptures(this.context);
    const favorites = getStoredPaths(this.context, FAVORITES_KEY)
      .map((filePath) => this.findItem(filePath))
      .filter(Boolean);
    const recent = getStoredPaths(this.context, RECENT_KEY)
      .slice(0, getMaxRecentItems())
      .map((filePath) => this.findItem(filePath))
      .filter(Boolean);
    const homeConfiguration = getHomeConfiguration(this.context);
    const stats = buildStats({
      items: this.items,
      prompts: this.prompts,
      favorites,
      recent,
      sources: this.sourceSummaries,
      quadrants: leapState.quadrants,
      calendarEvents: leapState.calendarEvents,
      focusTimer,
      countdown,
      searchHistory,
      nextActionFeedback
    });
    const knowledgeGraph = buildKnowledgeGraph(this.context, this.items, favorites);
    const systemRecommendations = buildNextActionRecommendations({
      quadrants: leapState.quadrants,
      calendarEvents: leapState.calendarEvents,
      countdown,
      quickCaptures,
      focusTimer,
      searchHistory
    }, nextActionFeedback);
    const nextAction = {
      systemRecommendations,
      aiRecommendations: buildNextActionAiRecommendations(systemRecommendations, nextActionFeedback),
      recommendations: systemRecommendations,
      ai: nextActionFeedback.ai,
      feedback: nextActionFeedback,
      metrics: nextActionFeedback.metrics
    };

    return {
      ready: this.ready,
      workspaceName: getWorkspaceName(),
      inboxPath: resolveInboxPath(this.context),
      activeTemplate: homeConfiguration.activeTemplate,
      activeHomeId: homeConfiguration.activeHomeId,
      activeHomeType: homeConfiguration.activeHomeType,
      activeTemplateTitle: homeConfiguration.activeTemplateTitle,
      templates: getTemplateSummaries(),
      components: getComponentDefinitions(),
      layout: homeConfiguration.layout,
      data: {
        items: this.items.map(serializeItem),
        prompts: this.prompts.map(serializePrompt),
        projectItems: this.projectItems.map(serializeItem),
        favorites: favorites.map(serializeItem),
        recent: recent.map(serializeItem),
        sources: this.sourceSummaries,
        quadrants: serializeQuadrants(leapState.quadrants),
        calendarEvents: leapState.calendarEvents,
        focusTimer,
        countdown,
        nextAction,
        knowledgeGraph,
        quickCaptures,
        searchHistory,
        stats,
        storage: getLeapDataPaths(this.context)
      }
    };
  }

  search(query, options) {
    const parsedQuery = parseSearchQuery(query);
    const terms = parsedQuery.terms;
    const limit = clampSearchLimit(parsedQuery.filters.limit || options && options.limit);
    const leapState = readLeapState(this.context);
    const entityItems = buildSearchEntities(leapState);
    const favoritePaths = new Set(getStoredPaths(this.context, FAVORITES_KEY));
    const recentPaths = getStoredPaths(this.context, RECENT_KEY);
    const recentWeights = new Map(recentPaths.map((filePath, index) => [filePath, Math.max(1, 12 - index)]));
    const projectPaths = new Set(this.projectItems.map((item) => item.filePath));
    const searchContext = { favoritePaths, recentWeights, projectPaths, parsedQuery };
    const ranked = terms.length === 0 && !hasOnlyFilters(parsedQuery)
      ? []
      : this.items.concat(entityItems)
        .filter((item) => matchesSearchFilters(item, searchContext))
        .map((item) => scoreSearchItem(item, terms, searchContext))
        .filter(Boolean)
        .sort((a, b) => sortSearchResults(a, b, parsedQuery.filters));

    return {
      query: String(query || '').trim(),
      filters: parsedQuery.filters,
      total: ranked.length,
      limit,
      indexedItems: this.items.length,
      indexedEntities: entityItems.length,
      sourceErrors: this.sourceSummaries.filter((source) => source.error).length,
      truncatedSources: this.sourceSummaries.filter((source) => source.truncated).length,
      groups: groupSearchResults(ranked.slice(0, limit), limit)
    };
  }
}

function buildSources() {
  const config = vscode.workspace.getConfiguration('leapHome');
  const configuredSources = config.get('sources', []);
  const promptDirs = config.get('promptDirs', []);
  const autoIndexWorkspace = config.get('autoIndexWorkspace', true);
  const sources = [];

  if (Array.isArray(configuredSources)) {
    for (const configured of configuredSources) {
      if (!configured || configured.enabled === false || !configured.path) {
        continue;
      }

      const resolvedPath = resolveConfiguredPath(configured.path);
      sources.push({
        id: sourceId(configured.name || resolvedPath, resolvedPath, configured.type || 'markdown'),
        name: configured.name || path.basename(resolvedPath),
        path: resolvedPath,
        type: configured.type || 'markdown',
        enabled: true
      });
    }
  }

  if (Array.isArray(promptDirs)) {
    for (const promptDir of promptDirs) {
      if (!promptDir) {
        continue;
      }

      const resolvedPath = resolveConfiguredPath(promptDir);
      sources.push({
        id: sourceId(path.basename(resolvedPath), resolvedPath, 'prompt'),
        name: path.basename(resolvedPath) || 'Prompt 模板',
        path: resolvedPath,
        type: 'prompt',
        enabled: true
      });
    }
  }

  if (autoIndexWorkspace && Array.isArray(vscode.workspace.workspaceFolders)) {
    for (const folder of vscode.workspace.workspaceFolders) {
      if (folder.uri.scheme !== 'file') {
        continue;
      }

      sources.push({
        id: sourceId(folder.name, folder.uri.fsPath, 'workspace'),
        name: folder.name,
        path: folder.uri.fsPath,
        type: 'workspace',
        enabled: true
      });
    }
  }

  return dedupeSources(sources);
}

function dedupeSources(sources) {
  const seen = new Set();
  const result = [];
  for (const source of sources) {
    const key = `${source.type}:${source.path}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(source);
  }
  return result;
}

async function addInboxItem(context, itemMap) {
  try {
    const inboxPath = resolveInboxPath(context);
    const stat = await fs.stat(inboxPath);
    if (!stat.isFile() || itemMap.has(inboxPath)) {
      return;
    }
    const source = {
      id: sourceId('收集箱', inboxPath, 'inbox'),
      name: '收集箱',
      path: path.dirname(inboxPath),
      type: 'inbox',
      enabled: true
    };
    const item = await createKnowledgeItem(inboxPath, source, stat);
    itemMap.set(item.filePath, item);
  } catch (error) {
    // The inbox is created lazily; a missing file should not make indexing noisy.
  }
}

async function scanSource(source) {
  const indexingOptions = getIndexingOptions();
  const stat = await fs.stat(source.path);
  const items = [];
  const state = { count: 0, truncated: false, latestUpdatedAt: 0 };

  if (stat.isFile()) {
    if (isAllowedFile(source, source.path, indexingOptions)) {
      const item = await createKnowledgeItem(source.path, source, stat, indexingOptions);
      items.push(item);
      state.latestUpdatedAt = item.updatedAt;
    }
    return { items, latestUpdatedAt: state.latestUpdatedAt, truncated: false };
  }

  if (!stat.isDirectory()) {
    return { items, latestUpdatedAt: 0, truncated: false };
  }

  await walkDirectory(source.path, source.path, source, items, state, indexingOptions);
  return { items, latestUpdatedAt: state.latestUpdatedAt, truncated: state.truncated };
}

async function walkDirectory(rootPath, currentPath, source, items, state, indexingOptions) {
  if (state.count >= SCAN_LIMIT_PER_SOURCE) {
    state.truncated = true;
    return;
  }

  let entries;
  try {
    entries = await fs.readdir(currentPath, { withFileTypes: true });
  } catch (error) {
    return;
  }

  entries.sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of entries) {
    if (state.count >= SCAN_LIMIT_PER_SOURCE) {
      state.truncated = true;
      return;
    }

    const entryPath = path.join(currentPath, entry.name);
    if (entry.isDirectory()) {
      if (!EXCLUDED_DIRECTORIES.has(entry.name) && !matchesIndexExclude(entryPath, indexingOptions)) {
        await walkDirectory(rootPath, entryPath, source, items, state, indexingOptions);
      }
      continue;
    }

    if (!entry.isFile() || !isAllowedFile(source, entryPath, indexingOptions)) {
      continue;
    }

    try {
      const item = await createKnowledgeItem(entryPath, source, undefined, indexingOptions);
      items.push(item);
      state.count += 1;
      state.latestUpdatedAt = Math.max(state.latestUpdatedAt, item.updatedAt);
    } catch (error) {
      // Skip unreadable files and keep the index useful.
    }
  }
}

function getIndexingOptions() {
  const config = vscode.workspace.getConfiguration('leapHome');
  return {
    includeExtensions: normalizeExtensions(config.get('index.includeExtensions', [])),
    excludeExtensions: normalizeExtensions(config.get('index.excludeExtensions', [])),
    excludePatterns: normalizePatterns(config.get('index.excludePatterns', [])),
    maxFileSizeBytes: clampIndexNumber(
      config.get('index.maxFileSizeKb', MAX_INDEXED_FILE_BYTES / 1024),
      16,
      10240
    ) * 1024,
    contentLimit: clampIndexNumber(
      config.get('index.contentLimitKb', SEARCH_CONTENT_LIMIT / 1024),
      4,
      512
    ) * 1024
  };
}

function normalizeExtensions(values) {
  if (!Array.isArray(values)) {
    return new Set();
  }
  return new Set(values
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean)
    .map((value) => value.startsWith('.') ? value : `.${value}`));
}

function normalizePatterns(values) {
  if (!Array.isArray(values)) {
    return [];
  }
  return values
    .map((value) => normalizePath(String(value || '').trim()).toLowerCase())
    .filter(Boolean);
}

function matchesIndexExclude(filePath, indexingOptions) {
  const patterns = indexingOptions && indexingOptions.excludePatterns;
  if (!Array.isArray(patterns) || patterns.length === 0) {
    return false;
  }
  const normalized = normalizePath(filePath).toLowerCase();
  return patterns.some((pattern) => simplePathPatternMatch(normalized, pattern));
}

function simplePathPatternMatch(text, pattern) {
  if (!pattern.includes('*')) {
    return text.includes(pattern);
  }
  const expression = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');
  return new RegExp(expression).test(text);
}

function clampIndexNumber(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return min;
  }
  return Math.min(Math.max(number, min), max);
}

function isAllowedFile(source, filePath, indexingOptions) {
  const options = indexingOptions || getIndexingOptions();
  const extension = path.extname(filePath).toLowerCase();
  if (matchesIndexExclude(filePath, options) || options.excludeExtensions.has(extension)) {
    return false;
  }
  if (source.type === 'prompt') {
    return PROMPT_EXTENSIONS.has(extension);
  }
  if (source.type === 'workspace') {
    return isWorkspaceTextFile(filePath, options);
  }
  return MARKDOWN_EXTENSIONS.has(extension) || isCursorRuleFile(filePath);
}

function isWorkspaceTextFile(filePath, indexingOptions) {
  const options = indexingOptions || getIndexingOptions();
  const extension = path.extname(filePath).toLowerCase();
  const fileName = path.basename(filePath).toLowerCase();
  if (SKIPPED_WORKSPACE_FILE_NAMES.has(fileName) || fileName.endsWith('.min.js') || fileName.endsWith('.min.css')) {
    return false;
  }
  if (options.includeExtensions.has(extension)) {
    return true;
  }
  if (isCursorRuleFile(filePath)) {
    return true;
  }
  if (WORKSPACE_TEXT_FILE_NAMES.has(fileName) || fileName.startsWith('.env.')) {
    return true;
  }
  return WORKSPACE_TEXT_EXTENSIONS.has(extension);
}

function isCursorRuleFile(filePath) {
  const normalized = normalizePath(filePath);
  return normalized.includes('/.cursor/') && (
    path.basename(filePath) === 'rules' ||
    normalized.includes('/.cursor/rules/')
  );
}

async function createKnowledgeItem(filePath, source, knownStat, indexingOptions) {
  const options = indexingOptions || getIndexingOptions();
  const stat = knownStat || await fs.stat(filePath);
  if (stat.size > options.maxFileSizeBytes) {
    throw new Error('文件过大，已跳过索引。');
  }
  const documentInfo = await readDocumentInfo(filePath, options);
  const category = getItemCategory(filePath, source);
  return {
    id: hashText(`${source.id}:${filePath}`),
    sourceId: source.id,
    sourceName: source.name,
    sourceType: source.type,
    title: getKnowledgeTitle(filePath, documentInfo, category),
    fileName: path.basename(filePath),
    filePath,
    relativePath: path.relative(source.path, filePath) || path.basename(filePath),
    tags: documentInfo.tags,
    headings: documentInfo.headings,
    frontmatterText: documentInfo.frontmatterText,
    searchLines: documentInfo.searchLines,
    updatedAt: stat.mtimeMs,
    isPrompt: source.type === 'prompt',
    category,
    searchContent: documentInfo.searchContent
  };
}

function getKnowledgeTitle(filePath, documentInfo, category) {
  if (category === 'document' || category === 'prompt') {
    return documentInfo.title || path.basename(filePath, path.extname(filePath));
  }
  return path.basename(filePath);
}

function getItemCategory(filePath, source) {
  if (source.type === 'prompt') {
    return 'prompt';
  }
  const extension = path.extname(filePath).toLowerCase();
  if (MARKDOWN_EXTENSIONS.has(extension) || isCursorRuleFile(filePath)) {
    return 'document';
  }
  if (source.type === 'workspace') {
    return 'code';
  }
  return 'document';
}

async function readDocumentInfo(filePath, indexingOptions) {
  const contentLimit = (indexingOptions && indexingOptions.contentLimit) || SEARCH_CONTENT_LIMIT;
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const head = content.slice(0, contentLimit);
    const frontmatterText = parseFrontmatterText(head);
    const headings = parseHeadings(head);
    const tags = parseTags(head);
    const searchLines = buildSearchLines(head);
    const frontmatterTitle = parseFrontmatterValue(frontmatterText, 'title');
    const heading = head.match(/^#\s+(.+?)\s*#*\s*$/m);
    if (heading) {
      return {
        title: cleanTitle(heading[1]),
        searchContent: cleanSearchContent(head, contentLimit),
        frontmatterText,
        headings,
        tags,
        searchLines
      };
    }

    const firstLine = stripFrontmatter(head)
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line && line !== '---');
    return {
      title: cleanTitle(frontmatterTitle || firstLine || ''),
      searchContent: cleanSearchContent(head, contentLimit),
      frontmatterText,
      headings,
      tags,
      searchLines
    };
  } catch (error) {
    return {
      title: '',
      searchContent: '',
      frontmatterText: '',
      headings: [],
      tags: [],
      searchLines: []
    };
  }
}

function cleanTitle(title) {
  return title.replace(/^#+\s*/, '').replace(/\s+/g, ' ').trim().slice(0, 120);
}

function cleanSearchContent(content, limit) {
  return String(content || '')
    .replace(/^---[\s\S]*?---/m, ' ')
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```[^\n]*\n?/g, ' '))
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
    .replace(/[#>*_\-~|\[\](){}`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limit || SEARCH_CONTENT_LIMIT);
}

function parseFrontmatterText(content) {
  const match = String(content || '').match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) {
    return '';
  }
  return match[1]
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
    .slice(0, 4096);
}

function parseFrontmatterValue(frontmatterText, key) {
  const expression = new RegExp('(?:^|\\n)' + key + '\\s*:\\s*(.+)(?:\\n|$)', 'i');
  const match = String(frontmatterText || '').match(expression);
  return match ? match[1].replace(/^['"]|['"]$/g, '').trim() : '';
}

function stripFrontmatter(content) {
  return String(content || '').replace(/^---\s*\n[\s\S]*?\n---/, '');
}

function parseHeadings(content) {
  const headings = [];
  const lines = String(content || '').split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (!match) {
      continue;
    }
    headings.push({
      level: match[1].length,
      text: cleanTitle(match[2]),
      line: index + 1
    });
  }
  return headings.slice(0, 80);
}

function parseTags(content) {
  const tags = new Set();
  const frontmatter = parseFrontmatterText(content);
  const tagMatch = frontmatter.match(/(?:^|\s)tags?\s*:\s*([^]+?)(?=\s+\w+\s*:|$)/i);
  if (tagMatch) {
    for (const tag of tagMatch[1].split(/[\s,[\]]+/)) {
      addTag(tags, tag);
    }
  }
  for (const match of String(content || '').matchAll(/(^|\s)#([\p{L}\p{N}_/-]{2,})/gu)) {
    addTag(tags, match[2]);
  }
  return Array.from(tags).slice(0, 40);
}

function addTag(tags, value) {
  const tag = String(value || '').replace(/^#/, '').replace(/['"]/g, '').trim().toLowerCase();
  if (tag && tag !== '-' && /[\p{L}\p{N}]/u.test(tag)) {
    tags.add(tag);
  }
}

function buildSearchLines(content) {
  return String(content || '')
    .split(/\r?\n/)
    .slice(0, 2400)
    .map((line, index) => ({
      line: index + 1,
      text: cleanSearchContent(line)
    }))
    .filter((item) => item.text);
}

function getProjectItems(items) {
  const folders = vscode.workspace.workspaceFolders || [];
  const roots = folders
    .filter((folder) => folder.uri.scheme === 'file')
    .map((folder) => folder.uri.fsPath);

  return items
    .filter((item) => roots.some((root) => isProjectDocument(root, item.filePath)))
    .sort((a, b) => projectDocumentWeight(a.filePath) - projectDocumentWeight(b.filePath) || sortByUpdatedAt(a, b))
    .slice(0, 20);
}

function isProjectDocument(rootPath, filePath) {
  const relative = normalizePath(path.relative(rootPath, filePath));
  if (!relative || relative.startsWith('../') || path.isAbsolute(relative)) {
    return false;
  }

  const upper = relative.toUpperCase();
  if (!relative.includes('/')) {
    return [
      'README.MD',
      'TODO.MD',
      'CHANGELOG.MD',
      'CONTRIBUTING.MD',
      'ROADMAP.MD',
      'NOTES.MD'
    ].includes(upper);
  }

  return relative.startsWith('docs/') || relative.startsWith('.cursor/');
}

function projectDocumentWeight(filePath) {
  const name = path.basename(filePath).toUpperCase();
  if (name === 'README.MD') {
    return 0;
  }
  if (name === 'TODO.MD') {
    return 1;
  }
  if (name === 'CHANGELOG.MD') {
    return 2;
  }
  if (normalizePath(filePath).includes('/docs/')) {
    return 3;
  }
  if (normalizePath(filePath).includes('/.cursor/')) {
    return 4;
  }
  return 5;
}

function serializeItem(item) {
  return {
    id: item.id,
    title: item.title,
    fileName: item.fileName,
    filePath: item.filePath,
    relativePath: item.relativePath,
    sourceName: item.sourceName,
    sourceType: item.sourceType,
    category: item.category || 'document',
    updatedAt: item.updatedAt
  };
}

function serializePrompt(prompt) {
  return {
    id: prompt.id,
    title: prompt.title,
    fileName: prompt.fileName,
    filePath: prompt.filePath,
    relativePath: prompt.relativePath,
    sourceName: prompt.sourceName,
    sourceType: prompt.sourceType,
    category: prompt.category || 'prompt',
    updatedAt: prompt.updatedAt
  };
}

function serializeQuadrants(quadrants) {
  return QUADRANT_DEFINITIONS.map((definition) => ({
    id: definition.id,
    title: definition.title,
    items: Array.isArray(quadrants[definition.id]) ? quadrants[definition.id] : []
  }));
}

function buildStats(data) {
  const quadrantTasksList = Object.entries(data.quadrants || {})
    .flatMap(([quadrantId, tasks]) => (Array.isArray(tasks) ? tasks : []).map((task) => Object.assign({ quadrantId }, task)));
  const quadrantTasks = quadrantTasksList.length;
  const doneTasks = quadrantTasksList.filter((task) => task.done).length;
  const openTasks = quadrantTasks - doneTasks;
  const todayKey = formatDateKey(new Date());
  const weekRange = getDateRange('week');
  const monthRange = getDateRange('month');
  const overdueTasks = quadrantTasksList.filter((task) => !task.done && task.dueDate && task.dueDate < todayKey).length;
  const undatedTasks = quadrantTasksList.filter((task) => !task.done && !task.dueDate).length;
  const todayTasks = quadrantTasksList.filter((task) => task.dueDate === todayKey).length;
  const weekTasks = quadrantTasksList.filter((task) => task.dueDate && task.dueDate >= weekRange.start && task.dueDate <= weekRange.end).length;
  const weekEvents = (data.calendarEvents || []).filter((event) => event.date >= weekRange.start && event.date <= weekRange.end).length;
  const monthScheduledDays = new Set(
    quadrantTasksList
      .map((task) => task.dueDate)
      .concat((data.calendarEvents || []).map((event) => event.date))
      .filter((date) => date >= monthRange.start && date <= monthRange.end)
  ).size;
  const activeSources = (data.sources || []).filter((source) => !source.error).length;
  const sourceErrors = (data.sources || []).filter((source) => source.error).length;
  const truncatedSources = (data.sources || []).filter((source) => source.truncated).length;
  const latestUpdatedAt = (data.items || []).reduce((latest, item) => Math.max(latest, item.updatedAt || 0), 0);
  const searchHistory = Array.isArray(data.searchHistory) ? data.searchHistory : [];
  const aiSearches = searchHistory.filter((item) => item.mode === 'ai').length;
  const nextActionMetrics = data.nextActionFeedback && data.nextActionFeedback.metrics ? data.nextActionFeedback.metrics : {};
  const focusHistory = data.focusTimer && Array.isArray(data.focusTimer.history) ? data.focusTimer.history : [];
  const focusRecords = focusHistory.filter((item) => item.type === 'focus');
  const completedFocusRecords = focusRecords.filter((item) => item.result !== 'aborted');
  const abortedFocusRecords = focusRecords.filter((item) => item.result === 'aborted');
  const linkedFocusRecords = focusRecords.filter((item) => item.task && item.task.title);
  const todayFocusRecords = focusRecords.filter((item) => formatDateKey(new Date(item.completedAt)) === todayKey);
  const todayCompletedFocusRecords = todayFocusRecords.filter((item) => item.result !== 'aborted');
  const weekFocusRecords = focusRecords.filter((item) => {
    const dateKey = formatDateKey(new Date(item.completedAt));
    return dateKey >= weekRange.start && dateKey <= weekRange.end;
  });
  const todayFocusMs = todayFocusRecords.reduce((sum, item) => sum + (item.focusedMs || 0), 0);
  const todayStrictFocusMs = todayFocusRecords.reduce((sum, item) => sum + (item.strictFocusedMs || 0), 0);
  const todayFocusInterruptions = todayFocusRecords.reduce((sum, item) => sum + (item.interruptions || 0), 0);
  const weekFocusMs = weekFocusRecords.reduce((sum, item) => sum + (item.focusedMs || 0), 0);
  const totalFocusMs = focusRecords.reduce((sum, item) => sum + (item.focusedMs || 0), 0);
  return {
    totalItems: data.items.length,
    prompts: data.prompts.length,
    favorites: data.favorites.length,
    recent: data.recent.length,
    sources: data.sources.length,
    activeSources,
    sourceErrors,
    truncatedSources,
    quadrantTasks,
    openTasks,
    doneTasks,
    completionRate: quadrantTasks > 0 ? Math.round(doneTasks / quadrantTasks * 100) : 0,
    overdueTasks,
    undatedTasks,
    todayTasks,
    weekTasks,
    calendarEvents: data.calendarEvents.length,
    weekEvents,
    monthScheduledDays,
    searchHistory: searchHistory.length,
    aiSearches,
    nextActionImpressions: nextActionMetrics.impressions || 0,
    nextActionAdopted: nextActionMetrics.adopted || 0,
    nextActionDismissed: nextActionMetrics.dismissed || 0,
    nextActionAdoptionRate: nextActionMetrics.adoptionRate || 0,
    nextActionAccuracyRate: nextActionMetrics.accuracyRate || 0,
    nextActionAiAdopted: nextActionMetrics.aiAdopted || 0,
    nextActionSystemAdopted: nextActionMetrics.systemAdopted || 0,
    focusRecords: focusRecords.length,
    completedFocusRecords: completedFocusRecords.length,
    abortedFocusRecords: abortedFocusRecords.length,
    linkedFocusRecords: linkedFocusRecords.length,
    focusLinkedRate: focusRecords.length > 0 ? Math.round(linkedFocusRecords.length / focusRecords.length * 100) : 0,
    focusCompletionRate: focusRecords.length > 0 ? Math.round(completedFocusRecords.length / focusRecords.length * 100) : 0,
    totalFocusMs,
    weekFocusRecords: weekFocusRecords.length,
    weekFocusMs,
    todayFocusRecords: todayFocusRecords.length,
    todayFocusSessions: todayCompletedFocusRecords.length,
    todayFocusMs,
    todayStrictFocusMs,
    todayFocusAverageInterruptions: todayFocusRecords.length > 0 ? Math.round(todayFocusInterruptions / todayFocusRecords.length * 10) / 10 : 0,
    latestSearch: searchHistory[0] ? searchHistory[0].query : '',
    latestUpdatedAt
  };
}

function sortByUpdatedAt(a, b) {
  return b.updatedAt - a.updatedAt || a.title.localeCompare(b.title);
}

function sourceId(name, sourcePath, type) {
  return hashText(`${name}:${sourcePath}:${type}`);
}

function toPromptItem(item) {
  return {
    id: item.id,
    title: item.title,
    fileName: item.fileName,
    filePath: item.filePath,
    relativePath: item.relativePath,
    sourceId: item.sourceId,
    sourceName: item.sourceName,
    sourceType: item.sourceType,
    category: item.category || 'prompt',
    updatedAt: item.updatedAt
  };
}

function buildSearchEntities(leapState) {
  return buildTaskSearchEntities(leapState.quadrants).concat(buildCalendarSearchEntities(leapState.calendarEvents));
}

function buildTaskSearchEntities(quadrants) {
  const result = [];
  for (const definition of QUADRANT_DEFINITIONS) {
    const tasks = Array.isArray(quadrants && quadrants[definition.id]) ? quadrants[definition.id] : [];
    for (const task of tasks) {
      result.push({
        id: `task:${definition.id}:${task.id}`,
        entityType: 'task',
        category: 'task',
        title: task.text,
        fileName: '',
        filePath: '',
        relativePath: definition.title + (task.dueDate ? ' · ' + task.dueDate : ''),
        sourceName: '四象限',
        sourceType: 'task',
        quadrantId: definition.id,
        quadrantTitle: definition.title,
        taskId: task.id,
        done: Boolean(task.done),
        tags: [],
        headings: [],
        frontmatterText: '',
        searchLines: [{
          line: 1,
          text: [task.text, task.note, task.reason, task.dueDate, task.done ? '已完成' : '未完成'].filter(Boolean).join(' ')
        }],
        updatedAt: toTimestamp(task.updatedAt || task.createdAt),
        searchContent: [task.text, task.note, task.reason, task.dueDate, definition.title, task.done ? '已完成' : '未完成'].filter(Boolean).join(' ')
      });
    }
  }
  return result;
}

function buildCalendarSearchEntities(events) {
  return (Array.isArray(events) ? events : []).map((event) => ({
    id: `calendar:${event.id}`,
    entityType: 'calendar',
    category: 'calendar',
    title: event.title,
    fileName: '',
    filePath: '',
    relativePath: [event.date, event.start, event.end].filter(Boolean).join(' '),
    sourceName: '日历',
    sourceType: 'calendar',
    eventId: event.id,
    date: event.date,
    start: event.start || '',
    end: event.end || '',
    tags: [],
    headings: [],
    frontmatterText: '',
    searchLines: [{
      line: 1,
      text: [event.title, event.date, event.start, event.end, event.type].filter(Boolean).join(' ')
    }],
    updatedAt: toTimestamp(event.date),
    searchContent: [event.title, event.date, event.start, event.end, event.type].filter(Boolean).join(' ')
  }));
}

function toTimestamp(value) {
  const timestamp = Date.parse(value || '');
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function parseSearchQuery(query) {
  const filters = {
    type: 'all',
    path: '',
    extension: '',
    title: '',
    source: '',
    recentDays: 0,
    projectOnly: false,
    favoriteOnly: false,
    recentOnly: false,
    taskStatus: '',
    dateRange: '',
    dateExact: '',
    after: '',
    before: '',
    sort: '',
    limit: 0,
    tags: []
  };
  const terms = [];
  for (const token of String(query || '').trim().split(/\s+/).filter(Boolean)) {
    const lower = token.toLowerCase();
    if (lower === '@prompt' || lower === '@prompts') {
      filters.type = 'prompt';
      continue;
    }
    if (lower === '@doc' || lower === '@docs' || lower === '@document' || lower === '@documents') {
      filters.type = 'docs';
      continue;
    }
    if (lower === '@code' || lower === '@source') {
      filters.type = 'code';
      continue;
    }
    if (lower === '@task' || lower === '@tasks') {
      filters.type = 'task';
      continue;
    }
    if (lower === '@calendar' || lower === '@event' || lower === '@events') {
      filters.type = 'calendar';
      continue;
    }
    if (lower === '@inbox') {
      filters.type = 'inbox';
      continue;
    }
    if (lower === '@favorite' || lower === '@favorites' || lower === '@fav' || lower === '@star' || lower === '@starred') {
      filters.favoriteOnly = true;
      continue;
    }
    if (lower === '@recent' || lower === '@opened') {
      filters.recentOnly = true;
      continue;
    }
    if (lower === '@latest' || lower === '@newest') {
      filters.sort = 'updatedDesc';
      continue;
    }
    if (lower === '@oldest') {
      filters.sort = 'updatedAsc';
      continue;
    }
    if (lower === '@todo' || lower === '@open' || lower === '@active') {
      filters.type = 'task';
      filters.taskStatus = 'open';
      continue;
    }
    if (lower === '@done' || lower === '@completed') {
      filters.type = 'task';
      filters.taskStatus = 'done';
      continue;
    }
    if (lower === '@today') {
      filters.dateRange = 'today';
      continue;
    }
    if (lower === '@week') {
      filters.dateRange = 'week';
      continue;
    }
    if (lower === '@month') {
      filters.dateRange = 'month';
      continue;
    }
    if (lower === '@project' || lower === '@current') {
      filters.projectOnly = true;
      continue;
    }
    if (lower.startsWith('path:')) {
      filters.path = lower.slice(5);
      continue;
    }
    if (lower.startsWith('ext:')) {
      filters.extension = normalizeExtensionFilter(lower.slice(4));
      continue;
    }
    if (lower.startsWith('title:')) {
      filters.title = lower.slice(6);
      continue;
    }
    if (lower.startsWith('source:')) {
      filters.source = lower.slice(7);
      continue;
    }
    if (lower.startsWith('recent:')) {
      filters.recentDays = parseRecentDays(lower.slice(7));
      continue;
    }
    if (lower.startsWith('updated:')) {
      filters.recentDays = parseRecentDays(lower.slice(8));
      continue;
    }
    if (lower.startsWith('date:')) {
      filters.dateExact = parseDateFilter(lower.slice(5));
      continue;
    }
    if (lower.startsWith('after:')) {
      filters.after = parseDateFilter(lower.slice(6));
      continue;
    }
    if (lower.startsWith('before:')) {
      filters.before = parseDateFilter(lower.slice(7));
      continue;
    }
    if (lower.startsWith('limit:')) {
      filters.limit = clampSearchLimit(lower.slice(6));
      continue;
    }
    if (lower.startsWith('top:')) {
      filters.limit = clampSearchLimit(lower.slice(4));
      continue;
    }
    if (lower.startsWith('sort:')) {
      filters.sort = parseSortFilter(lower.slice(5));
      continue;
    }
    if (lower.startsWith('#') && lower.length > 1) {
      filters.tags.push(lower.slice(1));
      continue;
    }
    applyInlineChineseFilters(lower, filters);
    for (const term of expandSearchToken(stripInlineChineseFilterTerms(lower))) {
      addSearchTerm(terms, term);
    }
  }
  return {
    raw: String(query || '').trim(),
    terms: terms.slice(0, 8),
    filters
  };
}

function addSearchTerm(terms, value) {
  const term = normalizeSearchTerm(value);
  if (term && !SEARCH_STOP_WORDS.has(term) && !terms.includes(term)) {
    terms.push(term);
  }
}

function expandSearchToken(token) {
  const normalized = normalizeSearchTerm(token);
  if (!normalized || SEARCH_STOP_WORDS.has(normalized)) {
    return [];
  }
  if (!containsCjk(normalized)) {
    return [normalized];
  }

  const connected = normalized
    .replace(/相关/g, ' ')
    .replace(/有关/g, ' ')
    .replace(/关于/g, ' ');
  const parts = connected
    .split(/(?:的|和|与|及|、|，|,|。|；|;|：|:|\(|\)|（|）|【|】|「|」|『|』|《|》)+/)
    .map(normalizeSearchTerm)
    .filter((part) => part && !SEARCH_STOP_WORDS.has(part));
  if (parts.length > 1) {
    return parts;
  }

  const phraseMatches = SEARCH_KNOWN_PHRASES.filter((phrase) => normalized.includes(phrase));
  return phraseMatches.length > 1 ? phraseMatches : [normalized];
}

function normalizeSearchTerm(value) {
  return String(value || '')
    .trim()
    .replace(/^[\s"'`“”‘’]+|[\s"'`“”‘’]+$/g, '')
    .toLowerCase();
}

function containsCjk(value) {
  return /[\u3400-\u9fff]/.test(value);
}

const SEARCH_STOP_WORDS = new Set([
  '搜索',
  '查找',
  '找',
  '找一下',
  '帮我',
  '帮忙',
  '这个',
  '那个',
  '当前仓库',
  '当前项目',
  '本仓库',
  '本项目'
]);

const SEARCH_KNOWN_PHRASES = [
  '搜索组件',
  '设计文档',
  '设计方案',
  '知识库',
  '四象限',
  '周历',
  '月历',
  '统计组件',
  '模板设计',
  '自定义主页'
];

function parseRecentDays(value) {
  const match = String(value || '').match(/^(\d+)(d|day|days|w|week|weeks)?$/);
  if (!match) {
    return 0;
  }
  const amount = Number.parseInt(match[1], 10);
  if (Number.isNaN(amount) || amount <= 0) {
    return 0;
  }
  return match[2] && match[2].startsWith('w') ? amount * 7 : amount;
}

function normalizeExtensionFilter(value) {
  const text = String(value || '').trim().toLowerCase();
  if (!text) {
    return '';
  }
  return text.startsWith('.') ? text : `.${text}`;
}

function parseDateFilter(value) {
  const text = String(value || '').trim().toLowerCase();
  if (text === 'today') {
    return formatDateKey(new Date());
  }
  if (text === 'yesterday') {
    return formatDateKey(addDays(new Date(), -1));
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
}

function parseSortFilter(value) {
  const text = String(value || '').trim().toLowerCase();
  if (['latest', 'newest', 'recent', 'updated', 'desc'].includes(text)) {
    return 'updatedDesc';
  }
  if (['oldest', 'asc'].includes(text)) {
    return 'updatedAsc';
  }
  if (['score', 'relevance', 'default'].includes(text)) {
    return 'score';
  }
  return '';
}

function applyInlineChineseFilters(token, filters) {
  if (!containsCjk(token)) {
    return;
  }
  const limitMatch = token.match(/(?:最新|最近|前)(\d+)(?:篇|个|条|份)?/);
  if (limitMatch) {
    filters.limit = clampSearchLimit(limitMatch[1]);
  }
  if (token.includes('最新') || token.includes('最近')) {
    filters.sort = 'updatedDesc';
  }
  if (token.includes('文档')) {
    filters.type = 'docs';
  }
  if (token.includes('代码')) {
    filters.type = 'code';
  }
  if (token.includes('prompt')) {
    filters.type = 'prompt';
  }
  if (token.includes('待办') || token.includes('未完成')) {
    filters.type = 'task';
    filters.taskStatus = 'open';
  }
  if (token.includes('已完成')) {
    filters.type = 'task';
    filters.taskStatus = 'done';
  }
  if (token.includes('收藏')) {
    filters.favoriteOnly = true;
  }
  if (token.includes('今天')) {
    filters.dateRange = 'today';
  }
  if (token.includes('本周')) {
    filters.dateRange = 'week';
  }
  if (token.includes('本月')) {
    filters.dateRange = 'month';
  }
}

function stripInlineChineseFilterTerms(token) {
  if (!containsCjk(token)) {
    return token;
  }
  return String(token || '')
    .replace(/(?:最新|最近|前)\d*(?:篇|个|条|份)?/g, ' ')
    .replace(/(?:文档|代码|待办|未完成|已完成|收藏|今天|本周|本月|当前仓库|当前项目|本仓库|本项目)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasOnlyFilters(parsedQuery) {
  const filters = parsedQuery.filters;
  return filters.type !== 'all' ||
    Boolean(filters.path) ||
    Boolean(filters.extension) ||
    Boolean(filters.title) ||
    Boolean(filters.source) ||
    Boolean(filters.recentDays) ||
    filters.projectOnly ||
    filters.favoriteOnly ||
    filters.recentOnly ||
    Boolean(filters.taskStatus) ||
    Boolean(filters.dateRange) ||
    Boolean(filters.dateExact) ||
    Boolean(filters.after) ||
    Boolean(filters.before) ||
    Boolean(filters.sort) ||
    Boolean(filters.limit) ||
    filters.tags.length > 0;
}

function matchesSearchFilters(item, context) {
  const filters = context.parsedQuery.filters;
  if (filters.type === 'prompt' && !item.isPrompt) {
    return false;
  }
  if (filters.type === 'docs' && (item.isPrompt || item.category === 'code')) {
    return false;
  }
  if (filters.type === 'code' && item.category !== 'code') {
    return false;
  }
  if (filters.type === 'task' && item.category !== 'task') {
    return false;
  }
  if (filters.type === 'calendar' && item.category !== 'calendar') {
    return false;
  }
  if (filters.type === 'inbox' && item.sourceType !== 'inbox') {
    return false;
  }
  if (filters.favoriteOnly && (!item.filePath || !context.favoritePaths.has(item.filePath))) {
    return false;
  }
  if (filters.recentOnly && (!item.filePath || !context.recentWeights.has(item.filePath))) {
    return false;
  }
  if (filters.taskStatus === 'open' && (item.category !== 'task' || item.done)) {
    return false;
  }
  if (filters.taskStatus === 'done' && (item.category !== 'task' || !item.done)) {
    return false;
  }
  if (filters.projectOnly && !context.projectPaths.has(item.filePath)) {
    return false;
  }
  if (filters.extension && path.extname(item.filePath || item.fileName || '').toLowerCase() !== filters.extension) {
    return false;
  }
  if (filters.title && !String(item.title || '').toLowerCase().includes(filters.title)) {
    return false;
  }
  if (filters.source) {
    const sourceText = [item.sourceName, item.sourceType, item.relativePath].filter(Boolean).join(' ').toLowerCase();
    if (!sourceText.includes(filters.source)) {
      return false;
    }
  }
  if (filters.path) {
    const relativePath = String(item.relativePath || '').toLowerCase();
    const filePath = String(item.filePath || '').toLowerCase();
    if (!relativePath.includes(filters.path) && !filePath.includes(filters.path)) {
      return false;
    }
  }
  if (filters.recentDays > 0) {
    const since = Date.now() - filters.recentDays * 86400000;
    if (!item.updatedAt || item.updatedAt < since) {
      return false;
    }
  }
  if (filters.tags.length > 0) {
    const itemTags = new Set((item.tags || []).map((tag) => String(tag).toLowerCase()));
    if (!filters.tags.every((tag) => itemTags.has(tag))) {
      return false;
    }
  }
  if (!matchesDateFilters(item, filters)) {
    return false;
  }
  return true;
}

function clampSearchLimit(value) {
  const number = Number.parseInt(value, 10);
  if (Number.isNaN(number)) {
    return 30;
  }
  return Math.min(Math.max(number, 1), 80);
}

function matchesDateFilters(item, filters) {
  if (!filters.dateRange && !filters.dateExact && !filters.after && !filters.before) {
    return true;
  }
  const dateKey = getItemDateKey(item);
  if (!dateKey) {
    return false;
  }
  if (filters.dateExact && dateKey !== filters.dateExact) {
    return false;
  }
  if (filters.dateRange) {
    const range = getDateRange(filters.dateRange);
    if (!range || dateKey < range.start || dateKey > range.end) {
      return false;
    }
  }
  if (filters.after && dateKey < filters.after) {
    return false;
  }
  if (filters.before && dateKey > filters.before) {
    return false;
  }
  return true;
}

function getItemDateKey(item) {
  if (item.category === 'calendar' && item.date) {
    return normalizeDateKey(item.date);
  }
  if (item.category === 'task' && item.searchContent) {
    const match = String(item.searchContent).match(/\d{4}-\d{2}-\d{2}/);
    if (match) {
      return match[0];
    }
  }
  if (item.updatedAt) {
    return formatDateKey(new Date(item.updatedAt));
  }
  return '';
}

function getDateRange(rangeName) {
  const today = startOfDay(new Date());
  if (rangeName === 'today') {
    const key = formatDateKey(today);
    return { start: key, end: key };
  }
  if (rangeName === 'week') {
    const start = addDays(today, -((today.getDay() + 6) % 7));
    return { start: formatDateKey(start), end: formatDateKey(addDays(start, 6)) };
  }
  if (rangeName === 'month') {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return { start: formatDateKey(start), end: formatDateKey(end) };
  }
  return undefined;
}

function normalizeDateKey(value) {
  const text = String(value || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
}

function formatDateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-');
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function sortSearchResults(a, b, filters) {
  if (filters.sort === 'updatedDesc') {
    return b.updatedAt - a.updatedAt || b.score - a.score || a.title.localeCompare(b.title);
  }
  if (filters.sort === 'updatedAsc') {
    return a.updatedAt - b.updatedAt || b.score - a.score || a.title.localeCompare(b.title);
  }
  return b.score - a.score || b.updatedAt - a.updatedAt || a.title.localeCompare(b.title);
}

function scoreSearchItem(item, terms, context) {
  const haystacks = {
    title: String(item.title || '').toLowerCase(),
    fileName: String(item.fileName || '').toLowerCase(),
    relativePath: String(item.relativePath || '').toLowerCase(),
    sourceName: String(item.sourceName || '').toLowerCase(),
    filePath: String(item.filePath || '').toLowerCase(),
    headings: (item.headings || []).map((heading) => heading.text).join(' ').toLowerCase(),
    tags: (item.tags || []).join(' ').toLowerCase(),
    frontmatter: String(item.frontmatterText || '').toLowerCase(),
    content: String(item.searchContent || '').toLowerCase()
  };
  let score = terms.length === 0 ? 1 : 0;
  const reasons = [];

  for (const term of terms) {
    let matched = false;
    if (haystacks.title.includes(term)) {
      score += haystacks.title === term ? 90 : 62;
      matched = true;
      addReason(reasons, '标题命中');
    }
    if (haystacks.fileName.includes(term)) {
      score += 48;
      matched = true;
      addReason(reasons, '文件名命中');
    }
    if (haystacks.relativePath.includes(term) || haystacks.filePath.includes(term)) {
      score += 34;
      matched = true;
      addReason(reasons, '路径命中');
    }
    if (haystacks.sourceName.includes(term)) {
      score += 16;
      matched = true;
      addReason(reasons, '知识源命中');
    }
    if (haystacks.headings.includes(term)) {
      score += 52;
      matched = true;
      addReason(reasons, '标题层级命中');
    }
    if (haystacks.tags.includes(term)) {
      score += 46;
      matched = true;
      addReason(reasons, '标签命中');
    }
    if (haystacks.frontmatter.includes(term)) {
      score += 28;
      matched = true;
      addReason(reasons, '属性命中');
    }
    if (haystacks.content.includes(term)) {
      score += 14 + Math.min(countOccurrences(haystacks.content, term), 6) * 3;
      matched = true;
      addReason(reasons, '正文命中');
    }
    if (!matched) {
      return undefined;
    }
  }

  if (item.isPrompt) {
    score += 8;
    addReason(reasons, 'Prompt');
  }
  if (item.category === 'code') {
    score += 6;
    addReason(reasons, '代码');
  }
  if (item.category === 'task') {
    score += item.done ? 3 : 10;
    addReason(reasons, item.done ? '已完成事项' : '待办事项');
  }
  if (item.category === 'calendar') {
    score += 9;
    addReason(reasons, '日历事件');
  }
  if (item.sourceType === 'inbox') {
    score += 7;
    addReason(reasons, '收集箱');
  }
  if (context.projectPaths.has(item.filePath)) {
    score += 12;
    addReason(reasons, '当前项目');
  }
  if (context.favoritePaths.has(item.filePath)) {
    score += 18;
    addReason(reasons, '收藏');
  }
  if (context.recentWeights.has(item.filePath)) {
    score += context.recentWeights.get(item.filePath);
    addReason(reasons, '最近打开');
  }

  const line = findBestMatchLine(item, terms);
  return Object.assign({}, serializeItem(item), {
    isPrompt: Boolean(item.isPrompt),
    category: item.category || 'document',
    score,
    snippet: buildSearchSnippet(item, terms),
    preview: buildSearchPreview(item, terms),
    line,
    heading: findNearestHeading(item, line),
    entityType: item.entityType || '',
    quadrantId: item.quadrantId || '',
    quadrantTitle: item.quadrantTitle || '',
    taskId: item.taskId || '',
    done: Boolean(item.done),
    eventId: item.eventId || '',
    date: item.date || '',
    start: item.start || '',
    end: item.end || '',
    reasons
  });
}

function addReason(reasons, reason) {
  if (!reasons.includes(reason)) {
    reasons.push(reason);
  }
}

function countOccurrences(text, term) {
  if (!term) return 0;
  let count = 0;
  let index = text.indexOf(term);
  while (index !== -1 && count < 20) {
    count += 1;
    index = text.indexOf(term, index + term.length);
  }
  return count;
}

function buildSearchSnippet(item, terms) {
  const matchingLine = findBestSearchLine(item, terms);
  if (matchingLine) {
    return matchingLine.text.slice(0, 240);
  }
  const text = String(item.searchContent || '').replace(/\s+/g, ' ').trim();
  if (!text) {
    return '';
  }
  const lowerText = text.toLowerCase();
  const firstHit = terms
    .map((term) => lowerText.indexOf(term))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0];
  const center = firstHit === undefined ? 0 : firstHit;
  const start = Math.max(0, center - 72);
  const end = Math.min(text.length, center + 168);
  return `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`;
}

function buildSearchPreview(item, terms) {
  if (Array.isArray(item.searchLines) && item.searchLines.length > 0) {
    const matchingLine = findBestSearchLine(item, terms);
    if (matchingLine) {
      const index = item.searchLines.findIndex((line) => line.line === matchingLine.line);
      const start = Math.max(0, index - 2);
      const end = Math.min(item.searchLines.length, index + 3);
      return item.searchLines
        .slice(start, end)
        .map((line) => `${line.line}: ${line.text}`)
        .join('\n')
        .slice(0, 1200);
    }
  }

  const text = String(item.searchContent || '').replace(/\s+/g, ' ').trim();
  if (!text) {
    return '';
  }
  const lowerText = text.toLowerCase();
  const firstHit = terms
    .map((term) => lowerText.indexOf(term))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0];
  const center = firstHit === undefined ? 0 : firstHit;
  const start = Math.max(0, center - 180);
  const end = Math.min(text.length, center + 520);
  return `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`;
}

function findBestMatchLine(item, terms) {
  const title = String(item.title || '').toLowerCase();
  if (terms.some((term) => title.includes(term))) {
    const heading = (item.headings || []).find((entry) => String(entry.text || '').toLowerCase() === title);
    return heading ? heading.line : 1;
  }
  const heading = findMatchingHeading(item, terms);
  if (heading) {
    return heading.line;
  }
  const line = findBestSearchLine(item, terms);
  return line ? line.line : 1;
}

function findMatchingHeading(item, terms) {
  if (!Array.isArray(item.headings) || terms.length === 0) {
    return undefined;
  }
  return item.headings.find((heading) => {
    const text = String(heading.text || '').toLowerCase();
    return terms.some((term) => text.includes(term));
  });
}

function findBestSearchLine(item, terms) {
  if (!Array.isArray(item.searchLines) || terms.length === 0) {
    return undefined;
  }
  return item.searchLines.find((line) => {
    const text = String(line.text || '').toLowerCase();
    return terms.every((term) => text.includes(term));
  }) || item.searchLines.find((line) => {
    const text = String(line.text || '').toLowerCase();
    return terms.some((term) => text.includes(term));
  });
}

function findNearestHeading(item, line) {
  if (!Array.isArray(item.headings) || item.headings.length === 0 || !line) {
    return '';
  }
  const nearest = item.headings
    .filter((heading) => heading.line <= line)
    .sort((a, b) => b.line - a.line)[0];
  return nearest ? nearest.text : '';
}

function groupSearchResults(results, limit) {
  const topCount = Math.min(results.length, Math.min(5, limit));
  const topItems = results.slice(0, topCount);
  const used = new Set(topItems.map(searchResultKey));
  const groups = [];
  if (topItems.length > 0) {
    groups.push({ id: 'top', title: '最相关', items: topItems });
  }

  const rest = results.filter((item) => !used.has(searchResultKey(item)));
  const projectItems = rest.filter((item) => item.reasons.includes('当前项目'));
  const promptItems = rest.filter((item) => item.isPrompt && !item.reasons.includes('当前项目'));
  const codeItems = rest.filter((item) => item.category === 'code' && !item.reasons.includes('当前项目'));
  const taskItems = rest.filter((item) => item.category === 'task');
  const calendarItems = rest.filter((item) => item.category === 'calendar');
  const documentItems = rest.filter((item) => !item.isPrompt && !['code', 'task', 'calendar'].includes(item.category) && !item.reasons.includes('当前项目'));
  if (projectItems.length > 0) {
    groups.push({ id: 'project', title: '当前项目', items: projectItems });
  }
  if (promptItems.length > 0) {
    groups.push({ id: 'prompt', title: 'Prompt', items: promptItems });
  }
  if (codeItems.length > 0) {
    groups.push({ id: 'code', title: '代码', items: codeItems });
  }
  if (taskItems.length > 0) {
    groups.push({ id: 'task', title: '四象限事项', items: taskItems });
  }
  if (calendarItems.length > 0) {
    groups.push({ id: 'calendar', title: '日历', items: calendarItems });
  }
  if (documentItems.length > 0) {
    groups.push({ id: 'docs', title: '文档', items: documentItems });
  }
  return groups;
}

function searchResultKey(item) {
  return item.filePath || item.id;
}

module.exports = {
  LeapHomeIndex,
  sortByUpdatedAt
};
