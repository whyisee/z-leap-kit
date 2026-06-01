const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { execFile } = require('child_process');
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
const MAX_APP_USAGE_ITEMS = 12;
const ACTIVITY_IDLE_THRESHOLD_MS = 2 * 60 * 1000;
const DEFAULT_FOREGROUND_APP_POLL_INTERVAL_MS = 5000;
const DEFAULT_TRUSTED_FOCUS_APPS = [
  'Cursor',
  'Visual Studio Code',
  'Code',
  'Obsidian',
  'Notion',
  'Google Chrome',
  'Chrome',
  'Safari',
  'Microsoft Edge',
  'Arc',
  'Preview',
  'PDF Expert',
  'Skim',
  'Typora',
  'Xcode',
  'Terminal',
  'iTerm2',
  'Warp',
  'WezTerm'
];

let foregroundAppWarningShown = false;

function readFocusTimerSnapshot(context) {
  const data = readFocusTimerData(context);
  const advanced = advanceFocusTimerData(data, Date.now(), { recordHistory: false });
  return toFocusTimerView(advanced.data);
}

async function startFocusTimer(context, options) {
  const now = new Date();
  const data = readFocusTimerData(context);
  const request = normalizeStartOptions(options, data.settings);
  const settings = normalizeSettings(data.settings);
  if (request.sessionType === 'focus' && request.saveDefaultDuration) {
    data.settings.defaultFocusDurationMs = request.durationMs;
  }
  const environment = await getCurrentFocusEnvironment(settings);
  data.activeSession = createSession(request.sessionType, request.durationMs, now, request.task, environment, settings);
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
    const settings = normalizeSettings(advanced.data.settings);
    const environment = await getCurrentFocusEnvironment(settings);
    session.status = 'running';
    session.pausedAt = '';
    session.lastTickAt = now.toISOString();
    updateSessionEnvironment(session, environment, settings, now.getTime());
    session.lastFocusChangedAt = now.toISOString();
    if (session.cursorFocused) {
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
  if (session && (session.status === 'running' || session.status === 'paused')) {
    const settings = normalizeSettings(advanced.data.settings);
    const environment = await getCurrentFocusEnvironment(settings, { cursorFocused: Boolean(focused) });
    if (updateSessionEnvironment(session, environment, settings, now)) {
      advanced.changed = true;
    }
    if (session.cursorFocused) {
      session.lastActivityAt = new Date(now).toISOString();
    }
  }
  if (advanced.changed) {
    await writeFocusTimerData(context, advanced.data);
  }
  return {
    changed: advanced.changed,
    completedSession: advanced.completedSession
  };
}

async function syncFocusTimerEnvironment(context) {
  const now = Date.now();
  const advanced = advanceFocusTimerData(readFocusTimerData(context), now, { recordHistory: true });
  const session = advanced.data.activeSession;
  if (session && (session.status === 'running' || session.status === 'paused')) {
    const settings = normalizeSettings(advanced.data.settings);
    const environment = await getCurrentFocusEnvironment(settings);
    if (updateSessionEnvironment(session, environment, settings, now)) {
      advanced.changed = true;
    }
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
  if (session && session.status === 'running') {
    const settings = normalizeSettings(advanced.data.settings);
    updateSessionEnvironment(session, {
      cursorFocused: true,
      foregroundApp: createForegroundApp(getCursorAppName(), true, 'cursor')
    }, settings, now);
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
  let lastEnvironmentSyncAt = 0;
  const disposables = [
    vscode.window.onDidChangeWindowState((state) => {
      runFocusUpdate(() => setFocusTimerWindowFocused(context, state.focused));
    }),
    vscode.workspace.onDidChangeTextDocument(() => recordActivity()),
    vscode.window.onDidChangeTextEditorSelection(() => recordActivity()),
    vscode.window.onDidChangeActiveTextEditor(() => recordActivity())
  ];
  const timer = setInterval(() => {
    const now = Date.now();
    if (now - lastEnvironmentSyncAt >= getFocusTimerPollIntervalMs()) {
      lastEnvironmentSyncAt = now;
      runFocusUpdate(() => syncFocusTimerEnvironment(context));
      return;
    }
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
      if (result && result.changed && provider && provider.panel) {
        if (result.completedSession && typeof provider.postModel === 'function') {
          provider.postModel();
        } else if (typeof provider.postFocusTimer === 'function') {
          provider.postFocusTimer();
        } else if (typeof provider.postModel === 'function') {
          provider.postModel();
        }
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

function createSession(sessionType, durationMs, now, task, environment, settings) {
  const timestamp = now.toISOString();
  const focusEnvironment = normalizeFocusEnvironment(environment, settings);
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
    lastActivityAt: focusEnvironment.cursorFocused ? timestamp : '',
    cursorFocused: focusEnvironment.cursorFocused,
    focused: isEnvironmentProductive(focusEnvironment, settings),
    foregroundApp: focusEnvironment.foregroundApp,
    foregroundAppName: focusEnvironment.foregroundApp.name,
    foregroundAppTrusted: focusEnvironment.foregroundApp.trusted,
    lastAppChangedAt: timestamp,
    focusedMs: 0,
    strictFocusedMs: 0,
    blurredMs: 0,
    trustedExternalMs: 0,
    untrustedExternalMs: 0,
    idleMs: 0,
    interruptions: 0,
    appSwitches: 0,
    appUsage: {},
    activityEvents: 0,
    task: sessionType === 'focus' ? normalizeTaskRef(task) : undefined,
    historyRecorded: false
  };
}

function updateSessionEnvironment(session, environment, settings, nowMs) {
  const normalized = normalizeFocusEnvironment(environment, settings);
  const previousFocused = Boolean(session.focused);
  const previousCursorFocused = Boolean(session.cursorFocused);
  const previousAppName = String(session.foregroundAppName || (session.foregroundApp && session.foregroundApp.name) || '').trim();
  const nextFocused = isEnvironmentProductive(normalized, settings);
  const nextApp = normalized.foregroundApp;
  let changed = false;

  if (session.cursorFocused !== normalized.cursorFocused) {
    session.cursorFocused = normalized.cursorFocused;
    changed = true;
  }
  if (session.focused !== nextFocused) {
    if (session.status === 'running' && previousFocused && !nextFocused) {
      session.interruptions += 1;
    }
    session.focused = nextFocused;
    session.lastFocusChangedAt = new Date(nowMs).toISOString();
    changed = true;
  }
  if (!isSameForegroundApp(session.foregroundApp, nextApp)) {
    if (previousAppName && previousAppName !== nextApp.name) {
      session.appSwitches += 1;
    }
    session.foregroundApp = nextApp;
    session.foregroundAppName = nextApp.name;
    session.foregroundAppTrusted = nextApp.trusted;
    session.lastAppChangedAt = new Date(nowMs).toISOString();
    changed = true;
  } else if (session.foregroundAppTrusted !== nextApp.trusted || session.foregroundAppName !== nextApp.name) {
    session.foregroundApp = nextApp;
    session.foregroundAppName = nextApp.name;
    session.foregroundAppTrusted = nextApp.trusted;
    changed = true;
  }
  if (normalized.cursorFocused && !previousCursorFocused) {
    session.lastActivityAt = new Date(nowMs).toISOString();
  }
  return changed;
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
  applyAppUsage(session, appliedMs);
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
  session.trustedExternalMs = Math.min(session.trustedExternalMs, session.focusedMs);
  session.untrustedExternalMs = Math.min(session.untrustedExternalMs, session.blurredMs);
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
    trustedExternalMs: session.trustedExternalMs,
    untrustedExternalMs: session.untrustedExternalMs,
    idleMs: session.idleMs,
    interruptions: session.interruptions,
    appSwitches: session.appSwitches,
    appUsage: normalizeAppUsage(session.appUsage),
    foregroundApp: normalizeForegroundApp(session.foregroundApp),
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
      cursorFocused: isCursorWindowFocused(),
      focused: isCursorWindowFocused(),
      foregroundApp: createForegroundApp(getCursorAppName(), true, 'cursor'),
      foregroundAppName: getCursorAppName(),
      foregroundAppTrusted: true,
      lastAppChangedAt: '',
      focusedMs: 0,
      strictFocusedMs: 0,
      blurredMs: 0,
      trustedExternalMs: 0,
      untrustedExternalMs: 0,
      idleMs: 0,
      interruptions: 0,
      appSwitches: 0,
      appUsage: {},
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
    strictProgress: session.durationMs > 0 ? Math.round((session.strictFocusedMs / session.durationMs) * 100) : 0,
    appUsage: normalizeAppUsage(session.appUsage),
    topApps: summarizeAppUsage(session.appUsage)
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

function getConfiguredFocusTimerSettings() {
  const config = vscode.workspace.getConfiguration('leapHome');
  return {
    trackForegroundApp: config.get('focusTimer.trackForegroundApp', true),
    trustedApps: config.get('focusTimer.trustedApps', DEFAULT_TRUSTED_FOCUS_APPS),
    foregroundAppPollIntervalMs: config.get('focusTimer.foregroundAppPollIntervalMs', DEFAULT_FOREGROUND_APP_POLL_INTERVAL_MS)
  };
}

function normalizeSettings(value) {
  const source = value && typeof value === 'object' ? value : {};
  const config = getConfiguredFocusTimerSettings();
  return {
    defaultFocusDurationMs: normalizeDuration(source.defaultFocusDurationMs || DEFAULT_FOCUS_DURATION_MS, 'focus'),
    shortBreakDurationMs: normalizeDuration(source.shortBreakDurationMs || DEFAULT_SHORT_BREAK_MS, 'shortBreak'),
    longBreakDurationMs: normalizeDuration(source.longBreakDurationMs || DEFAULT_LONG_BREAK_MS, 'longBreak'),
    activityIdleThresholdMs: normalizeDuration(source.activityIdleThresholdMs || ACTIVITY_IDLE_THRESHOLD_MS, 'shortBreak'),
    trackForegroundApp: typeof source.trackForegroundApp === 'boolean' ? source.trackForegroundApp : config.trackForegroundApp,
    trustedApps: normalizeStringList(source.trustedApps && source.trustedApps.length ? source.trustedApps : config.trustedApps, DEFAULT_TRUSTED_FOCUS_APPS),
    foregroundAppPollIntervalMs: normalizePollInterval(source.foregroundAppPollIntervalMs || config.foregroundAppPollIntervalMs)
  };
}

function normalizeFocusEnvironment(value, settings) {
  const source = value && typeof value === 'object' ? value : {};
  const cursorFocused = typeof source.cursorFocused === 'boolean' ? source.cursorFocused : isCursorWindowFocused();
  const fallbackName = cursorFocused ? getCursorAppName() : '';
  const app = normalizeForegroundApp(source.foregroundApp, {
    name: fallbackName,
    trusted: cursorFocused,
    source: cursorFocused ? 'cursor' : 'unknown'
  });
  const trusted = cursorFocused || isTrustedFocusApp(app.name, settings && settings.trustedApps);
  return {
    cursorFocused,
    foregroundApp: createForegroundApp(app.name || fallbackName, trusted, app.source, app.platform)
  };
}

function isEnvironmentProductive(environment, settings) {
  const normalized = normalizeFocusEnvironment(environment, settings);
  return Boolean(
    normalized.cursorFocused ||
    (settings && settings.trackForegroundApp && normalized.foregroundApp.name && normalized.foregroundApp.trusted)
  );
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
    cursorFocused: typeof value.cursorFocused === 'boolean'
      ? value.cursorFocused
      : (typeof value.focused === 'boolean' ? value.focused : isCursorWindowFocused()),
    focused: typeof value.focused === 'boolean' ? value.focused : isCursorWindowFocused(),
    foregroundApp: normalizeForegroundApp(value.foregroundApp, {
      name: value.foregroundAppName || (isCursorWindowFocused() ? getCursorAppName() : ''),
      trusted: Boolean(value.foregroundAppTrusted),
      source: 'legacy'
    }),
    foregroundAppName: String(value.foregroundAppName || (value.foregroundApp && value.foregroundApp.name) || '').trim(),
    foregroundAppTrusted: Boolean(value.foregroundAppTrusted || (value.foregroundApp && value.foregroundApp.trusted)),
    lastAppChangedAt: normalizeTimestamp(value.lastAppChangedAt) || normalizeTimestamp(value.startedAt),
    focusedMs: normalizeMs(value.focusedMs),
    strictFocusedMs: normalizeMs(value.strictFocusedMs),
    blurredMs: normalizeMs(value.blurredMs),
    trustedExternalMs: normalizeMs(value.trustedExternalMs),
    untrustedExternalMs: normalizeMs(value.untrustedExternalMs),
    idleMs: normalizeMs(value.idleMs),
    interruptions: normalizeCount(value.interruptions),
    appSwitches: normalizeCount(value.appSwitches),
    appUsage: normalizeAppUsage(value.appUsage),
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
    trustedExternalMs: normalizeMs(value.trustedExternalMs),
    untrustedExternalMs: normalizeMs(value.untrustedExternalMs),
    idleMs: normalizeMs(value.idleMs),
    interruptions: normalizeCount(value.interruptions),
    appSwitches: normalizeCount(value.appSwitches),
    appUsage: normalizeAppUsage(value.appUsage),
    foregroundApp: normalizeForegroundApp(value.foregroundApp),
    activityEvents: normalizeCount(value.activityEvents),
    task: normalizeTaskRef(value.task),
    startedAt,
    completedAt
  };
}

function normalizeForegroundApp(value, fallback) {
  const source = value && typeof value === 'object' ? value : {};
  const fallbackSource = fallback && typeof fallback === 'object' ? fallback : {};
  const name = String(source.name || fallbackSource.name || '').replace(/\s+/g, ' ').trim();
  return {
    name,
    platform: String(source.platform || fallbackSource.platform || process.platform || '').trim(),
    trusted: typeof source.trusted === 'boolean' ? source.trusted : Boolean(fallbackSource.trusted),
    source: String(source.source || fallbackSource.source || 'system').trim(),
    capturedAt: normalizeTimestamp(source.capturedAt) || new Date().toISOString()
  };
}

function createForegroundApp(name, trusted, source, platform) {
  return normalizeForegroundApp({
    name,
    trusted,
    source,
    platform: platform || process.platform,
    capturedAt: new Date().toISOString()
  });
}

function isSameForegroundApp(left, right) {
  const leftApp = normalizeForegroundApp(left);
  const rightApp = normalizeForegroundApp(right);
  return leftApp.name === rightApp.name && leftApp.trusted === rightApp.trusted && leftApp.source === rightApp.source;
}

function applyAppUsage(session, deltaMs) {
  const delta = normalizeMs(deltaMs);
  if (!delta) {
    return;
  }
  const appName = getSessionUsageAppName(session);
  session.appUsage = normalizeAppUsage(Object.assign({}, session.appUsage, {
    [appName]: (normalizeAppUsage(session.appUsage)[appName] || 0) + delta
  }));
  if (!session.cursorFocused && session.focused) {
    session.trustedExternalMs = normalizeMs(session.trustedExternalMs) + delta;
  } else if (!session.cursorFocused && !session.focused) {
    session.untrustedExternalMs = normalizeMs(session.untrustedExternalMs) + delta;
  }
}

function getSessionUsageAppName(session) {
  if (session && session.cursorFocused) {
    return getCursorAppName();
  }
  const appName = String(
    (session && session.foregroundAppName) ||
    (session && session.foregroundApp && session.foregroundApp.name) ||
    ''
  ).trim();
  return appName || '其他应用';
}

function normalizeAppUsage(value) {
  const source = value && typeof value === 'object' ? value : {};
  return Object.entries(source)
    .map(([name, ms]) => [String(name || '').replace(/\s+/g, ' ').trim(), normalizeMs(ms)])
    .filter(([name, ms]) => name && ms > 0)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, MAX_APP_USAGE_ITEMS)
    .reduce((result, [name, ms]) => {
      result[name] = ms;
      return result;
    }, {});
}

function summarizeAppUsage(value) {
  return Object.entries(normalizeAppUsage(value))
    .slice(0, 4)
    .map(([name, ms]) => ({ name, ms }));
}

function normalizeStringList(value, fallback) {
  const list = Array.isArray(value) ? value : fallback;
  const normalized = (Array.isArray(list) ? list : [])
    .map((item) => String(item || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  return normalized.length ? Array.from(new Set(normalized)) : fallback.slice();
}

function normalizePollInterval(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return DEFAULT_FOREGROUND_APP_POLL_INTERVAL_MS;
  }
  return Math.min(Math.max(Math.round(number), 1000), 60000);
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
  if (session.focused && !session.cursorFocused && session.foregroundAppTrusted) {
    return true;
  }
  const lastActivityMs = parseTimestamp(session.lastActivityAt);
  const threshold = normalizeSettings({}).activityIdleThresholdMs || ACTIVITY_IDLE_THRESHOLD_MS;
  return Boolean(lastActivityMs && nowMs - lastActivityMs <= threshold);
}

function getSessionElapsedMs(session) {
  return Math.min(session.durationMs || 0, (session.focusedMs || 0) + (session.blurredMs || 0));
}

function isCursorWindowFocused() {
  return Boolean(vscode.window.state && vscode.window.state.focused);
}

function getCursorAppName() {
  return String((vscode.env && vscode.env.appName) || 'Cursor').replace(/\s+/g, ' ').trim() || 'Cursor';
}

function getFocusTimerPollIntervalMs() {
  return normalizePollInterval(getConfiguredFocusTimerSettings().foregroundAppPollIntervalMs);
}

async function getCurrentFocusEnvironment(settings, options) {
  const cursorFocused = options && typeof options.cursorFocused === 'boolean'
    ? options.cursorFocused
    : isCursorWindowFocused();
  const normalizedSettings = normalizeSettings(settings);
  if (!normalizedSettings.trackForegroundApp) {
    return normalizeFocusEnvironment({
      cursorFocused,
      foregroundApp: createForegroundApp(cursorFocused ? getCursorAppName() : '', cursorFocused, cursorFocused ? 'cursor' : 'disabled')
    }, normalizedSettings);
  }

  let app = undefined;
  try {
    app = await queryForegroundApplication();
  } catch (error) {
    if (!foregroundAppWarningShown) {
      foregroundAppWarningShown = true;
      logger.warn('focus timer foreground app detection unavailable', error);
    }
  }
  const appName = app && app.name ? app.name : (cursorFocused ? getCursorAppName() : '');
  const trusted = cursorFocused || isTrustedFocusApp(appName, normalizedSettings.trustedApps);
  return normalizeFocusEnvironment({
    cursorFocused,
    foregroundApp: createForegroundApp(appName, trusted, app && app.source ? app.source : 'system', app && app.platform)
  }, normalizedSettings);
}

async function queryForegroundApplication() {
  if (process.platform === 'darwin') {
    const name = await execFileText('/usr/bin/osascript', [
      '-e',
      'tell application "System Events" to get name of first application process whose frontmost is true'
    ]);
    return { name, platform: process.platform, source: 'system-events' };
  }
  if (process.platform === 'win32') {
    const script = [
      'Add-Type -Namespace LeapHome -Name Win32 -MemberDefinition \'[System.Runtime.InteropServices.DllImport("user32.dll")] public static extern System.IntPtr GetForegroundWindow(); [System.Runtime.InteropServices.DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(System.IntPtr hWnd, out uint processId);\'',
      '$hwnd = [LeapHome.Win32]::GetForegroundWindow()',
      '[uint32]$pid = 0',
      '[LeapHome.Win32]::GetWindowThreadProcessId($hwnd, [ref]$pid) | Out-Null',
      '(Get-Process -Id $pid).ProcessName'
    ].join('; ');
    const name = await execFileText('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script]);
    return { name, platform: process.platform, source: 'win32' };
  }
  if (process.platform === 'linux') {
    const name = await execFileText('xdotool', ['getactivewindow', 'getwindowname']);
    return { name, platform: process.platform, source: 'xdotool' };
  }
  return { name: '', platform: process.platform, source: 'unsupported' };
}

function execFileText(command, args) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { timeout: 1200, maxBuffer: 64 * 1024 }, (error, stdout) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(String(stdout || '').replace(/\s+/g, ' ').trim());
    });
  });
}

function isTrustedFocusApp(name, trustedApps) {
  const normalized = normalizeAppName(name);
  if (!normalized) {
    return false;
  }
  return normalizeStringList(trustedApps, DEFAULT_TRUSTED_FOCUS_APPS).some((item) => {
    const trusted = normalizeAppName(item);
    return trusted && (normalized === trusted || normalized.includes(trusted) || trusted.includes(normalized));
  });
}

function normalizeAppName(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
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
