function getQuickCaptureStyles() {
  return String.raw`    .quick-capture-form {
      display: flex;
      flex-direction: column;
      gap: 7px;
    }
    .quick-capture-input {
      min-height: 78px;
      max-height: 180px;
    }
    .quick-capture-controls {
      display: grid;
      grid-template-columns: minmax(80px, 116px) minmax(126px, 160px) auto auto auto;
      gap: 6px;
      align-items: start;
    }
    .quick-capture-controls select,
    .quick-capture-controls button {
      height: 28px;
      min-height: 28px;
    }
    .quick-capture-controls button {
      padding: 0 8px;
    }
    .quick-capture-actions {
      display: flex;
      gap: 6px;
    }
    .quick-capture-recent {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    .quick-capture-recent-title {
      color: var(--vscode-descriptionForeground);
      font-size: 11px;
      font-weight: 700;
      line-height: 1;
    }
    .quick-capture-item {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      gap: 6px;
      align-items: center;
      min-height: 28px;
      border: 1px solid var(--vscode-sideBarSectionHeader-border, var(--vscode-panel-border));
      border-radius: 5px;
      padding: 4px 6px;
      background: var(--vscode-editor-background);
    }
    .quick-capture-kind {
      border: 1px solid var(--vscode-panel-border);
      border-radius: 999px;
      padding: 0 6px;
      color: var(--vscode-descriptionForeground);
      font-size: 10px;
      line-height: 18px;
      white-space: nowrap;
    }
    .quick-capture-text {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .quick-capture-meta {
      overflow: hidden;
      color: var(--vscode-descriptionForeground);
      font-size: 11px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
`;
}

function getQuickCaptureScript() {
  return String.raw`    function renderQuickCapture(container) {
      const stack = div('stack');
      const form = div('quick-capture-form');
      const input = document.createElement('textarea');
      input.className = 'quick-capture-input';
      input.placeholder = '记录想法、待办、链接或代码片段';
      const controls = div('quick-capture-controls');
      const kind = document.createElement('select');
      for (const option of [
        ['note', '想法'],
        ['task', '待办'],
        ['link', '链接'],
        ['code', '代码']
      ]) {
        const item = document.createElement('option');
        item.value = option[0];
        item.textContent = option[1];
        kind.appendChild(item);
      }
      const dueDate = inlineDateField();
      const save = button('保存', commit, false);
      save.title = '保存快速记录';
      const ai = button('AI', commitAi, true);
      ai.title = '用 AI 作为待办归类到四象限';
      const open = actionButton('收集箱', 'openInbox', true);
      open.title = '打开收集箱';
      kind.addEventListener('change', syncDateVisibility);
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
          event.preventDefault();
          commit();
        }
      });
      controls.append(kind, dueDate, save, ai, open);
      form.append(input, controls);
      stack.appendChild(form);
      const recent = quickCaptureRecentList();
      if (recent) stack.appendChild(recent);
      container.appendChild(stack);

      syncDateVisibility();

      function commit() {
        const text = input.value.trim();
        if (!text) {
          input.focus();
          return;
        }
        post('quickCaptureSave', {
          text,
          kind: kind.value,
          dueDate: dueDate.hidden ? '' : dueDate.getValue()
        });
        input.value = '';
        dueDate.clearValue();
      }

      function commitAi() {
        const text = input.value.trim();
        if (!text) {
          input.focus();
          return;
        }
        post('quickCaptureAi', {
          text,
          dueDate: dueDate.hidden ? '' : dueDate.getValue()
        });
        input.value = '';
        dueDate.clearValue();
      }

      function syncDateVisibility() {
        dueDate.hidden = kind.value !== 'task';
      }
    }

    function quickCaptureRecentList() {
      const recent = Array.isArray(state.model.data.quickCaptures) ? state.model.data.quickCaptures.slice(0, 4) : [];
      if (recent.length === 0) return undefined;
      const list = div('quick-capture-recent');
      list.appendChild(div('quick-capture-recent-title', '最近记录'));
      for (const item of recent) {
        const row = div('quick-capture-item');
        if (item.reason) row.title = item.reason;
        const kind = div('quick-capture-kind', formatQuickCaptureKind(item.kind));
        const text = div('quick-capture-text', String(item.text || '').replace(/\s+/g, ' '));
        const meta = div('quick-capture-meta', [
          item.label,
          item.dueDate,
          formatCaptureTime(item.createdAt)
        ].filter(Boolean).join(' · '));
        row.append(kind, text, meta);
        list.appendChild(row);
      }
      return list;
    }

`;
}

module.exports = {
  getQuickCaptureStyles,
  getQuickCaptureScript
};
