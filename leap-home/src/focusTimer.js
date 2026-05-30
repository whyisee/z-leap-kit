const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const vscode = require('vscode');
const logger = require('./logger');
const { getLeapComponentDataPath } = require('./storage');

const DEFAULT_DURATION_MS = 25 * 60 * 1000;
const MIN_DURATION_MS = 5 * 60 * 1000;
const MAX_DURATION_MS = 4 * 60 * 60 * 1000;
const MAX_HISTORY_ITEMS = 30;

function readFocusTimerSnapshot(context) {
  const data = readFocusTimerData(context);
  const advanced = advanceFocusTimerData(data, Date.now(), { recordHistory: false });
  return toFocusTimerView(advanced.data);
}

async function startFocusTimer(context, durationMs) {
  const now = new Date();
  const data = readFocusTimerData(context);
  data.activeSession = createSession(normalizeDuration(durationMs), now);
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
    advanced.changed = true;
  }
  if (advanced.changed) {
    await writeFocusTimerData(context, advanced.data);
  }
  return toFocusTimerView(advanced.data);
}

async function resetFocusTimer(context) {
  const data = readFocusTimerData(context);
  if (!data.activeSession) {
    return toFocusTimerView(data);
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
  return advanced.changed;
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
    advanced.changed = true;
  }
  if (advanced.changed) {
    await writeFocusTimerData(context, advanced.data);
  }
  return advanced.changed;
}

function registerFocusTimerLifecycle(context, provider) {
  let running = false;
  const focusDisposable = vscode.window.onDidChangeWindowState((state) => {
    runFocusUpdate(() => setFocusTimerWindowFocused(context, state.focused));
  });
  const timer = setInterval(() => {
    runFocusUpdate(() => tickFocusTimer(context));
  }, 1000);

  async function runFocusUpdate(operation) {
    if (running) {
      return;
    }
    running = true;
    try {
      const changed = await operation();
      if (changed && provider && provider.panel && typeof provider.postModel === 'function') {
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
      focusDisposable.dispose();
      clearInterval(timer);
    }
  };
}

function createSession(durationMs, now) {
  const timestamp = now.toISOString();
  return {
    id: `focus-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    status: 'running',
    durationMs,
    startedAt: timestamp,
    pausedAt: '',
    completedAt: '',
    lastTickAt: timestamp,
    lastFocusChangedAt: timestamp,
    focused: isCursorWindowFocused(),
    focusedMs: 0,
    blurredMs: 0,
    idleMs: 0,
    interruptions: 0,
    historyRecorded: false
  };
}

function advanceFocusTimerData(data, nowMs, options) {
  const result = { data, changed: false };
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
  } else {
    session.blurredMs += appliedMs;
  }
  session.lastTickAt = new Date(nowMs).toISOString();
  result.changed = true;

  if (session.focusedMs + session.blurredMs >= session.durationMs) {
    completeFocusSession(data, session, nowMs, Boolean(options && options.recordHistory));
  }

  return result;
}

function completeFocusSession(data, session, nowMs, recordHistory) {
  session.status = 'completed';
  session.pausedAt = '';
  session.completedAt = new Date(nowMs).toISOString();
  session.focusedMs = Math.min(session.focusedMs, session.durationMs);
  session.blurredMs = Math.min(session.blurredMs, Math.max(0, session.durationMs - session.focusedMs));
  if (recordHistory && !session.historyRecorded) {
    data.history = [toHistoryItem(session), ...(data.history || [])].slice(0, MAX_HISTORY_ITEMS);
    session.historyRecorded = true;
  }
}

function toHistoryItem(session) {
  return {
    id: session.id,
    durationMs: session.durationMs,
    focusedMs: session.focusedMs,
    blurredMs: session.blurredMs,
    idleMs: session.idleMs,
    interruptions: session.interruptions,
    startedAt: session.startedAt,
    completedAt: session.completedAt
  };
}

function toFocusTimerView(data) {
  const activeSession = data.activeSession
    ? addDerivedSessionFields(data.activeSession)
    : addDerivedSessionFields({
      id: '',
      status: 'idle',
      durationMs: DEFAULT_DURATION_MS,
      startedAt: '',
      pausedAt: '',
      completedAt: '',
      lastTickAt: '',
      lastFocusChangedAt: '',
      focused: isCursorWindowFocused(),
      focusedMs: 0,
      blurredMs: 0,
      idleMs: 0,
      interruptions: 0,
      historyRecorded: false
    });

  return {
    version: 1,
    activeSession,
    history: (data.history || []).map(normalizeHistoryItem).filter(Boolean).slice(0, MAX_HISTORY_ITEMS)
  };
}

function addDerivedSessionFields(session) {
  const elapsedMs = Math.min(session.durationMs, session.focusedMs + session.blurredMs);
  return Object.assign({}, session, {
    elapsedMs,
    remainingMs: Math.max(0, session.durationMs - elapsedMs),
    progress: session.durationMs > 0 ? Math.round((elapsedMs / session.durationMs) * 100) : 0
  });
}

function readFocusTimerData(context) {
  const value = readJsonFile(getLeapComponentDataPath(context, 'focusTimer'));
  const source = value && typeof value === 'object' ? value : {};
  return {
    version: 1,
    activeSession: normalizeSession(source.activeSession),
    history: Array.isArray(source.history) ? source.history.map(normalizeHistoryItem).filter(Boolean).slice(0, MAX_HISTORY_ITEMS) : []
  };
}

async function writeFocusTimerData(context, data) {
  const filePath = getLeapComponentDataPath(context, 'focusTimer');
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, JSON.stringify({
    version: 1,
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
    status,
    durationMs: normalizeDuration(value.durationMs),
    startedAt: normalizeTimestamp(value.startedAt),
    pausedAt: normalizeTimestamp(value.pausedAt),
    completedAt: normalizeTimestamp(value.completedAt),
    lastTickAt: normalizeTimestamp(value.lastTickAt) || normalizeTimestamp(value.startedAt),
    lastFocusChangedAt: normalizeTimestamp(value.lastFocusChangedAt) || normalizeTimestamp(value.startedAt),
    focused: typeof value.focused === 'boolean' ? value.focused : isCursorWindowFocused(),
    focusedMs: normalizeMs(value.focusedMs),
    blurredMs: normalizeMs(value.blurredMs),
    idleMs: normalizeMs(value.idleMs),
    interruptions: normalizeCount(value.interruptions),
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
  return {
    id: String(value.id || `focus-history-${startedAt}`),
    durationMs: normalizeDuration(value.durationMs),
    focusedMs: normalizeMs(value.focusedMs),
    blurredMs: normalizeMs(value.blurredMs),
    idleMs: normalizeMs(value.idleMs),
    interruptions: normalizeCount(value.interruptions),
    startedAt,
    completedAt
  };
}

function normalizeDuration(value) {
  const duration = Number(value);
  if (!Number.isFinite(duration)) {
    return DEFAULT_DURATION_MS;
  }
  return Math.min(Math.max(Math.round(duration), MIN_DURATION_MS), MAX_DURATION_MS);
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

function normalizeTimestamp(value) {
  const timestamp = String(value || '').trim();
  return parseTimestamp(timestamp) ? timestamp : '';
}

function parseTimestamp(value) {
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}

function isCursorWindowFocused() {
  return Boolean(vscode.window.state && vscode.window.state.focused);
}

module.exports = {
  DEFAULT_DURATION_MS,
  pauseFocusTimer,
  readFocusTimerSnapshot,
  registerFocusTimerLifecycle,
  resetFocusTimer,
  resumeFocusTimer,
  startFocusTimer
};
