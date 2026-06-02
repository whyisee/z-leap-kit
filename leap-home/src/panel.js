const fs = require('fs/promises');
const path = require('path');
const vscode = require('vscode');
const { classifyQuadrantTask, organizeKnowledgeInsight, recommendNextActions, understandSearchQuery } = require('./ai');
const { PANEL_VIEW_TYPE } = require('./constants');
const {
  addQuadrantTask,
  deleteQuadrantTask,
  toggleQuadrantTask,
  updateQuadrantTask
} = require('./quadrants');
const {
  addCountdownItem,
  deleteCountdownItem,
  toggleCountdownItem,
  updateCountdownItem
} = require('./countdown');
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
  readFocusTimerSnapshot,
  resetFocusTimer,
  resumeFocusTimer,
  startFocusTimer
} = require('./focusTimer');
const logger = require('./logger');
const {
  dismissNextAction,
  pinNextAction,
  recordNextActionAdoption,
  recordNextActionImpressions,
  saveNextActionAiPlan
} = require('./nextAction');
const { QUADRANT_DEFINITIONS, readLeapState } = require('./storage');
const {
  getQuickCaptureKindLabel,
  recordQuickCapture,
  saveQuickCaptureToInbox
} = require('./quickCapture');
const { recordSearchHistory } = require('./searchHistory');
const { getWebviewHtml } = require('./webview');
const { getLanguage, t } = require('./i18n');

class LeapHomePanelController {
  constructor(context, index) {
    this.context = context;
    this.index = index;
    this.panel = undefined;
    this.readyPromise = undefined;
    this.knowledgeGraphAiBusy = false;
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
        vscode.window.showWarningMessage(`Leap Home ${t('操作失败：')}${error.message}`);
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
      await this.recordNextActionFromMessage(message);
      this.postModel();
      if (message.nextAction) {
        vscode.window.setStatusBarMessage(`Leap Home: ${t('已按推荐加入待办')}`, 2500);
      }
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
      const sessionType = message.sessionType || 'focus';
      const task = sessionType === 'focus'
        ? await resolveFocusTimerTask(this.context, message.task)
        : undefined;
      await startFocusTimer(this.context, {
        durationMs: message.durationMs,
        sessionType,
        task,
        saveDefaultDuration: message.saveDefaultDuration
      });
      await this.recordNextActionFromMessage(message);
      this.postModel();
      if (message.nextAction) {
        vscode.window.setStatusBarMessage(sessionType === 'focus' ? `Leap Home: ${t('已按推荐开始番茄')}` : `Leap Home: ${t('已开始休息')}`, 2500);
      }
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

    if (message.type === 'addCountdownItem') {
      await addCountdownItem(this.context, message.item);
      this.postModel();
      return;
    }

    if (message.type === 'updateCountdownItem') {
      await updateCountdownItem(this.context, message.itemId, message.item);
      this.postModel();
      return;
    }

    if (message.type === 'toggleCountdownItem') {
      await toggleCountdownItem(this.context, message.itemId, message.done);
      await this.recordNextActionFromMessage(message);
      this.postModel();
      if (message.nextAction) {
        vscode.window.setStatusBarMessage(`Leap Home: ${t('已按推荐更新倒计日')}`, 2500);
      }
      return;
    }

    if (message.type === 'deleteCountdownItem') {
      await deleteCountdownItem(this.context, message.itemId);
      this.postModel();
      return;
    }

    if (message.type === 'dismissNextAction') {
      await dismissNextAction(this.context, message.key, message.reason, message.item);
      this.postModel();
      return;
    }

    if (message.type === 'pinNextAction') {
      await pinNextAction(this.context, message.key, message.pinned, message.item);
      this.postModel();
      return;
    }

    if (message.type === 'nextActionImpressions') {
      await recordNextActionImpressions(this.context, message.items);
      return;
    }

    if (message.type === 'nextActionAdoption') {
      await recordNextActionAdoption(this.context, message.item, message.action);
      this.postModel();
      return;
    }

    if (message.type === 'nextActionWriteNote') {
      const result = await this.writeNextActionNote(message.action);
      await this.recordNextActionFromMessage(message);
      await this.index.refresh();
      this.postModel();
      await openFile(result.filePath, this.context, this);
      return;
    }

    if (message.type === 'nextActionAiRecommend') {
      await this.optimizeNextActionWithAi(message.question);
      return;
    }

    if (message.type === 'knowledgeGraphAiOrganize') {
      await this.organizeKnowledgeGraphInsight(message.insight);
      return;
    }

    if (message.type === 'updateQuadrantTask') {
      const patch = {};
      if (Object.prototype.hasOwnProperty.call(message, 'text')) patch.text = message.text;
      if (Object.prototype.hasOwnProperty.call(message, 'dueDate')) patch.dueDate = message.dueDate;
      await updateQuadrantTask(this.context, message.quadrantId, message.taskId, patch);
      await this.recordNextActionFromMessage(message);
      this.postModel();
      if (message.nextAction) {
        vscode.window.setStatusBarMessage(`Leap Home: ${t('已按推荐更新事项')}`, 2500);
      }
      return;
    }

    if (message.type === 'toggleQuadrantTask') {
      await toggleQuadrantTask(this.context, message.quadrantId, message.taskId, message.done);
      await this.recordNextActionFromMessage(message);
      this.postModel();
      if (message.nextAction) {
        vscode.window.setStatusBarMessage(`Leap Home: ${t('已按推荐完成事项')}`, 2500);
      }
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
        ? { query: historyEffectiveQuery, reason: t('来自搜索历史') }
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
          reason: `${t('AI 查询失败：')}${error.message || String(error)}`
        };
      }
      return undefined;
    }
  }

  async optimizeNextActionWithAi(question) {
    try {
      const model = this.index.getModel();
      const current = model.data && model.data.nextAction && Array.isArray(model.data.nextAction.systemRecommendations)
        ? model.data.nextAction.systemRecommendations
        : model.data && model.data.nextAction && Array.isArray(model.data.nextAction.recommendations)
          ? model.data.nextAction.recommendations
          : [];
      const normalizedQuestion = String(question || '').replace(/\s+/g, ' ').trim().slice(0, 240);
      const plan = await recommendNextActions(current, Object.assign(buildNextActionAiContext(model), {
        question: normalizedQuestion
      }));
      await saveNextActionAiPlan(this.context, Object.assign({}, plan, {
        question: plan.question || normalizedQuestion
      }));
      this.postModel();
      vscode.window.setStatusBarMessage(
        normalizedQuestion ? `Leap Home: ${t('AI 已回答做什么问题')}` : `Leap Home: ${t('AI 已生成行动建议')}`,
        3500
      );
    } catch (error) {
      logger.warn('AI next action recommendation failed', {
        error: error && (error.message || String(error))
      });
      this.postModel();
      const configureAiLabel = t('配置 AI');
      const action = await vscode.window.showWarningMessage(
        `${t('Leap Home AI 推荐失败：')}${error.message || String(error)}`,
        configureAiLabel
      );
      if (action === configureAiLabel) {
        await vscode.commands.executeCommand('leapHome.configureAi');
      }
    }
  }

  async recordNextActionFromMessage(message) {
    if (!message || !message.nextAction) {
      return;
    }
    await recordNextActionAdoption(
      this.context,
      message.nextAction.item,
      message.nextAction.action
    );
  }

  async writeNextActionNote(action) {
    const result = await writeNoteFromNextAction(this.context, this.index, action);
    vscode.window.setStatusBarMessage(
      `Leap Home: ${result.mode === 'appendNote' ? t('已写入') : t('已新建')}${t('笔记「')}${path.basename(result.filePath)}${t('」')}`,
      3000
    );
    return result;
  }

  async organizeKnowledgeGraphInsight(insight) {
    const source = insight && typeof insight === 'object' ? insight : {};
    const insightId = String(source.id || source.title || '');
    const targetFile = String(source.filePath || '').trim();
    if (this.knowledgeGraphAiBusy) {
      this.postKnowledgeGraphAiStatus({
        insightId,
        phase: 'busy',
        message: t('AI 整理正在进行'),
        detail: t('上一条整理还没有结束，先等它完成，避免同时写入文档。'),
        targetFile
      });
      return;
    }
    if (!targetFile) {
      this.postKnowledgeGraphAiStatus({
        insightId,
        phase: 'error',
        message: t('无法开始 AI 整理'),
        detail: t('这条图谱洞察没有目标文档，无法读取和写回。'),
        targetFile
      });
      vscode.window.showWarningMessage(`Leap Home: ${t('图谱洞察缺少目标文档。')}`);
      return;
    }
    if (!isMarkdownFile(targetFile)) {
      this.postKnowledgeGraphAiStatus({
        insightId,
        phase: 'error',
        message: t('无法整理非 Markdown 文档'),
        detail: t('AI 整理目前只支持 Markdown、MDX、MDC 文档，避免误写代码或二进制文件。'),
        targetFile
      });
      vscode.window.showWarningMessage(`Leap Home: ${t('AI 整理目前只支持 Markdown/MDX/MDC 文档。')}`);
      return;
    }

    this.knowledgeGraphAiBusy = true;
    try {
      this.postKnowledgeGraphAiStatus({
        insightId,
        phase: 'reading',
        message: t('正在读取文档'),
        detail: t('读取目标文档元数据，并收集最多 4 个相关文档片段作为整理上下文。'),
        targetFile
      });
      const targetContent = await fs.readFile(targetFile, 'utf8');
      const relatedDocuments = await readKnowledgeInsightRelatedDocuments(source, targetFile);
      this.postKnowledgeGraphAiStatus({
        insightId,
        phase: 'thinking',
        message: t('正在让 AI 生成文档元数据'),
        detail: `${t('已读取 ')}${relatedDocuments.length + 1}${t(' 个文档片段，DeepSeek 会输出 tags、topics、summary、related。')}`,
        targetFile
      });
      const result = await organizeKnowledgeInsight(source, {
        targetDocument: {
          filePath: targetFile,
          relativePath: source.relativePath || path.basename(targetFile),
          content: targetContent.slice(0, 12000)
        },
        relatedDocuments
      });
      this.postKnowledgeGraphAiStatus({
        insightId,
        phase: 'writing',
        message: t('正在写回元数据'),
        detail: t('只更新 Markdown frontmatter 中的 Leap Home 元数据字段，不改正文。'),
        targetFile
      });
      const nextContent = upsertKnowledgeDocumentMetadata(targetContent, source, result, relatedDocuments);
      await fs.writeFile(targetFile, nextContent, 'utf8');
      await this.index.refresh();
      this.postModel();
      this.postKnowledgeGraphAiStatus({
        insightId,
        phase: 'done',
        message: t('AI 整理完成'),
        detail: `${t('已更新 ')}${path.basename(targetFile)}${t(' 的文档元数据，并刷新知识图谱。')}`,
        targetFile
      });
      vscode.window.setStatusBarMessage(`Leap Home: ${t('AI 已更新「')}${path.basename(targetFile)}${t('」元数据')}`, 3500);
    } catch (error) {
      const errorMessage = error && (error.message || String(error)) || '未知错误';
      logger.warn('knowledge graph AI organize failed', {
        error: errorMessage,
        insightTitle: source.title,
        targetFile
      });
      this.postKnowledgeGraphAiStatus({
        insightId,
        phase: 'error',
        message: t('AI 整理失败'),
        detail: errorMessage,
        targetFile
      });
      const configureAiLabel = t('配置 AI');
      const action = await vscode.window.showWarningMessage(
        `${t('Leap Home AI 整理失败：')}${errorMessage}`,
        configureAiLabel
      );
      if (action === configureAiLabel) {
        await vscode.commands.executeCommand('leapHome.configureAi');
      }
    } finally {
      this.knowledgeGraphAiBusy = false;
    }
  }

  postKnowledgeGraphAiStatus(payload) {
    if (!this.panel) {
      return;
    }
    logger.info('knowledge graph AI organize status', {
      insightId: payload && payload.insightId,
      phase: payload && payload.phase,
      targetFile: payload && payload.targetFile
    });
    this.panel.webview.postMessage(Object.assign({
      type: 'knowledgeGraphAiStatus'
    }, payload || {}));
  }

  postFocusTimer() {
    if (!this.panel) {
      return;
    }

    try {
      this.panel.webview.postMessage({
        type: 'focusTimer',
        focusTimer: readFocusTimerSnapshot(this.context)
      }).then(undefined, (error) => {
        logger.warn('postFocusTimer delivery failed', error);
      });
    } catch (error) {
      logger.error('postFocusTimer failed', error);
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
        vscode.window.showWarningMessage(`Leap Home ${t('索引失败：')}${error.message}`);
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
      vscode.window.setStatusBarMessage(`Leap Home: ${t('AI 已归类到「')}${t(quadrantName)}${t('」')}`, 3500);
    } catch (error) {
      const configureAiLabel = t('配置 AI');
      const action = await vscode.window.showWarningMessage(
        `${t('Leap Home AI 归类失败：')}${error.message}`,
        configureAiLabel
      );
      if (action === configureAiLabel) {
        await vscode.commands.executeCommand('leapHome.configureAi');
      }
    }
  }

  async saveQuickCapture(message) {
    const text = cleanQuickCaptureText(message && message.text);
    if (!text) {
      vscode.window.setStatusBarMessage(`Leap Home: ${t('快速记录内容为空')}`, 2500);
      return;
    }

    const kind = String(message.kind || 'note');
    const dueDate = normalizeDate(message.dueDate);
    if (kind === 'task') {
      const quadrantId = 'importantNotUrgent';
      await addQuadrantTask(this.context, quadrantId, text, {
        dueDate,
        source: 'quick-capture',
        reason: t('快速记录手动添加')
      });
      await recordQuickCapture(this.context, {
        text,
        kind: 'task',
        target: 'quadrant',
        label: getQuadrantName(quadrantId),
        dueDate
      });
      this.postModel();
      vscode.window.setStatusBarMessage(`Leap Home: ${t('已添加到「')}${t('重要不紧急')}${t('」')}`, 3000);
      return;
    }

    await saveQuickCaptureToInbox(this.context, { text, kind });
    await this.index.refresh();
    this.postModel();
    vscode.window.setStatusBarMessage(`Leap Home: ${t('已记录到')}${t(getQuickCaptureKindLabel(kind))}`, 3000);
  }

  async saveQuickCaptureWithAi(message) {
    const text = cleanQuickCaptureText(message && message.text);
    if (!text) {
      vscode.window.setStatusBarMessage(`Leap Home: ${t('快速记录内容为空')}`, 2500);
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
      vscode.window.setStatusBarMessage(`Leap Home: ${t('AI 已归类到「')}${t(getQuadrantName(result.quadrantId))}${t('」')}`, 3500);
    } catch (error) {
      const configureAiLabel = t('配置 AI');
      const action = await vscode.window.showWarningMessage(
        `${t('Leap Home AI 归类失败：')}${error.message}`,
        configureAiLabel
      );
      if (action === configureAiLabel) {
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

async function writeNoteFromNextAction(context, index, action) {
  const source = action && typeof action === 'object' ? action : {};
  const mode = source.type === 'appendNote' ? 'appendNote' : 'createNote';
  const title = cleanNoteTitle(source.title) || 'AI 笔记';
  const content = normalizeNoteContent(source.content, title, mode);
  if (!content) {
    throw new Error('AI 没有提供可写入的笔记内容。');
  }
  if (index && typeof index.ensureReady === 'function') {
    await index.ensureReady();
  }
  const target = await resolveNextActionNoteTarget(context, index, source, title, mode);
  await fs.mkdir(path.dirname(target.filePath), { recursive: true });
  if (mode === 'appendNote') {
    const prefix = await fileExists(target.filePath) ? '\n\n' : '';
    await fs.appendFile(target.filePath, prefix + content + '\n', 'utf8');
  } else {
    const uniquePath = await ensureUniqueNotePath(target.filePath);
    await fs.writeFile(uniquePath, content + '\n', 'utf8');
    target.filePath = uniquePath;
  }
  return {
    mode,
    filePath: target.filePath
  };
}

async function resolveNextActionNoteTarget(context, index, action, title, mode) {
  const sources = getWritableKnowledgeSources(context, index);
  if (!sources.length) {
    throw new Error('没有可写入的工作区或知识源。');
  }
  const requestedPath = cleanNotePath(action.relativePath || action.targetPath || action.path);
  const absolutePath = path.isAbsolute(requestedPath) ? requestedPath : '';
  if (absolutePath) {
    const source = sources.find((item) => isPathInside(absolutePath, item.path));
    if (!source) {
      throw new Error('AI 选择的笔记路径不在当前工作区或知识源内。');
    }
    return { source, filePath: ensureMarkdownFilePath(absolutePath) };
  }

  const source = pickNoteSource(sources, action) || sources[0];
  const relativePath = ensureMarkdownRelativePath(requestedPath || deriveNoteRelativePath(title));
  const filePath = path.resolve(source.path, relativePath);
  if (!isPathInside(filePath, source.path)) {
    throw new Error('AI 选择的笔记相对路径不安全。');
  }
  if (mode === 'appendNote' && !await fileExists(filePath)) {
    return { source, filePath };
  }
  return { source, filePath };
}

function getWritableKnowledgeSources(context, index) {
  const sourceSummaries = Array.isArray(index && index.sourceSummaries) ? index.sourceSummaries : [];
  const sources = sourceSummaries
    .filter((source) => source && source.path && ['workspace', 'markdown', 'obsidian'].includes(source.type) && !source.error)
    .map((source) => ({
      id: source.id,
      name: source.name,
      path: source.path,
      type: source.type
    }));
  if (sources.length > 0) {
    return sources;
  }
  return (vscode.workspace.workspaceFolders || [])
    .filter((folder) => folder.uri.scheme === 'file')
    .map((folder) => ({
      id: `workspace:${folder.uri.fsPath}`,
      name: folder.name,
      path: folder.uri.fsPath,
      type: 'workspace'
    }));
}

function pickNoteSource(sources, action) {
  const sourceId = String(action.sourceId || '').trim();
  if (sourceId) {
    const byId = sources.find((source) => source.id === sourceId);
    if (byId) return byId;
  }
  const sourceName = String(action.sourceName || '').trim().toLowerCase();
  if (sourceName) {
    const byName = sources.find((source) => String(source.name || '').toLowerCase() === sourceName);
    if (byName) return byName;
  }
  return sources.find((source) => source.type === 'markdown' || source.type === 'obsidian')
    || sources.find((source) => source.type === 'workspace')
    || sources[0];
}

function normalizeNoteContent(content, title, mode) {
  const text = String(content || '').replace(/\r\n/g, '\n').trim();
  if (!text) {
    return '';
  }
  if (mode === 'appendNote') {
    return /^#{1,6}\s/.test(text) ? text : `## ${title}\n\n${text}`;
  }
  return /^#\s/.test(text) ? text : `# ${title}\n\n${text}`;
}

function ensureMarkdownRelativePath(value) {
  const safe = cleanNotePath(value)
    .replace(/^\/+/, '')
    .split('/')
    .filter((part) => part && part !== '.' && part !== '..')
    .map(sanitizeNotePathSegment)
    .filter(Boolean)
    .join('/');
  return ensureMarkdownFilePath(safe || deriveNoteRelativePath('AI 笔记'));
}

function ensureMarkdownFilePath(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (['.md', '.markdown', '.mdx', '.mdc'].includes(extension)) {
    return filePath;
  }
  return extension ? filePath.slice(0, -extension.length) + '.md' : filePath + '.md';
}

function deriveNoteRelativePath(title) {
  return path.join('notes', sanitizeNotePathSegment(title || 'AI 笔记') + '.md');
}

function sanitizeNotePathSegment(value) {
  return String(value || '')
    .replace(/[<>:"|?*\x00-\x1f]/g, '')
    .replace(/[\\/]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80) || '未命名';
}

function cleanNoteTitle(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 120);
}

function cleanNotePath(value) {
  return String(value || '').replace(/\\/g, '/').replace(/\s+/g, ' ').trim();
}

async function ensureUniqueNotePath(filePath) {
  if (!await fileExists(filePath)) {
    return filePath;
  }
  const dir = path.dirname(filePath);
  const extension = path.extname(filePath);
  const base = path.basename(filePath, extension);
  for (let index = 2; index < 1000; index += 1) {
    const candidate = path.join(dir, `${base}-${index}${extension}`);
    if (!await fileExists(candidate)) {
      return candidate;
    }
  }
  throw new Error('无法为新笔记生成唯一文件名。');
}

async function fileExists(filePath) {
  try {
    await fs.stat(filePath);
    return true;
  } catch (error) {
    return false;
  }
}

function isPathInside(filePath, rootPath) {
  const relative = path.relative(rootPath, filePath);
  return relative === '' || Boolean(relative) && !relative.startsWith('..') && !path.isAbsolute(relative);
}

async function resolveFocusTimerTask(context, request) {
  const source = request && typeof request === 'object' ? request : {};
  const quadrantId = normalizeQuadrantId(source.quadrantId) || 'importantNotUrgent';
  const newTaskText = String(source.newTaskText || '').replace(/\s+/g, ' ').trim();
  if (newTaskText) {
    const task = await addQuadrantTask(context, quadrantId, newTaskText, {
      source: 'focusTimer',
      dueDate: normalizeDate(source.dueDate)
    });
    return task ? toFocusTimerTaskRef(quadrantId, task) : undefined;
  }

  const taskId = String(source.taskId || '').trim();
  if (!taskId || !quadrantId) {
    return undefined;
  }
  const state = readLeapState(context);
  const task = ((state.quadrants && state.quadrants[quadrantId]) || []).find((item) => item.id === taskId);
  return task && !task.done ? toFocusTimerTaskRef(quadrantId, task) : undefined;
}

function toFocusTimerTaskRef(quadrantId, task) {
  if (!task) {
    return undefined;
  }
  return {
    source: 'quadrant',
    quadrantId,
    quadrantTitle: getQuadrantName(quadrantId),
    taskId: task.id,
    title: task.text
  };
}

function normalizeQuadrantId(value) {
  const quadrantId = String(value || '').trim();
  return QUADRANT_DEFINITIONS.some((definition) => definition.id === quadrantId) ? quadrantId : '';
}

function buildNextActionAiContext(model) {
  const data = model && model.data ? model.data : {};
  return {
    locale: model && model.locale ? model.locale : getLanguage(),
    workspaceName: model && model.workspaceName ? model.workspaceName : '',
    recentNotes: (Array.isArray(data.quickCaptures) ? data.quickCaptures : []).slice(0, 8).map((item) => ({
      text: item.text,
      kind: item.kind,
      target: item.target,
      label: item.label,
      createdAt: item.createdAt
    })),
    openTasks: flattenAiTasks(data.quadrants).slice(0, 20),
    countdowns: ((data.countdown && Array.isArray(data.countdown.items)) ? data.countdown.items : [])
      .filter((item) => !item.done)
      .slice(0, 10)
      .map((item) => ({
        title: item.title,
        targetDate: item.targetDate,
        targetTime: item.targetTime,
        note: item.note
      })),
    focus: summarizeAiFocus(data.focusTimer),
    recentSearches: (Array.isArray(data.searchHistory) ? data.searchHistory : []).slice(0, 6).map((item) => ({
      query: item.query,
      effectiveQuery: item.effectiveQuery,
      resultCount: item.resultCount,
      mode: item.mode
    })),
    knowledgeSources: (Array.isArray(data.sources) ? data.sources : [])
      .filter((source) => source && ['workspace', 'markdown', 'obsidian'].includes(source.type) && !source.error)
      .slice(0, 8)
      .map((source) => ({
        id: source.id,
        name: source.name,
        type: source.type
      })),
    existingDocuments: (Array.isArray(data.items) ? data.items : [])
      .filter((item) => item && ['document', 'project', 'rule', 'text', 'code'].includes(item.category || 'document'))
      .slice(0, 40)
      .map((item) => ({
        title: item.title,
        sourceId: item.sourceId,
        sourceName: item.sourceName,
        relativePath: item.relativePath,
        category: item.category
      }))
  };
}

function flattenAiTasks(quadrants) {
  const result = [];
  for (const quadrant of Array.isArray(quadrants) ? quadrants : []) {
    for (const task of quadrant.items || []) {
      if (task.done) continue;
      result.push({
        text: task.text,
        dueDate: task.dueDate,
        quadrantId: quadrant.id,
        quadrantTitle: quadrant.title,
        reason: task.reason
      });
    }
  }
  return result;
}

function summarizeAiFocus(focusTimer) {
  const session = focusTimer && focusTimer.activeSession ? focusTimer.activeSession : {};
  const history = focusTimer && Array.isArray(focusTimer.history) ? focusTimer.history : [];
  return {
    status: session.status || 'idle',
    type: session.type || 'focus',
    focusedMs: session.focusedMs || 0,
    interruptions: session.interruptions || 0,
    recent: history.slice(0, 5).map((item) => ({
      type: item.type,
      result: item.result,
      focusedMs: item.focusedMs,
      interruptions: item.interruptions,
      taskTitle: item.task && item.task.title,
      completedAt: item.completedAt
    }))
  };
}

async function readKnowledgeInsightRelatedDocuments(insight, targetFile) {
  const files = Array.isArray(insight.relatedFiles) ? insight.relatedFiles : [];
  const result = [];
  const seen = new Set([targetFile]);
  for (const file of files.slice(0, 4)) {
    const filePath = String(file && file.filePath || '').trim();
    if (!filePath || seen.has(filePath) || !isMarkdownFile(filePath)) continue;
    seen.add(filePath);
    try {
      const content = await fs.readFile(filePath, 'utf8');
      result.push({
        title: String(file.title || path.basename(filePath)).slice(0, 120),
        filePath,
        relativePath: String(file.relativePath || path.basename(filePath)),
        content: content.slice(0, 5000)
      });
    } catch (error) {
      // Ignore missing related files; the target document is enough for a useful cleanup.
    }
  }
  return result;
}

function isMarkdownFile(filePath) {
  return ['.md', '.mdx', '.mdc', '.markdown'].includes(path.extname(filePath).toLowerCase());
}

function upsertKnowledgeDocumentMetadata(content, insight, result, relatedDocuments) {
  const document = splitMarkdownFrontmatter(content);
  const existingLines = document.frontmatter
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+$/, ''));
  const metadata = result && result.metadata && typeof result.metadata === 'object' ? result.metadata : {};
  const tags = uniqueValues(
    parseYamlValues(existingLines, 'tags')
      .concat(metadata.tags || [])
      .map(normalizeFrontmatterTag)
      .filter(Boolean)
  ).slice(0, 16);
  const topics = uniqueValues((metadata.topics || []).map(normalizeFrontmatterText).filter(Boolean)).slice(0, 12);
  const aliases = uniqueValues((metadata.aliases || []).map(normalizeFrontmatterText).filter(Boolean)).slice(0, 8);
  const related = collectKnowledgeRelatedPaths(metadata.related || [], insight, relatedDocuments);
  const summary = normalizeFrontmatterText(result && result.summary || insight.title || '');
  const preserved = removeYamlKeys(existingLines, [
    'tags',
    'leap_summary',
    'leap_topics',
    'leap_related',
    'leap_aliases',
    'leap_organized_at',
    'leap_organized_by'
  ]).filter((line, index, lines) => line.trim() || (index > 0 && index < lines.length - 1));
  const generated = [];
  if (tags.length) appendYamlList(generated, 'tags', tags);
  if (summary) generated.push(`leap_summary: ${quoteYaml(summary)}`);
  if (topics.length) appendYamlList(generated, 'leap_topics', topics);
  if (related.length) appendYamlList(generated, 'leap_related', related);
  if (aliases.length) appendYamlList(generated, 'leap_aliases', aliases);
  generated.push('leap_organized_by: "Leap Home AI"');
  generated.push(`leap_organized_at: ${quoteYaml(new Date().toISOString())}`);

  const frontmatter = preserved.concat(preserved.length ? [''] : [], generated).join('\n');
  return `---\n${frontmatter}\n---\n${document.body.replace(/^\s*\n/, '')}`;
}

function splitMarkdownFrontmatter(content) {
  const text = String(content || '');
  const match = text.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n)?/);
  if (!match) {
    return { frontmatter: '', body: text };
  }
  return {
    frontmatter: match[1],
    body: text.slice(match[0].length)
  };
}

function removeYamlKeys(lines, keys) {
  const blocked = new Set(keys.map((key) => key.toLowerCase()));
  const result = [];
  for (let index = 0; index < lines.length;) {
    const match = String(lines[index] || '').match(/^([A-Za-z0-9_-]+)\s*:/);
    if (!match || !blocked.has(match[1].toLowerCase())) {
      result.push(lines[index]);
      index += 1;
      continue;
    }
    index += 1;
    while (index < lines.length && !String(lines[index] || '').match(/^[A-Za-z0-9_-]+\s*:/)) {
      index += 1;
    }
  }
  return result;
}

function parseYamlValues(lines, key) {
  const expression = new RegExp(`^${escapeRegExp(key)}\\s*:\\s*(.*)$`, 'i');
  for (let index = 0; index < lines.length; index += 1) {
    const match = String(lines[index] || '').match(expression);
    if (!match) continue;
    const inline = match[1].trim();
    if (inline) {
      return splitYamlInlineList(inline);
    }
    const result = [];
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      if (String(lines[cursor] || '').match(/^[A-Za-z0-9_-]+\s*:/)) break;
      const item = String(lines[cursor] || '').match(/^\s*-\s*(.+)$/);
      if (item) result.push(unquoteYaml(item[1]));
    }
    return result;
  }
  return [];
}

function splitYamlInlineList(value) {
  const text = String(value || '').trim();
  const inline = text.startsWith('[') && text.endsWith(']') ? text.slice(1, -1) : text;
  return inline.split(/[,，]/).map(unquoteYaml).filter(Boolean);
}

function appendYamlList(lines, key, values) {
  lines.push(`${key}:`);
  for (const value of values) {
    lines.push(`  - ${quoteYaml(value)}`);
  }
}

function collectKnowledgeRelatedPaths(values, insight, relatedDocuments) {
  const allowed = new Map();
  for (const item of (Array.isArray(relatedDocuments) ? relatedDocuments : [])) {
    const relativePath = normalizeFrontmatterPath(item && item.relativePath);
    if (relativePath) allowed.set(relativePath.toLowerCase(), relativePath);
  }
  for (const item of (Array.isArray(insight && insight.relatedFiles) ? insight.relatedFiles : [])) {
    const relativePath = normalizeFrontmatterPath(item && item.relativePath);
    if (relativePath) allowed.set(relativePath.toLowerCase(), relativePath);
  }
  const selected = [];
  for (const value of (Array.isArray(values) ? values : [])) {
    const relativePath = normalizeFrontmatterPath(value && typeof value === 'object' ? value.relativePath || value.path || value.filePath : value);
    const allowedValue = allowed.get(relativePath.toLowerCase());
    if (allowedValue) selected.push(allowedValue);
  }
  return uniqueValues(selected.length ? selected : Array.from(allowed.values())).slice(0, 8);
}

function normalizeFrontmatterTag(value) {
  return String(value || '')
    .replace(/^#/, '')
    .replace(/[^\p{L}\p{N}_/-]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 40);
}

function normalizeFrontmatterText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 160);
}

function normalizeFrontmatterPath(value) {
  return String(value || '')
    .replace(/\\/g, '/')
    .replace(/^\.\/+/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 220);
}

function quoteYaml(value) {
  return JSON.stringify(String(value || ''));
}

function unquoteYaml(value) {
  return String(value || '').trim().replace(/^['"]|['"]$/g, '').trim();
}

function uniqueValues(values) {
  const result = [];
  const seen = new Set();
  for (const value of values) {
    const text = String(value || '').trim();
    const key = text.toLowerCase();
    if (!text || seen.has(key)) continue;
    seen.add(key);
    result.push(text);
  }
  return result;
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  LeapHomePanelController
};
