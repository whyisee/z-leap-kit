function getFocusTimerStyles() {
  return String.raw`    .focus-timer {
      display: grid;
      gap: 10px;
    }
    .focus-timer-head {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 76px 58px;
      gap: 12px;
      align-items: center;
    }
    .focus-main {
      display: grid;
      grid-template-columns: minmax(108px, 132px) minmax(0, 1fr);
      gap: 12px;
      align-items: center;
      min-width: 0;
    }
    .focus-main.active {
      grid-template-columns: minmax(0, 1fr);
    }
    .focus-time-panel {
      min-width: 0;
    }
    .focus-status {
      color: var(--vscode-descriptionForeground);
      font-size: 11px;
      font-weight: 700;
    }
    .focus-time {
      margin-top: 1px;
      font-size: 26px;
      font-weight: 700;
      line-height: 1.1;
      letter-spacing: 0;
    }
    .focus-duration-hero {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 6px;
      min-width: 0;
      margin-top: 1px;
    }
    .focus-duration-display {
      display: flex;
      align-items: baseline;
      gap: 4px;
      min-width: 0;
    }
    .focus-duration-input {
      width: 54px;
      height: 38px;
      border-color: transparent;
      padding: 0;
      color: var(--vscode-foreground);
      background: transparent;
      font-size: 34px;
      font-weight: 700;
      line-height: 1.1;
    }
    .focus-duration-input:hover,
    .focus-duration-input:focus {
      border-bottom-color: var(--vscode-focusBorder);
    }
    .focus-duration-input::-webkit-inner-spin-button,
    .focus-duration-input::-webkit-outer-spin-button {
      margin: 0;
      appearance: none;
    }
    .focus-duration-unit {
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
      font-weight: 700;
    }
    .focus-duration-presets {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
    }
    .focus-duration-preset {
      min-height: 24px;
      height: 24px;
      min-width: 34px;
      border-color: var(--vscode-panel-border);
      border-radius: 6px;
      padding: 0 7px;
      color: var(--vscode-descriptionForeground);
      background: transparent;
      font-size: 11px;
    }
    .focus-duration-preset.active {
      color: var(--vscode-button-foreground);
      background: var(--vscode-button-background);
    }
    .focus-task-binding {
      display: grid;
      gap: 7px;
      min-width: 0;
      border-left: 1px solid var(--vscode-panel-border);
      padding-left: 12px;
    }
    .focus-task-select,
    .focus-task-new-input,
    .focus-task-quadrant {
      min-height: 30px;
      height: 30px;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
      padding: 0 8px;
      color: var(--vscode-foreground);
      background: var(--vscode-input-background, var(--vscode-editor-background));
      font-size: 12px;
    }
    .focus-task-select {
      width: 100%;
    }
    .focus-task-new-input.invalid {
      border-color: var(--vscode-inputValidation-warningBorder, var(--vscode-focusBorder));
    }
    .focus-task-new {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(94px, 112px);
      gap: 8px;
      width: 100%;
    }
    .focus-task-new[hidden] {
      display: none;
    }
    .focus-linked-task {
      overflow: hidden;
      margin-top: 5px;
      color: var(--vscode-descriptionForeground);
      font-size: 11px;
      line-height: 1.25;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .focus-current-app {
      overflow: hidden;
      margin-top: 4px;
      color: var(--vscode-descriptionForeground);
      font-size: 10px;
      line-height: 1.2;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .focus-ring[data-focus-tooltip],
    .focus-history-item[data-focus-tooltip] {
      cursor: help;
    }
    .focus-detail-tooltip {
      position: fixed;
      z-index: 10000;
      max-width: min(360px, calc(100vw - 24px));
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
      padding: 8px 10px;
      color: var(--vscode-foreground);
      background: var(--vscode-editorWidget-background, var(--vscode-sideBar-background));
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
      font-size: 11px;
      line-height: 1.45;
      pointer-events: none;
      white-space: pre-line;
    }
    .focus-ring {
      display: grid;
      place-items: center;
      width: 58px;
      height: 58px;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 50%;
      color: var(--vscode-textLink-foreground, var(--vscode-foreground));
      background: conic-gradient(var(--vscode-progressBar-background, var(--vscode-focusBorder)) var(--focus-progress), var(--vscode-editor-background) 0);
      font-size: 11px;
      font-weight: 700;
    }
    .focus-ring-inner {
      display: grid;
      place-items: center;
      width: 46px;
      height: 46px;
      border-radius: 50%;
      background: var(--vscode-sideBar-background);
    }
    .focus-head-actions {
      display: flex;
      flex-direction: column;
      gap: 5px;
      align-items: stretch;
      min-width: 76px;
    }
    .focus-head-actions button {
      min-height: 30px;
      height: 30px;
      border-radius: 6px;
      padding: 0 9px;
      font-size: 12px;
    }
    .focus-metrics {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 0;
      border-top: 1px solid var(--vscode-panel-border);
      padding-top: 8px;
    }
    .focus-metric {
      border-right: 1px solid var(--vscode-panel-border);
      padding: 0 10px;
      background: transparent;
      min-width: 0;
    }
    .focus-metric:last-child { border-right: 0; }
    .focus-metric-value {
      overflow: hidden;
      font-weight: 700;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .focus-metric-label {
      color: var(--vscode-descriptionForeground);
      font-size: 10px;
      line-height: 1.2;
    }
    .focus-history {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .focus-history-title {
      color: var(--vscode-descriptionForeground);
      font-size: 10px;
      font-weight: 700;
      line-height: 1;
    }
    .focus-history-item {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      gap: 5px;
      align-items: center;
      border: 1px solid var(--vscode-sideBarSectionHeader-border, var(--vscode-panel-border));
      border-radius: 5px;
      padding: 4px 5px;
      background: var(--vscode-editor-background);
      font-size: 11px;
    }
    .focus-history-type {
      color: var(--vscode-descriptionForeground);
      font-weight: 700;
      white-space: nowrap;
    }
    .focus-history-main,
    .focus-history-meta {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .focus-history-meta {
      color: var(--vscode-descriptionForeground);
    }
    .focus-history-empty {
      border: 1px dashed var(--vscode-panel-border);
      border-radius: 5px;
      padding: 5px 6px;
      color: var(--vscode-descriptionForeground);
      font-size: 11px;
    }
`;
}

function getFocusTimerScript() {
  return String.raw`    function renderFocusTimer(container) {
      const focusTimer = state.model.data.focusTimer || {};
      if (!state.designMode && state.focusTimerHistoryVisible) {
        container.appendChild(focusTimerHistoryList(focusTimer.history || [], 8));
        return;
      }

      const timer = getFocusTimerSession();
      const wrap = div('focus-timer');
      const detailTitle = focusSessionTooltip(timer);
      const head = div('focus-timer-head');
      const duration = focusDurationControl((focusTimer.settings || {}).defaultFocusDurationMs || timer.durationMs || 1500000);
      const taskBinding = focusTaskBindingControl();
      const main = focusTimerMain(timer, duration, taskBinding);
      const ring = div('focus-ring');
      ring.style.setProperty('--focus-progress', String(timer.progress || 0) + '%');
      attachFocusTooltip(ring, detailTitle);
      ring.appendChild(div('focus-ring-inner', String(timer.progress || 0) + '%'));
      head.append(main, focusTimerActions(timer, duration, taskBinding), ring);
      wrap.appendChild(head);

      const metrics = div('focus-metrics');
      metrics.append(
        focusMetric('专注', formatCompactDuration(timer.focusedMs || 0)),
        focusMetric('外部', formatCompactDuration(timer.trustedExternalMs || 0)),
        focusMetric('离开', formatCompactDuration(timer.blurredMs || 0)),
        focusMetric('打断', String(timer.interruptions || 0))
      );
      wrap.appendChild(metrics);

      container.appendChild(wrap);
    }

    function focusTimerMain(timer, duration, taskBinding) {
      const setupMode = timer.status === 'idle' || timer.status === 'completed';
      const main = div('focus-main ' + (setupMode ? 'setup' : 'active'));
      const timePanel = div('focus-time-panel');
      timePanel.appendChild(div('focus-status', formatFocusStatus(timer)));
      if (setupMode) {
        timePanel.appendChild(duration.element);
        main.appendChild(timePanel);
        main.appendChild(taskBinding.element);
      } else {
        timePanel.appendChild(div('focus-time', formatClock(timer.remainingMs)));
        const taskLabel = focusTaskTitle(timer.task);
        if (taskLabel) {
          timePanel.appendChild(div('focus-linked-task', '事项 · ' + taskLabel));
        }
        const appLabel = focusCurrentAppLabel(timer);
        if (appLabel) {
          const app = div('focus-current-app', appLabel);
          timePanel.appendChild(app);
        }
        main.appendChild(timePanel);
      }
      return main;
    }

    function focusTimerActions(timer, duration, taskBinding) {
      const actions = div('focus-head-actions');
      if (timer.status === 'running') {
        actions.append(
          button('暂停', () => post('focusTimerPause'), true),
          button('终止', () => post('focusTimerReset'), true)
        );
        return actions;
      }
      if (timer.status === 'paused') {
        actions.append(button('继续', () => post('focusTimerResume'), false), button('终止', () => post('focusTimerReset'), true));
        return actions;
      }

      if (timer.status !== 'completed' || timer.type !== 'focus') {
        actions.append(button('开始', () => {
          if (!taskBinding.validate()) return;
          post('focusTimerStart', {
            durationMs: duration.getValue(),
            sessionType: 'focus',
            task: taskBinding.getValue(),
            saveDefaultDuration: true
          });
        }, false));
      }
      if (timer.status === 'completed' && timer.type === 'focus') {
        actions.append(
          button('短休息', () => post('focusTimerStart', { sessionType: 'shortBreak' }), false),
          button('长休息', () => post('focusTimerStart', { sessionType: 'longBreak' }), true),
          button('再专注', () => {
            if (!taskBinding.validate()) return;
            post('focusTimerStart', {
              durationMs: duration.getValue(),
              sessionType: 'focus',
              task: taskBinding.getValue(),
              saveDefaultDuration: true
            });
          }, true)
        );
      }
      if (timer.status === 'completed') {
        actions.appendChild(button('清空', () => post('focusTimerReset'), true));
      }
      return actions;
    }

    function focusDurationControl(durationMs) {
      const wrap = div('focus-duration-hero');
      const display = div('focus-duration-display');
      const input = document.createElement('input');
      input.className = 'focus-duration-input';
      input.type = 'number';
      input.min = '5';
      input.max = '240';
      input.step = '5';
      const minutes = Math.max(5, Math.round((Number(durationMs) || 1500000) / 60000));
      input.value = String(minutes);
      const unit = spanText('分钟');
      unit.className = 'focus-duration-unit';
      display.append(input, unit);
      const presets = div('focus-duration-presets');
      for (const value of [15, 25, 45, 60]) {
        const item = button(String(value), () => {
          input.value = String(value);
          syncPresetState();
        }, true);
        item.className = 'focus-duration-preset' + (value === minutes ? ' active' : '');
        item.title = String(value) + ' 分钟';
        presets.appendChild(item);
      }
      input.addEventListener('input', syncPresetState);
      wrap.append(display, presets);
      return {
        element: wrap,
        getValue() {
          const selected = Number(input.value);
          return Math.min(Math.max(Number.isFinite(selected) ? selected : 25, 5), 240) * 60000;
        }
      };

      function syncPresetState() {
        const selected = Number(input.value);
        for (const item of presets.querySelectorAll('.focus-duration-preset')) {
          item.classList.toggle('active', Number(item.textContent) === selected);
        }
      }
    }

    function focusTaskBindingControl() {
      const wrap = div('focus-task-binding');
      const tasks = getOpenFocusTasks();
      const select = document.createElement('select');
      select.className = 'focus-task-select';
      const none = document.createElement('option');
      none.value = '';
      none.textContent = '不关联事项';
      select.appendChild(none);
      for (const task of tasks.slice(0, 40)) {
        const option = document.createElement('option');
        option.value = task.quadrantId + '::' + task.id;
        option.textContent = truncateText(task.text, 22) + ' · ' + task.quadrantTitle;
        option.title = task.text;
        select.appendChild(option);
      }
      const create = document.createElement('option');
      create.value = '__new__';
      create.textContent = '+ 新建事项';
      select.appendChild(create);

      const newRow = div('focus-task-new');
      const input = document.createElement('input');
      input.className = 'focus-task-new-input';
      input.placeholder = '新事项内容';
      const quadrantSelect = document.createElement('select');
      quadrantSelect.className = 'focus-task-quadrant';
      for (const quadrant of state.model.data.quadrants || []) {
        const option = document.createElement('option');
        option.value = quadrant.id;
        option.textContent = quadrantShortTitle(quadrant.id);
        option.selected = quadrant.id === 'importantNotUrgent';
        quadrantSelect.appendChild(option);
      }
      newRow.append(input, quadrantSelect);
      wrap.append(select, newRow);
      select.addEventListener('change', syncNewTaskVisibility);
      syncNewTaskVisibility();
      return {
        element: wrap,
        getValue() {
          if (select.value === '__new__') {
            return {
              quadrantId: quadrantSelect.value || 'importantNotUrgent',
              newTaskText: input.value.trim()
            };
          }
          if (!select.value) {
            return {};
          }
          const parts = select.value.split('::');
          return {
            quadrantId: parts[0] || '',
            taskId: parts[1] || ''
          };
        },
        validate() {
          if (select.value !== '__new__' || input.value.trim()) {
            input.classList.remove('invalid');
            return true;
          }
          input.classList.add('invalid');
          input.focus();
          return false;
        }
      };

      function syncNewTaskVisibility() {
        newRow.hidden = select.value !== '__new__';
        if (!newRow.hidden) {
          window.setTimeout(() => input.focus(), 0);
        }
      }
    }

    function focusTimerHistoryList(history, limit) {
      const items = Array.isArray(history) ? history.slice(0, limit || 3) : [];
      const list = div('focus-history');
      list.appendChild(div('focus-history-title', '最近记录'));
      if (items.length === 0) {
        list.appendChild(div('focus-history-empty', '暂无记录'));
        return list;
      }
      for (const item of items) {
        const row = div('focus-history-item');
        const detailTitle = focusSessionTooltip(item);
        attachFocusTooltip(row, detailTitle);
        row.append(
          div('focus-history-type', formatFocusHistoryBadge(item)),
          div('focus-history-main', focusHistoryMain(item)),
          div('focus-history-meta', formatTimeOfDay(item.completedAt))
        );
        list.appendChild(row);
      }
      return list;
    }

    function getOpenFocusTasks() {
      const result = [];
      for (const quadrant of state.model.data.quadrants || []) {
        for (const task of quadrant.items || []) {
          if (task.done) continue;
          result.push(Object.assign({}, task, {
            quadrantId: quadrant.id,
            quadrantTitle: quadrant.title
          }));
        }
      }
      return result.sort((left, right) => {
        const leftDue = left.dueDate || '9999-99-99';
        const rightDue = right.dueDate || '9999-99-99';
        if (leftDue !== rightDue) return leftDue.localeCompare(rightDue);
        return getQuadrantSortWeight(left.quadrantId) - getQuadrantSortWeight(right.quadrantId);
      });
    }

    function focusTaskTitle(task) {
      return task && task.title ? task.title : '';
    }

    function focusCurrentAppLabel(timer) {
      if (!timer || timer.status !== 'running') return '';
      const app = String(timer.foregroundAppName || (timer.foregroundApp && timer.foregroundApp.name) || '').trim();
      if (timer.cursorFocused) {
        return app ? '当前 · ' + app : '';
      }
      if (timer.focused) {
        return app ? '外部专注 · ' + app : '外部专注';
      }
      return app ? '离开 · ' + app : '离开 Cursor';
    }

    function quadrantShortTitle(quadrantId) {
      return {
        importantUrgent: '重要紧急',
        importantNotUrgent: '重要不急',
        notImportantUrgent: '不重要紧急',
        notImportantNotUrgent: '不重要不急'
      }[quadrantId] || '四象限';
    }

    function focusMetric(label, value) {
      const item = div('focus-metric');
      item.append(div('focus-metric-value', value), div('focus-metric-label', label));
      return item;
    }

    let focusTooltipElement = undefined;
    function attachFocusTooltip(element, text) {
      if (!element || !text) return;
      element.dataset.focusTooltip = 'true';
      element.setAttribute('aria-label', text);
      element.addEventListener('mouseenter', (event) => showFocusTooltip(text, event));
      element.addEventListener('mousemove', (event) => positionFocusTooltip(event));
      element.addEventListener('mouseleave', hideFocusTooltip);
      element.addEventListener('blur', hideFocusTooltip);
    }
    function showFocusTooltip(text, event) {
      const tooltip = getFocusTooltipElement();
      tooltip.textContent = text;
      tooltip.hidden = false;
      positionFocusTooltip(event);
    }
    function hideFocusTooltip() {
      if (focusTooltipElement) {
        focusTooltipElement.hidden = true;
      }
    }
    function positionFocusTooltip(event) {
      if (!focusTooltipElement || focusTooltipElement.hidden || !event) return;
      const padding = 12;
      const rect = focusTooltipElement.getBoundingClientRect();
      const x = Math.min(window.innerWidth - rect.width - padding, event.clientX + 14);
      const y = Math.min(window.innerHeight - rect.height - padding, event.clientY + 14);
      focusTooltipElement.style.left = String(Math.max(padding, x)) + 'px';
      focusTooltipElement.style.top = String(Math.max(padding, y)) + 'px';
    }
    function getFocusTooltipElement() {
      if (!focusTooltipElement) {
        focusTooltipElement = div('focus-detail-tooltip');
        focusTooltipElement.hidden = true;
        document.body.appendChild(focusTooltipElement);
      }
      return focusTooltipElement;
    }

    function getFocusTimerSession() {
      const timer = state.model.data.focusTimer || {};
      const settings = timer.settings || {};
      const session = timer.activeSession || {};
      const durationMs = Number.isFinite(Number(session.durationMs))
        ? Number(session.durationMs)
        : Number.isFinite(Number(settings.defaultFocusDurationMs))
          ? Number(settings.defaultFocusDurationMs)
          : 1500000;
      const elapsedMs = Math.min(durationMs, (Number(session.focusedMs) || 0) + (Number(session.blurredMs) || 0));
      return Object.assign({
        id: '',
        type: 'focus',
        status: 'idle',
        durationMs,
        focused: false,
        cursorFocused: false,
        foregroundApp: {},
        foregroundAppName: '',
        foregroundAppTrusted: false,
        focusedMs: 0,
        strictFocusedMs: 0,
        blurredMs: 0,
        trustedExternalMs: 0,
        untrustedExternalMs: 0,
        idleMs: 0,
        interruptions: 0,
        appSwitches: 0,
        appUsage: {},
        topApps: [],
        activityEvents: 0,
        task: undefined,
        elapsedMs,
        remainingMs: Math.max(0, durationMs - elapsedMs),
        progress: durationMs > 0 ? Math.round((elapsedMs / durationMs) * 100) : 0
      }, session);
    }

    function formatFocusStatus(session) {
      if (session.status === 'running' && session.type === 'shortBreak') return '短休息中';
      if (session.status === 'running' && session.type === 'longBreak') return '长休息中';
      if (session.status === 'running' && session.focused && !session.cursorFocused) return '外部专注';
      if (session.status === 'running' && session.focused) return '专注中';
      if (session.status === 'running') return '已离开';
      if (session.status === 'paused') return '已暂停';
      if (session.status === 'completed') return formatFocusSessionType(session.type) + '完成';
      return '未开始';
    }
    function formatFocusSessionType(type) {
      return {
        focus: '专注',
        shortBreak: '短休息',
        longBreak: '长休息'
      }[type] || '专注';
    }
    function formatFocusHistoryBadge(item) {
      if (item && item.result === 'aborted') return '终止';
      return formatFocusSessionType(item && item.type);
    }
    function focusHistoryMain(item) {
      const taskPrefix = focusTaskTitle(item && item.task) ? truncateText(focusTaskTitle(item.task), 18) + ' · ' : '';
      const external = item && item.trustedExternalMs ? ' · 外部 ' + formatCompactDuration(item.trustedExternalMs) : '';
      if (item.result === 'aborted') {
        return taskPrefix + '已进行 ' + formatCompactDuration(getFocusHistoryElapsed(item)) + external;
      }
      if (item.type === 'focus') {
        return taskPrefix + '专注 ' + formatCompactDuration(item.focusedMs || 0) + external + ' · 打断 ' + String(item.interruptions || 0);
      }
      return '完成 ' + formatCompactDuration(item.durationMs || 0);
    }
    function focusSessionTooltip(item) {
      if (!item) return '';
      const lines = [];
      const title = item.result === 'aborted'
        ? '番茄记录 · 已终止'
        : item.status
          ? '番茄时钟 · ' + formatFocusStatus(item)
          : '番茄记录 · ' + formatFocusSessionType(item.type);
      lines.push(title);
      const taskTitle = focusTaskTitle(item.task);
      if (taskTitle) lines.push('事项：' + taskTitle);
      if (item.status === 'running') {
        const currentApp = String(item.foregroundAppName || (item.foregroundApp && item.foregroundApp.name) || '').trim();
        if (currentApp) lines.push('当前应用：' + currentApp + (item.foregroundAppTrusted ? '（计入专注）' : '（未计入专注）'));
      }
      if (item.startedAt) lines.push('开始：' + formatDateTime(item.startedAt));
      if (item.completedAt) lines.push('结束：' + formatDateTime(item.completedAt));
      lines.push('目标：' + formatCompactDuration(item.durationMs || 0));
      lines.push('已进行：' + formatCompactDuration(getFocusHistoryElapsed(item)));
      lines.push('专注合计：' + formatCompactDuration(item.focusedMs || 0));
      lines.push('编辑器内：' + formatCompactDuration(getFocusEditorMs(item)));
      lines.push('外部专注：' + formatCompactDuration(item.trustedExternalMs || 0));
      lines.push('离开：' + formatCompactDuration(item.blurredMs || 0));
      if (item.untrustedExternalMs) lines.push('非可信应用：' + formatCompactDuration(item.untrustedExternalMs));
      if (item.idleMs) lines.push('空闲：' + formatCompactDuration(item.idleMs));
      lines.push('打断：' + String(item.interruptions || 0) + ' 次');
      if (item.appSwitches) lines.push('应用切换：' + String(item.appSwitches) + ' 次');
      const appLines = focusAppUsageLines(item);
      if (appLines.length) {
        lines.push('');
        lines.push('应用用时：');
        lines.push(...appLines);
      }
      return lines.filter(Boolean).join('\n');
    }
    function getFocusEditorMs(item) {
      return Math.max(0, (Number(item && item.focusedMs) || 0) - (Number(item && item.trustedExternalMs) || 0));
    }
    function focusAppUsageLines(item) {
      return getFocusAppUsage(item).map((app) => '- ' + app.name + '：' + formatCompactDuration(app.ms));
    }
    function getFocusAppUsage(item) {
      if (item && Array.isArray(item.topApps) && item.topApps.length) {
        return item.topApps
          .map((app) => ({
            name: String(app.name || '').trim(),
            ms: Number(app.ms) || 0
          }))
          .filter((app) => app.name && app.ms > 0);
      }
      const usage = item && item.appUsage && typeof item.appUsage === 'object' ? item.appUsage : {};
      return Object.keys(usage)
        .map((name) => ({ name, ms: Number(usage[name]) || 0 }))
        .filter((app) => app.name && app.ms > 0)
        .sort((left, right) => right.ms - left.ms || left.name.localeCompare(right.name))
        .slice(0, 8);
    }
    function getFocusHistoryElapsed(item) {
      return Math.min(item.durationMs || 0, (item.focusedMs || 0) + (item.blurredMs || 0));
    }
    function formatDateTime(value) {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return '';
      return String(date.getFullYear()) + '-' + padDatePart(date.getMonth() + 1) + '-' + padDatePart(date.getDate()) + ' ' + padDatePart(date.getHours()) + ':' + padDatePart(date.getMinutes());
    }
`;
}

module.exports = {
  getFocusTimerScript,
  getFocusTimerStyles
};
