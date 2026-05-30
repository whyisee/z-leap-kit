const vscode = require('vscode');
const { classifyQuadrantTask, understandSearchQuery } = require('./ai');
const { PANEL_VIEW_TYPE } = require('./constants');
const {
  addQuadrantTask,
  deleteQuadrantTask,
  toggleQuadrantTask,
  updateQuadrantTask
} = require('./quadrants');
const { toggleFavorite } = require('./state');
const {
  captureNote,
  copyPromptFile,
  openFile,
  openInbox,
  resetLayout,
  saveLayout,
  switchTemplate
} = require('./actions');
const {
  pauseFocusTimer,
  resetFocusTimer,
  resumeFocusTimer,
  startFocusTimer
} = require('./focusTimer');
const logger = require('./logger');
const {
  getQuickCaptureKindLabel,
  recordQuickCapture,
  saveQuickCaptureToInbox
} = require('./quickCapture');
const { recordSearchHistory } = require('./searchHistory');
const { getWebviewHtml } = require('./webview');

class LeapHomePanelController {
  constructor(context, index) {
    this.context = context;
    this.index = index;
    this.panel = undefined;
    this.readyPromise = undefined;
  }

  async open() {
    logger.info('openHome requested', { indexReady: this.index.ready, hasPanel: Boolean(this.panel) });
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.One);
      this.postModel();
      this.ensureIndexReady();
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      PANEL_VIEW_TYPE,
      'Leap Home',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [this.context.extensionUri]
      }
    );
    logger.info('webview panel created');

    this.panel.webview.onDidReceiveMessage(async (message) => {
      try {
        await this.handleMessage(message);
      } catch (error) {
        logger.error('webview message handling failed', {
          messageType: message && message.type,
          error: error && (error.stack || error.message || String(error))
        });
        vscode.window.showWarningMessage(`Leap Home 操作失败：${error.message}`);
      }
    });
    this.panel.onDidDispose(() => {
      logger.info('webview panel disposed');
      this.panel = undefined;
    });

    this.panel.webview.html = getWebviewHtml(this.panel.webview);
    logger.info('webview html assigned');
    this.postModel();
    this.ensureIndexReady();
  }

  async openDesigner() {
    await this.open();
    this.panel.webview.postMessage({ type: 'setDesignMode', enabled: true });
  }

  async closeDesigner() {
    if (!this.panel) {
      return;
    }
    this.panel.webview.postMessage({ type: 'setDesignMode', enabled: false });
  }

  async handleMessage(message) {
    if (!message || typeof message.type !== 'string') {
      logger.warn('ignored invalid webview message', message);
      return;
    }

    if (message.type === 'log') {
      logger.info(`webview: ${message.message || ''}`, message.details);
      return;
    }

    if (message.type === 'ready') {
      logger.info('webview ready received', message.details);
      this.postModel();
      return;
    }

    if (message.type === 'refresh') {
      logger.info('refresh requested from webview');
      await this.index.refresh();
      this.postModel();
      return;
    }

    if (message.type === 'searchQuery' && typeof message.query === 'string') {
      await this.handleSearchQuery(message);
      return;
    }

    if (message.type === 'switchTemplate') {
      await switchTemplate(this);
      return;
    }

    if (message.type === 'saveLayout' && Array.isArray(message.layout)) {
      await saveLayout(message.layout, this);
      return;
    }

    if (message.type === 'resetLayout') {
      await resetLayout(this);
      return;
    }

    if (message.type === 'openItem' && typeof message.filePath === 'string') {
      await openFile(message.filePath, this.context, this, { line: message.line });
      return;
    }

    if (message.type === 'toggleFavorite' && typeof message.filePath === 'string') {
      await toggleFavorite(this.context, message.filePath);
      this.postModel();
      return;
    }

    if (message.type === 'addQuadrantTask') {
      await addQuadrantTask(this.context, message.quadrantId, message.text, {
        dueDate: message.dueDate,
        source: message.source,
        reason: message.reason
      });
      this.postModel();
      return;
    }

    if (message.type === 'aiAddQuadrantTask') {
      await this.addQuadrantTaskWithAi(message.text, message.dueDate);
      return;
    }

    if (message.type === 'quickCaptureSave') {
      await this.saveQuickCapture(message);
      return;
    }

    if (message.type === 'quickCaptureAi') {
      await this.saveQuickCaptureWithAi(message);
      return;
    }

    if (message.type === 'focusTimerStart') {
      await startFocusTimer(this.context, message.durationMs);
      this.postModel();
      return;
    }

    if (message.type === 'focusTimerPause') {
      await pauseFocusTimer(this.context);
      this.postModel();
      return;
    }

    if (message.type === 'focusTimerResume') {
      await resumeFocusTimer(this.context);
      this.postModel();
      return;
    }

    if (message.type === 'focusTimerReset') {
      await resetFocusTimer(this.context);
      this.postModel();
      return;
    }

    if (message.type === 'updateQuadrantTask') {
      const patch = {};
      if (Object.prototype.hasOwnProperty.call(message, 'text')) patch.text = message.text;
      if (Object.prototype.hasOwnProperty.call(message, 'dueDate')) patch.dueDate = message.dueDate;
      await updateQuadrantTask(this.context, message.quadrantId, message.taskId, patch);
      this.postModel();
      return;
    }

    if (message.type === 'toggleQuadrantTask') {
      await toggleQuadrantTask(this.context, message.quadrantId, message.taskId, message.done);
      this.postModel();
      return;
    }

    if (message.type === 'deleteQuadrantTask') {
      await deleteQuadrantTask(this.context, message.quadrantId, message.taskId);
      this.postModel();
      return;
    }

    if (message.type === 'copyPrompt' && typeof message.filePath === 'string') {
      await copyPromptFile(message.filePath);
      return;
    }

    if (message.type === 'captureNote') {
      await captureNote(this.context, this);
      return;
    }

    if (message.type === 'openInbox') {
      await openInbox(this.context, this);
    }
  }

  async handleSearchQuery(message) {
    if (!this.panel) {
      return;
    }
    try {
      await this.index.ensureReady();
      const useAi = Boolean(message.useAi);
      const historyEffectiveQuery = String(message.effectiveQuery || '').trim();
      const aiQuery = historyEffectiveQuery
        ? { query: historyEffectiveQuery, reason: '来自搜索历史' }
        : await this.getAiSearchQuery(message.query, useAi);
      const effectiveQuery = aiQuery && aiQuery.query ? aiQuery.query : message.query;
      const results = this.index.search(effectiveQuery, { limit: message.limit });
      results.query = message.query;
      results.effectiveQuery = effectiveQuery;
      results.aiAttempted = useAi || Boolean(aiQuery);
      results.aiReason = aiQuery && aiQuery.reason ? aiQuery.reason : '';
      if (message.recordHistory) {
        results.history = await recordSearchHistory(this.context, {
          query: message.query,
          effectiveQuery,
          aiAttempted: results.aiAttempted,
          reason: results.aiReason,
          resultCount: results.total
        });
      }
      this.panel.webview.postMessage({
        type: 'searchResults',
        requestId: message.requestId,
        results
      });
    } catch (error) {
      logger.error('search query failed', error);
      this.panel.webview.postMessage({
        type: 'searchResults',
        requestId: message.requestId,
        results: {
          query: message.query,
          total: 0,
          limit: message.limit,
          indexedItems: 0,
          sourceErrors: 0,
          truncatedSources: 0,
          groups: [],
          error: error.message || String(error)
        }
      });
    }
  }

  async getAiSearchQuery(query, force) {
    try {
      const result = await understandSearchQuery(query, { force });
      if (result && result.query && result.query !== query) {
        logger.info('AI search query rewritten', {
          query,
          effectiveQuery: result.query,
          reason: result.reason
        });
      }
      return result;
    } catch (error) {
      logger.warn('AI search query understanding failed, falling back to raw query', {
        error: error && (error.message || String(error))
      });
      if (force) {
        return {
          query,
          reason: `AI 查询失败：${error.message || String(error)}`
        };
      }
      return undefined;
    }
  }

  postModel() {
    if (!this.panel) {
      logger.warn('postModel skipped because panel is missing');
      return;
    }

    try {
      const model = this.index.getModel();
      const data = model.data || {};
      logger.info('posting model to webview', {
        ready: model.ready,
        layout: Array.isArray(model.layout) ? model.layout.length : 0,
        items: Array.isArray(data.items) ? data.items.length : 0,
        quadrants: Array.isArray(data.quadrants) ? data.quadrants.length : 0
      });
      this.panel.webview.postMessage({
        type: 'model',
        model
      }).then((accepted) => {
        logger.info('postModel completed', { accepted });
      });
    } catch (error) {
      logger.error('postModel failed', error);
      this.panel.webview.postMessage({
        type: 'error',
        message: error.message || String(error)
      });
    }
  }

  ensureIndexReady() {
    if (this.index.ready) {
      logger.info('index already ready');
      return Promise.resolve();
    }
    if (this.readyPromise) {
      logger.info('index refresh already running');
      return this.readyPromise;
    }
    logger.info('index refresh started');
    this.readyPromise = this.index.ensureReady()
      .then(() => {
        logger.info('index refresh finished');
        this.postModel();
      })
      .catch((error) => {
        logger.error('index refresh failed', error);
        vscode.window.showWarningMessage(`Leap Home 索引失败：${error.message}`);
      })
      .finally(() => {
        this.readyPromise = undefined;
      });
    return this.readyPromise;
  }

  async addQuadrantTaskWithAi(text, dueDate) {
    try {
      const result = await classifyQuadrantTask(text, { dueDate });
      await addQuadrantTask(this.context, result.quadrantId, text, {
        source: 'deepseek',
        reason: result.reason,
        confidence: result.confidence,
        dueDate: result.dueDate || dueDate
      });
      this.postModel();
      const quadrantName = getQuadrantName(result.quadrantId);
      vscode.window.setStatusBarMessage(`Leap Home: AI 已归类到「${quadrantName}」`, 3500);
    } catch (error) {
      const action = await vscode.window.showWarningMessage(
        `Leap Home AI 归类失败：${error.message}`,
        '配置 AI'
      );
      if (action === '配置 AI') {
        await vscode.commands.executeCommand('leapHome.configureAi');
      }
    }
  }

  async saveQuickCapture(message) {
    const text = cleanQuickCaptureText(message && message.text);
    if (!text) {
      vscode.window.setStatusBarMessage('Leap Home: 快速记录内容为空', 2500);
      return;
    }

    const kind = String(message.kind || 'note');
    const dueDate = normalizeDate(message.dueDate);
    if (kind === 'task') {
      const quadrantId = 'importantNotUrgent';
      await addQuadrantTask(this.context, quadrantId, text, {
        dueDate,
        source: 'quick-capture',
        reason: '快速记录手动添加'
      });
      await recordQuickCapture(this.context, {
        text,
        kind: 'task',
        target: 'quadrant',
        label: getQuadrantName(quadrantId),
        dueDate
      });
      this.postModel();
      vscode.window.setStatusBarMessage('Leap Home: 已添加到「重要不紧急」', 3000);
      return;
    }

    await saveQuickCaptureToInbox(this.context, { text, kind });
    await this.index.refresh();
    this.postModel();
    vscode.window.setStatusBarMessage(`Leap Home: 已记录到${getQuickCaptureKindLabel(kind)}`, 3000);
  }

  async saveQuickCaptureWithAi(message) {
    const text = cleanQuickCaptureText(message && message.text);
    if (!text) {
      vscode.window.setStatusBarMessage('Leap Home: 快速记录内容为空', 2500);
      return;
    }

    const dueDate = normalizeDate(message.dueDate);
    try {
      const result = await classifyQuadrantTask(text, { dueDate });
      const effectiveDueDate = result.dueDate || dueDate;
      await addQuadrantTask(this.context, result.quadrantId, text, {
        source: 'deepseek',
        reason: result.reason,
        confidence: result.confidence,
        dueDate: effectiveDueDate
      });
      await recordQuickCapture(this.context, {
        text,
        kind: 'task',
        target: 'quadrant',
        label: getQuadrantName(result.quadrantId),
        dueDate: effectiveDueDate,
        reason: result.reason
      });
      this.postModel();
      vscode.window.setStatusBarMessage(`Leap Home: AI 已归类到「${getQuadrantName(result.quadrantId)}」`, 3500);
    } catch (error) {
      const action = await vscode.window.showWarningMessage(
        `Leap Home AI 归类失败：${error.message}`,
        '配置 AI'
      );
      if (action === '配置 AI') {
        await vscode.commands.executeCommand('leapHome.configureAi');
      }
    }
  }
}

function cleanQuickCaptureText(value) {
  return String(value || '').replace(/\r\n/g, '\n').trim();
}

function normalizeDate(value) {
  const text = String(value || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
}

function getQuadrantName(quadrantId) {
  return {
    importantUrgent: '重要且紧急',
    importantNotUrgent: '重要不紧急',
    notImportantUrgent: '不重要但紧急',
    notImportantNotUrgent: '不重要不紧急'
  }[quadrantId] || quadrantId;
}

module.exports = {
  LeapHomePanelController
};
