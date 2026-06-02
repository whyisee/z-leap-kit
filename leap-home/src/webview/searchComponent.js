function getSearchStyles() {
  return String.raw`    .search-results {
      gap: 10px;
    }
    .block-body-search .stack {
      position: relative;
      z-index: 1;
    }
    .block-body-search .search-results[data-floating="true"] {
      position: relative;
      z-index: 40;
      max-height: min(560px, calc(100vh - 220px));
      border: 1px solid var(--vscode-panel-border);
      border-radius: 7px;
      margin-top: 2px;
      padding: 8px;
      overflow: auto;
      overscroll-behavior: auto;
      scrollbar-gutter: stable;
      background: var(--vscode-editorWidget-background, var(--vscode-sideBar-background));
      box-shadow: 0 10px 28px rgba(0, 0, 0, 0.22);
    }
    .search-input-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 6px;
      align-items: center;
    }
    .search-ai-button {
      min-width: 42px;
      height: 32px;
      min-height: 32px;
      border-color: var(--vscode-panel-border);
      padding: 0 9px;
      color: var(--vscode-textLink-foreground, var(--vscode-foreground));
      background: transparent;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0;
    }
    .search-ai-button:hover {
      color: var(--vscode-button-foreground);
      background: var(--vscode-button-background);
    }
    .search-command-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: -2px;
    }
    .search-command {
      min-height: 24px;
      height: 24px;
      min-width: 0;
      border-color: var(--vscode-panel-border);
      padding: 0 7px;
      color: var(--vscode-descriptionForeground);
      background: transparent;
      font-size: 11px;
    }
    .search-command:hover,
    .search-command.active {
      color: var(--vscode-button-foreground);
      background: var(--vscode-button-background);
    }
    .search-suggest {
      display: flex;
      flex-direction: column;
      gap: 3px;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
      padding: 4px;
      background: var(--vscode-editorWidget-background, var(--vscode-sideBar-background));
      box-shadow: 0 6px 18px rgba(0, 0, 0, 0.16);
    }
    .block-body-search .search-suggest {
      position: absolute;
      top: 38px;
      right: 50px;
      left: 0;
      z-index: 90;
      max-height: 210px;
      overflow: auto;
      overscroll-behavior: auto;
      scrollbar-gutter: stable;
    }
    .search-suggest[hidden] {
      display: none;
    }
    .search-suggest-item {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      gap: 8px;
      align-items: center;
      min-height: 26px;
      border-color: transparent;
      padding: 0 7px;
      color: var(--vscode-foreground);
      background: transparent;
      text-align: left;
    }
    .search-suggest-item:hover {
      background: var(--vscode-list-hoverBackground);
    }
    .search-suggest-item.selected {
      color: var(--vscode-list-activeSelectionForeground, var(--vscode-foreground));
      background: var(--vscode-list-activeSelectionBackground, var(--vscode-list-hoverBackground));
    }
    .search-suggest-desc {
      overflow: hidden;
      color: var(--vscode-descriptionForeground);
      font-size: 11px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .search-suggest-label {
      min-width: 0;
      overflow: hidden;
      font-weight: 600;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .search-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .search-group-title {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
      font-weight: 700;
    }
    .search-result {
      min-height: 0;
      align-items: start;
      transition: border-color 120ms ease, background-color 120ms ease;
    }
    .search-result.openable {
      cursor: pointer;
    }
    .search-result.openable:hover {
      border-color: var(--vscode-list-hoverForeground, var(--vscode-panel-border));
      background: var(--vscode-list-hoverBackground, var(--vscode-editor-background));
    }
    .search-result .item-actions {
      align-items: center;
      justify-content: flex-end;
      gap: 4px;
      padding-top: 1px;
      opacity: 0.28;
      transition: opacity 120ms ease;
    }
    .search-result:hover .item-actions,
    .search-result:focus-within .item-actions {
      opacity: 1;
    }
    .search-action {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      min-width: 28px;
      height: 28px;
      min-height: 28px;
      border-color: transparent;
      border-radius: 4px;
      padding: 0;
      color: var(--vscode-descriptionForeground);
      background: transparent;
      font-size: 15px;
      line-height: 1;
    }
    .search-action:hover {
      color: var(--vscode-foreground);
      background: var(--vscode-toolbar-hoverBackground, var(--vscode-list-hoverBackground));
    }
    .search-action.primary {
      color: var(--vscode-textLink-foreground, var(--vscode-focusBorder));
    }
    .search-action.active {
      color: var(--vscode-charts-yellow, var(--vscode-textLink-foreground));
      background: var(--vscode-toolbar-hoverBackground, transparent);
    }
    .search-ai-note {
      display: inline-flex;
      align-items: center;
      width: fit-content;
      max-width: 100%;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
      padding: 7px 8px;
      color: var(--vscode-descriptionForeground);
      background: var(--vscode-editor-background);
      font-size: 12px;
      cursor: help;
    }
    .search-ai-note strong {
      margin-right: 6px;
      color: var(--vscode-textLink-foreground, var(--vscode-foreground));
      font-weight: 700;
    }
    .search-ai-command {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .search-snippet {
      display: -webkit-box;
      overflow: hidden;
      margin-top: 5px;
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
      line-height: 1.35;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
    }
    .search-preview {
      display: none;
      margin-top: 8px;
      border-left: 2px solid var(--vscode-focusBorder);
      padding: 7px 8px;
      color: var(--vscode-foreground);
      background: var(--vscode-textCodeBlock-background, var(--vscode-editor-background));
      font-family: var(--vscode-editor-font-family, var(--vscode-font-family));
      font-size: 12px;
      line-height: 1.5;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
    .search-result:hover .search-preview,
    .search-result:focus-within .search-preview {
      display: block;
    }
    .search-hit {
      border-radius: 3px;
      padding: 0 2px;
      color: var(--vscode-editor-foreground);
      background: var(--vscode-editor-findMatchHighlightBackground, rgba(255, 214, 10, 0.32));
    }
    .reason-list {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-top: 6px;
    }
    .reason-chip {
      border: 1px solid var(--vscode-panel-border);
      border-radius: 999px;
      padding: 1px 6px;
      color: var(--vscode-descriptionForeground);
      background: var(--vscode-sideBar-background);
      font-size: 11px;
      line-height: 1.45;
    }
    .small-button {
      min-width: 44px;
      height: 28px;
      padding: 0 8px;
    }
`;
}

function getSearchScript() {
  return String.raw`    function renderSearch(container, block) {
      const stack = div('stack');
      const input = document.createElement('input');
      input.type = 'search';
      input.placeholder = tr('搜索代码、正文、标题、路径、Prompt');
      input.value = state.query;
      const results = div('list search-results');
      results.dataset.searchResults = 'true';
      results.dataset.limit = String(getLimit(block, 30));
      const suggestions = div('search-suggest');
      suggestions.hidden = true;
      const inputRow = div('search-input-row');
      const ai = button('AI', () => {
        state.query = input.value.trim();
        renderActiveSearchCommands(input.closest('.stack'));
        queueSearch(block, 0, true, true);
        renderSearchResults(results, block);
      }, true);
      ai.className = 'search-ai-button';
      ai.title = tr('用 DeepSeek 理解这次查询');
      ai.setAttribute('aria-label', tr('用 AI 搜索'));
      input.addEventListener('input', (event) => {
        state.query = event.target.value.trim();
        state.searchSuggestionIndex = -1;
        renderSearchSuggestions(suggestions, input, results, block);
        renderActiveSearchCommands(input.closest('.stack'));
        queueSearch(block);
        renderSearchResults(results, block);
      });
      input.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          if (!suggestions.hidden) {
            event.preventDefault();
            moveSearchSuggestion(suggestions, input, results, block, event.key === 'ArrowDown' ? 1 : -1);
          }
          return;
        }
        if (event.key === 'Escape') {
          suggestions.hidden = true;
          state.searchSuggestionIndex = -1;
          return;
        }
        if (event.key === 'Enter') {
          event.preventDefault();
          if (!event.shiftKey && useSelectedSearchSuggestion(suggestions)) {
            return;
          }
          state.query = input.value.trim();
          queueSearch(block, 0, event.shiftKey, true);
          renderSearchResults(results, block);
        }
      });
      input.addEventListener('keyup', () => {
        if (state.suppressSearchSuggestionOnce) {
          state.suppressSearchSuggestionOnce = false;
          return;
        }
        renderSearchSuggestions(suggestions, input, results, block);
      });
      input.addEventListener('click', () => renderSearchSuggestions(suggestions, input, results, block));
      input.addEventListener('blur', () => {
        window.setTimeout(() => { suggestions.hidden = true; }, 120);
      });
      inputRow.append(input, ai);
      stack.append(inputRow, suggestions, renderSearchCommandBar(input, results, block), results);
      container.appendChild(stack);
      renderSearchSuggestions(suggestions, input, results, block);
      renderSearchResults(results, block);
      if (state.query && state.search.responseQuery !== state.query && !state.search.loading) {
        queueSearch(block, 0);
      }
    }

    function renderSearchResults(container, block) {
      container.textContent = '';
      container.dataset.limit = String(getLimit(block, 30));
      container.dataset.floating = state.query ? 'true' : 'false';
      if (!state.query) return container.appendChild(empty(tr('输入关键词开始搜索代码、正文、标题、路径和 Prompt。')));
      if (state.search.error) {
        container.append(empty(tr('搜索失败：') + state.search.error), actionsWrap([actionButton('刷新索引', 'refresh', true)]));
        return;
      }
      if (state.search.loading || state.search.responseQuery !== state.query) {
        container.appendChild(empty(state.search.aiAttempted ? tr('正在使用 AI 理解查询并搜索...') : tr('正在搜索 Leap Home 索引...')));
        return;
      }
      const groups = state.search.groups || [];
      const searchNote = renderSearchNote();
      if (groups.length === 0) {
        const text = tr('没有匹配结果。当前索引 ') + String(state.search.indexedItems || 0) + tr(' 个文件、')
          + String(state.search.indexedEntities || 0) + tr(' 条 Leap 数据')
          + (state.search.sourceErrors ? tr('，') + String(state.search.sourceErrors) + tr(' 个知识源报错') : '')
          + (state.search.truncatedSources ? tr('，') + String(state.search.truncatedSources) + tr(' 个知识源已截断') : '')
          + tr('。');
        if (searchNote) {
          container.appendChild(searchNote);
        }
        container.append(empty(text), actionsWrap([actionButton('刷新索引', 'refresh', true)]));
        return;
      }
      if (searchNote) {
        container.appendChild(searchNote);
      }
      for (const group of groups) {
        container.appendChild(searchGroup(group));
      }
      if (state.search.total > getLimit(block, 30)) {
        container.appendChild(div('muted', tr('还有 ') + String(state.search.total - getLimit(block, 30)) + tr(' 条结果未展示，可在属性里调高显示数量。')));
      }
    }

    function renderSearchNote() {
      const effectiveQuery = String(state.search.effectiveQuery || '').trim();
      if (!effectiveQuery || effectiveQuery === state.query.trim()) {
        if (state.search.aiAttempted && state.search.aiReason) {
          const note = div('search-ai-note');
          note.title = tr('AI 没有生成新的搜索指令\\n原始查询：') + state.query.trim() + '\\n' + tr('说明：') + state.search.aiReason;
          note.append(strongText('AI'), div('search-ai-command', state.search.aiReason));
          return note;
        }
        return undefined;
      }
      const note = div('search-ai-note');
      note.title = [
        tr('AI 使用的搜索指令：') + effectiveQuery,
        tr('原始查询：') + state.query.trim(),
        state.search.aiReason ? tr('分析理由：') + state.search.aiReason : ''
      ].filter(Boolean).join('\\n');
      note.append(strongText('AI 指令'), div('search-ai-command', effectiveQuery));
      return note;
    }

    function renderSearchCommandBar(input, results, block) {
      const bar = div('search-command-bar');
      for (const command of getSearchCommands().filter((item) => item.visible !== false)) {
        const chip = button(command.label, () => {
          applySearchCommand(command.value, input, results, block);
        }, true);
        chip.className = isSearchCommandActive(command.value) ? 'search-command active' : 'search-command';
        chip.title = tr(command.title);
        bar.appendChild(chip);
      }
      return bar;
    }

    function renderSearchSuggestions(container, input, results, block) {
      container.textContent = '';
      const token = getActiveSearchToken(input.value, input.selectionStart || input.value.length);
      if (token && token.text.startsWith('@')) {
        renderSearchCommandSuggestions(container, token, input, results, block);
        return;
      }

      renderSearchHistorySuggestions(container, input, results, block);
    }

    function renderSearchCommandSuggestions(container, token, input, results, block) {
      const partial = token.text.toLowerCase();
      const matches = getSearchCommands()
        .filter((command) => command.value.startsWith(partial) || command.label.toLowerCase().includes(partial) || command.title.toLowerCase().includes(partial.slice(1)))
        .slice(0, 6);
      if (matches.length === 0) {
        container.hidden = true;
        state.searchSuggestionIndex = -1;
        return;
      }
      if (state.searchSuggestionIndex >= matches.length) {
        state.searchSuggestionIndex = -1;
      }

      for (const command of matches) {
        const index = matches.indexOf(command);
        const item = button('', () => {
          applySearchSuggestion(command.value, token, input, results, block, container);
        }, true);
        item.className = index === state.searchSuggestionIndex ? 'search-suggest-item selected' : 'search-suggest-item';
        item.addEventListener('mousedown', (event) => event.preventDefault());
        item.append(div('search-suggest-label', command.label), div('search-suggest-desc', tr(command.title)));
        container.appendChild(item);
      }
      container.hidden = false;
    }

    function renderSearchHistorySuggestions(container, input, results, block) {
      const query = String(input.value || '').trim().toLowerCase();
      if (!query) {
        container.hidden = true;
        state.searchSuggestionIndex = -1;
        return;
      }
      const history = Array.isArray(state.model.data.searchHistory) ? state.model.data.searchHistory : [];
      const matches = history
        .filter((item) => {
          return String(item.query || '').toLowerCase().includes(query) ||
            String(item.effectiveQuery || '').toLowerCase().includes(query);
        })
        .slice(0, 6);

      if (matches.length === 0) {
        container.hidden = true;
        state.searchSuggestionIndex = -1;
        return;
      }
      if (state.searchSuggestionIndex >= matches.length) {
        state.searchSuggestionIndex = -1;
      }

      for (let index = 0; index < matches.length; index += 1) {
        const entry = matches[index];
        const item = button('', () => {
          applySearchHistory(entry, input, results, block, container);
        }, true);
        item.className = index === state.searchSuggestionIndex ? 'search-suggest-item selected' : 'search-suggest-item';
        item.title = formatSearchHistoryTitle(entry);
        item.addEventListener('mousedown', (event) => event.preventDefault());
        item.append(
          div('search-suggest-label', entry.query),
          div('search-suggest-desc', formatSearchHistoryDescription(entry))
        );
        container.appendChild(item);
      }
      container.hidden = false;
    }

    function getActiveSearchToken(value, cursor) {
      const text = String(value || '');
      const position = Math.max(0, Math.min(cursor, text.length));
      const start = text.lastIndexOf(' ', Math.max(0, position - 1)) + 1;
      const nextSpace = text.indexOf(' ', position);
      const end = nextSpace === -1 ? text.length : nextSpace;
      const token = text.slice(start, end).trim();
      return token ? { start, end, text: token } : undefined;
    }

    function moveSearchSuggestion(container, input, results, block, direction) {
      const count = container.querySelectorAll('.search-suggest-item').length;
      if (count === 0) return;
      const current = state.searchSuggestionIndex;
      state.searchSuggestionIndex = current < 0
        ? (direction > 0 ? 0 : count - 1)
        : (current + direction + count) % count;
      renderSearchSuggestions(container, input, results, block);
      const selected = container.querySelector('.search-suggest-item.selected');
      if (selected) {
        selected.scrollIntoView({ block: 'nearest' });
      }
    }

    function useSelectedSearchSuggestion(container) {
      if (container.hidden || state.searchSuggestionIndex < 0) {
        return false;
      }
      const items = Array.from(container.querySelectorAll('.search-suggest-item'));
      const selected = items[state.searchSuggestionIndex];
      if (!selected) {
        return false;
      }
      state.suppressSearchSuggestionOnce = true;
      selected.click();
      return true;
    }

    function applySearchSuggestion(command, token, input, results, block, suggestions) {
      const current = input.value;
      const nextText = current.slice(0, token.start) + command + ' ' + current.slice(token.end).trimStart();
      const tokens = nextText.split(/\s+/).map((item) => item.trim()).filter(Boolean);
      state.query = normalizeSuggestedSearchTokens(tokens, command).join(' ');
      if (state.query) state.query += ' ';
      input.value = state.query;
      state.searchSuggestionIndex = -1;
      state.suppressSearchSuggestionOnce = true;
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
      renderSearchSuggestions(suggestions, input, results, block);
      renderActiveSearchCommands(input.closest('.stack'));
      queueSearch(block, 0);
      renderSearchResults(results, block);
    }

    function applySearchHistory(entry, input, results, block, suggestions) {
      state.query = String(entry.query || '').trim();
      input.value = state.query;
      state.searchSuggestionIndex = -1;
      state.suppressSearchSuggestionOnce = true;
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
      suggestions.hidden = true;
      const isAi = entry.mode === 'ai';
      const effectiveQuery = isAi && entry.effectiveQuery && entry.effectiveQuery !== entry.query
        ? entry.effectiveQuery
        : '';
      queueSearch(block, 0, isAi, true, effectiveQuery);
      renderSearchResults(results, block);
    }

    function formatSearchHistoryDescription(entry) {
      const mode = entry.mode === 'ai' ? 'AI' : tr('本地');
      const count = entry.count > 1 ? ' · ' + String(entry.count) + ' ' + tr('次') : '';
      const resultCount = Number.isFinite(Number(entry.resultCount)) ? ' · ' + String(entry.resultCount) + ' ' + tr('条') : '';
      return mode + resultCount + count;
    }

    function formatSearchHistoryTitle(entry) {
      const lines = [
        tr('搜索历史'),
        tr('原始查询：') + String(entry.query || ''),
        entry.mode === 'ai' && entry.effectiveQuery ? tr('AI 指令：') + entry.effectiveQuery : '',
        entry.reason ? tr('说明：') + entry.reason : ''
      ].filter(Boolean);
      return lines.join('\\n');
    }

    function normalizeSuggestedSearchTokens(tokens, command) {
      const lowerCommand = command.toLowerCase();
      const typeAliases = getSearchTypeCommandAliases();
      const isTypeCommand = typeAliases.has(lowerCommand);
      return tokens.filter((token, index) => {
        const lower = token.toLowerCase();
        if (lower.startsWith('@') && !getAllSearchCommandAliases().has(lower)) return false;
        if (isTypeCommand && typeAliases.has(lower) && lower !== lowerCommand) return false;
        if (lower === lowerCommand) return index === tokens.findIndex((item) => item.toLowerCase() === lowerCommand);
        return true;
      });
    }

    function getAllSearchCommandAliases() {
      return new Set(Array.from(getSearchTypeCommandAliases()).concat([
        '@project',
        '@current',
        '@favorite',
        '@favorites',
        '@fav',
        '@star',
        '@starred',
        '@recent',
        '@opened',
        '@latest',
        '@newest',
        '@oldest',
        '@todo',
        '@open',
        '@active',
        '@done',
        '@completed',
        '@today',
        '@week',
        '@month'
      ]));
    }

    function getSearchCommands() {
      return [
        { value: '@docs', label: '@docs', title: '只搜索文档', group: 'type' },
        { value: '@code', label: '@code', title: '只搜索代码和配置', group: 'type' },
        { value: '@prompt', label: '@prompt', title: '只搜索 Prompt', group: 'type' },
        { value: '@task', label: '@task', title: '只搜索四象限事项', group: 'type' },
        { value: '@calendar', label: '@calendar', title: '只搜索日历事件', group: 'type' },
        { value: '@inbox', label: '@inbox', title: '只搜索收集箱', group: 'type' },
        { value: '@project', label: '@project', title: '限定当前项目', group: 'scope' },
        { value: '@favorite', label: '@favorite', title: '只看收藏', group: 'scope', visible: false },
        { value: '@recent', label: '@recent', title: '只看最近打开', group: 'scope', visible: false },
        { value: '@latest', label: '@latest', title: '按最近更新优先', group: 'sort', visible: false },
        { value: '@oldest', label: '@oldest', title: '按最早更新优先', group: 'sort', visible: false },
        { value: '@todo', label: '@todo', title: '未完成四象限事项', group: 'status', visible: false },
        { value: '@done', label: '@done', title: '已完成四象限事项', group: 'status', visible: false },
        { value: '@today', label: '@today', title: '今天相关内容', group: 'date', visible: false },
        { value: '@week', label: '@week', title: '本周相关内容', group: 'date', visible: false },
        { value: '@month', label: '@month', title: '本月相关内容', group: 'date', visible: false }
      ];
    }

    function applySearchCommand(command, input, results, block) {
      const tokens = state.query.split(/\s+/).map((item) => item.trim()).filter(Boolean);
      const nextTokens = normalizeSearchCommandTokens(tokens, command);
      state.query = nextTokens.join(' ');
      if (state.query) state.query += ' ';
      input.value = state.query;
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
      renderActiveSearchCommands(input.closest('.stack'));
      queueSearch(block, 0);
      renderSearchResults(results, block);
    }

    function normalizeSearchCommandTokens(tokens, command) {
      const lowerCommand = command.toLowerCase();
      const commandGroup = getSearchCommandGroup(lowerCommand);
      const result = tokens.filter((token) => {
        const lower = token.toLowerCase();
        const group = getSearchCommandGroup(lower);
        if (group && group !== 'scope' && group === commandGroup) return false;
        if (group === 'scope' && lower === lowerCommand) return false;
        if (lowerCommand === '@project' && lower === '@current') return false;
        return true;
      });
      if (commandGroup === 'scope' && tokens.some((token) => token.toLowerCase() === lowerCommand || (lowerCommand === '@project' && token.toLowerCase() === '@current'))) {
        return result;
      }
      const insertIndex = commandGroup === 'type' ? 0 : Math.min(1, result.length);
      result.splice(insertIndex, 0, command);
      return result;
    }

    function getSearchTypeCommandAliases() {
      return new Set(['@doc', '@docs', '@document', '@documents', '@prompt', '@prompts', '@code', '@source', '@task', '@tasks', '@calendar', '@event', '@events', '@inbox']);
    }

    function getSearchCommandGroup(command) {
      const lower = String(command || '').toLowerCase();
      if (getSearchTypeCommandAliases().has(lower)) return 'type';
      if (['@todo', '@open', '@active', '@done', '@completed'].includes(lower)) return 'status';
      if (['@today', '@week', '@month'].includes(lower)) return 'date';
      if (['@latest', '@newest', '@oldest'].includes(lower)) return 'sort';
      if (['@project', '@current', '@favorite', '@favorites', '@fav', '@star', '@starred', '@recent', '@opened'].includes(lower)) return 'scope';
      return '';
    }

    function isSearchCommandActive(command) {
      const tokens = state.query.split(/\s+/).map((item) => item.trim().toLowerCase()).filter(Boolean);
      if (command === '@docs') return tokens.some((token) => ['@doc', '@docs', '@document', '@documents'].includes(token));
      if (command === '@prompt') return tokens.some((token) => ['@prompt', '@prompts'].includes(token));
      if (command === '@code') return tokens.some((token) => ['@code', '@source'].includes(token));
      if (command === '@task') return tokens.some((token) => ['@task', '@tasks'].includes(token));
      if (command === '@calendar') return tokens.some((token) => ['@calendar', '@event', '@events'].includes(token));
      if (command === '@inbox') return tokens.includes('@inbox');
      if (command === '@project') return tokens.some((token) => ['@project', '@current'].includes(token));
      if (command === '@favorite') return tokens.some((token) => ['@favorite', '@favorites', '@fav', '@star', '@starred'].includes(token));
      if (command === '@recent') return tokens.some((token) => ['@recent', '@opened'].includes(token));
      if (command === '@latest') return tokens.some((token) => ['@latest', '@newest'].includes(token));
      if (command === '@oldest') return tokens.includes('@oldest');
      if (command === '@todo') return tokens.some((token) => ['@todo', '@open', '@active'].includes(token));
      if (command === '@done') return tokens.some((token) => ['@done', '@completed'].includes(token));
      if (command === '@today') return tokens.includes('@today');
      if (command === '@week') return tokens.includes('@week');
      if (command === '@month') return tokens.includes('@month');
      return false;
    }

    function renderActiveSearchCommands(stack) {
      if (!stack) return;
      for (const chip of stack.querySelectorAll('.search-command')) {
        chip.classList.toggle('active', isSearchCommandActive(chip.textContent));
      }
    }

    function queueSearch(block, delay, useAi, recordHistory, effectiveQuery) {
      const query = state.query.trim();
      window.clearTimeout(state.searchTimer);
      state.search.requestedQuery = query;
      state.search.error = '';
      state.search.aiAttempted = Boolean(useAi);
      state.search.aiReason = useAi ? tr('正在使用 DeepSeek 理解查询...') : '';
      if (!query) {
        state.search.loading = false;
        state.search.responseQuery = '';
        state.search.effectiveQuery = '';
        state.search.aiAttempted = false;
        state.search.aiReason = '';
        state.search.groups = [];
        state.search.total = 0;
        return;
      }
      state.search.loading = true;
      state.searchTimer = window.setTimeout(() => {
        const requestId = state.search.requestId + 1;
        state.search.requestId = requestId;
        post('searchQuery', {
          requestId,
          query,
          limit: getLimit(block, 30),
          useAi: Boolean(useAi),
          recordHistory: Boolean(recordHistory || useAi),
          effectiveQuery: String(effectiveQuery || '')
        });
      }, delay === undefined ? 180 : delay);
    }

    function runSearchFromCommand(query) {
      state.query = String(query || '').trim();
      state.search.error = '';
      state.search.aiAttempted = false;
      state.search.aiReason = '';
      state.search.effectiveQuery = '';
      for (const input of document.querySelectorAll('input[type="search"]')) {
        input.value = state.query;
      }
      window.clearTimeout(state.searchTimer);
      const requestId = state.search.requestId + 1;
      state.search.requestId = requestId;
      state.search.loading = Boolean(state.query);
      renderSearchResultContainers();
      if (!state.query) {
        return;
      }
      post('searchQuery', {
        requestId,
        query: state.query,
        limit: 30,
        recordHistory: true
      });
    }

    function renderSearchResultContainers() {
      for (const container of document.querySelectorAll('[data-search-results="true"]')) {
        renderSearchResults(container, { options: { limit: container.dataset.limit || 30 } });
      }
    }

    function searchGroup(group) {
      const section = div('search-group');
      const head = div('search-group-title');
      head.append(div('search-group-name', tr(group.title)), div('count', String((group.items || []).length)));
      section.appendChild(head);
      for (const item of group.items || []) {
        section.appendChild(searchResultRow(item));
      }
      return section;
    }

    function searchResultRow(item) {
      const resultKey = getSearchResultKey(item);
      const highlightTerms = getSearchHighlightTerms();
      const row = div('item search-result');
      row.dataset.resultKey = resultKey;
      if (item.filePath) {
        row.classList.add('openable');
        row.title = tr('打开 ') + (item.relativePath || item.fileName || item.title);
        row.addEventListener('click', (event) => {
          if (event.target.closest('button, input, select, textarea')) return;
          post('openItem', Object.assign({ filePath: item.filePath }, item.line ? { line: item.line } : {}));
        });
      }
      const main = div('item-main');
      const title = div('item-title');
      appendHighlightedText(title, item.title || item.fileName, highlightTerms);
      title.title = item.filePath;
      const metaParts = searchResultMetaParts(item);
      if (item.heading) metaParts.push(item.heading);
      if (item.filePath && item.line) metaParts.push(tr('第 ') + String(item.line) + tr(' 行'));
      const meta = div('item-meta');
      appendHighlightedText(meta, metaParts.filter(Boolean).join(' · '), highlightTerms);
      main.append(title, meta);
      if (item.snippet) {
        const snippet = div('search-snippet');
        appendHighlightedText(snippet, localizeSearchResultSystemText(item.snippet), highlightTerms);
        main.appendChild(snippet);
      }
      if (item.preview) {
        const preview = div('search-preview');
        appendHighlightedText(preview, localizeSearchResultSystemText(item.preview), highlightTerms);
        main.appendChild(preview);
      }
      if (Array.isArray(item.reasons) && item.reasons.length > 0) {
        const reasons = div('reason-list');
        for (const reason of item.reasons.slice(0, 4)) {
          reasons.appendChild(div('reason-chip', tr(reason)));
        }
        main.appendChild(reasons);
      }
      const actions = div('item-actions');
      if (item.filePath) {
        const open = searchActionButton('↵', '打开', 'open', { primary: true });
        open.dataset.filePath = item.filePath;
        if (item.line) open.dataset.line = String(item.line);
        actions.appendChild(open);
      }
      if (item.isPrompt && item.filePath) {
        const copy = searchActionButton('⧉', '复制 Prompt', 'copyPrompt');
        copy.dataset.filePath = item.filePath;
        actions.appendChild(copy);
      }
      if (item.category === 'task' && !item.done) {
        const complete = searchActionButton('✓', '完成事项', 'completeTask');
        complete.dataset.quadrantId = item.quadrantId;
        complete.dataset.taskId = item.taskId;
        actions.appendChild(complete);
      }
      if (item.category !== 'task') {
        const task = searchActionButton('+', '加入待办', 'addTask');
        task.title = tr('加入四象限的重要不紧急');
        task.dataset.filePath = item.filePath || '';
        task.dataset.taskText = buildSearchTaskText(item);
        actions.appendChild(task);
      }
      if (item.filePath) {
        const isFavorite = getFavoritePaths().has(item.filePath);
        const favorite = searchActionButton(isFavorite ? '★' : '☆', isFavorite ? '取消收藏' : '收藏', 'favorite', {
          active: isFavorite
        });
        favorite.dataset.filePath = item.filePath;
        actions.appendChild(favorite);
      }
      row.append(main, actions);
      return row;
    }

    function searchResultMetaParts(item) {
      if (item.category === 'task') {
        const relative = String(item.relativePath || '');
        const parts = relative.split(' · ').map((part) => part.trim()).filter(Boolean);
        const date = parts.find((part) => /^\\d{4}-\\d{2}-\\d{2}$/.test(part));
        const quadrant = item.quadrantTitle || parts.find((part) => !/^\\d{4}-\\d{2}-\\d{2}$/.test(part)) || '';
        return [tr(item.sourceName || '四象限'), tr(quadrant), date];
      }
      return [tr(item.sourceName || ''), item.relativePath || item.fileName];
    }

    function localizeSearchResultSystemText(text) {
      let result = String(text || '');
      const replacements = [
        ['事项描述不完整，无法判断重要性和紧急性', tr('事项描述不完整，无法判断重要性和紧急性')],
        ['不重要不紧急', tr('不重要不紧急')],
        ['不重要紧急', tr('不重要紧急')],
        ['重要不紧急', tr('重要不紧急')],
        ['重要且紧急', tr('重要且紧急')],
        ['重要紧急', tr('重要紧急')],
        ['四象限', tr('四象限')],
        ['日历', tr('日历')],
        ['收集箱', tr('收集箱')],
        ['已完成', tr('已完成')],
        ['未完成', tr('未完成')]
      ];
      for (const [source, target] of replacements) {
        if (source && target && source !== target) {
          result = result.split(source).join(target);
        }
      }
      return result;
    }

    function buildSearchTaskText(item) {
      const target = item.heading ? item.title + ' / ' + item.heading : item.title;
      return tr('处理：') + target;
    }

    function getSearchResultKey(item) {
      return item.filePath || item.id || [item.category, item.title, item.relativePath].filter(Boolean).join(':');
    }

    function getSearchHighlightTerms() {
      const terms = new Set();
      for (const query of [state.search.effectiveQuery, state.query]) {
        for (const token of String(query || '').split(/\s+/).map((item) => item.trim()).filter(Boolean)) {
          const lower = token.toLowerCase();
          if (lower.startsWith('@') || lower.startsWith('recent:')) {
            continue;
          }
          if (lower.startsWith('path:')) {
            addHighlightTerm(terms, token.slice(5));
            continue;
          }
          if (lower.startsWith('title:') || lower.startsWith('source:') || lower.startsWith('ext:')) {
            addHighlightTerm(terms, token.slice(token.indexOf(':') + 1));
            continue;
          }
          if (/^(limit|top|sort|date|after|before|updated):/i.test(lower)) {
            continue;
          }
          if (lower.startsWith('#')) {
            addHighlightTerm(terms, token.slice(1));
            continue;
          }
          addHighlightTerm(terms, token);
        }
      }
      return Array.from(terms).sort((a, b) => b.length - a.length).slice(0, 10);
    }

    function addHighlightTerm(terms, value) {
      const term = String(value || '').trim();
      if (term) terms.add(term);
    }

    function appendHighlightedText(target, text, terms) {
      const value = String(text || '');
      const uniqueTerms = (terms || []).filter(Boolean);
      if (!value || uniqueTerms.length === 0) {
        target.textContent = value;
        return;
      }

      const expression = new RegExp(uniqueTerms.map(escapeRegExp).join('|'), 'gi');
      let lastIndex = 0;
      let match;
      while ((match = expression.exec(value)) !== null) {
        if (match.index > lastIndex) {
          target.appendChild(document.createTextNode(value.slice(lastIndex, match.index)));
        }
        const hit = document.createElement('mark');
        hit.className = 'search-hit';
        hit.textContent = match[0];
        target.appendChild(hit);
        lastIndex = match.index + match[0].length;
      }
      if (lastIndex < value.length) {
        target.appendChild(document.createTextNode(value.slice(lastIndex)));
      }
    }

    function escapeRegExp(value) {
      const slash = String.fromCharCode(92);
      const specials = new Set([slash, '|', '{', '}', '(', ')', '[', ']', '^', '$', '+', '*', '?', '.']);
      return String(value)
        .split('')
        .map((char) => specials.has(char) ? slash + char : char)
        .join('');
    }

`;
}

module.exports = {
  getSearchStyles,
  getSearchScript
};
