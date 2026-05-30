const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const vscode = require('vscode');
const { getLeapComponentDataPath } = require('./storage');
const { hashText } = require('./utils');

function readSearchHistory(context) {
  const data = readJsonFile(getLeapComponentDataPath(context, 'searchHistory'));
  const items = Array.isArray(data) ? data : data && Array.isArray(data.items) ? data.items : [];
  return items.map(normalizeHistoryItem).filter(Boolean).slice(0, getSearchHistoryLimit());
}

async function recordSearchHistory(context, entry) {
  const query = String(entry && entry.query || '').trim();
  if (!query) {
    return readSearchHistory(context);
  }

  const now = new Date().toISOString();
  const limit = getSearchHistoryLimit();
  const mode = entry && entry.aiAttempted ? 'ai' : 'local';
  const effectiveQuery = String(entry && entry.effectiveQuery || query).trim();
  const key = historyKey(query, effectiveQuery, mode);
  const current = readSearchHistory(context);
  const existing = current.find((item) => historyKey(item.query, item.effectiveQuery, item.mode) === key);
  const nextItem = {
    id: existing ? existing.id : hashText(key),
    query,
    effectiveQuery,
    mode,
    reason: String(entry && entry.reason || '').trim().slice(0, 240),
    resultCount: clampHistoryNumber(entry && entry.resultCount, 0, 99999),
    count: existing ? existing.count + 1 : 1,
    createdAt: existing ? existing.createdAt : now,
    updatedAt: now
  };
  const next = [nextItem]
    .concat(current.filter((item) => historyKey(item.query, item.effectiveQuery, item.mode) !== key))
    .slice(0, limit);

  await writeJsonFile(getLeapComponentDataPath(context, 'searchHistory'), {
    version: 1,
    items: next
  });
  return next;
}

function normalizeHistoryItem(value) {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const query = String(value.query || '').trim();
  if (!query) {
    return undefined;
  }
  const mode = value.mode === 'ai' ? 'ai' : 'local';
  const effectiveQuery = String(value.effectiveQuery || query).trim();
  return {
    id: String(value.id || hashText(historyKey(query, effectiveQuery, mode))),
    query,
    effectiveQuery,
    mode,
    reason: String(value.reason || '').trim(),
    resultCount: clampHistoryNumber(value.resultCount, 0, 99999),
    count: clampHistoryNumber(value.count, 1, 99999),
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : '',
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : ''
  };
}

function historyKey(query, effectiveQuery, mode) {
  return [mode || 'local', String(query || '').trim(), String(effectiveQuery || query || '').trim()].join('\n');
}

function getSearchHistoryLimit() {
  const config = vscode.workspace.getConfiguration('leapHome');
  return clampHistoryNumber(config.get('search.historyLimit', 30), 0, 100);
}

function clampHistoryNumber(value, min, max) {
  const number = Number.parseInt(value, 10);
  if (Number.isNaN(number)) {
    return min;
  }
  return Math.min(Math.max(number, min), max);
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

module.exports = {
  readSearchHistory,
  recordSearchHistory
};
