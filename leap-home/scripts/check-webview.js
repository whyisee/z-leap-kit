const fs = require('fs');
const Module = require('module');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const originalLoad = Module._load;
Module._load = (request, parent, isMain) => {
  if (request === 'vscode') {
    return { workspace: { workspaceFolders: [] } };
  }
  return originalLoad(request, parent, isMain);
};

const { getWebviewHtml } = require('../src/webview');

const html = getWebviewHtml({ cspSource: 'vscode-webview-resource:' });
const scriptMatch = html.match(/<script nonce="[^"]+">([\s\S]*?)<\/script>/);
if (!scriptMatch) {
  throw new Error('Webview script tag not found.');
}

const scriptPath = path.join(os.tmpdir(), 'leap-home-webview-check.js');
fs.writeFileSync(scriptPath, scriptMatch[1], 'utf8');
execFileSync(process.execPath, ['--check', scriptPath], { stdio: 'inherit' });
