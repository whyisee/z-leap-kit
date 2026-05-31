const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { getLeapComponentDataPath } = require('./storage');

const MAX_COUNTDOWN_ITEMS = 100;
const COLORS = new Set(['blue', 'green', 'yellow', 'red', 'purple']);

function readCountdowns(context) {
  const value = readJsonFile(getLeapComponentDataPath(context, 'countdown'));
  const source = value && typeof value === 'object' ? value : {};
  return {
    version: 1,
    items: Array.isArray(source.items)
      ? source.items.map(normalizeCountdownItem).filter(Boolean).slice(0, MAX_COUNTDOWN_ITEMS)
      : []
  };
}

async function addCountdownItem(context, input) {
  const item = createCountdownItem(input);
  if (!item) return readCountdowns(context);
  const data = readCountdowns(context);
  data.items = [item, ...data.items].slice(0, MAX_COUNTDOWN_ITEMS);
  await writeCountdowns(context, data);
  return data;
}

async function updateCountdownItem(context, itemId, patch) {
  const data = readCountdowns(context);
  const now = new Date().toISOString();
  data.items = data.items.map((item) => {
    if (item.id !== itemId) return item;
    return normalizeCountdownItem(Object.assign({}, item, sanitizePatch(patch), { updatedAt: now })) || item;
  });
  await writeCountdowns(context, data);
  return data;
}

async function toggleCountdownItem(context, itemId, done) {
  const data = readCountdowns(context);
  const now = new Date().toISOString();
  data.items = data.items.map((item) => (
    item.id === itemId ? Object.assign({}, item, { done: Boolean(done), updatedAt: now }) : item
  ));
  await writeCountdowns(context, data);
  return data;
}

async function deleteCountdownItem(context, itemId) {
  const data = readCountdowns(context);
  data.items = data.items.filter((item) => item.id !== itemId);
  await writeCountdowns(context, data);
  return data;
}

function createCountdownItem(input) {
  const now = new Date().toISOString();
  return normalizeCountdownItem(Object.assign({}, sanitizePatch(input), {
    id: `countdown-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    done: false,
    createdAt: now,
    updatedAt: now
  }));
}

function sanitizePatch(value) {
  const source = value && typeof value === 'object' ? value : {};
  const targetDate = normalizeDate(source.targetDate);
  const targetTime = normalizeTime(source.targetTime);
  return {
    title: cleanText(source.title),
    mode: targetTime ? 'datetime' : 'date',
    targetDate,
    targetTime,
    note: cleanText(source.note),
    color: normalizeColor(source.color),
    done: Boolean(source.done)
  };
}

function normalizeCountdownItem(value) {
  if (!value || typeof value !== 'object') return undefined;
  const title = cleanText(value.title);
  const targetDate = normalizeDate(value.targetDate);
  if (!title || !targetDate) return undefined;
  const targetTime = normalizeTime(value.targetTime);
  return {
    id: String(value.id || `countdown-${Date.now()}`),
    title,
    mode: targetTime ? 'datetime' : 'date',
    targetDate,
    targetTime,
    note: cleanText(value.note),
    color: normalizeColor(value.color),
    done: Boolean(value.done),
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : '',
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : ''
  };
}

function normalizeDate(value) {
  const text = String(value || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
}

function normalizeTime(value) {
  const text = String(value || '').trim();
  return /^\d{2}:\d{2}$/.test(text) ? text : '';
}

function normalizeColor(value) {
  const color = String(value || '').trim();
  return COLORS.has(color) ? color : 'blue';
}

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function readJsonFile(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    return undefined;
  }
}

async function writeCountdowns(context, data) {
  const filePath = getLeapComponentDataPath(context, 'countdown');
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, JSON.stringify({
    version: 1,
    items: (data.items || []).map(normalizeCountdownItem).filter(Boolean).slice(0, MAX_COUNTDOWN_ITEMS)
  }, null, 2) + '\n', 'utf8');
}

module.exports = {
  addCountdownItem,
  deleteCountdownItem,
  readCountdowns,
  toggleCountdownItem,
  updateCountdownItem
};
