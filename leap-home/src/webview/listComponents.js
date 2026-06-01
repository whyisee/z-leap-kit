function getListComponentsScript() {
  return String.raw`    function renderItemList(container, items, emptyText, block, allowFavorite) {
      const list = div('list');
      const data = (items || []).slice(0, getLimit(block, 8));
      if (data.length === 0) list.appendChild(empty(emptyText));
      const favoritePaths = getFavoritePaths();
      for (const item of data) list.appendChild(itemRow(item, allowFavorite && favoritePaths.has(item.filePath)));
      container.appendChild(list);
    }

    function renderPromptList(container, block) {
      const list = div('list');
      const prompts = (state.model.data.prompts || []).slice(0, getLimit(block, 12));
      if (prompts.length === 0) list.appendChild(empty('还没有配置 Prompt 模板。'));
      for (const prompt of prompts) {
        const row = itemRow(prompt, false);
        const copy = actionButton('复制', 'copyPrompt', true);
        copy.dataset.filePath = prompt.filePath;
        row.querySelector('.item-actions').prepend(copy);
        list.appendChild(row);
      }
      container.appendChild(list);
    }

`;
}

module.exports = {
  getListComponentsScript
};
