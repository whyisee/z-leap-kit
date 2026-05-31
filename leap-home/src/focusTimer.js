const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const vscode = require('vscode');
const logger = require('./logger');
const { getLeapComponentDataPath } = require('./storage');

const DEFAULT_FOCUS_DURATION_MS = 25 * 60 * 1000;
const DEFAULT_SHORT_BREAK_MS = 5 * 60 * 1000;
const DEFAULT_LONG_BREAK_MS = 15 * 60 * 1000;
const MIN_FOCUS_DURATION_MS = 5 * 60 * 1000;
const MIN_BREAK_DURATION_MS = 1 * 60 * 1000;
const MAX_DURATION_MS = 4 * 60 * 60 * 1000;
const MAX_HISTORY_ITEMS = 30;
const ACTIVITY_IDLE_THRESHOLD_MS = 2 * 60 * 1000;

function readFocusTimerSnapshot(context) {
  const data = readFocusTimerData(context);
  const advanced = advanceFocusTimerData(data, Date.now(), { recordHistory: false });
  return toFocusTimerView(advanced.data);
}

async function startFocusTimer(context, options) {
  const now = new Date();
  const data = readFocusTimerData(context);
  const request = normalizeStartOptions(options, data.settings);
  if (request.sessionType === 'focus' && request.saveDefaultDuration) {
    data.settings.defaultFocusDurationMs = request.durationMs;
  }
  data.activeSession = createSession(request.sessionType, request.durationMs, now, request.task);
  await writeFocusTimerData(context, data);
  return toFocusTimerView(data);
}

async function pauseFocusTimer(context) {
  const now = Date.now();
  const advanced = advanceFocusTimerData(readFocusTimerData(context), now, { recordHistory: true });
  const session = advanced.data.activeSession;
  if (session && session.status === 'running') {
    session.status = 'paused';
    session.pausedAt = new Date(now).toISOString();
    advanced.changed = true;
  }
  if (advanced.changed) {
    await writeFocusTimerData(context, advanced.data);
  }
  return toFocusTimerView(advanced.data);
}

async function resumeFocusTimer(context) {
  const now = new Date();
  const advanced = advanceFocusTimerData(readFocusTimerData(context), now.getTime(), { recordHistory: true });
  const session = advanced.data.activeSession;
  if (session && session.status === 'paused') {
    session.status = 'running';
    session.pausedAt = '';
    session.lastTickAt = now.toISOString();
    session.focused = isCursorWindowFocused();
    session.lastFocusChangedAt = now.toISOString();
    if (session.focused) {
      session.lastActivityAt = now.toISOString();
    }
    advanced.changed = true;
  }
  if (advanced.changed) {
    await writeFocusTimerData(context, advanced.data);
  }
  return toFocusTimerView(advanced.data);
}

async function resetFocusTimer(context) {
  const now = Date.now();
  const advanced = advanceFocusTimerData(readFocusTimerData(context), now, { recordHistory: true });
  const data = advanced.data;
  if (!data.activeSession) {
    return toFocusTimerView(data);
  }
  const session = data.activeSession;
  if ((session.status === 'running' || session.status === 'paused') && getSessionElapsedMs(session) > 0) {
    data.history = [toHistoryItem(Object.assign({}, session, {
      completedAt: new Date(now).toISOString()
    }), 'aborted'), ...(data.history || [])].slice(0, MAX_HISTORY_ITEMS);
  } else if (session.status === 'completed' && !session.historyRecorded) {
    const historyItem = toHistoryItem(session, 'completed');
    data.history = [historyItem, ...(data.history || [])].slice(0, MAX_HISTORY_ITEMS);
  }
  data.activeSession = undefined;
  await writeFocusTimerData(context, data);
  return toFocusTimerView(data);
}

async function tickFocusTimer(context) {
  const advanced = advanceFocusTimerData(readFocusTimerData(context), Date.now(), { recordHistory: true });
  if (advanced.changed) {
    await writeFocusTimerData(context, advanced.data);
  }
  return {
    changed: advanced.changed,
    completedSession: advanced.completedSession
  };
}

async function setFocusTimerWindowFocused(context, focused) {
  const now = Date.now();
  const advanced = advanceFocusTimerData(readFocusTimerData(context), now, { recordHistory: true });
  const session = advanced.data.activeSession;
  if (session && (session.status === 'running' || session.status === 'paused') && session.focused !== Boolean(focused)) {
    if (session.status === 'running' && session.focused && !focused) {
      session.interruptions += 1;
    }
    session.focused = Boolean(focused);
    session.lastFocusChangedAt = new Date(now).toISOString();
    if (session.focused) {
      session.lastActivityAt = new Date(now).toISOString();
    }
    advanced.changed = true;
  }
  if (advanced.changed) {
    await writeFocusTimerData(context, advanced.data);
  }
  return {
    changed: advanced.changed,
    completedSession: advanced.completedSession
  };
}

async function recordFocusTimerActivity(context) {
  const now = Date.now();
  const advanced = advanceFocusTimerData(readFocusTimerData(context), now, { recordHistory: true });
  const session = advanced.data.activeSession;
  if (session && session.status === 'running' && session.focused) {
    session.lastActivityAt = new Date(now).toISOString();
    session.activityEvents += 1;
    advanced.changed = true;
  }
  if (advanced.changed) {
    await writeFocusTimerData(context, advanced.data);
  }
  return {
    changed: advanced.changed,
    completedSession: advanced.completedSession
  };
}

function registerFocusTimerLifecycle(context, provider) {
  let running = false;
  let lastActivityWriteAt = 0;
  const disposables = [
    vscode.window.onDidChangeWindowState((state) => {
      runFocusUpdate(() => setFocusTimerWindowFocused(context, state.focused));
    }),
    vscode.workspace.onDidChangeTextDocument(() => recordActivity()),
    vscode.window.onDidChangeTextEditorSelection(() => recordActivity()),
    vscode.window.onDidChangeActiveTextEditor(() => recordActivity())
  ];
  const timer = setInterval(() => {
    runFocusUpdate(() => tickFocusTimer(context));
  }, 1000);

  function recordActivity() {
    const now = Date.now();
    if (now - lastActivityWriteAt < 5000) {
      return;
    }
    lastActivityWriteAt = now;
    runFocusUpdate(() => recordFocusTimerActivity(context));
  }

  async function runFocusUpdate(operation) {
    if (running) {
      return;
    }
    running = true;
    try {
      const result = await operation();
      if (result && result.completedSession) {
        notifySessionCompleted(result.completedSession);
      }
      if (result && result.changed && provider && provider.panel && typeof provider.postModel === 'function') {
        provider.postModel();
      }
    } catch (error) {
      logger.warn('focus timer update failed', error);
    } finally {
      running = false;
    }
  }

  return {
    dispose() {
      for (const disposable of disposables) {
        disposable.dispose();
      }
      clearInterval(timer);
    }
  };
}

function createSession(sessionType, durationMs, now, task) {
  const timestamp = now.toISOString();
  const focused = isCursorWindowFocused();
  return {
    id: `focus-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: sessionType,
    status: 'running',
    durationMs,
    startedAt: timestamp,
    pausedAt: '',
    completedAt: '',
    lastTickAt: timestamp,
    lastFocusChangedAt: timestamp,
    lastActivityAt: focused ? timestamp : '',
    focused,
    focusedMs: 0,
    strictFocusedMs: 0,
    blurredMs: 0,
    idleMs: 0,
    interruptions: 0,
    activityEvents: 0,
    task: sessionType === 'focus' ? normalizeTaskRef(task) : undefined,
    historyRecorded: false
  };
}

function advanceFocusTimerData(data, nowMs, options) {
  const result = { data, changed: false, completedSession: undefined };
  const session = data.activeSession;
  if (!session || session.status !== 'running') {
    return result;
  }

  const lastTickMs = parseTimestamp(session.lastTickAt) || parseTimestamp(session.startedAt) || nowMs;
  const deltaMs = Math.max(0, nowMs - lastTickMs);
  if (deltaMs === 0) {
    return result;
  }

  const remainingMs = Math.max(0, session.durationMs - session.focusedMs - session.blurredMs);
  const appliedMs = Math.min(deltaMs, remainingMs);
  if (session.focused) {
    session.focusedMs += appliedMs;
    if (isSessionStrictlyActive(session, nowMs)) {
      session.strictFocusedMs += appliedMs;
    } else {
      session.idleMs += appliedMs;
    }
  } else {
    session.blurredMs += appliedMs;
  }
  session.lastTickAt = new Date(nowMs).toISOString();
  result.changed = true;

  if (session.focusedMs + session.blurredMs >= session.durationMs) {
    result.completedSession = completeFocusSession(data, session, nowMs, Boolean(options && options.recordHistory));
  }

  return result;
}

function completeFocusSession(data, session, nowMs, recordHistory) {
  session.status = 'completed';
  session.pausedAt = '';
  session.completedAt = new Date(nowMs).toISOString();
  session.focusedMs = Math.min(session.focusedMs, session.durationMs);
  session.strictFocusedMs = Math.min(session.strictFocusedMs, session.focusedMs);
  session.blurredMs = Math.min(session.blurredMs, Math.max(0, session.durationMs - session.focusedMs));
  if (recordHistory && !session.historyRecorded) {
    const historyItem = toHistoryItem(session, 'completed');
    data.history = [historyItem, ...(data.history || [])].slice(0, MAX_HISTORY_ITEMS);
    session.historyRecorded = true;
    return historyItem;
  }
  return undefined;
}

function toHistoryItem(session, result) {
  return {
    id: session.id,
    type: normalizeSessionType(session.type),
    result: normalizeHistoryResult(result),
    durationMs: session.durationMs,
    focusedMs: session.focusedMs,
    strictFocusedMs: session.strictFocusedMs,
    blurredMs: session.blurredMs,
    idleMs: session.idleMs,
    interruptions: session.interruptions,
    activityEvents: session.activityEvents,
    task: normalizeTaskRef(session.task),
    startedAt: session.startedAt,
    completedAt: session.completedAt
  };
}

function toFocusTimerView(data) {
  const settings = normalizeSettings(data.settings);
  const activeSession = data.activeSession
    ? addDerivedSessionFields(data.activeSession)
    : addDerivedSessionFields({
      id: '',
      type: 'focus',
      status: 'idle',
      durationMs: settings.defaultFocusDurationMs,
      startedAt: '',
      pausedAt: '',
      completedAt: '',
      lastTickAt: '',
      lastFocusChangedAt: '',
      lastActivityAt: '',
      focused: isCursorWindowFocused(),
      focusedMs: 0,
      strictFocusedMs: 0,
      blurredMs: 0,
      idleMs: 0,
      interruptions: 0,
      activityEvents: 0,
      task: undefined,
      historyRecorded: false
    });

  return {
    version: 1,
    settings,
    activeSession,
    history: (data.history || []).map(normalizeHistoryItem).filter(Boolean).slice(0, MAX_HISTORY_ITEMS)
  };
}

function addDerivedSessionFields(session) {
  const elapsedMs = Math.min(session.durationMs, session.focusedMs + session.blurredMs);
  return Object.assign({}, session, {
    elapsedMs,
    remainingMs: Math.max(0, session.durationMs - elapsedMs),
    progress: session.durationMs > 0 ? Math.round((elapsedMs / session.durationMs) * 100) : 0,
    strictProgress: session.durationMs > 0 ? Math.round((session.strictFocusedMs / session.durationMs) * 100) : 0
  });
}

function readFocusTimerData(context) {
  const value = readJsonFile(getLeapComponentDataPath(context, 'focusTimer'));
  const source = value && typeof value === 'object' ? value : {};
  return {
    version: 1,
    settings: normalizeSettings(source.settings),
    activeSession: normalizeSession(source.activeSession),
    history: Array.isArray(source.history) ? source.history.map(normalizeHistoryItem).filter(Boolean).slice(0, MAX_HISTORY_ITEMS) : []
  };
}

async function writeFocusTimerData(context, data) {
  const filePath = getLeapComponentDataPath(context, 'focusTimer');
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, JSON.stringify({
    version: 1,
    settings: normalizeSettings(data.settings),
    activeSession: data.activeSession || null,
    history: (data.history || []).slice(0, MAX_HISTORY_ITEMS)
  }, null, 2) + '\n', 'utf8');
}

function readJsonFile(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    return undefined;
  }
}

function normalizeStartOptions(value, settings) {
  const source = value && typeof value === 'object' ? value : { durationMs: value };
  const sessionType = normalizeSessionType(source.sessionType || source.type);
  const normalizedSettings = normalizeSettings(settings);
  const fallbackDuration = sessionType === 'shortBreak'
    ? normalizedSettings.shortBreakDurationMs
    : sessionType === 'longBreak'
      ? normalizedSettings.longBreakDurationMs
      : normalizedSettings.defaultFocusDurationMs;
  return {
    sessionType,
    durationMs: normalizeDuration(source.durationMs || fallbackDuration, sessionType),
    task: sessionType === 'focus' ? normalizeTaskRef(source.task) : undefined,
    saveDefaultDuration: Boolean(source.saveDefaultDuration)
  };
}

function normalizeTaskRef(value) {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const taskId = String(value.taskId || value.id || '').trim();
  const quadrantId = String(value.quadrantId || '').trim();
  const title = String(value.title || value.text || '').replace(/\s+/g, ' ').trim();
  if (!taskId || !quadrantId || !title) {
    return undefined;
  }
  const quadrantTitle = String(value.quadrantTitle || '').replace(/\s+/g, ' ').trim();
  return {
    source: 'quadrant',
    quadrantId,
    quadrantTitle,
    taskId,
    title
  };
}

function normalizeSettings(value) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    defaultFocusDurationMs: normalizeDuration(source.defaultFocusDurationMs || DEFAULT_FOCUS_DURATION_MS, 'focus'),
    shortBreakDurationMs: normalizeDuration(source.shortBreakDurationMs || DEFAULT_SHORT_BREAK_MS, 'shortBreak'),
    longBreakDurationMs: normalizeDuration(source.longBreakDurationMs || DEFAULT_LONG_BREAK_MS, 'longBreak'),
    activityIdleThresholdMs: normalizeDuration(source.activityIdleThresholdMs || ACTIVITY_IDLE_THRESHOLD_MS, 'shortBreak')
  };
}

function normalizeSession(value) {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const status = normalizeStatus(value.status);
  if (!['running', 'paused', 'completed'].includes(status)) {
    return undefined;
  }
  return {
    id: String(value.id || `focus-${Date.now()}`),
    type: normalizeSessionType(value.type),
    status,
    durationMs: normalizeDuration(value.durationMs, normalizeSessionType(value.type)),
    startedAt: normalizeTimestamp(value.startedAt),
    pausedAt: normalizeTimestamp(value.pausedAt),
    completedAt: normalizeTimestamp(value.completedAt),
    lastTickAt: normalizeTimestamp(value.lastTickAt) || normalizeTimestamp(value.startedAt),
    lastFocusChangedAt: normalizeTimestamp(value.lastFocusChangedAt) || normalizeTimestamp(value.startedAt),
    lastActivityAt: normalizeTimestamp(value.lastActivityAt),
    focused: typeof value.focused === 'boolean' ? value.focused : isCursorWindowFocused(),
    focusedMs: normalizeMs(value.focusedMs),
    strictFocusedMs: normalizeMs(value.strictFocusedMs),
    blurredMs: normalizeMs(value.blurredMs),
    idleMs: normalizeMs(value.idleMs),
    interruptions: normalizeCount(value.interruptions),
    activityEvents: normalizeCount(value.activityEvents),
    task: normalizeTaskRef(value.task),
    historyRecorded: Boolean(value.historyRecorded)
  };
}

function normalizeHistoryItem(value) {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const startedAt = normalizeTimestamp(value.startedAt);
  const completedAt = normalizeTimestamp(value.completedAt);
  if (!startedAt || !completedAt) {
    return undefined;
  }
  const sessionType = normalizeSessionType(value.type);
  return {
    id: String(value.id || `focus-history-${startedAt}`),
    type: sessionType,
    result: normalizeHistoryResult(value.result),
    durationMs: normalizeDuration(value.durationMs, sessionType),
    focusedMs: normalizeMs(value.focusedMs),
    strictFocusedMs: normalizeMs(value.strictFocusedMs),
    blurredMs: normalizeMs(value.blurredMs),
    idleMs: normalizeMs(value.idleMs),
    interruptions: normalizeCount(value.interruptions),
    activityEvents: normalizeCount(value.activityEvents),
    task: normalizeTaskRef(value.task),
    startedAt,
    completedAt
  };
}

function normalizeDuration(value, sessionType) {
  const duration = Number(value);
  if (!Number.isFinite(duration)) {
    return sessionType === 'shortBreak'
      ? DEFAULT_SHORT_BREAK_MS
      : sessionType === 'longBreak'
        ? DEFAULT_LONG_BREAK_MS
        : DEFAULT_FOCUS_DURATION_MS;
  }
  const minimum = sessionType === 'focus' ? MIN_FOCUS_DURATION_MS : MIN_BREAK_DURATION_MS;
  return Math.min(Math.max(Math.round(duration), minimum), MAX_DURATION_MS);
}

function normalizeMs(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : 0;
}

function normalizeCount(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : 0;
}

function normalizeStatus(value) {
  const status = String(value || '').trim();
  return ['running', 'paused', 'completed'].includes(status) ? status : 'idle';
}

function normalizeSessionType(value) {
  const sessionType = String(value || '').trim();
  return ['focus', 'shortBreak', 'longBreak'].includes(sessionType) ? sessionType : 'focus';
}

function normalizeHistoryResult(value) {
  const result = String(value || '').trim();
  return ['completed', 'aborted'].includes(result) ? result : 'completed';
}

function normalizeTimestamp(value) {
  const timestamp = String(value || '').trim();
  return parseTimestamp(timestamp) ? timestamp : '';
}

function parseTimestamp(value) {
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}

function isSessionStrictlyActive(session, nowMs) {
  const lastActivityMs = parseTimestamp(session.lastActivityAt);
  return Boolean(lastActivityMs && nowMs - lastActivityMs <= ACTIVITY_IDLE_THRESHOLD_MS);
}

function getSessionElapsedMs(session) {
  return Math.min(session.durationMs || 0, (session.focusedMs || 0) + (session.blurredMs || 0));
}

function isCursorWindowFocused() {
  return Boolean(vscode.window.state && vscode.window.state.focused);
}

function notifySessionCompleted(session) {
  const label = formatSessionType(session.type);
  if (session.type === 'focus') {
    const taskTitle = session.task && session.task.title ? `「${session.task.title}」` : '';
    vscode.window.showInformationMessage(`Leap Home: ${taskTitle}${label}完成，专注 ${formatMinutes(session.focusedMs)}，打断 ${session.interruptions} 次。`);
    return;
  }
  vscode.window.showInformationMessage(`Leap Home: ${label}完成。`);
}

function formatSessionType(sessionType) {
  return {
    focus: '专注',
    shortBreak: '短休息',
    longBreak: '长休息'
  }[normalizeSessionType(sessionType)];
}

function formatMinutes(ms) {
  const minutes = Math.max(0, Math.round((Number(ms) || 0) / 60000));
  return `${minutes} 分钟`;
}

module.exports = {
  DEFAULT_FOCUS_DURATION_MS,
  pauseFocusTimer,
  readFocusTimerSnapshot,
  registerFocusTimerLifecycle,
  resetFocusTimer,
  resumeFocusTimer,
  startFocusTimer
};
