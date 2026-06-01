function getNextActionStyles() {
  return String.raw`    .next-action {
      display: grid;
      gap: 8px;
    }
    .next-action-tabs {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      min-width: 0;
    }
    .next-action-tab-list {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 7px;
      padding: 2px;
      background: var(--vscode-editor-background);
    }
    .next-action-tab-button {
      min-height: 24px;
      height: 24px;
      border: 0;
      border-radius: 5px;
      padding: 0 8px;
      color: var(--vscode-descriptionForeground);
      background: transparent;
      font-size: 11px;
      font-weight: 700;
    }
    .next-action-tab-button.active {
      color: var(--vscode-button-foreground);
      background: var(--vscode-button-background);
    }
    .next-action-tab-button:not(.active):hover {
      color: var(--vscode-foreground);
      background: var(--vscode-toolbar-hoverBackground);
    }
    .next-action-tab-meta {
      overflow: hidden;
      color: var(--vscode-descriptionForeground);
      font-size: 11px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .next-action-panel {
      display: grid;
      gap: 7px;
      min-width: 0;
    }
    .next-action-ai-form {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 6px;
      align-items: center;
    }
    .next-action-ai-form input {
      width: 100%;
      height: 28px;
      min-height: 28px;
      border-radius: 6px;
      font-size: 12px;
    }
    .next-action-coach-note {
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
      padding: 6px 8px;
      color: var(--vscode-descriptionForeground);
      background: var(--vscode-editor-background);
      font-size: 11px;
      line-height: 1.45;
    }
    .next-action-ai-button {
      min-height: 24px;
      height: 24px;
      border-color: var(--vscode-panel-border);
      border-radius: 6px;
      padding: 0 9px;
      color: var(--vscode-textLink-foreground, var(--vscode-foreground));
      background: transparent;
      font-size: 11px;
      font-weight: 700;
    }
    .next-action-ai-button:hover {
      color: var(--vscode-button-foreground);
      background: var(--vscode-button-background);
    }
    .next-action-card {
      display: grid;
      gap: 7px;
      border: 1px solid var(--vscode-sideBarSectionHeader-border, var(--vscode-panel-border));
      border-left: 3px solid var(--next-accent, var(--vscode-focusBorder));
      border-radius: 7px;
      padding: 9px 10px;
      background:
        linear-gradient(90deg, color-mix(in srgb, var(--next-accent, var(--vscode-focusBorder)) 12%, transparent), transparent 44%),
        var(--vscode-editor-background);
    }
    .next-action-card.primary {
      min-height: 94px;
    }
    .next-action-card.do-now { --next-accent: var(--vscode-charts-red, #d94b4b); }
    .next-action-card.plan { --next-accent: var(--vscode-charts-blue, #3794ff); }
    .next-action-card.review { --next-accent: var(--vscode-charts-yellow, #d7ba7d); }
    .next-action-card.break { --next-accent: var(--vscode-charts-green, #89d185); }
    .next-action-card.insight { --next-accent: var(--vscode-charts-purple, #b180d7); }
    .next-action-card.idea { --next-accent: var(--vscode-charts-blue, #3794ff); }
    .next-action-card.microtask { --next-accent: var(--vscode-charts-green, #89d185); }
    .next-action-card.encouragement { --next-accent: var(--vscode-charts-yellow, #d7ba7d); }
    .next-action-card.ai {
      border-color: color-mix(in srgb, var(--next-accent, var(--vscode-focusBorder)) 54%, var(--vscode-panel-border));
    }
    .next-action-panel.system .next-action-card {
      border-left-color: var(--vscode-descriptionForeground);
      background: var(--vscode-editor-background);
    }
    .next-action-head {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 8px;
      align-items: start;
    }
    .next-action-title {
      overflow: hidden;
      font-weight: 800;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .next-action-card.primary .next-action-title {
      font-size: 15px;
    }
    .next-action-badge {
      border: 1px solid color-mix(in srgb, var(--next-accent, var(--vscode-focusBorder)) 62%, var(--vscode-panel-border));
      border-radius: 999px;
      padding: 1px 7px;
      color: var(--next-accent, var(--vscode-descriptionForeground));
      font-size: 10px;
      font-weight: 700;
      white-space: nowrap;
    }
    .next-action-reason {
      display: -webkit-box;
      overflow: hidden;
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
      line-height: 1.45;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
    }
    .next-action-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: center;
    }
    .next-action-actions button {
      min-height: 24px;
      height: 24px;
      border-radius: 6px;
      padding: 0 8px;
      font-size: 11px;
    }
    .next-action-secondary {
      display: grid;
      gap: 6px;
    }
    .next-action-empty {
      border: 1px dashed var(--vscode-panel-border);
      border-radius: 7px;
      padding: 9px;
      color: var(--vscode-descriptionForeground);
      background: var(--vscode-editor-background);
    }
`;
}

function getNextActionScript() {
  return String.raw`    function renderNextAction(container, block) {
      const wrap = div('next-action');
      const data = state.model.data.nextAction || {};
      const legacyRecommendations = Array.isArray(data.recommendations) ? data.recommendations : [];
      const systemRecommendations = Array.isArray(data.systemRecommendations)
        ? data.systemRecommendations
        : legacyRecommendations.filter((item) => !item.ai);
      const aiRecommendations = Array.isArray(data.aiRecommendations)
        ? data.aiRecommendations
        : legacyRecommendations.filter((item) => item.ai);
      const limit = getLimit(block, 4);
      const activeTab = state.nextActionTab === 'ai' ? 'ai' : 'system';
      wrap.appendChild(nextActionTabs({
        activeTab,
        systemCount: systemRecommendations.length,
        aiCount: aiRecommendations.length,
        ai: data.ai
      }));
      if (activeTab === 'ai') {
        const visible = aiRecommendations.slice(0, limit);
        wrap.appendChild(nextActionAiPanel(data, visible));
        recordNextActionImpressions(visible);
      } else {
        const visible = systemRecommendations.slice(0, limit);
        wrap.appendChild(nextActionPanel({
          items: visible,
          emptyTitle: '当前没有高优先级推荐',
          emptyReason: '可以先补充四象限事项、倒计节点，或把快速记录整理成明确任务。',
          className: 'system'
        }));
        recordNextActionImpressions(visible);
      }
      if (state.nextActionNotice) {
        wrap.appendChild(div('next-action-coach-note', state.nextActionNotice));
      }
      container.appendChild(wrap);
    }

    function nextActionTabs(options) {
      const tabs = div('next-action-tabs');
      const list = div('next-action-tab-list');
      list.append(
        nextActionTabButton('system', '系统推荐', options.systemCount, options.activeTab === 'system'),
        nextActionTabButton('ai', 'AI 建议', options.aiCount, options.activeTab === 'ai')
      );
      const ai = options.ai || {};
      const meta = options.activeTab === 'ai'
        ? (ai.generatedAt ? 'DeepSeek · ' + formatTimeOfDay(ai.generatedAt) : '可输入问题')
        : '本地规则 · ' + String(options.systemCount);
      tabs.append(list, div('next-action-tab-meta', meta));
      return tabs;
    }

    function nextActionTabButton(tab, label, count, active) {
      const control = button(label + ' ' + String(count || 0), () => {
        state.nextActionTab = tab;
        render();
      }, true);
      control.className = 'next-action-tab-button' + (active ? ' active' : '');
      control.setAttribute('aria-pressed', active ? 'true' : 'false');
      return control;
    }

    function recordNextActionImpressions(items) {
      const payload = (items || []).map(nextActionEventItem).filter(Boolean);
      const fresh = [];
      for (const item of payload) {
        const signature = [item.sourceKind, item.key, item.aiGeneratedAt || ''].join('|');
        if (state.nextActionSeen[signature]) continue;
        state.nextActionSeen[signature] = true;
        fresh.push(item);
      }
      if (fresh.length > 0) {
        post('nextActionImpressions', { items: fresh });
      }
    }

    function nextActionPanel(options) {
      const section = div('next-action-panel ' + (options.className || ''));
      if (!options.items || options.items.length === 0) {
        section.appendChild(nextActionEmpty(options.emptyTitle, options.emptyReason));
        return section;
      }
      section.appendChild(nextActionCard(options.items[0], true));
      if (options.items.length > 1) {
        const list = div('next-action-secondary');
        for (const item of options.items.slice(1)) {
          list.appendChild(nextActionCard(item, false));
        }
        section.appendChild(list);
      }
      return section;
    }

    function nextActionAiPanel(data, recommendations) {
      const section = div('next-action-panel ai');
      section.appendChild(nextActionAiQuestionForm(data && data.ai ? data.ai : {}));
      const coachNote = nextActionCoachNote(data);
      if (coachNote) section.appendChild(coachNote);
      if (!recommendations || recommendations.length === 0) {
        section.appendChild(nextActionEmpty('还没有 AI 建议', '输入你的问题，例如“帮我拆一下不想开始的任务”或“我现在应该先做什么”。'));
        return section;
      }
      section.appendChild(nextActionCard(recommendations[0], true));
      if (recommendations.length > 1) {
        const list = div('next-action-secondary');
        for (const item of recommendations.slice(1)) {
          list.appendChild(nextActionCard(item, false));
        }
        section.appendChild(list);
      }
      return section;
    }

    function nextActionAiQuestionForm(ai) {
      const form = document.createElement('form');
      form.className = 'next-action-ai-form';
      const input = document.createElement('input');
      input.type = 'text';
      input.value = state.nextActionQuestion || ai.question || '';
      input.placeholder = '问 AI：现在先做什么 / 帮我拆小任务';
      input.addEventListener('input', () => {
        state.nextActionQuestion = input.value;
      });
      const label = state.nextActionAiLoading ? '思考中...' : '提问';
      const trigger = button(label, () => requestNextActionAi(input.value), true);
      trigger.className = 'next-action-ai-button';
      trigger.disabled = state.nextActionAiLoading;
      trigger.title = ai.reason ? '上次 AI 理由：' + ai.reason : '让 DeepSeek 根据当前知识库和任务回答';
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        requestNextActionAi(input.value);
      });
      form.append(input, trigger);
      return form;
    }

    function requestNextActionAi(question) {
      if (state.nextActionAiLoading) return;
      state.nextActionQuestion = String(question || '').trim();
      state.nextActionTab = 'ai';
      state.nextActionAiLoading = true;
      render();
      post('nextActionAiRecommend', { question: state.nextActionQuestion });
    }

    function nextActionEmpty(title, reason) {
      const emptyState = div('next-action-empty');
      emptyState.append(
        div('next-action-title', title),
        div('next-action-reason', reason)
      );
      const actions = div('next-action-actions');
      actions.append(
        button('查看待办', () => runSearchFromCommand('@todo'), true),
        button('快速记录', () => post('openInbox'), true)
      );
      emptyState.appendChild(actions);
      return emptyState;
    }

    function nextActionCoachNote(data) {
      const ai = data && data.ai ? data.ai : {};
      const question = ai.question ? '问：' + ai.question : '';
      const text = [question, ai.summary, ai.encouragement].filter(Boolean).join(' · ');
      return text ? div('next-action-coach-note', text) : undefined;
    }

    function nextActionCard(item, primary) {
      const card = div(['next-action-card', primary ? 'primary' : '', item.type || 'plan', item.sourceType || '', item.ai ? 'ai' : ''].filter(Boolean).join(' '));
      const head = div('next-action-head');
      const title = div('next-action-title', item.title || '下一步行动');
      title.title = item.title || '';
      const badgeText = (item.ai ? 'AI · ' : '') + formatNextActionType(item.type, item.sourceType) + ' · ' + String(Math.max(0, Math.round(item.score || 0)));
      head.append(title, div('next-action-badge', badgeText));
      const reason = div('next-action-reason', item.reason || '根据当前上下文推荐。');
      if (item.aiReason) reason.title = 'AI 整体理由：' + item.aiReason;
      card.append(head, reason, nextActionButtons(item));
      return card;
    }

    function nextActionButtons(item) {
      const actions = div('next-action-actions');
      for (const action of item.actions || []) {
        actions.appendChild(nextActionButton(item, action));
      }
      const pin = button(item.pinned ? '取消置顶' : '置顶', () => {
        post('pinNextAction', { key: item.key, pinned: !item.pinned, item: nextActionEventItem(item) });
      }, true);
      pin.title = item.pinned ? '取消置顶这条推荐' : '置顶这条推荐';
      actions.appendChild(pin);
      if (!(item.actions || []).some((action) => action.type === 'dismiss')) {
        actions.appendChild(nextActionButton(item, { type: 'dismiss', label: '忽略' }));
      }
      return actions;
    }

    function nextActionButton(item, action) {
      const pending = Boolean(state.nextActionPending[nextActionActionKey(item, action)]);
      const control = button(pending ? '处理中...' : (action.label || formatNextActionButton(action.type)), () => handleNextAction(item, action), action.type !== 'startFocus');
      control.disabled = pending;
      control.title = action.query ? '搜索：' + action.query : '';
      return control;
    }

    function handleNextAction(item, action) {
      const actionKey = nextActionActionKey(item, action);
      if (state.nextActionPending[actionKey]) return;
      state.nextActionPending[actionKey] = true;
      state.nextActionNotice = '正在执行：' + (action.label || formatNextActionButton(action.type));
      render();
      const nextAction = {
        item: nextActionEventItem(item),
        action: nextActionEventAction(action)
      };
      if (action.type === 'startFocus') {
        post('focusTimerStart', {
          sessionType: 'focus',
          durationMs: action.durationMs,
          nextAction,
          task: {
            quadrantId: action.quadrantId || item.source && item.source.quadrantId,
            taskId: action.taskId || item.source && item.source.taskId,
            newTaskText: action.title || '',
            dueDate: action.dueDate || ''
          }
        });
        return;
      }
      if (action.type === 'startBreak') {
        post('focusTimerStart', { sessionType: action.sessionType || 'shortBreak', nextAction });
        return;
      }
      if (action.type === 'completeTask') {
        post('toggleQuadrantTask', {
          quadrantId: action.quadrantId || item.source && item.source.quadrantId,
          taskId: action.taskId || item.source && item.source.taskId,
          done: true,
          nextAction
        });
        return;
      }
      if (action.type === 'scheduleTask') {
        post('updateQuadrantTask', {
          quadrantId: action.quadrantId || item.source && item.source.quadrantId,
          taskId: action.taskId || item.source && item.source.taskId,
          dueDate: action.dueDate || '',
          nextAction
        });
        return;
      }
      if (action.type === 'completeCountdown') {
        post('toggleCountdownItem', {
          itemId: action.itemId || item.source && item.source.itemId,
          done: true,
          nextAction
        });
        return;
      }
      if (action.type === 'openInbox') {
        post('nextActionAdoption', nextAction);
        post('openInbox');
        state.nextActionNotice = '已打开收集箱';
        delete state.nextActionPending[actionKey];
        render();
        return;
      }
      if (action.type === 'createNote' || action.type === 'appendNote') {
        post('nextActionWriteNote', {
          action,
          nextAction
        });
        return;
      }
      if (action.type === 'search') {
        post('nextActionAdoption', nextAction);
        runSearchFromCommand(action.query || item.title || '');
        state.nextActionNotice = '已搜索：' + (action.query || item.title || '');
        delete state.nextActionPending[actionKey];
        render();
        return;
      }
      if (action.type === 'createTask') {
        post('addQuadrantTask', {
          quadrantId: action.quadrantId || 'importantNotUrgent',
          text: action.title || item.title || 'AI 建议事项',
          dueDate: action.dueDate || '',
          source: 'next-action-ai',
          reason: item.reason || 'AI 做什么推荐生成',
          nextAction
        });
        return;
      }
      if (action.type === 'dismiss') {
        post('dismissNextAction', { key: item.key, reason: 'not-now', item: nextActionEventItem(item) });
        return;
      }
      post('nextActionAdoption', nextAction);
      state.nextActionNotice = '暂不支持这个动作：' + (action.type || '未知');
      delete state.nextActionPending[actionKey];
      render();
    }

    function nextActionActionKey(item, action) {
      return [item && item.key || '', action && action.type || '', action && action.label || ''].join('|');
    }

    function nextActionEventItem(item) {
      if (!item || !item.key) return undefined;
      return {
        key: item.key,
        sourceKind: item.ai ? 'ai' : 'system',
        ai: Boolean(item.ai),
        type: item.type || '',
        title: item.title || '',
        score: item.score || 0,
        aiGeneratedAt: item.aiGeneratedAt || ''
      };
    }

    function nextActionEventAction(action) {
      return {
        type: action && action.type || '',
        label: action && action.label || ''
      };
    }

    function formatNextActionType(type, sourceType) {
      if (sourceType === 'microtask') return '小任务';
      if (sourceType === 'insight') return '洞察';
      if (sourceType === 'encouragement') return '鼓励';
      if (sourceType === 'idea') return '想法';
      return {
        'do-now': '现在做',
        plan: '安排',
        review: '整理',
        break: '休息'
      }[type] || '推荐';
    }

    function formatNextActionButton(type) {
      return {
        startFocus: '开始番茄',
        startBreak: '短休息',
        completeTask: '完成',
        scheduleTask: '安排',
        completeCountdown: '已完成',
        openInbox: '打开收集箱',
        createNote: '新建笔记',
        appendNote: '写入笔记',
        createTask: '加入待办',
        search: '查上下文',
        dismiss: '忽略'
      }[type] || '执行';
    }

`;
}

module.exports = {
  getNextActionStyles,
  getNextActionScript
};
