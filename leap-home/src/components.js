const COMPONENT_DEFINITIONS = {
  search: {
    type: 'search',
    title: '搜索',
    description: '搜索知识库、项目文档和 Prompt',
    defaultColSpan: 12,
    defaultRowSpan: 1
  },
  quickCapture: {
    type: 'quickCapture',
    title: '快速记录',
    description: '写入收集箱或打开收集箱',
    defaultColSpan: 4,
    defaultRowSpan: 2
  },
  focusTimer: {
    type: 'focusTimer',
    title: '番茄时钟',
    description: '记录 25 分钟专注周期和窗口离开时间',
    dataKey: 'focusTimer',
    defaultColSpan: 4,
    defaultRowSpan: 2
  },
  countdown: {
    type: 'countdown',
    title: '倒计日',
    description: '展示重要日期、截止时间和阶段节点',
    dataKey: 'countdown',
    defaultColSpan: 4,
    defaultRowSpan: 3
  },
  nextAction: {
    type: 'nextAction',
    title: '做什么',
    description: '根据任务、日历、倒计日和番茄状态推荐下一步',
    dataKey: 'nextAction',
    defaultColSpan: 4,
    defaultRowSpan: 3
  },
  knowledgeGraph: {
    type: 'knowledgeGraph',
    title: '知识图谱',
    description: '展示文档、Prompt 和知识源之间的关系',
    dataKey: 'knowledgeGraph',
    defaultColSpan: 8,
    defaultRowSpan: 4
  },
  favorites: {
    type: 'favorites',
    title: '收藏',
    description: '用户收藏的知识文件',
    dataKey: 'favorites',
    defaultColSpan: 4,
    defaultRowSpan: 3
  },
  prompts: {
    type: 'prompts',
    title: 'Prompt 模板',
    description: 'Prompt 模板列表和复制操作',
    dataKey: 'prompts',
    defaultColSpan: 6,
    defaultRowSpan: 4
  },
  fourQuadrants: {
    type: 'fourQuadrants',
    title: '四象限',
    description: '按重要/紧急维度组织任务和事项',
    dataKey: 'quadrants',
    defaultColSpan: 6,
    defaultRowSpan: 4
  },
  weekCalendar: {
    type: 'weekCalendar',
    title: '周历',
    description: '展示本周安排和事件',
    dataKey: 'calendarEvents',
    defaultColSpan: 6,
    defaultRowSpan: 3
  },
  monthCalendar: {
    type: 'monthCalendar',
    title: '月历',
    description: '展示当月日期和事件分布',
    dataKey: 'calendarEvents',
    defaultColSpan: 6,
    defaultRowSpan: 4
  },
  stats: {
    type: 'stats',
    title: '统计',
    description: '展示知识库、任务、日历和存储状态',
    dataKey: 'stats',
    defaultColSpan: 4,
    defaultRowSpan: 2
  }
};

function getComponentDefinitions() {
  return Object.values(COMPONENT_DEFINITIONS);
}

module.exports = {
  COMPONENT_DEFINITIONS,
  getComponentDefinitions
};
