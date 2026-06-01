function getStatsStyles() {
  return String.raw`    .stats-grid {
      display: grid;
      grid-template-columns: repeat(6, minmax(0, 1fr));
      gap: 4px;
    }
    .stats-section {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
    .stats-section-title {
      color: var(--vscode-descriptionForeground);
      font-size: 10px;
      font-weight: 700;
      line-height: 1;
    }
    .stat {
      border: 1px solid var(--vscode-sideBarSectionHeader-border, var(--vscode-panel-border));
      border-radius: 5px;
      padding: 5px;
      background: var(--vscode-editor-background);
      text-align: left;
      min-width: 0;
    }
    button.stat {
      width: 100%;
      min-height: 0;
      color: var(--vscode-foreground);
      cursor: pointer;
    }
    button.stat:hover {
      border-color: var(--vscode-focusBorder);
      background: var(--vscode-list-hoverBackground, var(--vscode-editor-background));
    }
    .stat.warn {
      border-color: var(--vscode-inputValidation-warningBorder, var(--vscode-panel-border));
    }
    .stat.danger {
      border-color: var(--vscode-inputValidation-errorBorder, var(--vscode-panel-border));
    }
    .stat-value {
      overflow: hidden;
      font-size: 14px;
      font-weight: 700;
      line-height: 1.1;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .stat-label {
      margin-top: 1px;
      color: var(--vscode-descriptionForeground);
      font-size: 10px;
      line-height: 1.2;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
`;
}

function getStatsScript() {
  return String.raw`    function renderStats(container) {
      const stats = state.model.data.stats || {};
      const stack = div('stack');
      stack.append(
        statsSection('任务', [
          statItem('待办', stats.openTasks || 0, '@todo', stats.overdueTasks ? 'danger' : '', '未完成事项'),
          statItem('已完成', stats.doneTasks || 0, '@done', '', '已完成事项'),
          statItem('完成率', String(stats.completionRate || 0) + '%', '', '', '四象限事项完成率'),
          statItem('过期', stats.overdueTasks || 0, '@todo before:today', stats.overdueTasks ? 'danger' : '', '过期未完成事项'),
          statItem('无日期', stats.undatedTasks || 0, '@todo', stats.undatedTasks ? 'warn' : '', '没有截止日期的待办')
        ]),
        statsSection('日历', [
          statItem('今日', stats.todayTasks || 0, '@today', '', '今日事项'),
          statItem('本周', stats.weekTasks || 0, '@week', '', '本周事项'),
          statItem('本周事件', stats.weekEvents || 0, '@calendar @week', '', '本周日历事件'),
          statItem('本月天数', stats.monthScheduledDays || 0, '@month', '', '本月有安排的天数')
        ]),
        statsSection('专注', [
          statItem('今日番茄', stats.todayFocusSessions || 0, '', '', '今日完成的专注轮数；今日记录 ' + String(stats.todayFocusRecords || 0) + ' 条'),
          statItem('今日专注', formatCompactDuration(stats.todayFocusMs || 0), '', '', '今日所有番茄记录累计专注时间，包含手动终止记录'),
          statItem('本周专注', formatCompactDuration(stats.weekFocusMs || 0), '', '', '本周番茄记录累计专注时间，共 ' + String(stats.weekFocusRecords || 0) + ' 条记录'),
          statItem('记录', stats.focusRecords || 0, '', '', '番茄专注记录总数，累计 ' + formatCompactDuration(stats.totalFocusMs || 0)),
          statItem('完成/终止', String(stats.completedFocusRecords || 0) + '/' + String(stats.abortedFocusRecords || 0), '', stats.abortedFocusRecords ? 'warn' : '', '完成记录 / 手动终止记录，完成率 ' + String(stats.focusCompletionRate || 0) + '%'),
          statItem('事项关联', String(stats.focusLinkedRate || 0) + '%', '', stats.focusRecords && stats.focusLinkedRate < 60 ? 'warn' : '', '已关联事项的番茄记录：' + String(stats.linkedFocusRecords || 0) + '/' + String(stats.focusRecords || 0))
        ]),
        statsSection('推荐', [
          statItem('曝光', stats.nextActionImpressions || 0, '', '', '做什么组件展示过的推荐数'),
          statItem('采纳', stats.nextActionAdopted || 0, '', '', '点击开始番茄、完成、查上下文、加入待办等推荐动作的次数'),
          statItem('采纳率', String(stats.nextActionAdoptionRate || 0) + '%', '', '', '采纳次数 / 推荐曝光次数'),
          statItem('准确率', String(stats.nextActionAccuracyRate || 0) + '%', '', stats.nextActionAccuracyRate && stats.nextActionAccuracyRate < 50 ? 'warn' : '', '采纳次数 / 有明确反馈次数（采纳 + 忽略）'),
          statItem('AI/系统', String(stats.nextActionAiAdopted || 0) + '/' + String(stats.nextActionSystemAdopted || 0), '', '', 'AI 建议采纳数 / 系统推荐采纳数')
        ]),
        statsSection('知识库', [
          statItem('知识文件', stats.totalItems || 0, '@docs', '', '索引到的知识文件'),
          statItem('Prompt', stats.prompts || 0, '@prompt', '', 'Prompt 模板'),
          statItem('收藏', stats.favorites || 0, '@favorite', '', '收藏文件'),
          statItem('知识源', String(stats.activeSources || 0) + '/' + String(stats.sources || 0), '', stats.sourceErrors ? 'danger' : '', '知识源状态'),
          statItem('最近更新', stats.latestUpdatedAt ? formatShortDate(new Date(stats.latestUpdatedAt)) : '-', '', '', '最近索引文件更新时间')
        ]),
        statsSection('搜索/健康', [
          statItem('搜索历史', stats.searchHistory || 0, '', '', '已保存搜索历史'),
          statItem('AI 搜索', stats.aiSearches || 0, '', '', 'AI 搜索历史数'),
          statItem('健康', getStatsRiskCount(stats), getStatsRiskQuery(stats), getStatsRiskCount(stats) ? 'warn' : '', getStatsHealthText(stats))
        ])
      );
      container.appendChild(stack);
    }

    function statsSection(title, items) {
      const section = div('stats-section');
      section.appendChild(div('stats-section-title', title));
      const grid = div('stats-grid');
      for (const item of items) {
        grid.appendChild(item);
      }
      section.appendChild(grid);
      return section;
    }

    function statItem(label, value, query, tone, title) {
      const card = query ? actionButton('', 'runSearch', true) : div('stat');
      card.className = ['stat', tone || ''].filter(Boolean).join(' ');
      if (query) {
        card.dataset.query = query;
      }
      card.title = [title || '', query ? '搜索：' + query : ''].filter(Boolean).join('\\n');
      card.append(div('stat-value', String(value)), div('stat-label', label));
      return card;
    }

    function getStatsRiskCount(stats) {
      return (stats.sourceErrors || 0) + (stats.truncatedSources || 0) + (stats.overdueTasks || 0) + (stats.undatedTasks || 0);
    }

    function getStatsRiskQuery(stats) {
      if (stats.overdueTasks) return '@todo before:today';
      if (stats.undatedTasks) return '@todo';
      return '';
    }

    function getStatsHealthText(stats) {
      const notes = [];
      if (stats.sourceErrors) notes.push(String(stats.sourceErrors) + ' 个知识源报错');
      if (stats.truncatedSources) notes.push(String(stats.truncatedSources) + ' 个知识源被截断');
      if (stats.overdueTasks) notes.push(String(stats.overdueTasks) + ' 个事项已过期');
      if (stats.undatedTasks) notes.push(String(stats.undatedTasks) + ' 个待办没有日期');
      return notes.length ? notes.join(' · ') : '状态正常';
    }

    function appendEvents(container, events, limit) {
      const list = div('event-list');
      const visible = events.slice(0, limit);
      if (visible.length === 0) {
        list.appendChild(div('muted', '暂无安排'));
      }
      for (const event of visible) {
        const time = event.start ? event.start + ' ' : '';
        const pill = div('event-pill', time + event.title);
        pill.title = event.title;
        list.appendChild(pill);
      }
      if (events.length > visible.length) {
        list.appendChild(div('muted', '+' + String(events.length - visible.length) + ' 项'));
      }
      container.appendChild(list);
    }

`;
}

module.exports = {
  getStatsStyles,
  getStatsScript
};
