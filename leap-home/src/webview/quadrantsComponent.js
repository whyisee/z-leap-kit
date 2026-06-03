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
      grid-template-columns: 16px minmax(0, 1fr) 108px 24px 20px;
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
    .task.focus-flash {
      background: color-mix(in srgb, var(--quadrant-accent, var(--vscode-focusBorder)) 24%, var(--vscode-sideBar-background));
      box-shadow: 0 0 0 1px var(--quadrant-accent, var(--vscode-focusBorder)) inset;
    }
    .task-check,
    .task-delete,
    .task-doc-button {
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
    .task-doc-actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 2px;
      min-width: 0;
    }
    .task-doc-button {
      min-width: 22px;
      width: 22px;
      height: 22px;
      min-height: 22px;
      border-radius: 4px;
      border-color: transparent;
      padding: 0;
      color: var(--vscode-descriptionForeground);
      background: transparent;
      font-size: 11px;
      opacity: 0.78;
    }
    .task-doc-button:hover,
    .task-doc-button:focus {
      color: var(--vscode-button-foreground);
      background: var(--vscode-button-background);
      opacity: 1;
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
    .task-title-cell {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      align-items: center;
      gap: 4px;
      min-width: 0;
      overflow: hidden;
    }
    .task-title-cell .task-input {
      width: 100%;
      max-width: 100%;
      min-width: 42px;
      box-sizing: border-box;
    }
    .task-text {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .task-doc-label {
      display: inline-flex;
      align-items: center;
      justify-content: flex-start;
      width: 100%;
      min-width: 0;
      height: 24px;
      min-height: 24px;
      border-color: transparent;
      padding: 0 4px;
      color: var(--vscode-descriptionForeground);
      background: transparent;
      font-size: 11px;
      line-height: 18px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      opacity: 0.88;
    }
    .task-doc-label:hover,
    .task-doc-label:focus {
      color: var(--vscode-button-foreground);
      background: var(--vscode-button-background);
      opacity: 1;
    }
    .task-doc-label.empty {
      opacity: 0;
    }
    .task:hover .task-doc-label.empty,
    .task:focus-within .task-doc-label.empty {
      opacity: 0.62;
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
    .quadrant-add-main {
      display: grid;
      gap: 6px;
      min-width: 0;
    }
    .quadrant-add-note-actions {
      display: grid;
      gap: 6px;
      min-width: 0;
    }
    .quadrant-add-note-buttons {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      min-width: 0;
    }
    .quadrant-add-note-button {
      min-height: 24px;
      height: 24px;
      border-color: var(--vscode-panel-border);
      padding: 0 8px;
      color: var(--vscode-descriptionForeground);
      background: transparent;
      font-size: 11px;
    }
    .quadrant-add-note-button:hover,
    .quadrant-add-note-button:focus {
      color: var(--vscode-button-foreground);
      background: var(--vscode-button-background);
    }
    .quadrant-add-draft-links {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      min-width: 0;
    }
    .quadrant-add-draft-link {
      max-width: 100%;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 4px;
      padding: 2px 6px;
      color: var(--vscode-descriptionForeground);
      background: var(--vscode-sideBar-background);
      font-size: 11px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
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
          const toggle = button(tr('已完成') + ' ' + String(completedItems.length), () => {
            state.completedQuadrants[quadrant.id] = !showCompleted;
            render();
          }, true);
          toggle.className = showCompleted ? 'completed-toggle active' : 'completed-toggle';
          toggle.title = showCompleted ? tr('隐藏已完成事项') : tr('展示已完成事项');
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
      if (task.reason) row.title = tr('AI 归类理由：') + task.reason;
      row.append(div('task-dot'), readonlyTaskText(task));
      return row;
    }

    function readonlyTaskText(task) {
      const documentLabel = getTaskDocumentDisplayName(task);
      const wrap = div('task-title-cell');
      wrap.appendChild(div('task-text', task.dueDate ? task.text + ' · ' + task.dueDate : task.text));
      if (documentLabel) {
        const label = div('task-doc-label', '@' + documentLabel);
        label.title = tr('关联文档：') + documentLabel;
        wrap.appendChild(label);
      } else {
        wrap.appendChild(div('task-doc-label empty', '@' + tr('关联文档')));
      }
      return wrap;
    }

    function editableQuadrantTask(quadrantId, task) {
      const row = div(task.done ? 'task done' : 'task');
      row.dataset.quadrantTaskId = task.id || '';
      const check = button(task.done ? '✓' : '', () => {
        post('toggleQuadrantTask', { quadrantId, taskId: task.id, done: !task.done });
      }, true);
      check.className = 'task-check';
      check.title = task.done ? tr('标记为未完成') : tr('标记为完成');

      const input = document.createElement('input');
      input.className = 'task-input';
      input.dataset.quadrantTaskId = task.id || '';
      input.value = task.text;
      input.title = task.reason ? tr('AI 归类理由：') + task.reason : tr('修改事项内容');
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
      remove.title = tr('删除事项');
      row.append(check, taskTitleCell(quadrantId, input, task), date, taskDocumentActions(quadrantId, task), remove);
      return row;
    }

    function taskTitleCell(quadrantId, input, task) {
      const documentLabel = getTaskDocumentDisplayName(task);
      const wrap = div('task-title-cell');
      wrap.appendChild(input);
      const label = button(documentLabel ? '@' + documentLabel : '@' + tr('关联文档'), () => {
        post('selectQuadrantTaskDocumentAction', { quadrantId, taskId: task.id });
      }, true);
      label.className = documentLabel ? 'task-doc-label' : 'task-doc-label empty';
      label.title = documentLabel ? tr('关联文档：') + documentLabel : tr('关联或新建文档');
      label.setAttribute('aria-label', documentLabel ? tr('管理关联文档') : tr('关联或新建文档'));
      wrap.appendChild(label);
      return wrap;
    }

    function taskDocumentActions(quadrantId, task) {
      const wrap = div('task-doc-actions');
      const primary = getPrimaryTaskDocumentLink(task);
      if (primary && primary.filePath) {
        const openSource = button('↗', () => {
          post('openItem', Object.assign({ filePath: primary.filePath }, primary.line ? { line: primary.line } : {}));
        }, true);
        openSource.className = 'task-doc-button';
        openSource.title = tr('打开文档') + formatTaskLinkTitle(primary);
        openSource.setAttribute('aria-label', tr('打开文档'));
        wrap.appendChild(openSource);
      }
      return wrap;
    }

    function getTaskLink(task, role) {
      return (Array.isArray(task && task.links) ? task.links : []).find((link) => link && link.role === role && (link.filePath || link.relativePath));
    }

    function getTaskDocumentDisplayName(task) {
      const link = getPrimaryTaskDocumentLink(task);
      if (!link) return '';
      return cleanTaskDocumentDisplayName(link.title || link.relativePath || link.filePath || '');
    }

    function getPrimaryTaskDocumentLink(task) {
      return getTaskLink(task, 'output') || getTaskLink(task, 'source') || getTaskLink(task, 'reference');
    }

    function cleanTaskDocumentDisplayName(value) {
      const text = String(value || '').replace(/\\/g, '/').trim();
      if (!text) return '';
      const fileName = text.split('/').filter(Boolean).pop() || text;
      return fileName.replace(/\.(markdown|mdx|mdc|md)$/i, '').trim() || fileName;
    }

    function formatTaskLinkTitle(link) {
      const label = link && (link.title || link.relativePath || link.filePath);
      return label ? tr('：') + label : '';
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
      const draft = getQuadrantAddDraft(quadrantId);
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
        trigger.title = tr('添加事项');
        trigger.setAttribute('aria-label', tr('添加事项'));
        triggerRow.appendChild(trigger);
        wrap.appendChild(triggerRow);
        return wrap;
      }

      const form = div('quadrant-add-form');
      const main = div('quadrant-add-main');
      const input = document.createElement('input');
      input.placeholder = tr('添加事项');
      input.value = draft.text || '';
      input.dataset.quadrantAddInput = quadrantId;
      const dueDate = inlineDateField(draft.dueDate || '');
      const add = button('添加', commit, false);
      const cancel = button('取消', () => {
        state.activeQuadrantAdd = '';
        delete state.quadrantAddDrafts[quadrantId];
        render();
      }, true);
      cancel.title = tr('收起添加事项');
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') commit();
        if (event.key === 'Escape') {
          state.activeQuadrantAdd = '';
          render();
        }
      });
      main.append(input, quadrantAddNoteActions(quadrantId, input, dueDate));
      form.append(main, dueDate, add, cancel);
      wrap.appendChild(form);
      return wrap;

      function commit() {
        const text = input.value.trim();
        if (!text) return;
        const links = getQuadrantAddDraftLinks(quadrantId);
        const createOutputDocument = links.some((link) => link.role === 'output' && link.filePath);
        state.activeQuadrantAdd = '';
        delete state.quadrantAddDrafts[quadrantId];
        post('addQuadrantTask', { quadrantId, text, dueDate: dueDate.getValue(), links, createOutputDocument });
        input.value = '';
        dueDate.clearValue();
        render();
      }
    }

    function quadrantAddNoteActions(quadrantId, input, dueDate) {
      const wrap = div('quadrant-add-note-actions');
      const buttonRow = div('quadrant-add-note-buttons');
      const linkExisting = button('关联笔记', () => {
        const text = input.value.trim();
        if (!text) {
          input.focus();
          return;
        }
        saveQuadrantAddDraft(quadrantId, input, dueDate);
        clearQuadrantAddDraftIncompatibleLinks(quadrantId, 'source');
        render();
        post('pickQuadrantTaskExistingDocument', { quadrantId });
      }, true);
      linkExisting.className = 'quadrant-add-note-button';
      linkExisting.title = tr('搜索现有笔记并关联到这个事项');

      const createNote = button('创建笔记', () => {
        const text = input.value.trim();
        if (!text) {
          input.focus();
          return;
        }
        saveQuadrantAddDraft(quadrantId, input, dueDate);
        clearQuadrantAddDraftIncompatibleLinks(quadrantId, 'output');
        render();
        post('pickQuadrantTaskOutputDocument', { quadrantId, text, dueDate: dueDate.getValue() });
      }, true);
      createNote.className = 'quadrant-add-note-button';
      createNote.title = tr('创建事项并新建产出笔记');
      buttonRow.append(linkExisting, createNote);
      wrap.appendChild(buttonRow);
      const draftLinks = getQuadrantAddDraftLinks(quadrantId);
      if (draftLinks.length) {
        const links = div('quadrant-add-draft-links');
        for (const link of draftLinks) {
          links.appendChild(div('quadrant-add-draft-link', formatQuadrantAddDraftLink(link)));
        }
        wrap.appendChild(links);
      }
      return wrap;
    }

    function handleQuadrantAddDraftLink(message) {
      const quadrantId = message && message.quadrantId || state.activeQuadrantAdd || '';
      const link = message && message.link;
      if (!quadrantId || !link) return;
      const draft = getQuadrantAddDraft(quadrantId);
      draft.links = upsertQuadrantAddDraftLink(draft.links, link);
      state.quadrantAddDrafts[quadrantId] = draft;
      render();
      requestAnimationFrame(() => {
        const input = document.querySelector('[data-quadrant-add-input="' + quadrantId + '"]');
        if (input) input.focus();
      });
    }

    function getQuadrantAddDraft(quadrantId) {
      const draft = state.quadrantAddDrafts && state.quadrantAddDrafts[quadrantId];
      return draft && typeof draft === 'object' ? draft : { text: '', dueDate: '', links: [] };
    }

    function saveQuadrantAddDraft(quadrantId, input, dueDate) {
      const draft = getQuadrantAddDraft(quadrantId);
      draft.text = input.value.trim();
      draft.dueDate = dueDate.getValue();
      state.quadrantAddDrafts[quadrantId] = draft;
    }

    function getQuadrantAddDraftLinks(quadrantId) {
      const draft = getQuadrantAddDraft(quadrantId);
      return Array.isArray(draft.links) ? draft.links : [];
    }

    function clearQuadrantAddDraftIncompatibleLinks(quadrantId, role) {
      const draft = getQuadrantAddDraft(quadrantId);
      const links = Array.isArray(draft.links) ? draft.links : [];
      draft.links = role === 'output'
        ? links.filter((link) => link && link.role === 'output')
        : links.filter((link) => link && link.role !== 'output');
      state.quadrantAddDrafts[quadrantId] = draft;
    }

    function upsertQuadrantAddDraftLink(links, link) {
      const next = Array.isArray(links) ? links.slice() : [];
      const key = getQuadrantAddDraftLinkKey(link);
      const filtered = next.filter((item) => {
        if (link.role === 'output') return false;
        if (item.role === 'output') return false;
        if (item.role === link.role) return false;
        return getQuadrantAddDraftLinkKey(item) !== key;
      });
      filtered.push(link);
      return filtered.slice(0, 6);
    }

    function getQuadrantAddDraftLinkKey(link) {
      return [link && link.role || '', String(link && (link.filePath || link.relativePath || link.title) || '').toLowerCase()].join('|');
    }

    function formatQuadrantAddDraftLink(link) {
      const prefix = link.role === 'output' ? '将创建' : link.role === 'source' ? '将关联' : '参考';
      return tr(prefix) + tr('：') + (link.title || link.relativePath || link.filePath || tr('笔记'));
    }

`;
}

module.exports = {
  getQuadrantsStyles,
  getQuadrantsScript
};
