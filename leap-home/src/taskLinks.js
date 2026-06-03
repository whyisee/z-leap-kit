const LINK_ROLES = new Set(['source', 'output', 'reference']);
const LINK_STATUSES = new Set(['draft', 'ready', 'archived']);

function normalizeTaskLinks(value, options) {
  if (!Array.isArray(value)) {
    return [];
  }
  const result = [];
  const seen = new Set();
  for (const item of value) {
    const link = normalizeTaskLink(item, options);
    if (!link) continue;
    const key = getTaskLinkKey(link);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(link);
  }
  return result.slice(0, 12);
}

function normalizeTaskLink(value, options) {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const role = LINK_ROLES.has(value.role) ? value.role : 'reference';
  const filePath = cleanPath(value.filePath).slice(0, 1000);
  const relativePath = cleanPath(value.relativePath).slice(0, 500);
  const title = cleanInline(value.title || value.fileName || relativePath || filePath).slice(0, 160);
  if (!filePath && !relativePath && !title) {
    return undefined;
  }
  const status = LINK_STATUSES.has(value.status) ? value.status : '';
  const line = normalizeLine(value.line);
  const createdAt = typeof value.createdAt === 'string' && value.createdAt
    ? value.createdAt
    : options && typeof options.defaultCreatedAt === 'string'
      ? options.defaultCreatedAt
      : '';
  const result = {
    role,
    sourceId: cleanInline(value.sourceId).slice(0, 200),
    sourceName: cleanInline(value.sourceName).slice(0, 120),
    sourceType: cleanInline(value.sourceType).slice(0, 40),
    filePath,
    relativePath,
    title,
    status,
    createdAt
  };
  if (line) {
    result.line = line;
  }
  return result;
}

function upsertTaskLink(links, link, options) {
  const normalized = normalizeTaskLink(link, options);
  if (!normalized) {
    return normalizeTaskLinks(links);
  }
  const existing = normalizeTaskLinks(links);
  const key = getTaskLinkKey(normalized);
  const filtered = existing.filter((item) => getTaskLinkKey(item) !== key);
  return filtered.concat(normalized).slice(0, 12);
}

function getTaskLinkKey(link) {
  const target = String(link.filePath || link.relativePath || link.title || '').toLowerCase();
  return [
    link.role || '',
    target
  ].join('|');
}

function cleanInline(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function cleanPath(value) {
  return String(value || '').replace(/\\/g, '/').replace(/\s+/g, ' ').trim();
}

function normalizeLine(value) {
  const line = Number.parseInt(value, 10);
  return Number.isFinite(line) && line > 0 ? line : 0;
}

module.exports = {
  normalizeTaskLink,
  normalizeTaskLinks,
  upsertTaskLink
};
