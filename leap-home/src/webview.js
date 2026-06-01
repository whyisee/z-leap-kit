const { getNonce } = require('./utils');
const { getCalendarComponentsScript, getCalendarComponentsStyles } = require('./webview/calendarComponents');
const { getCountdownScript, getCountdownStyles } = require('./webview/countdownComponent');
const { getFocusTimerScript, getFocusTimerStyles } = require('./webview/focusTimerComponent');
const { getKnowledgeGraphScript, getKnowledgeGraphStyles } = require('./webview/knowledgeGraphComponent');
const { getListComponentsScript } = require('./webview/listComponents');
const { getNextActionScript, getNextActionStyles } = require('./webview/nextActionComponent');
const { getQuadrantsScript, getQuadrantsStyles } = require('./webview/quadrantsComponent');
const { getQuickCaptureScript, getQuickCaptureStyles } = require('./webview/quickCaptureComponent');
const { getSearchScript, getSearchStyles } = require('./webview/searchComponent');
const { getStatsScript, getStatsStyles } = require('./webview/statsComponent');

function getWebviewHtml(webview) {
  const nonce = getNonce();
  const cspSource = webview.cspSource;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
  <title>Leap Home</title>
  <style nonce="${nonce}">
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      line-height: 1.45;
    }
    button, input, select, textarea { font: inherit; }
    button {
      min-height: 30px;
      border: 1px solid var(--vscode-button-border, transparent);
      border-radius: 4px;
      padding: 5px 10px;
      color: var(--vscode-button-foreground);
      background: var(--vscode-button-background);
      cursor: pointer;
      white-space: nowrap;
    }
    button:hover { background: var(--vscode-button-hoverBackground); }
    button.secondary {
      color: var(--vscode-foreground);
      background: var(--vscode-button-secondaryBackground);
    }
    button.secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }
    input, select, textarea {
      width: 100%;
      border: 1px solid var(--vscode-input-border, transparent);
      border-radius: 4px;
      color: var(--vscode-input-foreground);
      background: var(--vscode-input-background);
      outline: none;
    }
    input, select {
      height: 32px;
      padding: 0 8px;
    }
    textarea {
      min-height: 76px;
      padding: 7px 8px;
      resize: vertical;
      line-height: 1.45;
    }
    input:focus, select:focus, textarea:focus { border-color: var(--vscode-focusBorder); }
    .app {
      width: min(1180px, 100%);
      margin: 0 auto;
      padding: 24px;
    }
    .top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      min-height: 34px;
      margin-bottom: 18px;
    }
    .title-area {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }
    .title {
      min-width: 0;
      margin: 0;
      font-size: 28px;
      font-weight: 700;
      letter-spacing: 0;
    }
    .title-edit-button {
      height: 28px;
      min-height: 28px;
      border-color: var(--vscode-panel-border);
      padding: 0 9px;
      color: var(--vscode-descriptionForeground);
      background: transparent;
      font-size: 12px;
    }
    .title-edit-button:hover {
      color: var(--vscode-button-foreground);
      background: var(--vscode-button-background);
    }
    body.design-mode .title-edit-button {
      display: none;
    }
    .template-name {
      display: inline-flex;
      align-items: center;
      min-height: 30px;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 4px;
      padding: 4px 9px;
      color: var(--vscode-descriptionForeground);
      background: var(--vscode-sideBar-background);
      white-space: nowrap;
    }
    .design-toolbar {
      display: none;
      align-items: center;
      justify-content: flex-end;
      gap: 8px;
      min-width: 0;
      flex: 1;
    }
    body.design-mode .design-toolbar { display: flex; }
    .toolbar-group {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }
    .toolbar-select {
      width: 190px;
      height: 30px;
    }
    .design-toolbar button {
      height: 30px;
      min-height: 30px;
      padding: 0 10px;
    }
    .design-toolbar .save-button {
      font-weight: 700;
    }
    .toolbar-divider {
      width: 1px;
      min-height: 24px;
      background: var(--vscode-panel-border);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(12, minmax(0, 1fr));
      grid-auto-rows: 92px;
      grid-auto-flow: row dense;
      gap: 12px;
      align-items: stretch;
    }
    body.design-mode .grid {
      min-height: 720px;
      grid-auto-rows: 92px;
      border: 1px dashed var(--vscode-panel-border);
      border-radius: 8px;
      padding: 12px;
      background:
        linear-gradient(to right, var(--vscode-panel-border) 1px, transparent 1px) 0 0 / calc((100% - 22px) / 12) 100%,
        var(--vscode-editor-background);
    }
    .block {
      position: relative;
      display: flex;
      flex-direction: column;
      min-width: 0;
      min-height: 0;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 8px;
      background: var(--vscode-sideBar-background);
      overflow: hidden;
    }
    body.design-mode .block { cursor: move; }
    body.design-mode .block.dragging,
    body.design-mode .block.resizing {
      opacity: 0.78;
    }
    body.design-mode .block.dragging {
      cursor: grabbing;
    }
    body.design-mode .block.resizing {
      cursor: nwse-resize;
    }
    body.design-mode .block.selected {
      border-color: var(--vscode-focusBorder);
      box-shadow: 0 0 0 1px var(--vscode-focusBorder) inset;
    }
    body.design-mode .block.shifted {
      border-color: var(--vscode-inputValidation-warningBorder, var(--vscode-focusBorder));
      box-shadow: 0 0 0 1px var(--vscode-inputValidation-warningBorder, var(--vscode-focusBorder)) inset;
    }
    .resize-handle {
      display: none;
      position: absolute;
      right: 0;
      bottom: 0;
      width: 18px;
      height: 18px;
      border-top: 1px solid var(--vscode-focusBorder);
      border-left: 1px solid var(--vscode-focusBorder);
      border-radius: 6px 0 6px 0;
      background:
        linear-gradient(135deg, transparent 0 40%, var(--vscode-focusBorder) 41% 47%, transparent 48% 62%, var(--vscode-focusBorder) 63% 69%, transparent 70% 100%),
        var(--vscode-sideBar-background);
      cursor: nwse-resize;
    }
    body.design-mode .block.selected .resize-handle,
    body.design-mode .block:hover .resize-handle {
      display: block;
    }
    .block-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      min-height: 36px;
      border-bottom: 1px solid var(--vscode-panel-border);
      padding: 8px 10px;
      background: var(--vscode-sideBarSectionHeader-background, transparent);
    }
    .block-header-actions {
      display: flex;
      align-items: center;
      gap: 6px;
      flex: 0 0 auto;
    }
    .block-header-button {
      min-height: 22px;
      height: 22px;
      border-color: var(--vscode-panel-border);
      padding: 0 7px;
      color: var(--vscode-descriptionForeground);
      background: transparent;
      font-size: 11px;
      line-height: 20px;
    }
    .block-header-button.active,
    .block-header-button:hover {
      color: var(--vscode-button-foreground);
      background: var(--vscode-button-background);
    }
    .block-title {
      overflow: hidden;
      min-width: 0;
      margin: 0;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .count, .muted {
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
    }
    .block-body {
      flex: 1 1 auto;
      min-height: 0;
      padding: 10px;
      overflow: auto;
      overscroll-behavior: auto;
      scrollbar-gutter: stable;
    }
    .block-body-knowledge-graph {
      overflow: hidden;
    }
    .block-search {
      overflow: visible;
      z-index: 30;
    }
    .block-search:focus-within {
      z-index: 80;
    }
    .block-body-search {
      overflow: visible;
    }
    .stack, .list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .inline-actions, .item-actions, .designer-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .item {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 10px;
      min-height: 44px;
      border: 1px solid var(--vscode-sideBarSectionHeader-border, var(--vscode-panel-border));
      border-radius: 6px;
      padding: 8px;
      background: var(--vscode-editor-background);
    }
    .item-main { min-width: 0; }
    .item-title {
      overflow: hidden;
      font-weight: 600;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .item-meta {
      overflow: hidden;
      margin-top: 2px;
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    ${getSearchStyles()}
    .empty {
      border: 1px dashed var(--vscode-panel-border);
      border-radius: 6px;
      padding: 12px;
      color: var(--vscode-descriptionForeground);
      background: var(--vscode-editor-background);
    }
    .grid > .empty {
      grid-column: 1 / -1;
    }
    ${getQuickCaptureStyles()}
    ${getFocusTimerStyles()}
    ${getCountdownStyles()}
    ${getNextActionStyles()}
    ${getKnowledgeGraphStyles()}
    ${getQuadrantsStyles()}
    .inline-date {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 3px;
      min-width: 0;
    }
    .inline-date input {
      height: 28px;
      min-width: 0;
      font-size: 11px;
    }
    .inline-date-actions {
      display: flex;
      gap: 4px;
      min-width: 0;
      overflow: hidden;
    }
    .inline-date-actions button {
      min-width: 28px;
      min-height: 20px;
      height: 20px;
      padding: 0 5px;
      font-size: 10px;
    }
    ${getCalendarComponentsStyles()}
    ${getStatsStyles()}
    .design-panel {
      display: none;
      position: sticky;
      top: 12px;
      align-self: start;
      max-height: calc(100vh - 32px);
      overflow: auto;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 8px;
      padding: 12px;
      background: var(--vscode-sideBar-background);
    }
    body.design-mode .design-panel { display: block; }
    .designer-shell {
      display: block;
    }
    body.design-mode .designer-shell {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 320px;
      gap: 14px;
      align-items: start;
    }
    .designer-section {
      border-bottom: 1px solid var(--vscode-panel-border);
      margin-bottom: 12px;
      padding-bottom: 12px;
    }
    .designer-section:last-child {
      border-bottom: 0;
      margin-bottom: 0;
      padding-bottom: 0;
    }
    .designer-title {
      margin: 0 0 8px;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0;
    }
    .designer-fields {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .property-stack {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .property-stack .designer-section {
      margin-bottom: 0;
    }
    .designer-field {
      display: flex;
      flex-direction: column;
      gap: 5px;
      min-width: 0;
    }
    .designer-field label {
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
    }
    .designer-help {
      margin: 0 0 10px;
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
    }
    .layout-preview {
      display: grid;
      grid-template-columns: repeat(12, minmax(0, 1fr));
      grid-template-rows: repeat(6, 8px);
      gap: 2px;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
      margin-bottom: 8px;
      padding: 6px;
      background: var(--vscode-editor-background);
    }
    .layout-preview-cell {
      min-width: 0;
      min-height: 0;
      border-radius: 2px;
      background: var(--vscode-panel-border);
      opacity: 0.38;
    }
    .layout-preview-block {
      z-index: 1;
      border: 1px solid var(--vscode-focusBorder);
      border-radius: 3px;
      background: var(--vscode-list-activeSelectionBackground, var(--vscode-button-background));
      box-shadow: 0 0 0 1px var(--vscode-focusBorder) inset;
      opacity: 0.92;
    }
    .layout-hint {
      margin: -2px 0 8px;
      color: var(--vscode-descriptionForeground);
      font-size: 11px;
    }
    .layout-control-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 6px;
    }
    .layout-mini-field {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
    }
    .layout-mini-field label {
      color: var(--vscode-descriptionForeground);
      font-size: 11px;
      line-height: 1.1;
      text-align: center;
    }
    .layout-mini-field input {
      height: 28px;
      padding: 0 4px;
      text-align: center;
    }
    .design-notice {
      border: 1px solid var(--vscode-inputValidation-warningBorder, var(--vscode-panel-border));
      border-radius: 6px;
      margin-top: 10px;
      padding: 8px;
      color: var(--vscode-inputValidation-warningForeground, var(--vscode-foreground));
      background: var(--vscode-inputValidation-warningBackground, var(--vscode-editor-background));
      font-size: 12px;
    }
    .design-panel > .design-notice:first-child {
      margin-top: 0;
      margin-bottom: 12px;
    }
  </style>
</head>
<body>
  <main class="app">
    <header class="top">
      <div class="title-area">
        <h1 class="title">Leap Home</h1>
        <button type="button" class="title-edit-button" id="editHomeButton" title="编辑当前主页">编辑</button>
      </div>
      <div class="design-toolbar" id="designToolbar"></div>
    </header>
    <section class="designer-shell">
      <section class="grid" id="grid">
        <div class="empty">正在加载 Leap Home...</div>
      </section>
      <aside class="design-panel" id="designerPanel"></aside>
    </section>
  </main>

  <script nonce="${nonce}">
    const vscodeApi = acquireVsCodeApi();
    const state = {
      model: {
        data: { items: [], prompts: [], projectItems: [], favorites: [], recent: [], sources: [], focusTimer: {}, countdown: { items: [] }, nextAction: { recommendations: [], systemRecommendations: [], aiRecommendations: [] }, knowledgeGraph: { nodes: [], edges: [] }, quickCaptures: [], searchHistory: [] },
        layout: [],
        components: [],
        activeTemplateTitle: ''
      },
      query: '',
      search: {
        requestId: 0,
        requestedQuery: '',
        responseQuery: '',
        effectiveQuery: '',
        aiAttempted: false,
        aiReason: '',
        loading: false,
        groups: [],
        total: 0,
        indexedItems: 0,
        indexedEntities: 0,
        sourceErrors: 0,
        truncatedSources: 0,
        error: ''
      },
      searchTimer: undefined,
      searchSuggestionIndex: -1,
      suppressSearchSuggestionOnce: false,
      designMode: false,
      draftLayout: [],
      selectedBlockId: '',
      selectedComponentType: '',
      layoutNotice: '',
      layoutNoticeTimer: undefined,
      completedQuadrants: {},
      activeQuadrantAdd: '',
      focusTimerHistoryVisible: false,
      countdownFormId: '',
      countdownShowDone: false,
      nextActionAiLoading: false,
      nextActionQuestion: '',
      nextActionTab: 'system',
      nextActionSeen: {},
      nextActionPending: {},
      nextActionNotice: '',
      knowledgeGraphView: 'cluster',
      knowledgeGraphRelation: 'all',
      knowledgeGraphNodeId: '',
      knowledgeGraphAi: {
        insightId: '',
        phase: 'idle',
        message: '',
        detail: '',
        targetFile: ''
      },
      knowledgeGraphAiCompleted: {},
      selectedCalendarDate: '',
      calendarMonthOffset: 0,
      calendarWeekOffset: 0,
      drag: null
    };
    const els = {
      editHomeButton: document.getElementById('editHomeButton'),
      designToolbar: document.getElementById('designToolbar'),
      designerPanel: document.getElementById('designerPanel'),
      grid: document.getElementById('grid')
    };
    let hasModel = false;
    let readyAttempts = 0;

    window.addEventListener('error', (event) => {
      logToExtension('runtime error', {
        message: event.message,
        source: event.filename,
        line: event.lineno,
        column: event.colno
      });
    });
    window.addEventListener('unhandledrejection', (event) => {
      logToExtension('unhandled promise rejection', formatWebviewError(event.reason));
    });

    window.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'model') {
        hasModel = true;
        state.model = event.data.model;
        state.nextActionAiLoading = false;
        state.nextActionPending = {};
        state.nextActionNotice = '';
        if (!state.nextActionQuestion && state.model && state.model.data && state.model.data.nextAction && state.model.data.nextAction.ai) {
          state.nextActionQuestion = state.model.data.nextAction.ai.question || '';
        }
        logToExtension('model received', summarizeModel(state.model));
        render();
      }
      if (event.data && event.data.type === 'error') {
        hasModel = true;
        logToExtension('extension error received', event.data.message || '');
        showRenderError(new Error(event.data.message || '扩展端模型生成失败'));
      }
      if (event.data && event.data.type === 'setDesignMode') {
        logToExtension('setDesignMode received', { enabled: Boolean(event.data.enabled) });
        setDesignMode(Boolean(event.data.enabled));
      }
      if (event.data && event.data.type === 'searchResults') {
        handleSearchResults(event.data);
      }
      if (event.data && event.data.type === 'knowledgeGraphAiStatus') {
        handleKnowledgeGraphAiStatus(event.data);
      }
    });

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', finishDrag);
    document.addEventListener('click', closeDatePickers);
    document.addEventListener('wheel', releasePageScrollAtNestedBoundary, { passive: false });
    if (els.editHomeButton) {
      els.editHomeButton.addEventListener('click', () => setDesignMode(true));
    }

    document.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-action]');
      if (!button) return;
      if (state.designMode) return;
      const action = button.dataset.action;
      const filePath = button.dataset.filePath;
      const line = Number.parseInt(button.dataset.line, 10);
      if (action === 'open') post('openItem', Object.assign({ filePath }, Number.isNaN(line) ? {} : { line }));
      if (action === 'favorite') post('toggleFavorite', { filePath });
      if (action === 'copyPrompt') post('copyPrompt', { filePath });
      if (action === 'captureNote') post('captureNote');
      if (action === 'openInbox') post('openInbox');
      if (action === 'refresh') post('refresh');
      if (action === 'runSearch') {
        const query = button.dataset.query || '';
        if (query) {
          runSearchFromCommand(query);
        }
      }
      if (action === 'addTask') {
        post('addQuadrantTask', {
          quadrantId: 'importantNotUrgent',
          text: button.dataset.taskText || '处理搜索结果',
          source: 'search',
          reason: filePath || ''
        });
      }
      if (action === 'completeTask') {
        post('toggleQuadrantTask', {
          quadrantId: button.dataset.quadrantId,
          taskId: button.dataset.taskId,
          done: true
        });
      }
    });

    function post(type, payload) {
      vscodeApi.postMessage(Object.assign({ type }, payload || {}));
    }

    function logToExtension(message, details) {
      try {
        console.log('[Leap Home]', message, details || '');
        post('log', { message, details });
      } catch (error) {
        console.log('[Leap Home] log failed', error);
      }
    }

    function requestModel(reason) {
      readyAttempts += 1;
      logToExtension('requesting model', { reason, attempt: readyAttempts });
      post('ready', { details: { reason, attempt: readyAttempts } });
    }

    function handleSearchResults(message) {
      if (message.requestId !== state.search.requestId) {
        return;
      }
      const results = message.results || {};
      state.search.loading = false;
      state.search.responseQuery = results.query || '';
      state.search.effectiveQuery = results.effectiveQuery || '';
      state.search.aiAttempted = Boolean(results.aiAttempted);
      state.search.aiReason = results.aiReason || '';
      state.search.groups = Array.isArray(results.groups) ? results.groups : [];
      state.search.total = results.total || 0;
      state.search.indexedItems = results.indexedItems || 0;
      state.search.indexedEntities = results.indexedEntities || 0;
      state.search.sourceErrors = results.sourceErrors || 0;
      state.search.truncatedSources = results.truncatedSources || 0;
      state.search.error = results.error || '';
      if (Array.isArray(results.history)) {
        state.model.data.searchHistory = results.history;
      }
      renderSearchResultContainers();
    }

    function handleKnowledgeGraphAiStatus(message) {
      const insightId = String(message.insightId || '');
      const phase = String(message.phase || 'idle');
      if (phase === 'done' && insightId) {
        state.knowledgeGraphAiCompleted[insightId] = true;
      }
      state.knowledgeGraphAi = {
        insightId,
        phase,
        message: String(message.message || ''),
        detail: String(message.detail || ''),
        targetFile: String(message.targetFile || '')
      };
      render();
    }

    function releasePageScrollAtNestedBoundary(event) {
      if (!event || event.defaultPrevented || state.designMode || !event.deltaY) {
        return;
      }
      if (event.target && event.target.closest && event.target.closest('textarea, select')) {
        return;
      }
      const scroller = getNestedScrollElement(event.target);
      if (!scroller || !canScrollVertically(scroller)) {
        return;
      }
      const deltaY = normalizeWheelDelta(event);
      const atTop = scroller.scrollTop <= 0;
      const atBottom = Math.ceil(scroller.scrollTop + scroller.clientHeight) >= scroller.scrollHeight;
      if ((deltaY < 0 && atTop) || (deltaY > 0 && atBottom)) {
        const page = document.scrollingElement || document.documentElement;
        const pageAtTop = page.scrollTop <= 0;
        const pageAtBottom = Math.ceil(page.scrollTop + window.innerHeight) >= page.scrollHeight;
        if ((deltaY < 0 && !pageAtTop) || (deltaY > 0 && !pageAtBottom)) {
          event.preventDefault();
          window.scrollBy({ top: deltaY, left: 0, behavior: 'auto' });
        }
      }
    }

    function getNestedScrollElement(target) {
      let element = target && target.nodeType === Node.ELEMENT_NODE ? target : target && target.parentElement;
      while (element && element !== document.body) {
        if (element.matches && element.matches('.block-body, .search-results[data-floating="true"], .search-suggest, .knowledge-graph-insight-list')) {
          return element;
        }
        element = element.parentElement;
      }
      return undefined;
    }

    function canScrollVertically(element) {
      const style = window.getComputedStyle(element);
      return /(auto|scroll|overlay)/.test(style.overflowY) && element.scrollHeight > element.clientHeight + 1;
    }

    function normalizeWheelDelta(event) {
      if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
        return event.deltaY * 16;
      }
      if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
        return event.deltaY * window.innerHeight;
      }
      return event.deltaY;
    }

    function render() {
      try {
        renderContent();
        logToExtension('render completed', { blocks: getActiveLayout().length, designMode: state.designMode });
      } catch (error) {
        logToExtension('render failed', formatWebviewError(error));
        showRenderError(error);
      }
    }

    function renderContent() {
      document.body.classList.toggle('design-mode', state.designMode);
      els.grid.textContent = '';
      renderDesignToolbar();
      renderDesignerPanel();
      for (const block of getActiveLayout()) {
        els.grid.appendChild(renderBlock(block));
      }
    }

    function showRenderError(error) {
      document.body.classList.remove('design-mode');
      els.grid.textContent = '';
      const message = error && error.message ? error.message : String(error || '未知错误');
      els.grid.appendChild(empty('Leap Home 渲染失败：' + message));
    }

    function renderBlock(block) {
      const wrapper = document.createElement('section');
      const wrapperClasses = ['block'];
      if (block.component === 'search') wrapperClasses.push('block-search');
      if (block.id === state.selectedBlockId && state.designMode) wrapperClasses.push('selected');
      wrapper.className = wrapperClasses.join(' ');
      wrapper.dataset.layoutId = block.id;
      applyGridPosition(wrapper, block);
      if (state.designMode) {
        wrapper.addEventListener('pointerdown', (event) => {
          if (event.target.closest('button, input, select, textarea, .resize-handle')) return;
          state.selectedBlockId = block.id;
          startDrag(event, block);
        });
      }

      const header = document.createElement('div');
      header.className = 'block-header';
      const title = document.createElement('h2');
      title.className = 'block-title';
      title.textContent = block.title;
      const count = document.createElement('span');
      count.className = 'count';
      count.textContent = state.designMode ? formatBlockPosition(block) : getComponentCount(block);
      const headerActions = div('block-header-actions');
      headerActions.appendChild(count);
      if (!state.designMode && block.component === 'focusTimer') {
        const historyButton = button(state.focusTimerHistoryVisible ? '时钟' : '记录', () => {
          state.focusTimerHistoryVisible = !state.focusTimerHistoryVisible;
          render();
        }, true);
        historyButton.className = 'block-header-button' + (state.focusTimerHistoryVisible ? ' active' : '');
        historyButton.title = state.focusTimerHistoryVisible ? '切换到番茄时钟' : '切换到历史记录';
        headerActions.appendChild(historyButton);
      }
      header.append(title, headerActions);

      const body = document.createElement('div');
      body.className = 'block-body';
      if (block.component === 'knowledgeGraph') {
        body.classList.add('block-body-knowledge-graph');
      }
      if (block.component === 'search') {
        body.classList.add('block-body-search');
      }
      renderComponentBody(body, block);
      wrapper.append(header, body);
      if (state.designMode) {
        const resizeHandle = document.createElement('div');
        resizeHandle.className = 'resize-handle';
        resizeHandle.title = '拖拽调整大小';
        resizeHandle.addEventListener('pointerdown', (event) => startResize(event, block));
        wrapper.appendChild(resizeHandle);
      }
      return wrapper;
    }

    function renderComponentBody(container, block) {
      if (block.component === 'search') return renderSearch(container, block);
      if (block.component === 'quickCapture') return renderQuickCapture(container);
      if (block.component === 'focusTimer') return renderFocusTimer(container);
      if (block.component === 'countdown') return renderCountdown(container, block);
      if (block.component === 'nextAction') return renderNextAction(container, block);
      if (block.component === 'knowledgeGraph') return renderKnowledgeGraph(container, block);
      if (block.component === 'favorites') return renderItemList(container, state.model.data.favorites, '还没有收藏。', block, true);
      if (block.component === 'prompts') return renderPromptList(container, block);
      if (block.component === 'fourQuadrants') return renderFourQuadrants(container, block);
      if (block.component === 'weekCalendar') return renderWeekCalendar(container);
      if (block.component === 'monthCalendar') return renderMonthCalendar(container);
      if (block.component === 'stats') return renderStats(container);
      container.appendChild(empty('未知组件：' + block.component));
    }

    ${getSearchScript()}
    ${getQuickCaptureScript()}
    ${getFocusTimerScript()}
    ${getCountdownScript()}
    ${getKnowledgeGraphScript()}
    ${getNextActionScript()}
    ${getListComponentsScript()}
    ${getQuadrantsScript()}
    function inlineDateField(initialValue) {
      const wrap = div('inline-date');
      const input = document.createElement('input');
      input.type = 'date';
      input.value = normalizeDateValue(initialValue);
      input.title = '截止日期';
      const actions = div('inline-date-actions');
      const options = [
        ['今', 0],
        ['明', 1],
        ['+3', 3],
        ['+7', 7]
      ];
      for (const option of options) {
        const item = button(option[0], () => {
          input.value = toDateKey(addDays(startOfDay(new Date()), option[1]));
        }, true);
        item.title = option[0] === '今' ? '今天' : option[0] === '明' ? '明天' : option[1] + ' 天后';
        actions.appendChild(item);
      }
      const clear = button('清', () => {
        input.value = '';
      }, true);
      clear.title = '清空截止日期';
      actions.appendChild(clear);
      wrap.append(input, actions);
      wrap.getValue = () => normalizeDateValue(input.value);
      wrap.clearValue = () => { input.value = ''; };
      return wrap;
    }

    function datePicker(initialValue, onChange, placeholder) {
      const wrap = div(initialValue ? 'date-picker' : 'date-picker empty-date');
      let value = normalizeDateValue(initialValue);
      const trigger = button(formatDueDate(value, placeholder), () => {
        wrap.classList.toggle('open');
      }, true);
      trigger.className = 'date-pill';
      trigger.title = '选择截止日期';

      const popover = div('date-popover');
      const quick = div('date-quick');
      for (const option of [
        ['今天', 0],
        ['明天', 1],
        ['3 天内', 3],
        ['下周', 7]
      ]) {
        const chip = button(option[0], () => setValue(toDateKey(addDays(startOfDay(new Date()), option[1])), true), true);
        chip.className = 'date-chip';
        quick.appendChild(chip);
      }

      const customWrap = div('date-custom');
      const custom = document.createElement('input');
      custom.type = 'date';
      custom.value = value;
      custom.addEventListener('change', () => setValue(custom.value, true));
      const clear = button('清空', () => setValue('', true), true);
      clear.className = 'date-clear';
      customWrap.append(custom, clear);
      popover.append(quick, customWrap);
      wrap.append(trigger, popover);

      wrap.getValue = () => value;
      wrap.clearValue = () => setValue('', false);
      return wrap;

      function setValue(nextValue, shouldNotify) {
        value = normalizeDateValue(nextValue);
        custom.value = value;
        trigger.textContent = formatDueDate(value, placeholder);
        trigger.title = value ? '截止日期：' + value : '选择截止日期';
        wrap.classList.toggle('empty-date', !value);
        wrap.classList.remove('open');
        if (shouldNotify && onChange) onChange(value);
      }
    }

    ${getCalendarComponentsScript()}
    ${getStatsScript()}
    function itemRow(item, isFavorite) {
      const row = div('item');
      const main = div('item-main');
      const title = div('item-title', item.title || item.fileName);
      title.title = item.filePath;
      const meta = div('item-meta', item.sourceName + ' · ' + (item.relativePath || item.fileName));
      main.append(title, meta);
      const actions = div('item-actions');
      const open = actionButton('打开', 'open');
      open.dataset.filePath = item.filePath;
      const favorite = actionButton(isFavorite ? '取消' : '收藏', 'favorite', true);
      favorite.title = isFavorite ? '取消收藏' : '加入收藏';
      favorite.dataset.filePath = item.filePath;
      actions.append(open, favorite);
      row.append(main, actions);
      return row;
    }

    function renderDesignToolbar() {
      els.designToolbar.textContent = '';
      if (!state.designMode) return;
      const definitions = state.model.components || [];
      if (definitions.length === 0) {
        els.designToolbar.appendChild(div('muted', '暂无可添加组件'));
        return;
      }
      const selectedType = definitions.some((definition) => definition.type === state.selectedComponentType)
        ? state.selectedComponentType
        : definitions[0].type;
      state.selectedComponentType = selectedType;

      const componentGroup = div('toolbar-group');
      const selector = document.createElement('select');
      selector.className = 'toolbar-select';
      selector.title = '选择要添加的组件';
      for (const definition of state.model.components || []) {
        const option = document.createElement('option');
        option.value = definition.type;
        option.textContent = definition.title + ' · ' + definition.type;
        selector.appendChild(option);
      }
      selector.value = selectedType;
      selector.addEventListener('change', () => {
        state.selectedComponentType = selector.value;
      });
      const add = button('添加组件', () => {
        state.selectedComponentType = selector.value;
        addComponent(selector.value);
      }, false);
      add.title = '添加到画布空白位置';
      componentGroup.append(selector, add);

      const save = button('保存主页', () => {
        ensureLayoutCanSave();
        post('saveLayout', { layout: state.draftLayout });
      }, false);
      save.className = 'save-button';
      save.title = '保存当前主页布局';

      const exit = button('退出编辑', () => {
        setDesignMode(false);
      }, true);
      exit.title = '退出主页编辑状态';

      els.designToolbar.append(componentGroup, div('toolbar-divider'), save, exit);
    }

    function renderDesignerPanel() {
      els.designerPanel.textContent = '';
      if (!state.designMode) return;
      if (state.layoutNotice) {
        els.designerPanel.appendChild(div('design-notice', state.layoutNotice));
      }
      const selected = getSelectedBlock();
      if (selected) {
        els.designerPanel.appendChild(renderSelectedEditor(selected));
      } else {
        els.designerPanel.appendChild(empty('请选择画布上的组件，或用顶部工具栏添加组件。'));
      }
    }

    function renderSelectedEditor(block) {
      const stack = div('property-stack');
      stack.append(
        renderComponentPropertySection(block),
        renderLayoutPropertySection(block),
        renderActionPropertySection()
      );
      return stack;
    }

    function renderComponentPropertySection(block) {
      const section = div('designer-section');
      const heading = document.createElement('h2');
      heading.className = 'designer-title';
      heading.textContent = '组件属性';
      const definition = getComponentDefinition(block.component);
      const fields = div('designer-fields');
      fields.append(
        componentTypeField(block),
        inputField('标题', block.title, 'text', (value) => updateSelectedBlock({ title: value || getComponentDefinition(block.component).title }))
      );
      if (componentUsesLimit(block.component)) {
        fields.appendChild(inputField('显示数量', getLimit(block, 8), 'number', (value) => updateSelectedOptions({ limit: clamp(value, 1, 50) }), 1, 50));
      }
      section.append(heading, div('designer-help', definition.description || '配置组件内容和展示方式。'), fields);
      return section;
    }

    function renderLayoutPropertySection(block) {
      const section = div('designer-section');
      const heading = document.createElement('h2');
      heading.className = 'designer-title';
      heading.textContent = '布局信息';
      const controls = div('layout-control-grid');
      const col = block.col || 1;
      const colSpan = block.colSpan || 12;
      controls.append(
        layoutNumberField('列', col, 1, 13 - colSpan, (value) => updateSelectedBlock({ col: clamp(value, 1, 13 - colSpan) })),
        layoutNumberField('行', block.row || 1, 1, 99, (value) => updateSelectedBlock({ row: clamp(value, 1, 99) })),
        layoutNumberField('宽', colSpan, 1, 13 - col, (value) => updateSelectedBlock({ colSpan: clamp(value, 1, 13 - col) })),
        layoutNumberField('高', block.rowSpan || 1, 1, 12, (value) => updateSelectedBlock({ rowSpan: clamp(value, 1, 12) }))
      );
      section.append(heading, renderLayoutPreview(block), div('layout-hint', formatLayoutHint(block)), controls);
      return section;
    }

    function renderActionPropertySection() {
      const section = div('designer-section');
      const heading = document.createElement('h2');
      heading.className = 'designer-title';
      heading.textContent = '操作';
      section.append(heading, actionsWrap([button('复制组件', duplicateSelectedBlock, true), button('删除组件', removeSelectedBlock, true)]));
      return section;
    }

    function componentTypeField(block) {
      const selector = document.createElement('select');
      for (const definition of state.model.components || []) {
        const option = document.createElement('option');
        option.value = definition.type;
        option.textContent = definition.title;
        selector.appendChild(option);
      }
      selector.value = block.component;
      selector.addEventListener('change', () => switchSelectedComponent(selector.value));
      return fieldWrap('组件类型', selector);
    }

    function componentUsesLimit(componentType) {
      return ['search', 'favorites', 'prompts', 'fourQuadrants', 'countdown', 'nextAction', 'knowledgeGraph'].includes(componentType);
    }

    function layoutNumberField(labelText, value, min, max, onChange) {
      const wrap = div('layout-mini-field');
      const label = document.createElement('label');
      label.textContent = labelText;
      const input = document.createElement('input');
      input.type = 'number';
      input.value = String(value ?? '');
      input.min = String(min);
      input.max = String(max);
      input.addEventListener('change', () => onChange(input.value));
      wrap.append(label, input);
      return wrap;
    }

    function renderLayoutPreview(block) {
      const preview = div('layout-preview');
      const row = block.row || 1;
      const rowSpan = block.rowSpan || 1;
      const previewStartRow = Math.max(1, Math.min(row, row + rowSpan - 6));
      const markerRow = clamp(row - previewStartRow + 1, 1, 6);
      const markerRowSpan = clamp(rowSpan, 1, 7 - markerRow);
      for (let index = 0; index < 72; index += 1) {
        preview.appendChild(div('layout-preview-cell'));
      }
      const marker = div('layout-preview-block');
      marker.style.gridColumn = String(block.col || 1) + ' / span ' + String(block.colSpan || 12);
      marker.style.gridRow = String(markerRow) + ' / span ' + String(markerRowSpan);
      preview.appendChild(marker);
      return preview;
    }

    function formatLayoutHint(block) {
      return '12 列网格 · 起点：第 ' + String(block.col || 1) + ' 列 / 第 ' + String(block.row || 1) + ' 行 · 占用：' + String(block.colSpan || 12) + ' 列 x ' + String(block.rowSpan || 1) + ' 行';
    }

    function setDesignMode(enabled) {
      state.designMode = enabled;
      if (enabled) {
        state.draftLayout = cloneLayout(state.model.layout || []);
        state.selectedBlockId = state.draftLayout[0] ? state.draftLayout[0].id : '';
        const definitions = state.model.components || [];
        if (!state.selectedComponentType && definitions[0]) state.selectedComponentType = definitions[0].type;
      } else {
        state.draftLayout = [];
        state.selectedBlockId = '';
        clearLayoutNotice();
      }
      render();
    }

    function getActiveLayout() { return state.designMode ? state.draftLayout : (state.model.layout || []); }
    function cloneLayout(layout) { return JSON.parse(JSON.stringify(layout || [])); }
    function getSelectedBlock() { return state.draftLayout.find((block) => block.id === state.selectedBlockId); }
    function getComponentDefinition(type) { return (state.model.components || []).find((item) => item.type === type) || { title: type, defaultColSpan: 4, defaultRowSpan: 2 }; }

    function updateSelectedBlock(patch) {
      const block = getSelectedBlock();
      if (!block) return;
      const result = applyBlockPatch(block, patch);
      render();
      markShiftedBlocks(result.movedIds);
    }

    function updateSelectedBlockLive(patch) {
      const block = getSelectedBlock();
      if (!block) return;
      const result = applyBlockPatch(block, patch);
      updateRenderedBlock(block);
      for (const blockId of result.movedIds) {
        const movedBlock = state.draftLayout.find((item) => item.id === blockId);
        if (movedBlock) updateRenderedBlock(movedBlock);
      }
      markShiftedBlocks(result.movedIds);
      renderDesignerPanel();
    }

    function updateSelectedOptions(patch) {
      const block = getSelectedBlock();
      if (!block) return;
      block.options = Object.assign({}, block.options || {}, patch);
      render();
    }

    function switchSelectedComponent(componentType) {
      const block = getSelectedBlock();
      if (!block || block.component === componentType) return;
      const currentDefinition = getComponentDefinition(block.component);
      const nextDefinition = getComponentDefinition(componentType);
      const hasCustomTitle = block.title && block.title !== currentDefinition.title;
      const patch = {
        component: componentType,
        title: hasCustomTitle ? block.title : nextDefinition.title
      };
      if ((block.colSpan || 12) === currentDefinition.defaultColSpan && (block.rowSpan || 1) === currentDefinition.defaultRowSpan) {
        patch.colSpan = clamp(nextDefinition.defaultColSpan || block.colSpan || 4, 1, 12);
        patch.rowSpan = clamp(nextDefinition.defaultRowSpan || block.rowSpan || 2, 1, 12);
      }
      const result = applyBlockPatch(block, patch);
      state.selectedComponentType = componentType;
      render();
      markShiftedBlocks(result.movedIds);
    }

    function addComponent(componentType) {
      const definition = getComponentDefinition(componentType);
      const block = {
        id: componentType + '-' + Date.now(),
        component: componentType,
        title: definition.title,
        col: 1,
        row: getNextRow(),
        colSpan: clamp(definition.defaultColSpan || 4, 1, 12),
        rowSpan: clamp(definition.defaultRowSpan || 2, 1, 12),
        options: {}
      };
      placeBlockInOpenSlot(block, 1, getNextRow());
      state.draftLayout.push(block);
      state.selectedBlockId = block.id;
      render();
    }

    function duplicateSelectedBlock() {
      const block = getSelectedBlock();
      if (!block) return;
      const copy = cloneLayout([block])[0];
      copy.id = block.component + '-' + Date.now();
      placeBlockInOpenSlot(copy, block.col || 1, (block.row || 1) + 1);
      state.draftLayout.push(copy);
      state.selectedBlockId = copy.id;
      render();
    }

    function removeSelectedBlock() {
      state.draftLayout = state.draftLayout.filter((block) => block.id !== state.selectedBlockId);
      state.selectedBlockId = state.draftLayout[0] ? state.draftLayout[0].id : '';
      render();
    }

    function getNextRow() {
      return (state.draftLayout || []).reduce((max, block) => Math.max(max, (block.row || 1) + (block.rowSpan || 1)), 1);
    }

    function startDrag(event, block) {
      event.preventDefault();
      state.selectedBlockId = block.id;
      const metrics = getGridMetrics();
      for (const element of document.querySelectorAll('.block.selected')) {
        element.classList.remove('selected');
      }
      event.currentTarget.classList.add('selected');
      state.drag = {
        mode: 'move',
        blockId: block.id,
        startX: event.clientX,
        startY: event.clientY,
        startCol: block.col || 1,
        startRow: block.row || 1,
        metrics
      };
      event.currentTarget.classList.add('dragging');
      event.currentTarget.setPointerCapture(event.pointerId);
      renderDesignerPanel();
    }

    function startResize(event, block) {
      event.preventDefault();
      event.stopPropagation();
      state.selectedBlockId = block.id;
      const blockElement = event.currentTarget.closest('.block');
      const metrics = getGridMetrics();
      for (const element of document.querySelectorAll('.block.selected')) {
        element.classList.remove('selected');
      }
      if (blockElement) {
        blockElement.classList.add('selected', 'resizing');
      }
      state.drag = {
        mode: 'resize',
        blockId: block.id,
        startX: event.clientX,
        startY: event.clientY,
        startColSpan: block.colSpan || 1,
        startRowSpan: block.rowSpan || 1,
        metrics
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      renderDesignerPanel();
    }

    function handlePointerMove(event) {
      if (!state.drag) return;
      const block = state.draftLayout.find((item) => item.id === state.drag.blockId);
      if (!block) return;
      const deltaCol = Math.round((event.clientX - state.drag.startX) / state.drag.metrics.columnWidth);
      const deltaRow = Math.round((event.clientY - state.drag.startY) / state.drag.metrics.rowHeight);
      if (state.drag.mode === 'resize') {
        const maxColSpan = 13 - (block.col || 1);
        const nextColSpan = clamp(state.drag.startColSpan + deltaCol, 1, maxColSpan);
        const nextRowSpan = clamp(state.drag.startRowSpan + deltaRow, 1, 12);
        if (nextColSpan !== block.colSpan || nextRowSpan !== block.rowSpan) {
          updateSelectedBlockLive({ colSpan: nextColSpan, rowSpan: nextRowSpan });
        }
      } else {
        const nextCol = clamp(state.drag.startCol + deltaCol, 1, 13 - (block.colSpan || 1));
        const nextRow = clamp(state.drag.startRow + deltaRow, 1, 99);
        if (nextCol !== block.col || nextRow !== block.row) {
          updateSelectedBlockLive({ col: nextCol, row: nextRow });
        }
      }
    }

    function applyBlockPatch(block, patch) {
      if (!changesGeometry(patch)) {
        Object.assign(block, patch);
        return { movedIds: [] };
      }
      const candidate = normalizeBlockGeometry(Object.assign({}, block, patch));
      Object.assign(block, patch, {
        col: candidate.col,
        row: candidate.row,
        colSpan: candidate.colSpan,
        rowSpan: candidate.rowSpan
      });
      const movedIds = moveCollidingBlocks(block.id);
      if (movedIds.length > 0) {
        setLayoutNotice('已自动移动被碰撞组件：' + formatMovedBlocks(movedIds));
      } else {
        clearLayoutNotice();
      }
      return { movedIds };
    }

    function ensureLayoutCanSave() {
      const movedIds = repairLayoutCollisions();
      if (movedIds.length > 0) {
        setLayoutNotice('保存前已自动整理重叠组件：' + formatMovedBlocks(movedIds));
        markShiftedBlocks(movedIds);
      }
      return true;
    }

    function changesGeometry(patch) {
      return ['col', 'row', 'colSpan', 'rowSpan', 'span'].some((key) => Object.prototype.hasOwnProperty.call(patch, key));
    }

    function normalizeBlockGeometry(block) {
      const colSpan = clamp(block.colSpan || block.span || 12, 1, 12);
      const rowSpan = clamp(block.rowSpan || 1, 1, 12);
      return Object.assign({}, block, {
        col: clamp(block.col || 1, 1, 13 - colSpan),
        row: clamp(block.row || 1, 1, 99),
        colSpan,
        rowSpan
      });
    }

    function getBlockRect(block) {
      const normalized = normalizeBlockGeometry(block);
      return {
        colStart: normalized.col,
        colEnd: normalized.col + normalized.colSpan,
        rowStart: normalized.row,
        rowEnd: normalized.row + normalized.rowSpan
      };
    }

    function getCollision(candidate, ignoredId) {
      const candidateRect = getBlockRect(candidate);
      return (state.draftLayout || []).find((block) => block.id !== ignoredId && rectsOverlap(candidateRect, getBlockRect(block)));
    }

    function getLayoutCollision() {
      const layout = state.draftLayout || [];
      for (let index = 0; index < layout.length; index += 1) {
        const first = layout[index];
        const firstRect = getBlockRect(first);
        for (let next = index + 1; next < layout.length; next += 1) {
          const second = layout[next];
          if (rectsOverlap(firstRect, getBlockRect(second))) {
            return { a: first, b: second };
          }
        }
      }
      return undefined;
    }

    function moveCollidingBlocks(anchorId) {
      const movedIds = [];
      for (let guard = 0; guard < 120; guard += 1) {
        const anchor = state.draftLayout.find((block) => block.id === anchorId);
        if (!anchor) return movedIds;
        const collision = getCollision(anchor, anchorId);
        if (!collision) return movedIds;
        placeBlockInOpenSlot(collision, collision.col || 1, collision.row || 1);
        if (!movedIds.includes(collision.id)) movedIds.push(collision.id);
      }
      return movedIds;
    }

    function repairLayoutCollisions() {
      const movedIds = [];
      for (let guard = 0; guard < 120; guard += 1) {
        const collision = getLayoutCollision();
        if (!collision) return movedIds;
        placeBlockInOpenSlot(collision.b, collision.b.col || 1, collision.b.row || 1);
        if (!movedIds.includes(collision.b.id)) movedIds.push(collision.b.id);
      }
      return movedIds;
    }

    function rectsOverlap(a, b) {
      return a.colStart < b.colEnd && a.colEnd > b.colStart && a.rowStart < b.rowEnd && a.rowEnd > b.rowStart;
    }

    function placeBlockInOpenSlot(block, preferredCol, preferredRow) {
      const normalized = normalizeBlockGeometry(Object.assign({}, block, { col: preferredCol, row: preferredRow }));
      const maxCol = 13 - normalized.colSpan;
      let bestCandidate = undefined;
      let bestScore = Number.POSITIVE_INFINITY;
      for (let row = normalized.row; row < normalized.row + 200; row += 1) {
        for (let col = 1; col <= maxCol; col += 1) {
          const candidate = normalizeBlockGeometry(Object.assign({}, block, { col, row }));
          if (!getCollision(candidate, block.id)) {
            const score = Math.abs(row - normalized.row) * 12 + Math.abs(col - normalized.col);
            if (score < bestScore) {
              bestCandidate = candidate;
              bestScore = score;
            }
          }
        }
        if (bestCandidate && bestCandidate.row === row) break;
      }
      if (bestCandidate) {
        block.col = bestCandidate.col;
        block.row = bestCandidate.row;
        block.colSpan = bestCandidate.colSpan;
        block.rowSpan = bestCandidate.rowSpan;
        clearLayoutNotice();
        return;
      }
      block.col = 1;
      block.row = getNextRow();
      setLayoutNotice('没有找到足够的空位，已把组件放到画布底部。');
    }

    function setLayoutNotice(message) {
      if (state.layoutNoticeTimer) window.clearTimeout(state.layoutNoticeTimer);
      state.layoutNotice = message;
      renderDesignerPanel();
      state.layoutNoticeTimer = window.setTimeout(() => {
        state.layoutNotice = '';
        state.layoutNoticeTimer = undefined;
        renderDesignerPanel();
      }, 2200);
    }

    function clearLayoutNotice() {
      if (state.layoutNoticeTimer) window.clearTimeout(state.layoutNoticeTimer);
      state.layoutNoticeTimer = undefined;
      state.layoutNotice = '';
    }

    function markShiftedBlocks(blockIds) {
      for (const blockId of blockIds) markBlockShifted(blockId);
    }

    function markBlockShifted(blockId) {
      const element = document.querySelector('[data-layout-id="' + blockId + '"]');
      if (!element) return;
      element.classList.add('shifted');
      window.setTimeout(() => element.classList.remove('shifted'), 420);
    }

    function finishDrag() {
      if (!state.drag) return;
      const dragged = document.querySelector('[data-layout-id="' + state.drag.blockId + '"]');
      if (dragged) dragged.classList.remove('dragging', 'resizing');
      state.drag = null;
    }

    function getGridMetrics() {
      const rect = els.grid.getBoundingClientRect();
      const styles = getComputedStyle(els.grid);
      const gap = Number.parseFloat(styles.columnGap) || 0;
      const rowGap = Number.parseFloat(styles.rowGap) || 0;
      const baseRowHeight = Number.parseFloat(styles.gridAutoRows) || 92;
      const columnWidth = Math.max(1, (rect.width - gap * 11) / 12 + gap);
      const rowHeight = baseRowHeight + rowGap;
      return { columnWidth, rowHeight };
    }

    function updateRenderedBlock(block) {
      const element = document.querySelector('[data-layout-id="' + block.id + '"]');
      if (!element) return;
      applyGridPosition(element, block);
      const count = element.querySelector('.count');
      if (count) count.textContent = formatBlockPosition(block);
    }

    function applyGridPosition(element, block) {
      const colSpan = clamp(block.colSpan || block.span || 12, 1, 12);
      const rowSpan = clamp(block.rowSpan || 1, 1, 12);
      element.style.gridColumn = block.col ? String(block.col) + ' / span ' + String(colSpan) : 'span ' + String(colSpan);
      element.style.gridRow = block.row ? String(block.row) + ' / span ' + String(rowSpan) : 'span ' + String(rowSpan);
    }

    function getComponentCount(block) {
      const data = state.model.data || {};
      if (block.component === 'search') return state.query ? '搜索中' : '';
      if (block.component === 'quickCapture') return String((data.quickCaptures || []).length);
      if (block.component === 'focusTimer') return '';
      if (block.component === 'countdown') return String(((data.countdown && data.countdown.items) || []).filter((item) => !item.done).length);
      if (block.component === 'nextAction') {
        const nextAction = data.nextAction || {};
        const systemCount = Array.isArray(nextAction.systemRecommendations)
          ? nextAction.systemRecommendations.length
          : Array.isArray(nextAction.recommendations) ? nextAction.recommendations.length : 0;
        const aiCount = Array.isArray(nextAction.aiRecommendations) ? nextAction.aiRecommendations.length : 0;
        return String(systemCount + aiCount);
      }
      if (block.component === 'knowledgeGraph') {
        const graph = data.knowledgeGraph || {};
        return String(graph.stats && graph.stats.edges || (Array.isArray(graph.edges) ? graph.edges.length : 0));
      }
      if (block.component === 'favorites') return String((data.favorites || []).length);
      if (block.component === 'prompts') return String((data.prompts || []).length);
      if (block.component === 'fourQuadrants') return String((data.quadrants || []).reduce((count, quadrant) => count + (quadrant.items || []).length, 0));
      if (block.component === 'weekCalendar') return String((data.calendarEvents || []).length);
      if (block.component === 'monthCalendar') return String(getMonthCalendarItems().length);
      if (block.component === 'stats') return '概览';
      return '';
    }

    function getLimit(block, fallback) {
      const value = block && block.options ? Number.parseInt(block.options.limit, 10) : NaN;
      return Number.isNaN(value) ? fallback : Math.max(1, value);
    }

    function getFavoritePaths() { return new Set((state.model.data.favorites || []).map((item) => item.filePath)); }
    function closeDatePickers(event) {
      if (event.target.closest('.date-picker')) return;
      for (const picker of document.querySelectorAll('.date-picker.open')) {
        picker.classList.remove('open');
      }
    }
    function groupCalendarItemsByDate(items) {
      return (items || []).reduce((result, item) => {
        if (!result[item.date]) result[item.date] = [];
        result[item.date].push(item);
        result[item.date].sort((a, b) => a.sortWeight - b.sortWeight || a.title.localeCompare(b.title));
        return result;
      }, {});
    }
    function getVisibleMonthItems(itemsByDate, visibleMonth) {
      const prefix = String(visibleMonth.getFullYear()) + '-' + padDatePart(visibleMonth.getMonth() + 1) + '-';
      return Object.keys(itemsByDate || {})
        .filter((dateKey) => dateKey.startsWith(prefix))
        .reduce((result, dateKey) => result.concat(itemsByDate[dateKey] || []), []);
    }
    function getMonthCalendarItems() {
      const events = (state.model.data.calendarEvents || []).map((event) => ({
        type: 'event',
        date: event.date,
        title: (event.start ? event.start + ' ' : '') + event.title,
        meta: '日历事件' + (event.start ? ' · ' + event.start : ''),
        className: 'month-item calendar-event',
        sortWeight: 10
      }));
      const tasks = [];
      for (const quadrant of state.model.data.quadrants || []) {
        for (const task of quadrant.items || []) {
          if (!normalizeDateValue(task.dueDate)) continue;
          const overdue = !task.done && daysUntil(task.dueDate) < 0;
          tasks.push({
            type: 'task',
            date: task.dueDate,
            title: task.text,
            meta: quadrant.title + (overdue ? ' · 已过期' : ''),
            quadrantId: quadrant.id,
            quadrantTitle: quadrant.title,
            taskId: task.id,
            done: Boolean(task.done),
            overdue,
            className: 'month-item ' + quadrant.id + (task.done ? ' done' : '') + (overdue ? ' overdue' : ''),
            sortWeight: task.done ? 80 : getQuadrantSortWeight(quadrant.id)
          });
        }
      }
      return events.concat(tasks);
    }
    function getQuadrantSortWeight(quadrantId) {
      return ({
        importantUrgent: 20,
        notImportantUrgent: 30,
        importantNotUrgent: 40,
        notImportantNotUrgent: 50
      })[quadrantId] || 60;
    }
    function getDefaultQuadrantForDate(dateKey) {
      const days = daysUntil(dateKey);
      return days <= 3 ? 'importantUrgent' : 'importantNotUrgent';
    }
    function daysUntil(dateKey) {
      const date = parseDateKey(dateKey);
      if (!date) return 99;
      return Math.round((date.getTime() - startOfDay(new Date()).getTime()) / 86400000);
    }
    function addDays(date, days) { const next = new Date(date); next.setDate(next.getDate() + days); return next; }
    function startOfDay(date) { return new Date(date.getFullYear(), date.getMonth(), date.getDate()); }
    function startOfWeek(date) { return addDays(startOfDay(date), -((date.getDay() + 6) % 7)); }
    function toDateKey(date) { return [date.getFullYear(), padDatePart(date.getMonth() + 1), padDatePart(date.getDate())].join('-'); }
    function isSameDate(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
    function weekdayName(date) { return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()]; }
    function formatDueDate(value, placeholder) {
      if (!value) return placeholder || '截止日';
      const date = parseDateKey(value);
      if (!date) return placeholder || '截止日';
      const days = Math.round((date.getTime() - startOfDay(new Date()).getTime()) / 86400000);
      if (days === 0) return '今天';
      if (days === 1) return '明天';
      if (days === -1) return '昨天';
      return String(date.getMonth() + 1) + '/' + String(date.getDate());
    }
    function formatShortDate(date) { return String(date.getMonth() + 1) + '/' + String(date.getDate()); }
    function formatFullDate(value) {
      const date = parseDateKey(value);
      if (!date) return value;
      return String(date.getFullYear()) + ' 年 ' + String(date.getMonth() + 1) + ' 月 ' + String(date.getDate()) + ' 日';
    }
    function formatCaptureTime(value) {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return '';
      const today = startOfDay(new Date());
      const target = startOfDay(date);
      const time = padDatePart(date.getHours()) + ':' + padDatePart(date.getMinutes());
      if (target.getTime() === today.getTime()) return time;
      return formatShortDate(date) + ' ' + time;
    }
    function formatQuickCaptureKind(kind) {
      return {
        note: '想法',
        task: '待办',
        link: '链接',
        code: '代码'
      }[kind] || '记录';
    }
    function formatTimeOfDay(value) {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return '';
      return padDatePart(date.getHours()) + ':' + padDatePart(date.getMinutes());
    }
    function formatClock(ms) {
      const seconds = Math.max(0, Math.ceil((Number(ms) || 0) / 1000));
      const minutes = Math.floor(seconds / 60);
      return String(minutes).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
    }
    function formatCompactDuration(ms) {
      const seconds = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
      const minutes = Math.floor(seconds / 60);
      if (minutes >= 60) return String(Math.floor(minutes / 60)) + 'h ' + String(minutes % 60) + 'm';
      if (minutes > 0) return String(minutes) + 'm';
      return String(seconds) + 's';
    }
    function truncateText(value, maxLength) {
      const text = String(value || '').replace(/\s+/g, ' ').trim();
      const limit = Math.max(1, Number(maxLength) || 20);
      return text.length > limit ? text.slice(0, limit - 1) + '…' : text;
    }
    function padDatePart(value) { return String(value).padStart(2, '0'); }
    function normalizeDateValue(value) { const text = String(value || '').trim(); return /^\\d{4}-\\d{2}-\\d{2}$/.test(text) ? text : ''; }
    function parseDateKey(value) {
      const normalized = normalizeDateValue(value);
      if (!normalized) return undefined;
      const parts = normalized.split('-').map((part) => Number.parseInt(part, 10));
      return new Date(parts[0], parts[1] - 1, parts[2]);
    }
    function formatBlockPosition(block) { return '列 ' + (block.col || '-') + ' · 行 ' + (block.row || '-') + ' · 宽 ' + (block.colSpan || 12) + ' · 高 ' + (block.rowSpan || 1); }
    function formatCollisionName(block) { return (block.title || getComponentDefinition(block.component).title || block.component) + '（' + (block.col || 1) + ',' + (block.row || 1) + '）'; }
    function formatMovedBlocks(blockIds) { return blockIds.map((blockId) => state.draftLayout.find((block) => block.id === blockId)).filter(Boolean).map(formatCollisionName).join('、'); }
    function clamp(value, min, max) { const number = Number.parseInt(value, 10); return Number.isNaN(number) ? min : Math.min(Math.max(number, min), max); }
    function summarizeModel(model) {
      const data = model && model.data ? model.data : {};
      return {
        ready: Boolean(model && model.ready),
        layout: Array.isArray(model && model.layout) ? model.layout.length : 0,
        items: Array.isArray(data.items) ? data.items.length : 0,
        favorites: Array.isArray(data.favorites) ? data.favorites.length : 0,
        recent: Array.isArray(data.recent) ? data.recent.length : 0,
        quickCaptures: Array.isArray(data.quickCaptures) ? data.quickCaptures.length : 0,
        countdowns: data.countdown && Array.isArray(data.countdown.items) ? data.countdown.items.length : 0,
        recommendations: data.nextAction && Array.isArray(data.nextAction.recommendations) ? data.nextAction.recommendations.length : 0,
        aiRecommendations: data.nextAction && Array.isArray(data.nextAction.aiRecommendations) ? data.nextAction.aiRecommendations.length : 0,
        graphNodes: data.knowledgeGraph && Array.isArray(data.knowledgeGraph.nodes) ? data.knowledgeGraph.nodes.length : 0,
        graphEdges: data.knowledgeGraph && Array.isArray(data.knowledgeGraph.edges) ? data.knowledgeGraph.edges.length : 0,
        quadrants: Array.isArray(data.quadrants) ? data.quadrants.length : 0
      };
    }
    function formatWebviewError(error) {
      if (!error) return { message: '未知错误' };
      return {
        message: error.message || String(error),
        stack: error.stack || ''
      };
    }

    function actionButton(text, action, secondary) {
      const result = button(text, undefined, secondary);
      result.dataset.action = action;
      return result;
    }
    function searchActionButton(icon, label, action, options) {
      const result = actionButton(icon, action, true);
      result.className = ['search-action', options && options.primary ? 'primary' : '', options && options.active ? 'active' : ''].filter(Boolean).join(' ');
      result.title = label;
      result.setAttribute('aria-label', label);
      return result;
    }
    function actionsWrap(buttons) { const wrap = div('designer-actions'); for (const item of buttons) wrap.appendChild(item); return wrap; }
    function button(text, onClick, secondary) { const result = document.createElement('button'); result.type = 'button'; result.textContent = text; if (secondary) result.className = 'secondary'; if (onClick) result.addEventListener('click', onClick); return result; }
    function div(className, text) { const result = document.createElement('div'); result.className = className; if (text !== undefined) result.textContent = text; return result; }
    function strongText(text) { const result = document.createElement('strong'); result.textContent = text; return result; }
    function spanText(text) { const result = document.createElement('span'); result.textContent = text; return result; }
    function empty(text) { return div('empty', text); }
    function fieldWrap(labelText, control) { const wrap = div('designer-field'); const label = document.createElement('label'); label.textContent = labelText; wrap.append(label, control); return wrap; }
    function inputField(labelText, value, type, onChange, min, max) { const input = document.createElement('input'); input.type = type; input.value = String(value ?? ''); if (min !== undefined) input.min = String(min); if (max !== undefined) input.max = String(max); input.addEventListener('change', () => onChange(input.value)); return fieldWrap(labelText, input); }
    function readonlyField(labelText, value) { return fieldWrap(labelText, div('template-name', value)); }

    requestModel('boot');
    const readyTimer = window.setInterval(() => {
      if (hasModel || readyAttempts >= 6) {
        window.clearInterval(readyTimer);
        if (!hasModel) {
          logToExtension('model still missing after retries', { attempts: readyAttempts });
        }
        return;
      }
      requestModel('retry');
    }, 1000);
  </script>
</body>
</html>`;
}

module.exports = {
  getWebviewHtml
};
