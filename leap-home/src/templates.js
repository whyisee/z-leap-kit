const BUILTIN_TEMPLATES = {
  'project-workbench': {
    id: 'project-workbench',
    title: '项目工作台',
    description: '优先展示搜索、快速记录、Prompt、收藏和今日安排。',
    layout: [
      { id: 'search', component: 'search', col: 1, row: 1, colSpan: 12, rowSpan: 1 },
      { id: 'capture', component: 'quickCapture', col: 1, row: 2, colSpan: 4, rowSpan: 2 },
      { id: 'prompts', component: 'prompts', col: 5, row: 2, colSpan: 4, rowSpan: 4, options: { limit: 10 } },
      { id: 'favorites', component: 'favorites', col: 9, row: 2, colSpan: 4, rowSpan: 2, options: { limit: 8 } },
      { id: 'focus', component: 'focusTimer', col: 1, row: 4, colSpan: 4, rowSpan: 2 },
      { id: 'stats', component: 'stats', col: 9, row: 4, colSpan: 4, rowSpan: 2 },
      { id: 'week', component: 'weekCalendar', col: 1, row: 6, colSpan: 12, rowSpan: 3 }
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
      { id: 'prompts', component: 'prompts', col: 9, row: 4, colSpan: 4, rowSpan: 2, options: { limit: 8 } },
      { id: 'quadrants', component: 'fourQuadrants', col: 1, row: 6, colSpan: 6, rowSpan: 4 },
      { id: 'month', component: 'monthCalendar', col: 7, row: 6, colSpan: 6, rowSpan: 4 }
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
      { id: 'prompts', component: 'prompts', col: 1, row: 5, colSpan: 8, rowSpan: 3, options: { limit: 10 } },
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
