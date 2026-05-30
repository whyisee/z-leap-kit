const crypto = require('crypto');
const os = require('os');
const path = require('path');
const vscode = require('vscode');

function clampInteger(value, min, max) {
  const number = Number.parseInt(value, 10);
  if (Number.isNaN(number)) {
    return min;
  }
  return Math.min(Math.max(number, min), max);
}

function firstWorkspaceFolder() {
  const folders = vscode.workspace.workspaceFolders || [];
  return folders.find((folder) => folder.uri.scheme === 'file');
}

function formatTimestamp(date) {
  const pad = (value) => String(value).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join('-') + ' ' + [
    pad(date.getHours()),
    pad(date.getMinutes())
  ].join(':');
}

function getNonce() {
  return crypto.randomBytes(16).toString('base64');
}

function getWorkspaceName() {
  const folders = vscode.workspace.workspaceFolders || [];
  if (folders.length === 0) {
    return '未打开工作区';
  }
  if (folders.length === 1) {
    return folders[0].name;
  }
  return `${folders[0].name} + ${folders.length - 1}`;
}

function hashText(text) {
  return crypto.createHash('sha1').update(text).digest('hex').slice(0, 16);
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizePath(value) {
  return value.split(path.sep).join('/');
}

function resolveConfiguredPath(value) {
  const folder = firstWorkspaceFolder();
  const workspaceRoot = folder ? folder.uri.fsPath : '';
  let result = String(value).trim();

  if (workspaceRoot) {
    result = result.replace('${workspaceFolder}', workspaceRoot);
  }

  if (result === '~') {
    return os.homedir();
  }

  if (result.startsWith(`~${path.sep}`) || result.startsWith('~/')) {
    return path.join(os.homedir(), result.slice(2));
  }

  if (path.isAbsolute(result)) {
    return result;
  }

  if (workspaceRoot) {
    return path.resolve(workspaceRoot, result);
  }

  return path.resolve(result);
}

module.exports = {
  clampInteger,
  firstWorkspaceFolder,
  formatTimestamp,
  getNonce,
  getWorkspaceName,
  hashText,
  isObject,
  normalizePath,
  resolveConfiguredPath
};
