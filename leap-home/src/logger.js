const vscode = require('vscode');

let channel;

function getChannel() {
  if (!channel) {
    channel = vscode.window.createOutputChannel('Leap Home');
  }
  return channel;
}

function info(message, details) {
  write('INFO', message, details);
}

function warn(message, details) {
  write('WARN', message, details);
}

function error(message, details) {
  write('ERROR', message, details);
}

function show() {
  getChannel().show(true);
}

function write(level, message, details) {
  const timestamp = new Date().toISOString();
  getChannel().appendLine(`[${timestamp}] [${level}] ${message}`);
  if (details !== undefined) {
    getChannel().appendLine(formatDetails(details));
  }
}

function formatDetails(details) {
  if (details instanceof Error) {
    return details.stack || details.message;
  }
  if (typeof details === 'string') {
    return details;
  }
  try {
    return JSON.stringify(details, null, 2);
  } catch (error) {
    return String(details);
  }
}

module.exports = {
  error,
  info,
  show,
  warn
};
