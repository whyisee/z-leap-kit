const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { appendInboxEntry, resolveInboxPath } = require('./inbox');
const { getLeapComponentDataPath } = require('./storage');

const MAX_QUICK_CAPTURE_ITEMS = 12;
const QUICK_CAPTURE_KINDS = new Set(['note', 'task', 'link', 'code']);

function readQuickCaptures(context) {
  const value = readJsonFile(getLeapComponentDataPath(context, 'quickCapture'));
  const items = Array.isArray(value)
    ? value
    : value && typeof value === 'object' && Array.isArray(value.items)
      ? value.items
      : [];
  return items.map(normalizeQuickCaptureItem).filter(Boolean).slice(0, MAX_QUICK_CAPTURE_ITEMS);
}

async function recordQuickCapture(context, entry) {
  const item = normalizeQuickCaptureItem(Object.assign({}, entry, {
    id: entry && entry.id ? entry.id : createCaptureId(),
    createdAt: entry && entry.createdAt ? entry.createdAt : new Date().toISOString()
  }));
  if (!item) {
    return readQuickCaptures(context);
  }

  const existing = readQuickCaptures(context).filter((current) => current.id !== item.id);
  const next = [item, ...existing].slice(0, MAX_QUICK_CAPTURE_ITEMS);
  await writeQuickCaptures(context, next);
  return next;
}

async function saveQuickCaptureToInbox(context, payload) {
  const text = cleanText(payload && payload.text);
  if (!text) {
    return readQuickCaptures(context);
  }

  const kind = normalizeQuickCaptureKind(payload && payload.kind);
  const inboxPath = resolveInboxPath(context);
  await appendInboxEntry(inboxPath, formatInboxEntry(text, kind));
  return recordQuickCapture(context, {
    text,
    kind,
    target: 'inbox',
    label: '收集箱'
  });
}

function formatInboxEntry(text, kind) {
  if (kind === 'code') {
    return ['类型：代码片段', '', '```text', text, '```'].join('\n');
  }
  if (kind === 'link') {
    return ['类型：链接', '', text].join('\n');
  }
  return ['类型：想法', '', text].join('\n');
}

function normalizeQuickCaptureKind(value) {
  const kind = String(value || '').trim();
  return QUICK_CAPTURE_KINDS.has(kind) ? kind : 'note';
}

function getQuickCaptureKindLabel(kind) {
  return {
    note: '想法',
    task: '待办',
    link: '链接',
    code: '代码'
  }[normalizeQuickCaptureKind(kind)];
}

function normalizeQuickCaptureItem(value) {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const text = cleanText(value.text);
  if (!text) {
    return undefined;
  }
  return {
    id: String(value.id || createCaptureId()),
    text,
    kind: normalizeQuickCaptureKind(value.kind),
    target: normalizeTarget(value.target),
    label: cleanInline(value.label).slice(0, 40),
    dueDate: normalizeDate(value.dueDate),
    reason: cleanInline(value.reason).slice(0, 160),
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : new Date().toISOString()
  };
}

async function writeQuickCaptures(context, items) {
  const filePath = getLeapComponentDataPath(context, 'quickCapture');
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, JSON.stringify({ version: 1, items }, null, 2) + '\n', 'utf8');
}

function readJsonFile(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    return undefined;
  }
}

function normalizeTarget(value) {
  const target = String(value || '').trim();
  return ['inbox', 'quadrant'].includes(target) ? target : '';
}

function cleanText(value) {
  return String(value || '').replace(/\r\n/g, '\n').trim().slice(0, 4000);
}

function cleanInline(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeDate(value) {
  const text = String(value || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
}

function createCaptureId() {
  return `capture-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

module.exports = {
  getQuickCaptureKindLabel,
  readQuickCaptures,
  recordQuickCapture,
  saveQuickCaptureToInbox
};
