const fs = require('fs/promises');
const path = require('path');
const vscode = require('vscode');
const { getLeapDataDir } = require('./storage');
const { formatTimestamp, resolveConfiguredPath } = require('./utils');

async function appendInboxEntry(inboxPath, text) {
  await ensureInboxFile(inboxPath);
  const entry = `## ${formatTimestamp(new Date())}\n\n${text}\n\n`;
  await fs.appendFile(inboxPath, entry, 'utf8');
}

async function ensureInboxFile(inboxPath) {
  await fs.mkdir(path.dirname(inboxPath), { recursive: true });
  try {
    await fs.access(inboxPath);
  } catch (error) {
    await fs.writeFile(inboxPath, '# 收集箱\n\n', 'utf8');
  }
}

function resolveInboxPath(context) {
  const configured = vscode.workspace.getConfiguration('leapHome').get('inboxPath', '');
  if (configured) {
    return resolveConfiguredPath(configured);
  }

  return path.join(getLeapDataDir(context), 'inbox.md');
}

module.exports = {
  appendInboxEntry,
  ensureInboxFile,
  resolveInboxPath
};
