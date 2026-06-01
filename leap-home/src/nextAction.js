const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { getLeapComponentDataPath, QUADRANT_DEFINITIONS } = require('./storage');

const MAX_RECOMMENDATIONS = 6;
const MAX_FEEDBACK_ITEMS = 120;
const MAX_EVENTS = 500;
const DISMISS_HOURS = 4;

function readNextActionFeedback(context) {
  const value = readJsonFile(getLeapComponentDataPath(context, 'nextAction'));
  const source = value && typeof value === 'object' ? value : {};
  const events = Array.isArray(source.events) ? source.events.map(normalizeEvent).filter(Boolean).slice(0, MAX_EVENTS) : [];
  return {
    version: 1,
    dismissed: Array.isArray(source.dismissed) ? source.dismissed.map(normalizeDismissed).filter(Boolean).slice(0, MAX_FEEDBACK_ITEMS) : [],
    pins: Array.isArray(source.pins) ? source.pins.map(normalizePin).filter(Boolean).slice(0, MAX_FEEDBACK_ITEMS) : [],
    ai: normalizeAiPlan(source.ai),
    events,
    metrics: buildNextActionMetrics(events)
  };
}

async function dismissNextAction(context, key, reason, meta) {
  const normalizedKey = cleanInline(key);
  if (!normalizedKey) return readNextActionFeedback(context);
  const feedback = pruneFeedback(readNextActionFeedback(context), Date.now());
  const until = new Date(Date.now() + DISMISS_HOURS * 60 * 60 * 1000).toISOString();
  feedback.dismissed = [
    { key: normalizedKey, until, reason: cleanInline(reason) || 'not-now' },
    ...feedback.dismissed.filter((item) => item.key !== normalizedKey)
  ].slice(0, MAX_FEEDBACK_ITEMS);
  feedback.events = appendNextActionEvents(feedback.events, [{
    kind: 'dismissed',
    key: normalizedKey,
    sourceKind: meta && meta.sourceKind,
    itemType: meta && meta.itemType,
    title: meta && meta.title,
    actionType: 'dismiss',
    reason: cleanInline(reason) || 'not-now',
    aiGeneratedAt: meta && meta.aiGeneratedAt
  }]);
  await writeNextActionFeedback(context, feedback);
  return feedback;
}

async function pinNextAction(context, key, pinned, meta) {
  const normalizedKey = cleanInline(key);
  if (!normalizedKey) return readNextActionFeedback(context);
  const feedback = pruneFeedback(readNextActionFeedback(context), Date.now());
  if (pinned) {
    feedback.pins = [
      { key: normalizedKey, createdAt: new Date().toISOString() },
      ...feedback.pins.filter((item) => item.key !== normalizedKey)
    ].slice(0, MAX_FEEDBACK_ITEMS);
  } else {
    feedback.pins = feedback.pins.filter((item) => item.key !== normalizedKey);
  }
  feedback.events = appendNextActionEvents(feedback.events, [{
    kind: pinned ? 'pinned' : 'unpinned',
    key: normalizedKey,
    sourceKind: meta && meta.sourceKind,
    itemType: meta && meta.itemType,
    title: meta && meta.title,
    actionType: pinned ? 'pin' : 'unpin',
    aiGeneratedAt: meta && meta.aiGeneratedAt
  }]);
  await writeNextActionFeedback(context, feedback);
  return feedback;
}

async function saveNextActionAiPlan(context, plan) {
  const feedback = pruneFeedback(readNextActionFeedback(context), Date.now());
  feedback.ai = normalizeAiPlan(Object.assign({}, plan || {}, {
    generatedAt: new Date().toISOString()
  }));
  await writeNextActionFeedback(context, feedback);
  return feedback;
}

async function recordNextActionImpressions(context, items) {
  const normalizedItems = (Array.isArray(items) ? items : []).map(normalizeEventItem).filter(Boolean);
  if (normalizedItems.length === 0) return readNextActionFeedback(context);
  const feedback = pruneFeedback(readNextActionFeedback(context), Date.now());
  const seen = new Set((feedback.events || [])
    .filter((event) => event.kind === 'impression')
    .map((event) => getImpressionSignature(event)));
  const events = [];
  for (const item of normalizedItems) {
    const event = Object.assign({ kind: 'impression' }, item);
    const signature = getImpressionSignature(event);
    if (seen.has(signature)) continue;
    seen.add(signature);
    events.push(event);
  }
  if (events.length === 0) return feedback;
  feedback.events = appendNextActionEvents(feedback.events, events);
  await writeNextActionFeedback(context, feedback);
  return feedback;
}

async function recordNextActionAdoption(context, item, action) {
  const eventItem = normalizeEventItem(item);
  if (!eventItem) return readNextActionFeedback(context);
  const actionType = cleanInline(action && action.type) || 'unknown';
  if (actionType === 'dismiss') {
    return dismissNextAction(context, eventItem.key, 'not-now', eventItem);
  }
  const feedback = pruneFeedback(readNextActionFeedback(context), Date.now());
  feedback.events = appendNextActionEvents(feedback.events, [{
    kind: 'adopted',
    key: eventItem.key,
    sourceKind: eventItem.sourceKind,
    itemType: eventItem.itemType,
    title: eventItem.title,
    score: eventItem.score,
    actionType,
    actionLabel: cleanInline(action && action.label).slice(0, 32),
    aiGeneratedAt: eventItem.aiGeneratedAt
  }]);
  if (shouldHideAfterAdoption(eventItem, actionType)) {
    const until = new Date(Date.now() + DISMISS_HOURS * 60 * 60 * 1000).toISOString();
    feedback.dismissed = [
      { key: eventItem.key, until, reason: `adopted:${actionType}` },
      ...feedback.dismissed.filter((dismissed) => dismissed.key !== eventItem.key)
    ].slice(0, MAX_FEEDBACK_ITEMS);
  }
  await writeNextActionFeedback(context, feedback);
  return feedback;
}

function buildNextActionRecommendations(input, feedback) {
  const now = new Date();
  const safeFeedback = pruneFeedback(feedback || { dismissed: [], pins: [] }, now.getTime());
  const dismissed = new Set(safeFeedback.dismissed.map((item) => item.key));
  const pinned = new Set(safeFeedback.pins.map((item) => item.key));
  const candidates = []
    .concat(buildFocusCandidates(input.focusTimer))
    .concat(buildTaskCandidates(input.quadrants, input.searchHistory))
    .concat(buildCountdownCandidates(input.countdown))
    .concat(buildQuickCaptureCandidates(input.quickCaptures));

  const ranked = candidates
    .filter((item) => item && !dismissed.has(item.key))
    .map((item) => Object.assign({}, item, {
      pinned: pinned.has(item.key),
      rankScore: item.score + (pinned.has(item.key) ? 1000 : 0)
    }))
    .sort(compareRecommendation)
    .slice(0, MAX_RECOMMENDATIONS);

  return ranked.map((item, index) => Object.assign({}, item, { id: `system-recommendation-${index + 1}` }));
}

function buildNextActionAiRecommendations(systemRecommendations, feedback) {
  const safeFeedback = pruneFeedback(feedback || { dismissed: [], pins: [] }, Date.now());
  const dismissed = new Set(safeFeedback.dismissed.map((item) => item.key));
  const pinned = new Set(safeFeedback.pins.map((item) => item.key));
  const aiPlan = safeFeedback.ai
    ? Object.assign({}, safeFeedback.ai, { items: (safeFeedback.ai.items || []).filter((item) => !dismissed.has(item.key)) })
    : undefined;
  return applyAiPlan(systemRecommendations || [], aiPlan, pinned)
    .map((item, index) => Object.assign({}, item, { id: `ai-recommendation-${index + 1}` }));
}

function buildFocusCandidates(focusTimer) {
  const session = focusTimer && focusTimer.activeSession ? focusTimer.activeSession : {};
  if (session.status !== 'completed') return [];
  if (session.type === 'focus') {
    return [{
      key: `focus:break:${session.id || 'latest'}`,
      type: 'break',
      title: '先休息一下，再决定下一步',
      reason: `刚完成一轮专注，专注 ${formatMinutes(session.focusedMs)}，打断 ${session.interruptions || 0} 次。`,
      score: 94,
      source: { type: 'focusTimer', sessionId: session.id || '' },
      actions: [
        { type: 'startBreak', label: '短休息', sessionType: 'shortBreak' },
        { type: 'dismiss', label: '忽略' }
      ]
    }];
  }
  return [{
    key: `focus:resume:${session.id || 'latest'}`,
    type: 'do-now',
    title: '休息结束，挑一件事重新进入专注',
    reason: '休息已经完成，可以回到一个明确事项上继续推进。',
    score: 72,
    source: { type: 'focusTimer', sessionId: session.id || '' },
    actions: [
      { type: 'search', label: '查待办', query: '@todo' },
      { type: 'dismiss', label: '忽略' }
    ]
  }];
}

function buildTaskCandidates(quadrants, searchHistory) {
  const result = [];
  const recentTerms = getRecentSearchTerms(searchHistory);
  for (const definition of QUADRANT_DEFINITIONS) {
    const tasks = Array.isArray(quadrants && quadrants[definition.id]) ? quadrants[definition.id] : [];
    for (const task of tasks) {
      if (!task || task.done) continue;
      const timing = getTaskTiming(task.dueDate);
      let score = getQuadrantScore(definition.id) + timing.score;
      const reasons = [definition.title];
      if (timing.reason) reasons.push(timing.reason);
      if (!task.dueDate && definition.id.startsWith('important')) {
        score += 8;
        reasons.push('重要但还没有日期');
      }
      if (matchesRecentSearch(task.text, recentTerms)) {
        score += 8;
        reasons.push('和最近搜索主题相关');
      }
      const actions = [
        { type: 'startFocus', label: timing.overdue || timing.today ? '开始番茄' : '25分钟推进', quadrantId: definition.id, taskId: task.id },
        { type: 'startFocus', label: '10分钟启动', quadrantId: definition.id, taskId: task.id, durationMs: 10 * 60 * 1000 },
        { type: 'completeTask', label: '完成', quadrantId: definition.id, taskId: task.id },
        { type: 'search', label: '查上下文', query: task.text }
      ];
      if (!task.dueDate) {
        const planToday = definition.id === 'importantUrgent' || definition.id === 'notImportantUrgent';
        actions.splice(2, 0, { type: 'scheduleTask', label: planToday ? '安排今天' : '安排明天', quadrantId: definition.id, taskId: task.id, dueDate: formatDateKey(addDays(new Date(), planToday ? 0 : 1)) });
      } else if (!timing.today && !timing.overdue) {
        actions.splice(2, 0, { type: 'scheduleTask', label: '改到今天', quadrantId: definition.id, taskId: task.id, dueDate: formatDateKey(new Date()) });
      }
      result.push({
        key: `task:${definition.id}:${task.id}`,
        type: timing.overdue || timing.today ? 'do-now' : 'plan',
        title: task.text,
        reason: reasons.join('，') + '。',
        score,
        source: {
          type: 'task',
          quadrantId: definition.id,
          quadrantTitle: definition.title,
          taskId: task.id,
          title: task.text
        },
        actions
      });
    }
  }
  return result;
}

function buildCountdownCandidates(countdown) {
  const items = countdown && Array.isArray(countdown.items) ? countdown.items : [];
  return items.map((item) => {
    if (!item || item.done) return undefined;
    const timing = getCountdownTiming(item);
    if (!timing || timing.days > 7) return undefined;
    const type = timing.overdue || timing.days <= 1 ? 'do-now' : 'plan';
    return {
      key: `countdown:${item.id}`,
      type,
      title: item.title,
      reason: `倒计节点${timing.reason}${item.note ? '，备注：' + item.note : ''}。`,
      score: 54 + timing.score,
      source: { type: 'countdown', itemId: item.id },
      actions: [
        { type: 'createTask', label: '生成准备事项', title: `准备：${item.title}`, quadrantId: type === 'do-now' ? 'importantUrgent' : 'importantNotUrgent', dueDate: item.targetDate },
        { type: 'startFocus', label: '10分钟推进', title: `推进：${item.title}`, quadrantId: type === 'do-now' ? 'importantUrgent' : 'importantNotUrgent', durationMs: 10 * 60 * 1000 },
        { type: 'search', label: '查上下文', query: item.title },
        { type: 'completeCountdown', label: '已完成', itemId: item.id },
        { type: 'dismiss', label: '忽略' }
      ]
    };
  }).filter(Boolean);
}

function buildQuickCaptureCandidates(quickCaptures) {
  const captures = Array.isArray(quickCaptures) ? quickCaptures : [];
  return captures
    .filter((item) => item && item.target === 'inbox')
    .slice(0, 3)
    .map((item, index) => ({
      key: `capture:${item.id}`,
      type: 'review',
      title: `整理快速记录：${truncate(item.text, 28)}`,
      reason: `最近捕获到收集箱，还没有转成明确事项或文档。`,
      score: 42 - index * 4,
      source: { type: 'quickCapture', captureId: item.id },
      actions: [
        { type: 'createTask', label: '转成待办', title: truncate(item.text, 80), quadrantId: 'importantNotUrgent', dueDate: item.dueDate || '' },
        { type: 'openInbox', label: '打开收集箱' },
        { type: 'search', label: '查上下文', query: item.text },
        { type: 'dismiss', label: '忽略' }
      ]
    }));
}

function getQuadrantScore(quadrantId) {
  return {
    importantUrgent: 50,
    importantNotUrgent: 34,
    notImportantUrgent: 24,
    notImportantNotUrgent: 8
  }[quadrantId] || 8;
}

function getTaskTiming(dueDate) {
  const days = daysUntil(dueDate);
  if (days === undefined) return { score: 0, reason: '', overdue: false, today: false };
  if (days < 0) return { score: 34, reason: `已过期 ${Math.abs(days)} 天`, overdue: true, today: false };
  if (days === 0) return { score: 30, reason: '今天截止', overdue: false, today: true };
  if (days === 1) return { score: 22, reason: '明天截止', overdue: false, today: false };
  if (days <= 3) return { score: 16, reason: `${days} 天内截止`, overdue: false, today: false };
  if (days <= 7) return { score: 10, reason: '本周截止', overdue: false, today: false };
  return { score: days > 30 ? -10 : 0, reason: '', overdue: false, today: false };
}

function getCountdownTiming(item) {
  const days = daysUntil(item.targetDate);
  if (days === undefined) return undefined;
  if (days < 0) return { days, score: 28, reason: `已过 ${Math.abs(days)} 天`, overdue: true };
  if (days === 0) return { days, score: 26, reason: '就在今天', overdue: false };
  if (days === 1) return { days, score: 20, reason: '还有 1 天', overdue: false };
  if (days <= 3) return { days, score: 14, reason: `还有 ${days} 天`, overdue: false };
  return { days, score: 8, reason: `还有 ${days} 天`, overdue: false };
}

function compareRecommendation(left, right) {
  if (left.pinned !== right.pinned) return left.pinned ? -1 : 1;
  return (right.rankScore || right.score) - (left.rankScore || left.score) || left.title.localeCompare(right.title);
}

function applyAiPlan(recommendations, aiPlan, pinnedKeys) {
  const plan = normalizeAiPlan(aiPlan);
  if (!plan || !plan.items || plan.items.length === 0) {
    return [];
  }
  const byKey = new Map(recommendations.map((item) => [item.key, item]));
  const used = new Set();
  const aiOrdered = [];
  for (const aiItem of plan.items) {
    const base = byKey.get(aiItem.key);
    if (base) {
      if (used.has(aiItem.key)) continue;
      used.add(aiItem.key);
      aiOrdered.push(Object.assign({}, base, {
        ai: true,
        sourceType: aiItem.sourceType || 'candidate',
        type: aiItem.type || base.type,
        title: aiItem.title || base.title,
        reason: aiItem.reason || base.reason,
        actions: aiItem.actions && aiItem.actions.length ? aiItem.actions : base.actions,
        aiGeneratedAt: plan.generatedAt,
        aiReason: plan.reason,
        aiSummary: plan.summary,
        aiEncouragement: plan.encouragement
      }));
      continue;
    }
    if (!aiItem.key.startsWith('ai:') || used.has(aiItem.key)) continue;
    used.add(aiItem.key);
    aiOrdered.push(createAiRecommendation(aiItem, plan, pinnedKeys && pinnedKeys.has(aiItem.key)));
  }
  return aiOrdered.filter((item) => item.pinned)
    .concat(aiOrdered.filter((item) => !item.pinned))
    .slice(0, MAX_RECOMMENDATIONS);
}

function createAiRecommendation(aiItem, plan, pinned) {
  const fallbackAction = aiItem.sourceType === 'encouragement'
    ? [{ type: 'dismiss', label: '收下' }]
    : [{ type: 'dismiss', label: '忽略' }];
  return {
    key: aiItem.key,
    type: aiItem.type || 'plan',
    title: aiItem.title || 'AI 建议',
    reason: aiItem.reason || plan.reason || '根据最近上下文生成的行动建议。',
    score: 68,
    rankScore: 68 + (pinned ? 1000 : 0),
    pinned: Boolean(pinned),
    ai: true,
    sourceType: aiItem.sourceType || 'insight',
    source: {
      type: 'ai',
      basedOnKey: aiItem.basedOnKey || ''
    },
    actions: aiItem.actions && aiItem.actions.length ? aiItem.actions : fallbackAction,
    aiGeneratedAt: plan.generatedAt,
    aiReason: plan.reason,
    aiSummary: plan.summary,
    aiEncouragement: plan.encouragement
  };
}

function daysUntil(dateValue) {
  const date = parseDate(dateValue);
  if (!date) return undefined;
  const today = startOfDay(new Date());
  return Math.round((date.getTime() - today.getTime()) / 86400000);
}

function addDays(date, days) {
  const next = startOfDay(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatDateKey(date) {
  const target = startOfDay(date);
  return [
    target.getFullYear(),
    String(target.getMonth() + 1).padStart(2, '0'),
    String(target.getDate()).padStart(2, '0')
  ].join('-');
}

function parseDate(value) {
  const text = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return undefined;
  const parts = text.split('-').map((part) => Number.parseInt(part, 10));
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getRecentSearchTerms(searchHistory) {
  return (Array.isArray(searchHistory) ? searchHistory : [])
    .slice(0, 5)
    .flatMap((item) => cleanInline(item.query).split(/\s+/))
    .filter((term) => term.length >= 2 && !term.startsWith('@'));
}

function matchesRecentSearch(text, terms) {
  const target = cleanInline(text).toLowerCase();
  return terms.some((term) => target.includes(term.toLowerCase()));
}

function normalizeDismissed(value) {
  if (!value || typeof value !== 'object') return undefined;
  const key = cleanInline(value.key);
  const until = cleanInline(value.until);
  if (!key || !Date.parse(until)) return undefined;
  return { key, until, reason: cleanInline(value.reason) };
}

function normalizePin(value) {
  if (!value || typeof value !== 'object') return undefined;
  const key = cleanInline(value.key);
  if (!key) return undefined;
  return { key, createdAt: cleanInline(value.createdAt) || new Date().toISOString() };
}

function normalizeEvent(value) {
  if (!value || typeof value !== 'object') return undefined;
  const kind = cleanInline(value.kind);
  const key = cleanInline(value.key);
  const createdAt = cleanInline(value.createdAt);
  if (!['impression', 'adopted', 'dismissed', 'pinned', 'unpinned'].includes(kind) || !key || !Date.parse(createdAt)) {
    return undefined;
  }
  return {
    id: cleanInline(value.id) || `${createdAt}:${kind}:${key}`,
    kind,
    key,
    sourceKind: ['system', 'ai'].includes(cleanInline(value.sourceKind)) ? cleanInline(value.sourceKind) : 'system',
    itemType: cleanInline(value.itemType).slice(0, 32),
    title: cleanInline(value.title).slice(0, 120),
    score: clampNumber(value.score, 0, 1000),
    actionType: cleanInline(value.actionType).slice(0, 32),
    actionLabel: cleanInline(value.actionLabel).slice(0, 32),
    reason: cleanInline(value.reason).slice(0, 80),
    aiGeneratedAt: cleanInline(value.aiGeneratedAt),
    createdAt
  };
}

function pruneFeedback(feedback, nowMs) {
  const events = (feedback.events || []).map(normalizeEvent).filter(Boolean).slice(0, MAX_EVENTS);
  return {
    version: 1,
    dismissed: (feedback.dismissed || []).filter((item) => Date.parse(item.until) > nowMs).slice(0, MAX_FEEDBACK_ITEMS),
    pins: (feedback.pins || []).slice(0, MAX_FEEDBACK_ITEMS),
    ai: normalizeAiPlan(feedback.ai),
    events
  };
}

function normalizeAiPlan(value) {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const generatedAt = cleanInline(value.generatedAt);
  const items = Array.isArray(value.items) ? value.items.map(normalizeAiPlanItem).filter(Boolean).slice(0, MAX_RECOMMENDATIONS) : [];
  if (!generatedAt || items.length === 0) {
    return undefined;
  }
  return {
    generatedAt,
    question: cleanInline(value.question).slice(0, 240),
    summary: cleanInline(value.summary).slice(0, 220),
    encouragement: cleanInline(value.encouragement).slice(0, 180),
    reason: cleanInline(value.reason).slice(0, 220),
    items
  };
}

function normalizeAiPlanItem(value) {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const key = cleanInline(value.key);
  if (!key) {
    return undefined;
  }
  const type = cleanInline(value.type);
  const sourceType = cleanInline(value.sourceType);
  return {
    key,
    type: ['do-now', 'plan', 'review', 'break'].includes(type) ? type : '',
    sourceType: ['candidate', 'microtask', 'insight', 'encouragement', 'idea'].includes(sourceType)
      ? sourceType
      : (key.startsWith('ai:') ? 'insight' : 'candidate'),
    title: cleanInline(value.title).slice(0, 80),
    reason: cleanInline(value.reason).slice(0, 180),
    basedOnKey: cleanInline(value.basedOnKey),
    actions: normalizeAiPlanActions(value.actions)
  };
}

function normalizeAiPlanActions(value) {
  const actions = Array.isArray(value) ? value : [];
  return actions.map(normalizeAiPlanAction).filter(Boolean).slice(0, 4);
}

function normalizeAiPlanAction(value) {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const type = cleanInline(value.type);
  const label = cleanInline(value.label).slice(0, 16);
  if (type === 'createTask' || type === 'startFocus') {
    const title = cleanInline(value.title).slice(0, 120);
    const quadrantId = cleanInline(value.quadrantId);
    if (!title || !QUADRANT_DEFINITIONS.some((definition) => definition.id === quadrantId)) {
      return undefined;
    }
    const dueDate = normalizeDate(value.dueDate);
    const durationMs = clampNumber(value.durationMs, 0, 4 * 60 * 60 * 1000);
    return Object.assign({ type, label: label || (type === 'startFocus' ? '开始专注' : '加入待办'), title, quadrantId }, dueDate ? { dueDate } : {}, durationMs ? { durationMs } : {});
  }
  if (type === 'search') {
    const query = cleanInline(value.query).slice(0, 180);
    if (!query) return undefined;
    return { type, label: label || '查上下文', query };
  }
  if (type === 'dismiss') {
    return { type, label: label || '忽略' };
  }
  if (type === 'openInbox') {
    return { type, label: label || '打开收集箱' };
  }
  if (type === 'createNote' || type === 'appendNote') {
    const content = cleanText(value.content).slice(0, 4000);
    const title = cleanInline(value.title).slice(0, 120);
    const sourceId = cleanInline(value.sourceId).slice(0, 160);
    const sourceName = cleanInline(value.sourceName).slice(0, 80);
    const relativePath = cleanNotePath(value.relativePath || value.targetPath || value.path).slice(0, 240);
    if (!content || (!title && !relativePath)) {
      return undefined;
    }
    return {
      type,
      label: label || (type === 'appendNote' ? '写入笔记' : '新建笔记'),
      title,
      sourceId,
      sourceName,
      relativePath,
      content
    };
  }
  return undefined;
}

function readJsonFile(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    return undefined;
  }
}

async function writeNextActionFeedback(context, feedback) {
  const filePath = getLeapComponentDataPath(context, 'nextAction');
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, JSON.stringify(pruneFeedback(feedback, Date.now()), null, 2) + '\n', 'utf8');
}

function appendNextActionEvents(existing, events) {
  const createdAt = new Date().toISOString();
  const normalized = events.map((event, index) => normalizeEvent(Object.assign({}, event, {
    id: `${createdAt}:${index}:${cleanInline(event.kind)}:${cleanInline(event.key)}`,
    createdAt
  }))).filter(Boolean);
  return normalized.concat((existing || []).map(normalizeEvent).filter(Boolean)).slice(0, MAX_EVENTS);
}

function normalizeEventItem(value) {
  if (!value || typeof value !== 'object') return undefined;
  const key = cleanInline(value.key);
  if (!key) return undefined;
  return {
    key,
    sourceKind: value.ai || value.sourceKind === 'ai' ? 'ai' : 'system',
    itemType: cleanInline(value.type || value.itemType).slice(0, 32),
    title: cleanInline(value.title).slice(0, 120),
    score: clampNumber(value.score, 0, 1000),
    aiGeneratedAt: cleanInline(value.aiGeneratedAt)
  };
}

function getImpressionSignature(event) {
  return [
    formatDatePart(event.createdAt || new Date().toISOString()),
    event.sourceKind || 'system',
    event.key,
    event.aiGeneratedAt || ''
  ].join('|');
}

function buildNextActionMetrics(events) {
  const list = Array.isArray(events) ? events : [];
  const impressions = list.filter((event) => event.kind === 'impression');
  const adopted = list.filter((event) => event.kind === 'adopted');
  const dismissed = list.filter((event) => event.kind === 'dismissed');
  const systemAdopted = adopted.filter((event) => event.sourceKind === 'system');
  const aiAdopted = adopted.filter((event) => event.sourceKind === 'ai');
  const systemImpressions = impressions.filter((event) => event.sourceKind === 'system');
  const aiImpressions = impressions.filter((event) => event.sourceKind === 'ai');
  const explicitFeedback = adopted.length + dismissed.length;
  return {
    events: list.length,
    impressions: impressions.length,
    adopted: adopted.length,
    dismissed: dismissed.length,
    pinned: list.filter((event) => event.kind === 'pinned').length,
    adoptionRate: impressions.length > 0 ? Math.round(adopted.length / impressions.length * 100) : 0,
    accuracyRate: explicitFeedback > 0 ? Math.round(adopted.length / explicitFeedback * 100) : 0,
    systemAdoptionRate: systemImpressions.length > 0 ? Math.round(systemAdopted.length / systemImpressions.length * 100) : 0,
    aiAdoptionRate: aiImpressions.length > 0 ? Math.round(aiAdopted.length / aiImpressions.length * 100) : 0,
    systemAdopted: systemAdopted.length,
    aiAdopted: aiAdopted.length,
    latestEventAt: list[0] ? list[0].createdAt : ''
  };
}

function shouldHideAfterAdoption(item, actionType) {
  if (item.key && item.key.startsWith('ai:')) return true;
  return ['createTask', 'startFocus', 'startBreak', 'completeTask', 'scheduleTask', 'completeCountdown', 'openInbox'].includes(actionType);
}

function formatDatePart(value) {
  return cleanInline(value).slice(0, 10);
}

function normalizeDate(value) {
  const text = cleanInline(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
}

function cleanText(value) {
  return String(value || '').replace(/\r\n/g, '\n').trim();
}

function cleanNotePath(value) {
  return String(value || '').replace(/\\/g, '/').replace(/\s+/g, ' ').trim();
}

function cleanInline(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function clampNumber(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(Math.max(number, min), max);
}

function truncate(value, maxLength) {
  const text = cleanInline(value);
  return text.length > maxLength ? text.slice(0, maxLength - 1) + '…' : text;
}

function formatMinutes(ms) {
  const minutes = Math.max(0, Math.round((Number(ms) || 0) / 60000));
  return `${minutes} 分钟`;
}

module.exports = {
  buildNextActionAiRecommendations,
  buildNextActionRecommendations,
  dismissNextAction,
  pinNextAction,
  readNextActionFeedback,
  recordNextActionAdoption,
  recordNextActionImpressions,
  saveNextActionAiPlan
};
