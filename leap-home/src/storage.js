const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { FAVORITES_KEY, LEAP_DATA_DIR, LEAP_STATE_FILE, RECENT_KEY } = require('./constants');
const { normalizeTaskLinks } = require('./taskLinks');
const { firstWorkspaceFolder } = require('./utils');

const LEAP_COMPONENT_DATA_DIR = 'components';
const COMPONENT_DATA_FILES = {
  favorites: 'favorites.json',
  recent: 'recent.json',
  quadrants: 'four-quadrants.json',
  calendarEvents: 'calendar.json',
  searchHistory: 'search-history.json',
  quickCapture: 'quick-capture.json',
  focusTimer: 'focus-timer.json',
  countdown: 'countdown.json',
  nextAction: 'next-action.json',
  knowledgeGraph: 'knowledge-graph.json'
};

const QUADRANT_DEFINITIONS = [
  { id: 'importantUrgent', title: '重要且紧急' },
  { id: 'importantNotUrgent', title: '重要不紧急' },
  { id: 'notImportantUrgent', title: '不重要但紧急' },
  { id: 'notImportantNotUrgent', title: '不重要不紧急' }
];

function getLeapDataDir(context) {
  const folder = firstWorkspaceFolder();
  if (folder) {
    return path.join(folder.uri.fsPath, LEAP_DATA_DIR);
  }
  return path.join(context.globalStorageUri.fsPath, LEAP_DATA_DIR);
}

function getLeapStatePath(context) {
  return path.join(getLeapDataDir(context), LEAP_STATE_FILE);
}

function getLeapComponentDataDir(context) {
  return path.join(getLeapDataDir(context), LEAP_COMPONENT_DATA_DIR);
}

function getLeapComponentDataPath(context, key) {
  const fileName = COMPONENT_DATA_FILES[key];
  return fileName ? path.join(getLeapComponentDataDir(context), fileName) : '';
}

function getLeapDataPaths(context) {
  return {
    dataDir: getLeapDataDir(context),
    statePath: getLeapStatePath(context),
    componentsDir: getLeapComponentDataDir(context),
    components: {
      favorites: getLeapComponentDataPath(context, 'favorites'),
      recent: getLeapComponentDataPath(context, 'recent'),
      quadrants: getLeapComponentDataPath(context, 'quadrants'),
      calendarEvents: getLeapComponentDataPath(context, 'calendarEvents'),
      searchHistory: getLeapComponentDataPath(context, 'searchHistory'),
      quickCapture: getLeapComponentDataPath(context, 'quickCapture'),
      focusTimer: getLeapComponentDataPath(context, 'focusTimer'),
      countdown: getLeapComponentDataPath(context, 'countdown'),
      nextAction: getLeapComponentDataPath(context, 'nextAction'),
      knowledgeGraph: getLeapComponentDataPath(context, 'knowledgeGraph')
    }
  };
}

function readLeapState(context) {
  const statePath = getLeapStatePath(context);
  const fileState = readJsonFile(statePath);
  const legacyState = readLegacyState(context);
  const state = fileState && typeof fileState === 'object' ? fileState : {};
  return normalizeLeapState({
    version: state.version,
    activeHomeId: state.activeHomeId,
    homeTemplate: state.homeTemplate,
    homeLayout: state.homeLayout,
    customHomes: state.customHomes,
    favorites: readPathListData(context, 'favorites', state.favorites !== undefined ? state.favorites : legacyState.favorites),
    recent: readPathListData(context, 'recent', state.recent !== undefined ? state.recent : legacyState.recent),
    quadrants: readQuadrantData(context, state.quadrants),
    calendarEvents: readCalendarEventData(context, state.calendarEvents)
  });
}

async function updateLeapState(context, updater) {
  const current = readLeapState(context);
  const next = normalizeLeapState(await updater(current) || current);
  await writeLeapState(context, next);
  return next;
}

async function migrateLeapStateStorage(context) {
  const statePath = getLeapStatePath(context);
  const fileState = readJsonFile(statePath);
  const hasStateFile = fileState && typeof fileState === 'object';
  const hasLegacyComponentData = hasStateFile && [
    'favorites',
    'recent',
    'quadrants',
    'calendarEvents'
  ].some((key) => Object.prototype.hasOwnProperty.call(fileState, key));

  if (!hasLegacyComponentData) {
    return readLeapState(context);
  }

  const state = readLeapState(context);
  await writeLeapState(context, state);
  return state;
}

async function writeLeapState(context, state) {
  const next = normalizeLeapState(state);
  await Promise.all([
    writeJsonFile(getLeapStatePath(context), {
      version: next.version,
      activeHomeId: next.activeHomeId,
      homeTemplate: next.homeTemplate,
      homeLayout: next.homeLayout,
      customHomes: next.customHomes
    }),
    writeJsonFile(getLeapComponentDataPath(context, 'favorites'), {
      version: 1,
      items: next.favorites
    }),
    writeJsonFile(getLeapComponentDataPath(context, 'recent'), {
      version: 1,
      items: next.recent
    }),
    writeJsonFile(getLeapComponentDataPath(context, 'quadrants'), {
      version: 1,
      quadrants: next.quadrants
    }),
    writeJsonFile(getLeapComponentDataPath(context, 'calendarEvents'), {
      version: 1,
      events: next.calendarEvents
    })
  ]);
}

function readJsonFile(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    return undefined;
  }
}

async function writeJsonFile(filePath, value) {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function readLegacyState(context) {
  return {
    favorites: getLegacyPaths(context, FAVORITES_KEY),
    recent: getLegacyPaths(context, RECENT_KEY)
  };
}

function getLegacyPaths(context, key) {
  if (!context || !context.globalState || typeof context.globalState.get !== 'function') {
    return [];
  }
  const value = context.globalState.get(key, []);
  return Array.isArray(value) ? value.filter((entry) => typeof entry === 'string') : [];
}

function readPathListData(context, key, fallback) {
  const value = readJsonFile(getLeapComponentDataPath(context, key));
  if (Array.isArray(value)) {
    return value;
  }
  if (value && typeof value === 'object') {
    if (Array.isArray(value.items)) {
      return value.items;
    }
    if (Array.isArray(value[key])) {
      return value[key];
    }
  }
  return fallback;
}

function readQuadrantData(context, fallback) {
  const value = readJsonFile(getLeapComponentDataPath(context, 'quadrants'));
  if (value && typeof value === 'object') {
    if (value.quadrants && typeof value.quadrants === 'object') {
      return value.quadrants;
    }
    if (QUADRANT_DEFINITIONS.some((definition) => Array.isArray(value[definition.id]))) {
      return value;
    }
  }
  return fallback;
}

function readCalendarEventData(context, fallback) {
  const value = readJsonFile(getLeapComponentDataPath(context, 'calendarEvents'));
  if (Array.isArray(value)) {
    return value;
  }
  if (value && typeof value === 'object') {
    if (Array.isArray(value.events)) {
      return value.events;
    }
    if (Array.isArray(value.calendarEvents)) {
      return value.calendarEvents;
    }
  }
  return fallback;
}

function normalizeLeapState(value) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    version: 1,
    activeHomeId: typeof source.activeHomeId === 'string' ? source.activeHomeId : '',
    homeTemplate: typeof source.homeTemplate === 'string' ? source.homeTemplate : '',
    homeLayout: Array.isArray(source.homeLayout) ? source.homeLayout : [],
    customHomes: normalizeCustomHomes(source.customHomes),
    favorites: normalizePathList(source.favorites),
    recent: normalizePathList(source.recent),
    quadrants: normalizeQuadrants(source.quadrants),
    calendarEvents: normalizeCalendarEvents(source.calendarEvents)
  };
}

function normalizeCustomHomes(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map(normalizeCustomHome).filter(Boolean);
}

function normalizeCustomHome(value, index) {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const layout = Array.isArray(value.layout) ? value.layout : [];
  if (layout.length === 0) {
    return undefined;
  }
  const title = String(value.title || '').trim() || `自定义主页 ${index + 1}`;
  return {
    id: String(value.id || `custom-home-${index + 1}`),
    title,
    baseTemplate: typeof value.baseTemplate === 'string' ? value.baseTemplate : 'project-workbench',
    layout,
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : '',
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : ''
  };
}

function normalizePathList(value) {
  return Array.isArray(value)
    ? value.filter((entry) => typeof entry === 'string' && entry.trim()).map((entry) => entry.trim())
    : [];
}

function normalizeQuadrants(value) {
  const source = value && typeof value === 'object' ? value : {};
  const result = {};
  for (const definition of QUADRANT_DEFINITIONS) {
    const raw = Array.isArray(source[definition.id]) ? source[definition.id] : [];
    result[definition.id] = raw.map(normalizeTask).filter(Boolean);
  }
  return result;
}

function normalizeTask(value, index) {
  if (typeof value === 'string') {
    const text = value.trim();
    return text ? { id: `task-${index || 0}`, text, done: false, links: [] } : undefined;
  }
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const text = String(value.text || value.title || '').trim();
  if (!text) {
    return undefined;
  }
  return {
    id: String(value.id || `task-${index || 0}`),
    text,
    done: Boolean(value.done),
    note: typeof value.note === 'string' ? value.note : '',
    dueDate: normalizeDate(value.dueDate),
    source: typeof value.source === 'string' ? value.source : '',
    reason: typeof value.reason === 'string' ? value.reason : '',
    confidence: Number.isFinite(Number(value.confidence)) ? Number(value.confidence) : undefined,
    links: normalizeTaskLinks(value.links),
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : '',
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : ''
  };
}

function normalizeDate(value) {
  const text = String(value || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
}

function normalizeCalendarEvents(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map(normalizeCalendarEvent).filter(Boolean);
}

function normalizeCalendarEvent(value, index) {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const title = String(value.title || value.text || '').trim();
  const date = String(value.date || '').trim();
  if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return undefined;
  }
  return {
    id: String(value.id || `event-${date}-${index || 0}`),
    title,
    date,
    start: typeof value.start === 'string' ? value.start : '',
    end: typeof value.end === 'string' ? value.end : '',
    type: typeof value.type === 'string' ? value.type : 'event'
  };
}

module.exports = {
  QUADRANT_DEFINITIONS,
  getLeapComponentDataDir,
  getLeapComponentDataPath,
  getLeapDataPaths,
  getLeapDataDir,
  getLeapStatePath,
  migrateLeapStateStorage,
  readLeapState,
  updateLeapState
};
