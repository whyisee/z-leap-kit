function getCalendarComponentsStyles() {
  return String.raw`    .calendar-week {
      display: grid;
      grid-template-columns: repeat(7, minmax(0, 1fr));
      gap: 6px;
    }
    .week-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .week-title {
      font-size: 13px;
      font-weight: 700;
    }
    .week-nav {
      display: flex;
      gap: 4px;
    }
    .week-nav button {
      min-width: 28px;
      width: 28px;
      height: 26px;
      min-height: 26px;
      padding: 0;
    }
    .week-summary {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      color: var(--vscode-descriptionForeground);
      font-size: 11px;
    }
    .week-summary span {
      border: 1px solid var(--vscode-panel-border);
      border-radius: 999px;
      padding: 1px 7px;
      background: var(--vscode-editor-background);
    }
    .calendar-day {
      min-height: 96px;
      border: 1px solid var(--vscode-sideBarSectionHeader-border, var(--vscode-panel-border));
      border-radius: 6px;
      padding: 7px;
      background: var(--vscode-editor-background);
      overflow: hidden;
    }
    .calendar-day.today {
      border-color: var(--vscode-focusBorder);
      box-shadow: 0 0 0 1px var(--vscode-focusBorder) inset;
    }
    .calendar-day.selected {
      border-color: var(--vscode-button-background);
      background: var(--vscode-list-activeSelectionBackground, var(--vscode-editor-background));
    }
    .calendar-day.overdue {
      border-color: var(--vscode-inputValidation-errorBorder, var(--vscode-charts-red, #d94b4b));
    }
    .day-head {
      display: flex;
      justify-content: space-between;
      gap: 4px;
      margin-bottom: 6px;
      color: var(--vscode-descriptionForeground);
      font-size: 11px;
      white-space: nowrap;
    }
    .event-list {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .event-pill {
      overflow: hidden;
      border-radius: 4px;
      padding: 3px 5px;
      color: var(--vscode-badge-foreground);
      background: var(--vscode-badge-background);
      font-size: 11px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .week-items {
      display: flex;
      flex-direction: column;
      gap: 3px;
      min-width: 0;
    }
    .month-calendar {
      display: grid;
      grid-template-columns: repeat(7, minmax(0, 1fr));
      gap: 4px;
    }
    .month-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .month-title {
      font-size: 13px;
      font-weight: 700;
    }
    .month-nav {
      display: flex;
      gap: 4px;
    }
    .month-nav button {
      min-width: 28px;
      width: 28px;
      height: 26px;
      min-height: 26px;
      padding: 0;
    }
    .month-summary {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      color: var(--vscode-descriptionForeground);
      font-size: 11px;
    }
    .month-summary span {
      border: 1px solid var(--vscode-panel-border);
      border-radius: 999px;
      padding: 1px 7px;
      background: var(--vscode-editor-background);
    }
    .month-weekday,
    .month-cell {
      min-width: 0;
      text-align: center;
      font-size: 11px;
    }
    .month-weekday {
      color: var(--vscode-descriptionForeground);
      font-weight: 700;
    }
    .month-cell {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 3px;
      min-height: 58px;
      border: 1px solid transparent;
      border-radius: 5px;
      padding: 5px 4px;
      background: var(--vscode-editor-background);
      cursor: pointer;
    }
    .month-cell.outside {
      color: var(--vscode-disabledForeground, var(--vscode-descriptionForeground));
      opacity: 0.5;
    }
    .month-cell.today {
      border-color: var(--vscode-focusBorder);
    }
    .month-cell.selected {
      border-color: var(--vscode-button-background);
      background: var(--vscode-list-activeSelectionBackground, var(--vscode-sideBar-background));
    }
    .month-cell.has-events {
      border-color: var(--vscode-panel-border);
    }
    .month-cell.overdue {
      border-color: var(--vscode-inputValidation-errorBorder, var(--vscode-charts-red, #d94b4b));
    }
    .month-date {
      text-align: center;
      line-height: 1.1;
    }
    .month-items {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    .month-item {
      overflow: hidden;
      border-left: 2px solid var(--quadrant-accent, var(--vscode-badge-background));
      border-radius: 3px;
      padding: 1px 3px;
      color: var(--vscode-foreground);
      background: var(--quadrant-tint, var(--vscode-sideBar-background));
      text-align: left;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .month-item.calendar-event {
      border-left-color: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      background: var(--vscode-badge-background);
    }
    .month-item.done {
      color: var(--vscode-descriptionForeground);
      text-decoration: line-through;
      opacity: 0.78;
    }
    .month-item.overdue {
      border-left-color: var(--vscode-inputValidation-errorBorder, var(--vscode-charts-red, #d94b4b));
      background: rgba(217, 75, 75, 0.12);
    }
    .month-add-panel {
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
      padding: 8px;
      background: var(--vscode-editor-background);
    }
    .month-detail-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 8px;
    }
    .month-add-title {
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
      font-weight: 700;
    }
    .month-detail-list {
      display: flex;
      flex-direction: column;
      gap: 5px;
      margin-bottom: 8px;
    }
    .month-detail-item {
      display: grid;
      grid-template-columns: 18px minmax(0, 1fr);
      gap: 6px;
      align-items: start;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 5px;
      padding: 6px;
      background: var(--vscode-sideBar-background);
    }
    .month-detail-item.overdue {
      border-color: var(--vscode-inputValidation-errorBorder, var(--vscode-charts-red, #d94b4b));
    }
    .month-detail-item.done {
      color: var(--vscode-descriptionForeground);
    }
    .month-detail-check {
      width: 16px;
      min-width: 16px;
      height: 16px;
      min-height: 16px;
      border-radius: 50%;
      padding: 0;
      font-size: 10px;
      line-height: 1;
    }
    .month-detail-title {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .month-detail-item.done .month-detail-title {
      text-decoration: line-through;
    }
    .month-detail-meta {
      margin-top: 2px;
      color: var(--vscode-descriptionForeground);
      font-size: 11px;
    }
    .month-add-form {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 150px auto auto auto;
      gap: 6px;
      align-items: start;
    }
`;
}

function getCalendarComponentsScript() {
  return String.raw`    function renderWeekCalendar(container) {
      const today = startOfDay(new Date());
      const weekStart = addDays(startOfWeek(today), state.calendarWeekOffset * 7);
      const itemsByDate = groupCalendarItemsByDate(getMonthCalendarItems());
      const weekDates = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
      const weekItems = weekDates.reduce((result, date) => result.concat(itemsByDate[toDateKey(date)] || []), []);
      const wrap = div('stack');
      wrap.append(weekToolbar(weekStart), weekSummary(weekItems));
      const grid = div('calendar-week');
      for (const date of weekDates) {
        const key = toDateKey(date);
        const items = itemsByDate[key] || [];
        const day = div([
          'calendar-day',
          isSameDate(date, today) ? 'today' : '',
          state.selectedCalendarDate === key ? 'selected' : '',
          items.some((item) => item.overdue) ? 'overdue' : ''
        ].filter(Boolean).join(' '));
        const head = div('day-head');
        head.append(div('day-name', weekdayName(date)), div('day-date', String(date.getDate()) + (items.length ? ' · ' + String(items.length) : '')));
        day.appendChild(head);
        appendWeekItems(day, items, 4);
        if (!state.designMode) {
          day.addEventListener('click', () => {
            state.selectedCalendarDate = state.selectedCalendarDate === key ? '' : key;
            render();
          });
        }
        grid.appendChild(day);
      }
      wrap.appendChild(grid);
      if (!state.designMode && state.selectedCalendarDate) {
        wrap.appendChild(monthDetailPanel(state.selectedCalendarDate, itemsByDate[state.selectedCalendarDate] || []));
      }
      container.appendChild(wrap);
    }

    function weekToolbar(weekStart) {
      const weekEnd = addDays(weekStart, 6);
      const toolbar = div('week-toolbar');
      toolbar.appendChild(div('week-title', formatShortDate(weekStart) + ' - ' + formatShortDate(weekEnd)));
      if (!state.designMode) {
        const nav = div('week-nav');
        const prev = button('‹', () => {
          state.calendarWeekOffset -= 1;
          render();
        }, true);
        prev.title = tr('上周');
        const current = button('今', () => {
          state.calendarWeekOffset = 0;
          state.selectedCalendarDate = toDateKey(startOfDay(new Date()));
          render();
        }, true);
        current.title = tr('回到本周');
        const next = button('›', () => {
          state.calendarWeekOffset += 1;
          render();
        }, true);
        next.title = tr('下周');
        nav.append(prev, current, next);
        toolbar.appendChild(nav);
      }
      return toolbar;
    }

    function weekSummary(items) {
      const activeTasks = items.filter((item) => item.type === 'task' && !item.done);
      const overdue = getMonthCalendarItems().filter((item) => item.type === 'task' && item.overdue);
      const events = items.filter((item) => item.type === 'event');
      const summary = div('week-summary');
      summary.append(
        spanText(tr('本周事项') + ' ' + String(activeTasks.length)),
        spanText(tr('过期') + ' ' + String(overdue.length)),
        spanText(tr('事件') + ' ' + String(events.length))
      );
      return summary;
    }

    function appendWeekItems(container, items, limit) {
      const list = div('week-items');
      const visible = items.slice(0, limit);
      if (visible.length === 0) {
        list.appendChild(div('muted', tr('暂无安排')));
      }
      for (const item of visible) {
        const pill = div(item.className, item.title);
        pill.title = item.title;
        list.appendChild(pill);
      }
      if (items.length > visible.length) {
        list.appendChild(div('muted', '+' + String(items.length - visible.length) + ' ' + tr('项')));
      }
      container.appendChild(list);
    }

    function renderMonthCalendar(container) {
      const today = startOfDay(new Date());
      const visibleMonth = new Date(today.getFullYear(), today.getMonth() + state.calendarMonthOffset, 1);
      const itemsByDate = groupCalendarItemsByDate(getMonthCalendarItems());
      const monthStart = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
      const gridStart = startOfWeek(monthStart);
      const monthItems = getVisibleMonthItems(itemsByDate, visibleMonth);
      const wrap = div('stack');
      wrap.append(monthToolbar(visibleMonth), monthSummary(monthItems));
      const grid = div('month-calendar');
      const weekdays = isEnglishUI() ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] : ['一', '二', '三', '四', '五', '六', '日'];
      for (const name of weekdays) {
        grid.appendChild(div('month-weekday', name));
      }
      for (let index = 0; index < 42; index += 1) {
        const date = addDays(gridStart, index);
        const key = toDateKey(date);
        const items = itemsByDate[key] || [];
        const className = [
          'month-cell',
          date.getMonth() === visibleMonth.getMonth() ? '' : 'outside',
          isSameDate(date, today) ? 'today' : '',
          items.length > 0 ? 'has-events' : '',
          items.some((item) => item.overdue) ? 'overdue' : '',
          state.selectedCalendarDate === key ? 'selected' : ''
        ].filter(Boolean).join(' ');
        const cell = div(className);
        cell.appendChild(div('month-date', String(date.getDate())));
        if (items.length > 0) {
          cell.title = items.map((item) => item.title).join('\\n');
          appendMonthItems(cell, items, 2);
        }
        if (!state.designMode) {
          cell.addEventListener('click', () => {
            state.selectedCalendarDate = state.selectedCalendarDate === key ? '' : key;
            render();
          });
        }
        grid.appendChild(cell);
      }
      wrap.appendChild(grid);
      if (!state.designMode && state.selectedCalendarDate) {
        wrap.appendChild(monthDetailPanel(state.selectedCalendarDate, itemsByDate[state.selectedCalendarDate] || []));
      }
      container.appendChild(wrap);
    }

    function monthToolbar(visibleMonth) {
      const toolbar = div('month-toolbar');
      toolbar.appendChild(div('month-title', formatMonthTitle(visibleMonth)));
      if (!state.designMode) {
        const nav = div('month-nav');
        const prev = button('‹', () => {
          state.calendarMonthOffset -= 1;
          render();
        }, true);
        prev.title = tr('上月');
        const today = button('今', () => {
          state.calendarMonthOffset = 0;
          state.selectedCalendarDate = toDateKey(startOfDay(new Date()));
          render();
        }, true);
        today.title = tr('回到今天');
        const next = button('›', () => {
          state.calendarMonthOffset += 1;
          render();
        }, true);
        next.title = tr('下月');
        nav.append(prev, today, next);
        toolbar.appendChild(nav);
      }
      return toolbar;
    }

    function monthSummary(items) {
      const activeTasks = items.filter((item) => item.type === 'task' && !item.done);
      const overdue = activeTasks.filter((item) => item.overdue);
      const events = items.filter((item) => item.type === 'event');
      const summary = div('month-summary');
      summary.append(
        spanText(tr('事项') + ' ' + String(activeTasks.length)),
        spanText(tr('过期') + ' ' + String(overdue.length)),
        spanText(tr('事件') + ' ' + String(events.length))
      );
      return summary;
    }

    function appendMonthItems(container, items, limit) {
      const list = div('month-items');
      const visible = items.slice(0, limit);
      for (const item of visible) {
        const pill = div(item.className, item.title);
        pill.title = item.title;
        list.appendChild(pill);
      }
      if (items.length > visible.length) {
        list.appendChild(div('muted', '+' + String(items.length - visible.length)));
      }
      container.appendChild(list);
    }

    function monthDetailPanel(dateKey, items) {
      const panel = div('month-add-panel');
      const head = div('month-detail-head');
      head.appendChild(div('month-add-title', formatFullDate(dateKey)));
      const close = button('×', () => {
        state.selectedCalendarDate = '';
        render();
      }, true);
      close.title = tr('收起日期详情');
      head.appendChild(close);
      panel.appendChild(head);
      panel.appendChild(monthDetailList(items));
      const form = div('month-add-form');
      const input = document.createElement('input');
      input.placeholder = tr('事项内容');
      const quadrantSelect = document.createElement('select');
      const defaultQuadrant = getDefaultQuadrantForDate(dateKey);
      for (const quadrant of state.model.data.quadrants || []) {
        const option = document.createElement('option');
        option.value = quadrant.id;
        option.textContent = quadrant.title;
        option.selected = quadrant.id === defaultQuadrant;
        quadrantSelect.appendChild(option);
      }
      const add = button('添加', commit, false);
      const aiAdd = button('AI', commitWithAi, true);
      aiAdd.title = tr('AI 自动归类并添加到当天');
      const clear = button('清空', () => {
        input.value = '';
        input.focus();
      }, true);
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') commit();
        if (event.key === 'Escape') {
          input.value = '';
        }
      });
      form.append(input, quadrantSelect, add, aiAdd, clear);
      panel.appendChild(form);
      requestAnimationFrame(() => input.focus());
      return panel;

      function commit() {
        const text = input.value.trim();
        const quadrantId = quadrantSelect.value || defaultQuadrant;
        if (!text || !quadrantId) return;
        state.selectedCalendarDate = '';
        post('addQuadrantTask', { quadrantId, text, dueDate: dateKey });
        render();
      }

      function commitWithAi() {
        const text = input.value.trim();
        if (!text) return;
        input.value = '';
        post('aiAddQuadrantTask', { text, dueDate: dateKey });
        render();
      }
    }

    function monthDetailList(items) {
      const list = div('month-detail-list');
      if (!items || items.length === 0) {
        list.appendChild(div('muted', tr('当天暂无事项或事件')));
        return list;
      }
      for (const item of items) {
        list.appendChild(monthDetailItem(item));
      }
      return list;
    }

    function monthDetailItem(item) {
      const row = div(['month-detail-item', item.done ? 'done' : '', item.overdue ? 'overdue' : ''].filter(Boolean).join(' '));
      if (item.type === 'task') {
        const check = button(item.done ? '✓' : '', () => {
          post('toggleQuadrantTask', { quadrantId: item.quadrantId, taskId: item.taskId, done: !item.done });
        }, true);
        check.className = 'month-detail-check';
        check.title = item.done ? tr('标记为未完成') : tr('标记为完成');
        row.append(check, monthDetailMain(item));
        return row;
      }
      row.append(div('task-dot'), monthDetailMain(item));
      return row;
    }

    function monthDetailMain(item) {
      const main = div('month-detail-main');
      main.append(div('month-detail-title', item.title), div('month-detail-meta', item.meta || ''));
      return main;
    }

    function formatMonthTitle(date) {
      if (isEnglishUI()) {
        return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      }
      return String(date.getFullYear()) + ' 年 ' + String(date.getMonth() + 1) + ' 月';
    }

`;
}

module.exports = {
  getCalendarComponentsStyles,
  getCalendarComponentsScript
};
