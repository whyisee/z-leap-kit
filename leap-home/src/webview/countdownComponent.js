function getCountdownStyles() {
  return String.raw`    .countdown {
      display: grid;
      gap: 8px;
    }
    .countdown-toolbar {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      align-items: center;
    }
    .countdown-toolbar-actions {
      display: flex;
      gap: 6px;
      align-items: center;
    }
    .countdown-add-button,
    .countdown-toggle-button {
      min-height: 24px;
      height: 24px;
      border-color: var(--vscode-panel-border);
      border-radius: 6px;
      padding: 0 8px;
      color: var(--vscode-descriptionForeground);
      background: transparent;
      font-size: 11px;
    }
    .countdown-add-button:hover,
    .countdown-toggle-button:hover,
    .countdown-toggle-button.active {
      color: var(--vscode-button-foreground);
      background: var(--vscode-button-background);
    }
    .countdown-hero,
    .countdown-item {
      --countdown-accent: var(--vscode-charts-blue, var(--vscode-focusBorder));
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 10px;
      align-items: center;
      border: 1px solid var(--vscode-sideBarSectionHeader-border, var(--vscode-panel-border));
      border-left: 3px solid var(--countdown-accent);
      border-radius: 7px;
      background:
        linear-gradient(90deg, color-mix(in srgb, var(--countdown-accent) 14%, transparent), transparent 44%),
        var(--vscode-editor-background);
    }
    .countdown-hero {
      min-height: 74px;
      padding: 10px 12px;
    }
    .countdown-item {
      min-height: 42px;
      padding: 7px 9px;
    }
    .countdown-item.done,
    .countdown-hero.done {
      opacity: 0.58;
    }
    .countdown-hero.overdue,
    .countdown-item.overdue {
      --countdown-accent: var(--vscode-charts-red, #d94b4b);
    }
    .countdown-hero.due-soon,
    .countdown-item.due-soon {
      --countdown-accent: var(--vscode-charts-yellow, #d7ba7d);
    }
    .countdown-hero.blue,
    .countdown-item.blue { --countdown-accent: var(--vscode-charts-blue, #3794ff); }
    .countdown-hero.green,
    .countdown-item.green { --countdown-accent: var(--vscode-charts-green, #89d185); }
    .countdown-hero.yellow,
    .countdown-item.yellow { --countdown-accent: var(--vscode-charts-yellow, #d7ba7d); }
    .countdown-hero.red,
    .countdown-item.red { --countdown-accent: var(--vscode-charts-red, #d94b4b); }
    .countdown-hero.purple,
    .countdown-item.purple { --countdown-accent: var(--vscode-charts-purple, #b180d7); }
    .countdown-title {
      overflow: hidden;
      font-weight: 700;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .countdown-meta {
      overflow: hidden;
      margin-top: 3px;
      color: var(--vscode-descriptionForeground);
      font-size: 11px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .countdown-value {
      color: var(--countdown-accent);
      font-size: 22px;
      font-weight: 800;
      line-height: 1.1;
      text-align: right;
      white-space: nowrap;
    }
    .countdown-side {
      display: grid;
      justify-items: end;
      gap: 5px;
    }
    .countdown-item .countdown-value {
      font-size: 13px;
      font-weight: 700;
    }
    .countdown-list {
      display: grid;
      gap: 6px;
    }
    .countdown-actions {
      display: flex;
      gap: 4px;
      opacity: 0;
      transition: opacity 120ms ease;
    }
    .countdown-hero:hover .countdown-actions,
    .countdown-hero:focus-within .countdown-actions,
    .countdown-item:hover .countdown-actions,
    .countdown-item:focus-within .countdown-actions {
      opacity: 1;
    }
    .countdown-actions button {
      min-height: 22px;
      height: 22px;
      border-color: var(--vscode-panel-border);
      border-radius: 5px;
      padding: 0 6px;
      background: transparent;
      font-size: 11px;
    }
    .countdown-form {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 132px 96px 96px auto auto;
      gap: 6px;
      align-items: start;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 7px;
      padding: 8px;
      background: var(--vscode-editor-background);
    }
    .countdown-form input,
    .countdown-form select {
      height: 28px;
      min-height: 28px;
      border-radius: 5px;
      font-size: 12px;
    }
    .countdown-form-note {
      grid-column: 1 / -1;
    }
    .countdown-form button {
      min-height: 28px;
      height: 28px;
      padding: 0 8px;
      font-size: 12px;
    }
`;
}

function getCountdownScript() {
  return String.raw`    function renderCountdown(container, block) {
      const wrap = div('countdown');
      const items = getCountdownItems();
      const doneCount = items.filter((item) => item.done).length;
      wrap.appendChild(countdownToolbar(items.length, doneCount));

      const editingItem = items.find((item) => item.id === state.countdownFormId);
      if (state.countdownFormId === 'new') {
        wrap.appendChild(countdownForm());
      } else if (editingItem) {
        wrap.appendChild(countdownForm(editingItem));
      }

      const limit = getLimit(block, 5);
      const displayPool = items
        .filter((item) => state.countdownShowDone || !item.done)
        .filter((item) => item.id !== state.countdownFormId);
      const visible = displayPool.slice(0, limit);
      if (visible.length === 0) {
        wrap.appendChild(empty(state.countdownShowDone ? tr('还没有倒计项。') : tr('没有进行中的倒计项。')));
        container.appendChild(wrap);
        return;
      }

      wrap.appendChild(countdownCard(visible[0], true));
      const rest = visible.slice(1);
      if (rest.length > 0) {
        const list = div('countdown-list');
        for (const item of rest) {
          list.appendChild(countdownCard(item, false));
        }
        wrap.appendChild(list);
      }
      if (displayPool.length > visible.length) {
        wrap.appendChild(div('muted', tr('还有 ') + String(displayPool.length - visible.length) + tr(' 个倒计项未展示')));
      }
      container.appendChild(wrap);
    }

    function countdownToolbar(total, doneCount) {
      const toolbar = div('countdown-toolbar');
      toolbar.appendChild(div('muted', total ? tr('最近节点') + ' ' + String(total - doneCount) : tr('重要节点')));
      const actions = div('countdown-toolbar-actions');
      if (doneCount > 0) {
        const done = button(state.countdownShowDone ? '隐藏已完成' : '完成', () => {
          state.countdownShowDone = !state.countdownShowDone;
          render();
        }, true);
        done.className = 'countdown-toggle-button' + (state.countdownShowDone ? ' active' : '');
        done.title = tr('切换已完成倒计项');
        actions.appendChild(done);
      }
      const add = button('+', () => {
        state.countdownFormId = state.countdownFormId === 'new' ? '' : 'new';
        render();
      }, true);
      add.className = 'countdown-add-button';
      add.title = tr('新增倒计日/时');
      actions.appendChild(add);
      toolbar.appendChild(actions);
      return toolbar;
    }

    function countdownCard(item, primary) {
      const card = div([
        primary ? 'countdown-hero' : 'countdown-item',
        item.color || 'blue',
        item.done ? 'done' : '',
        item.overdue ? 'overdue' : '',
        item.dueSoon ? 'due-soon' : ''
      ].filter(Boolean).join(' '));
      const main = div('countdown-main');
      main.append(div('countdown-title', item.title), div('countdown-meta', countdownMeta(item)));
      const side = div('countdown-side');
      side.append(div('countdown-value', item.label), countdownActions(item));
      card.append(main, side);
      return card;
    }

    function countdownActions(item) {
      const actions = div('countdown-actions');
      const done = button(item.done ? '恢复' : '完成', () => {
        post('toggleCountdownItem', { itemId: item.id, done: !item.done });
      }, true);
      const edit = button('编辑', () => {
        state.countdownFormId = item.id;
        render();
      }, true);
      const remove = button('删除', () => post('deleteCountdownItem', { itemId: item.id }), true);
      actions.append(done, edit, remove);
      return actions;
    }

    function countdownForm(item) {
      const form = div('countdown-form');
      const title = document.createElement('input');
      title.placeholder = tr('节点名称');
      title.value = item ? item.title : '';
      const date = document.createElement('input');
      date.type = 'date';
      date.value = item ? item.targetDate : '';
      const time = document.createElement('input');
      time.type = 'time';
      time.value = item ? item.targetTime : '';
      const color = document.createElement('select');
      for (const option of countdownColorOptions()) {
        const node = document.createElement('option');
        node.value = option.value;
        node.textContent = option.label;
        node.selected = option.value === (item ? item.color : 'blue');
        color.appendChild(node);
      }
      const save = button('保存', () => {
        const payload = {
          title: title.value,
          targetDate: date.value,
          targetTime: time.value,
          color: color.value,
          note: note.value
        };
        if (!payload.title.trim()) {
          title.focus();
          return;
        }
        if (!payload.targetDate) {
          date.focus();
          return;
        }
        post(item ? 'updateCountdownItem' : 'addCountdownItem', item ? { itemId: item.id, item: payload } : { item: payload });
        state.countdownFormId = '';
      }, false);
      const cancel = button('取消', () => {
        state.countdownFormId = '';
        render();
      }, true);
      const note = document.createElement('input');
      note.className = 'countdown-form-note';
      note.placeholder = tr('备注（可选）');
      note.value = item ? item.note : '';
      form.append(title, date, time, color, save, cancel, note);
      window.setTimeout(() => title.focus(), 0);
      return form;
    }

    function getCountdownItems() {
      const data = state.model.data.countdown || {};
      const items = Array.isArray(data.items) ? data.items : [];
      return items.map(addCountdownFields).filter(Boolean).sort(compareCountdownItems);
    }

    function addCountdownFields(item) {
      const target = getCountdownTarget(item);
      if (!target) return undefined;
      const now = new Date();
      const dateMode = !item.targetTime;
      const today = startOfLocalDay(now);
      const targetDay = startOfLocalDay(target);
      const dayDiff = Math.round((targetDay.getTime() - today.getTime()) / 86400000);
      const msDiff = dateMode ? targetDay.getTime() - today.getTime() : target.getTime() - now.getTime();
      const overdue = dateMode ? dayDiff < 0 : msDiff < 0;
      const dueSoon = !overdue && (dateMode ? dayDiff <= 1 : msDiff <= 24 * 60 * 60 * 1000);
      return Object.assign({}, item, {
        target,
        dayDiff,
        msDiff,
        overdue,
        dueSoon,
        label: formatCountdownLabel(item, dayDiff, msDiff)
      });
    }

    function compareCountdownItems(left, right) {
      if (left.done !== right.done) return left.done ? 1 : -1;
      if (left.overdue !== right.overdue) return left.overdue ? 1 : -1;
      const leftDistance = Math.abs(left.msDiff || 0);
      const rightDistance = Math.abs(right.msDiff || 0);
      return leftDistance - rightDistance || left.title.localeCompare(right.title);
    }

    function getCountdownTarget(item) {
      const date = parseDateKey(item.targetDate);
      if (!date) return undefined;
      if (item.targetTime) {
        const parts = String(item.targetTime).split(':').map((part) => Number.parseInt(part, 10));
        date.setHours(parts[0] || 0, parts[1] || 0, 0, 0);
      }
      return date;
    }

    function formatCountdownLabel(item, dayDiff, msDiff) {
      if (!item.targetTime) {
        if (dayDiff > 0) return isEnglishUI() ? String(dayDiff) + 'd' : String(dayDiff) + ' ' + tr('天');
        if (dayDiff === 0) return tr('今天');
        return isEnglishUI() ? String(Math.abs(dayDiff)) + 'd overdue' : tr('已过') + ' ' + String(Math.abs(dayDiff)) + ' ' + tr('天');
      }
      if (msDiff < 0) return tr('已过期');
      const minutes = Math.max(0, Math.ceil(msDiff / 60000));
      const days = Math.floor(minutes / 1440);
      const hours = Math.floor((minutes % 1440) / 60);
      if (days > 0) return isEnglishUI() ? String(days) + 'd ' + String(hours) + 'h' : String(days) + ' ' + tr('天') + ' ' + String(hours) + ' ' + tr('时');
      if (hours > 0) return isEnglishUI() ? String(hours) + 'h ' + String(minutes % 60) + 'm' : String(hours) + ' ' + tr('时') + ' ' + String(minutes % 60) + ' ' + tr('分');
      return isEnglishUI() ? String(Math.max(1, minutes)) + 'm' : String(Math.max(1, minutes)) + ' ' + tr('分钟');
    }

    function countdownMeta(item) {
      return [item.targetDate + (item.targetTime ? ' ' + item.targetTime : ''), item.note].filter(Boolean).join(' · ');
    }

    function countdownColorOptions() {
      return [
        { value: 'blue', label: tr('蓝色') },
        { value: 'green', label: tr('绿色') },
        { value: 'yellow', label: tr('黄色') },
        { value: 'red', label: tr('红色') },
        { value: 'purple', label: tr('紫色') }
      ];
    }

    function startOfLocalDay(date) {
      return new Date(date.getFullYear(), date.getMonth(), date.getDate());
    }

`;
}

module.exports = {
  getCountdownStyles,
  getCountdownScript
};
