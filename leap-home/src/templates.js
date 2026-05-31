const BUILTIN_TEMPLATES = {
  'project-workbench': {
    id: 'project-workbench',
    title: '默认工作台',
    description: '覆盖搜索、做什么、番茄、倒计日、记录、四象限、日历、知识图谱和统计。',
    layout: [
      { id: 'search', component: 'search', title: '搜索', col: 1, row: 1, colSpan: 12, rowSpan: 2 },
      { id: 'next-action', component: 'nextAction', title: '做什么', col: 1, row: 3, colSpan: 6, rowSpan: 5 },
      { id: 'focus-timer', component: 'focusTimer', title: '番茄时钟', col: 7, row: 3, colSpan: 6, rowSpan: 2 },
      { id: 'countdown', component: 'countdown', title: '倒计日', col: 7, row: 5, colSpan: 6, rowSpan: 3 },
      { id: 'quick-capture', component: 'quickCapture', title: '快速记录', col: 1, row: 8, colSpan: 12, rowSpan: 4 },
      { id: 'quadrants', component: 'fourQuadrants', title: '四象限', col: 1, row: 12, colSpan: 12, rowSpan: 3 },
      { id: 'week-calendar', component: 'weekCalendar', title: '周历', col: 1, row: 15, colSpan: 12, rowSpan: 3 },
      { id: 'month-calendar', component: 'monthCalendar', title: '月历', col: 1, row: 18, colSpan: 12, rowSpan: 5 },
      { id: 'knowledge-graph', component: 'knowledgeGraph', title: '知识图谱', col: 1, row: 23, colSpan: 12, rowSpan: 5 },
      { id: 'stats', component: 'stats', title: '统计', col: 1, row: 28, colSpan: 12, rowSpan: 5 }
    ]
  },
  'second-brain': {
    id: 'second-brain',
    title: '第二大脑首页',
    description: '更适合从知识库入口开始检索、沉淀和整理。',
    layout: [
      { id: 'search', component: 'search', col: 1, row: 1, colSpan: 12, rowSpan: 1 },
      { id: 'favorites', component: 'favorites', col: 1, row: 2, colSpan: 4, rowSpan: 4, options: { limit: 10 } },
      { id: 'stats', component: 'stats', col: 5, row: 2, colSpan: 4, rowSpan: 2 },
      { id: 'capture', component: 'quickCapture', col: 9, row: 2, colSpan: 4, rowSpan: 2 },
      { id: 'countdown', component: 'countdown', col: 5, row: 4, colSpan: 4, rowSpan: 2, options: { limit: 5 } },
      { id: 'prompts', component: 'prompts', col: 9, row: 4, colSpan: 4, rowSpan: 2, options: { limit: 8 } },
      { id: 'quadrants', component: 'fourQuadrants', col: 1, row: 6, colSpan: 6, rowSpan: 4 },
      { id: 'month', component: 'monthCalendar', col: 7, row: 6, colSpan: 6, rowSpan: 4 },
      { id: 'graph', component: 'knowledgeGraph', col: 1, row: 10, colSpan: 8, rowSpan: 4 }
    ]
  },
  'prompt-console': {
    id: 'prompt-console',
    title: 'Prompt 控制台',
    description: '优先展示 Prompt 模板，并保留快速记录、收藏和周计划。',
    layout: [
      { id: 'search', component: 'search', col: 1, row: 1, colSpan: 12, rowSpan: 1 },
      { id: 'prompts', component: 'prompts', col: 1, row: 2, colSpan: 8, rowSpan: 5, options: { limit: 16 } },
      { id: 'capture', component: 'quickCapture', col: 9, row: 2, colSpan: 4, rowSpan: 2 },
      { id: 'favorites', component: 'favorites', col: 9, row: 4, colSpan: 4, rowSpan: 3, options: { limit: 8 } },
      { id: 'stats', component: 'stats', col: 1, row: 7, colSpan: 4, rowSpan: 2 },
      { id: 'week', component: 'weekCalendar', col: 5, row: 7, colSpan: 8, rowSpan: 3 }
    ]
  },
  'daily-start': {
    id: 'daily-start',
    title: '今日启动页',
    description: '适合每天进入工作状态，突出快速记录、常用上下文和今日安排。',
    layout: [
      { id: 'search', component: 'search', col: 1, row: 1, colSpan: 12, rowSpan: 1 },
      { id: 'capture', component: 'quickCapture', col: 1, row: 2, colSpan: 4, rowSpan: 2 },
      { id: 'favorites', component: 'favorites', col: 5, row: 2, colSpan: 4, rowSpan: 3, options: { limit: 8 } },
      { id: 'stats', component: 'stats', col: 9, row: 2, colSpan: 4, rowSpan: 2 },
      { id: 'focus', component: 'focusTimer', col: 9, row: 4, colSpan: 4, rowSpan: 2 },
      { id: 'countdown', component: 'countdown', col: 9, row: 6, colSpan: 4, rowSpan: 2, options: { limit: 5 } },
      { id: 'next', component: 'nextAction', col: 5, row: 5, colSpan: 4, rowSpan: 3 },
      { id: 'prompts', component: 'prompts', col: 1, row: 5, colSpan: 4, rowSpan: 3, options: { limit: 8 } },
      { id: 'quadrants', component: 'fourQuadrants', col: 1, row: 8, colSpan: 6, rowSpan: 4 },
      { id: 'week', component: 'weekCalendar', col: 7, row: 8, colSpan: 6, rowSpan: 3 }
    ]
  },
  minimal: {
    id: 'minimal',
    title: '极简首页',
    description: '只保留搜索、收藏、统计和月历。',
    layout: [
      { id: 'search', component: 'search', col: 1, row: 1, colSpan: 12, rowSpan: 1 },
      { id: 'favorites', component: 'favorites', col: 1, row: 2, colSpan: 6, rowSpan: 4, options: { limit: 10 } },
      { id: 'stats', component: 'stats', col: 7, row: 2, colSpan: 6, rowSpan: 2 },
      { id: 'month', component: 'monthCalendar', col: 7, row: 4, colSpan: 6, rowSpan: 4 }
    ]
  }
};

function getTemplate(id) {
  return BUILTIN_TEMPLATES[id] || BUILTIN_TEMPLATES.minimal;
}

function getTemplateSummaries() {
  return Object.values(BUILTIN_TEMPLATES).map((template) => ({
    id: template.id,
    title: template.title,
    description: template.description
  }));
}

module.exports = {
  BUILTIN_TEMPLATES,
  getTemplate,
  getTemplateSummaries
};
