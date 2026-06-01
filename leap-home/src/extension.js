const vscode = require('vscode');
const {
  addCurrentFileToFavorites,
  captureNote,
  configureAi,
  copyPrompt,
  createCustomHomePage,
  editCustomHomePage,
  searchKnowledge,
  switchTemplate
} = require('./actions');
const { registerFocusTimerLifecycle } = require('./focusTimer');
const { LeapHomeIndex } = require('./indexer');
const logger = require('./logger');
const { LeapHomePanelController } = require('./panel');
const { LeapHomeStatusBarController } = require('./statusBar');
const { migrateLeapStateStorage } = require('./storage');

function activate(context) {
  logger.info('extension activated');
  const index = new LeapHomeIndex(context);
  const homePanel = new LeapHomePanelController(context, index);
  const statusBar = new LeapHomeStatusBarController(context, index);
  context.subscriptions.push(statusBar);
  context.subscriptions.push(registerFocusTimerLifecycle(context, homePanel));
  const indexWatcher = createIndexWatcher(index, homePanel);
  if (indexWatcher) {
    context.subscriptions.push(indexWatcher);
  }

  context.subscriptions.push(
    vscode.commands.registerCommand('leapHome.openHome', async () => {
      await homePanel.open();
    }),
    vscode.commands.registerCommand('leapHome.chooseStatusBarComponent', async () => {
      await statusBar.chooseComponent();
    }),
    vscode.commands.registerCommand('leapHome.searchKnowledge', async () => {
      await searchKnowledge(index, context, homePanel);
    }),
    vscode.commands.registerCommand('leapHome.captureNote', async () => {
      await captureNote(context, homePanel);
    }),
    vscode.commands.registerCommand('leapHome.refreshIndex', async () => {
      await refreshIndex(index, homePanel);
    }),
    vscode.commands.registerCommand('leapHome.addCurrentFileToFavorites', async () => {
      await addCurrentFileToFavorites(context, homePanel);
    }),
    vscode.commands.registerCommand('leapHome.copyPrompt', async () => {
      await copyPrompt(index);
    }),
    vscode.commands.registerCommand('leapHome.switchTemplate', async () => {
      await switchTemplate(homePanel);
    }),
    vscode.commands.registerCommand('leapHome.openTemplateDesigner', async () => {
      await createCustomHomePage(homePanel);
    }),
    vscode.commands.registerCommand('leapHome.editCustomHome', async () => {
      await editCustomHomePage(homePanel);
    }),
    vscode.commands.registerCommand('leapHome.editCurrentHome', async () => {
      await homePanel.openDesigner();
    }),
    vscode.commands.registerCommand('leapHome.closeTemplateDesigner', async () => {
      await homePanel.closeDesigner();
    }),
    vscode.commands.registerCommand('leapHome.configureAi', async () => {
      await configureAi();
    }),
    vscode.commands.registerCommand('leapHome.showLogs', async () => {
      logger.show();
    }),
    vscode.workspace.onDidChangeConfiguration(async (event) => {
      if (event.affectsConfiguration('leapHome.statusBar')) {
        statusBar.refresh();
      }
      if (event.affectsConfiguration('leapHome')) {
        logger.info('configuration changed, refreshing index');
        await index.refresh();
        homePanel.postModel();
        statusBar.refresh();
      }
    }),
    vscode.workspace.onDidChangeWorkspaceFolders(async () => {
      logger.info('workspace folders changed, refreshing index');
      await index.refresh();
      homePanel.postModel();
      statusBar.refresh();
    })
  );

  migrateLeapStateStorage(context)
    .then(() => logger.info('storage migration checked'))
    .catch((error) => {
      logger.error('storage migration failed', error);
      vscode.window.showWarningMessage(`Leap Home 数据迁移失败：${error.message}`);
    })
    .then(() => {
      logger.info('initial index refresh started');
      return index.refresh();
    })
    .then(
      () => {
        logger.info('initial index refresh finished');
        homePanel.postModel();
        statusBar.refresh();
      },
      (error) => {
        logger.error('initial index refresh failed', error);
        vscode.window.showWarningMessage(`Leap Home 索引失败：${error.message}`);
      }
    );
}

function deactivate() {}

async function refreshIndex(index, homePanel) {
  logger.info('refreshIndex command started');
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Window,
      title: 'Leap Home: 正在刷新索引'
    },
    async () => {
      await index.refresh();
      homePanel.postModel();
    }
  );
  logger.info('refreshIndex command finished');
  vscode.window.showInformationMessage('Leap Home 索引已刷新。');
}

function createIndexWatcher(index, homePanel) {
  const config = vscode.workspace.getConfiguration('leapHome');
  if (!config.get('index.watchWorkspace', true)) {
    logger.info('workspace index watcher disabled by configuration');
    return undefined;
  }

  const watcher = vscode.workspace.createFileSystemWatcher('**/*');
  let timer = undefined;
  let running = false;
  let pending = false;

  const schedule = (uri, eventName) => {
    if (!shouldRefreshForUri(uri)) {
      return;
    }
    windowClearTimeout(timer);
    logger.info('workspace file change scheduled index refresh', {
      event: eventName,
      file: uri.fsPath
    });
    timer = setTimeout(run, 1200);
  };

  const disposables = [
    watcher.onDidCreate((uri) => schedule(uri, 'create')),
    watcher.onDidChange((uri) => schedule(uri, 'change')),
    watcher.onDidDelete((uri) => schedule(uri, 'delete')),
    watcher,
    {
      dispose() {
        windowClearTimeout(timer);
      }
    }
  ];

  async function run() {
    timer = undefined;
    if (running) {
      pending = true;
      return;
    }
    running = true;
    try {
      logger.info('auto index refresh started');
      await index.refresh();
      homePanel.postModel();
      logger.info('auto index refresh finished');
    } catch (error) {
      logger.error('auto index refresh failed', error);
    } finally {
      running = false;
      if (pending) {
        pending = false;
        timer = setTimeout(run, 1200);
      }
    }
  }

  return {
    dispose() {
      for (const disposable of disposables) {
        disposable.dispose();
      }
    }
  };
}

function shouldRefreshForUri(uri) {
  if (!uri || uri.scheme !== 'file' || !uri.fsPath) {
    return false;
  }
  const normalized = uri.fsPath.replace(/\\/g, '/').toLowerCase();
  return ![
    '/.git/',
    '/.leap/',
    '/node_modules/',
    '/dist/',
    '/build/',
    '/coverage/',
    '/.next/',
    '/.turbo/',
    '/out/',
    '/vendor/'
  ].some((segment) => normalized.includes(segment));
}

function windowClearTimeout(timer) {
  if (timer) {
    clearTimeout(timer);
  }
}

exports.activate = activate;
exports.deactivate = deactivate;
