function getQuadrantsStyles() {
  return String.raw`    .quadrant-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }
    .quadrant-ai {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 190px auto;
      gap: 8px;
      margin-bottom: 8px;
    }
    .quadrant-ai button {
      height: 32px;
    }
    .quadrant {
      --quadrant-accent: var(--vscode-focusBorder);
      --quadrant-tint: transparent;
      min-height: 88px;
      border: 1px solid var(--vscode-sideBarSectionHeader-border, var(--vscode-panel-border));
      border-left: 3px solid var(--quadrant-accent);
      border-radius: 6px;
      padding: 10px;
      background:
        linear-gradient(90deg, var(--quadrant-tint), transparent 44%),
        var(--vscode-editor-background);
      transition: border-color 120ms ease, background 120ms ease;
    }
    .quadrant.importantUrgent,
    .month-item.importantUrgent {
      --quadrant-accent: var(--vscode-charts-red, #d94b4b);
      --quadrant-tint: rgba(217, 75, 75, 0.1);
    }
    .quadrant.importantNotUrgent,
    .month-item.importantNotUrgent {
      --quadrant-accent: var(--vscode-charts-blue, #3794ff);
      --quadrant-tint: rgba(55, 148, 255, 0.1);
    }
    .quadrant.notImportantUrgent,
    .month-item.notImportantUrgent {
      --quadrant-accent: var(--vscode-charts-yellow, #d7ba7d);
      --quadrant-tint: rgba(215, 186, 125, 0.13);
    }
    .quadrant.notImportantNotUrgent,
    .month-item.notImportantNotUrgent {
      --quadrant-accent: var(--vscode-charts-green, #89d185);
      --quadrant-tint: rgba(137, 209, 133, 0.11);
    }
    .quadrant:hover,
    .quadrant:focus-within {
      border-color: var(--vscode-focusBorder);
    }
    .quadrant-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 8px;
    }
    .quadrant-title-wrap {
      display: flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
    }
    .quadrant-title-wrap::before {
      content: '';
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--quadrant-accent);
      flex: 0 0 auto;
    }
    .quadrant-title {
      font-size: 12px;
      font-weight: 700;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .completed-toggle {
      min-height: 22px;
      height: 22px;
      padding: 0 7px;
      color: var(--vscode-descriptionForeground);
      background: transparent;
      font-size: 11px;
      opacity: 0;
      pointer-events: none;
      transition: opacity 120ms ease;
    }
    .quadrant-head:hover .completed-toggle,
    .quadrant-head:focus-within .completed-toggle,
    .completed-toggle.active {
      opacity: 1;
      pointer-events: auto;
    }
    .completed-toggle.active {
      color: var(--vscode-button-foreground);
      background: var(--vscode-button-background);
    }
    .task-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .task {
      display: grid;
      grid-template-columns: 16px minmax(0, 1fr) 108px 20px;
      align-items: center;
      gap: 5px;
      min-height: 30px;
      border-radius: 5px;
      padding: 1px 2px;
      color: var(--vscode-foreground);
      font-size: 12px;
      transition: background 120ms ease;
    }
    .task:hover,
    .task:focus-within {
      background: var(--vscode-sideBar-background);
    }
    .task-check,
    .task-delete {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 16px;
      width: 16px;
      height: 16px;
      min-height: 16px;
      padding: 0;
      font-size: 10px;
      line-height: 1;
    }
    .task-check {
      border-radius: 50%;
      color: var(--vscode-button-foreground);
      background: transparent;
      border-color: var(--vscode-descriptionForeground);
    }
    .task.done .task-check {
      border-color: var(--vscode-button-background);
      background: var(--vscode-button-background);
    }
    .task-delete {
      border-radius: 4px;
      color: var(--vscode-descriptionForeground);
      background: transparent;
      opacity: 0;
      pointer-events: none;
      transition: opacity 120ms ease;
    }
    .task:hover .task-delete,
    .task:focus-within .task-delete {
      opacity: 1;
      pointer-events: auto;
    }
    .task-input {
      height: 28px;
      min-width: 0;
      border-color: transparent;
      padding: 0 6px;
      background: transparent;
    }
    .task-input:hover,
    .task-input:focus {
      border-color: var(--vscode-input-border, var(--vscode-focusBorder));
      background: var(--vscode-input-background);
    }
    .date-picker {
      position: relative;
      min-width: 0;
    }
    .date-pill {
      justify-content: flex-start;
      width: 100%;
      height: 28px;
      min-height: 28px;
      min-width: 0;
      border-color: transparent;
      padding: 0 8px;
      color: var(--vscode-descriptionForeground);
      background: transparent;
      font-size: 11px;
      text-align: left;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      opacity: 0.78;
    }
    .date-picker.empty-date .date-pill {
      opacity: 0;
      pointer-events: none;
    }
    .task:hover .date-picker.empty-date .date-pill,
    .task:focus-within .date-picker.empty-date .date-pill,
    .date-picker.open .date-pill,
    .date-picker:focus-within .date-pill {
      border-color: var(--vscode-input-border, var(--vscode-focusBorder));
      color: var(--vscode-input-foreground);
      background: var(--vscode-input-background);
      opacity: 1;
      pointer-events: auto;
    }
    .date-popover {
      display: none;
      position: absolute;
      top: 32px;
      right: 0;
      z-index: 20;
      width: 174px;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
      padding: 6px;
      background: var(--vscode-sideBar-background);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.22);
    }
    .date-picker.open .date-popover {
      display: block;
    }
    .date-quick {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-bottom: 6px;
    }
    .date-chip,
    .date-clear {
      min-height: 22px;
      height: 22px;
      min-width: 34px;
      padding: 0 5px;
      font-size: 10px;
    }
    .date-custom {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 6px;
    }
    .date-custom input {
      height: 24px;
      font-size: 11px;
    }
    .task.done .task-input {
      color: var(--vscode-descriptionForeground);
      text-decoration: line-through;
    }
    .task-readonly {
      display: grid;
      grid-template-columns: 12px minmax(0, 1fr);
      gap: 6px;
      font-size: 12px;
    }
    .task-readonly.done {
      color: var(--vscode-descriptionForeground);
      text-decoration: line-through;
    }
    .task-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      margin-top: 5px;
      background: var(--quadrant-accent, var(--vscode-charts-blue, var(--vscode-focusBorder)));
    }
    .quadrant-add {
      margin-top: 8px;
    }
    .quadrant-add-trigger-row {
      display: flex;
      justify-content: flex-end;
      min-height: 24px;
    }
    .quadrant-add-trigger {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 24px;
      width: 24px;
      min-height: 24px;
      height: 24px;
      padding: 0;
      border-radius: 50%;
      color: var(--vscode-descriptionForeground);
      background: transparent;
      font-size: 16px;
      line-height: 1;
    }
    .quadrant-add-trigger:hover,
    .quadrant-add-trigger:focus {
      color: var(--vscode-button-foreground);
      background: var(--vscode-button-background);
    }
    .quadrant-add-form {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(132px, 168px) auto auto;
      align-items: start;
      gap: 6px;
    }
    .quadrant-add-form input {
      height: 28px;
    }
    .quadrant-add-form button {
      min-height: 28px;
      height: 28px;
      padding: 0 8px;
    }
`;
}

function getQuadrantsScript() {
  return String.raw`    function renderFourQuadrants(container, block) {
      if (!state.designMode) {
        container.appendChild(quadrantAiForm());
      }
      const grid = div('quadrant-grid');
      const quadrants = state.model.data.quadrants || [];
      const limit = getLimit(block, 4);
      for (const quadrant of quadrants) {
        const card = div('quadrant ' + quadrant.id);
        const head = div('quadrant-head');
        const allItems = quadrant.items || [];
        const completedItems = allItems.filter((task) => task.done);
        const activeItems = allItems.filter((task) => !task.done);
        const showCompleted = Boolean(state.completedQuadrants[quadrant.id]);
        const titleWrap = div('quadrant-title-wrap');
        titleWrap.appendChild(div('quadrant-title', quadrant.title));
        if (!state.designMode && (completedItems.length > 0 || showCompleted)) {
          const toggle = button('已完成 ' + String(completedItems.length), () => {
            state.completedQuadrants[quadrant.id] = !showCompleted;
            render();
          }, true);
          toggle.className = showCompleted ? 'completed-toggle active' : 'completed-toggle';
          toggle.title = showCompleted ? '隐藏已完成事项' : '展示已完成事项';
          titleWrap.appendChild(toggle);
        }
        head.append(titleWrap, div('count', String(activeItems.length) + (completedItems.length ? '/' + String(allItems.length) : '')));
        card.appendChild(head);
        const list = div('task-list');
        const visibleItems = showCompleted ? completedItems : activeItems;
        const tasks = visibleItems.slice(0, limit);
        if (tasks.length === 0) {
          list.appendChild(div('muted', showCompleted ? '暂无已完成事项' : '暂无未完成事项'));
        }
        for (const task of tasks) {
          list.appendChild(state.designMode ? readonlyQuadrantTask(task) : editableQuadrantTask(quadrant.id, task));
        }
        if (visibleItems.length > tasks.length) {
          list.appendChild(div('muted', '+' + String(visibleItems.length - tasks.length) + ' 项'));
        }
        card.appendChild(list);
        if (!state.designMode) {
          card.appendChild(quadrantAddForm(quadrant.id));
        }
        grid.appendChild(card);
      }
      container.appendChild(grid);
    }

    function readonlyQuadrantTask(task) {
      const row = div(task.done ? 'task-readonly done' : 'task-readonly');
      if (task.reason) row.title = 'AI 归类理由：' + task.reason;
      row.append(div('task-dot'), div('task-text', task.dueDate ? task.text + ' · ' + task.dueDate : task.text));
      return row;
    }

    function editableQuadrantTask(quadrantId, task) {
      const row = div(task.done ? 'task done' : 'task');
      const check = button(task.done ? '✓' : '', () => {
        post('toggleQuadrantTask', { quadrantId, taskId: task.id, done: !task.done });
      }, true);
      check.className = 'task-check';
      check.title = task.done ? '标记为未完成' : '标记为完成';

      const input = document.createElement('input');
      input.className = 'task-input';
      input.value = task.text;
      input.title = task.reason ? 'AI 归类理由：' + task.reason : '修改事项内容';
      input.addEventListener('change', () => {
        const text = input.value.trim();
        if (text && text !== task.text) {
          post('updateQuadrantTask', { quadrantId, taskId: task.id, text });
        } else {
          input.value = task.text;
        }
      });
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') input.blur();
      });

      const date = datePicker(task.dueDate || '', (dueDate) => {
        post('updateQuadrantTask', { quadrantId, taskId: task.id, dueDate });
      }, '截止日');

      const remove = button('×', () => {
        post('deleteQuadrantTask', { quadrantId, taskId: task.id });
      }, true);
      remove.className = 'task-delete';
      remove.title = '删除事项';
      row.append(check, input, date, remove);
      return row;
    }

    function quadrantAiForm() {
      const wrap = div('quadrant-ai');
      const input = document.createElement('input');
      input.placeholder = '输入事项，AI 自动判断重要/紧急';
      const dueDate = inlineDateField();
      const add = button('AI 归类', commit, false);
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') commit();
      });
      wrap.append(input, dueDate, add);
      return wrap;

      function commit() {
        const text = input.value.trim();
        if (!text) return;
        post('aiAddQuadrantTask', { text, dueDate: dueDate.getValue() });
        input.value = '';
        dueDate.clearValue();
      }
    }

    function quadrantAddForm(quadrantId) {
      const wrap = div('quadrant-add');
      if (state.activeQuadrantAdd !== quadrantId) {
        const triggerRow = div('quadrant-add-trigger-row');
        const trigger = button('+', () => {
          state.activeQuadrantAdd = quadrantId;
          render();
          requestAnimationFrame(() => {
            const input = document.querySelector('[data-quadrant-add-input="' + quadrantId + '"]');
            if (input) input.focus();
          });
        }, true);
        trigger.className = 'quadrant-add-trigger';
        trigger.title = '添加事项';
        trigger.setAttribute('aria-label', '添加事项');
        triggerRow.appendChild(trigger);
        wrap.appendChild(triggerRow);
        return wrap;
      }

      const form = div('quadrant-add-form');
      const input = document.createElement('input');
      input.placeholder = '添加事项';
      input.dataset.quadrantAddInput = quadrantId;
      const dueDate = inlineDateField();
      const add = button('添加', commit, false);
      const cancel = button('取消', () => {
        state.activeQuadrantAdd = '';
        render();
      }, true);
      cancel.title = '收起添加事项';
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') commit();
        if (event.key === 'Escape') {
          state.activeQuadrantAdd = '';
          render();
        }
      });
      form.append(input, dueDate, add, cancel);
      wrap.appendChild(form);
      return wrap;

      function commit() {
        const text = input.value.trim();
        if (!text) return;
        state.activeQuadrantAdd = '';
        post('addQuadrantTask', { quadrantId, text, dueDate: dueDate.getValue() });
        input.value = '';
        dueDate.clearValue();
        render();
      }
    }

`;
}

module.exports = {
  getQuadrantsStyles,
  getQuadrantsScript
};
