const vscode = require('vscode');
const { readCountdowns } = require('./countdown');
const { readFocusTimerSnapshot } = require('./focusTimer');

const STATUS_BAR_COMPONENTS = [
  {
    id: 'home',
    label: '首页入口',
    description: '只显示 Leap Home 快捷入口'
  },
  {
    id: 'focusTimer',
    label: '番茄时钟',
    description: '显示当前番茄剩余时间和状态'
  },
  {
    id: 'countdown',
    label: '倒计日',
    description: '显示最近一个未完成倒计日'
  },
  {
    id: 'stats',
    label: '今日统计',
    description: '显示索引数量和今日专注'
  }
];

class LeapHomeStatusBarController {
  constructor(context, index) {
    this.context = context;
    this.index = index;
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.item.name = 'Leap Home';
    this.item.command = 'leapHome.openHome';
    this.timer = setInterval(() => this.refresh(), 1000);
    this.refresh();
  }

  dispose() {
    clearInterval(this.timer);
    this.item.dispose();
  }

  refresh() {
    const config = vscode.workspace.getConfiguration('leapHome');
    if (!config.get('statusBar.enabled', true)) {
      this.item.hide();
      return;
    }

    const component = normalizeStatusBarComponent(config.get('statusBar.component', 'focusTimer'));
    const summary = this.buildSummary(component);
    this.item.text = summary.text;
    this.item.tooltip = createStatusBarTooltip(component, summary);
    this.item.show();
  }

  async chooseComponent() {
    const current = normalizeStatusBarComponent(vscode.workspace.getConfiguration('leapHome').get('statusBar.component', 'focusTimer'));
    const picked = await vscode.window.showQuickPick(
      STATUS_BAR_COMPONENTS.map((component) => ({
        label: component.id === current ? `$(check) ${component.label}` : component.label,
        description: component.id,
        detail: component.description,
        componentId: component.id
      })),
      {
        title: 'Leap Home 状态栏显示组件',
        placeHolder: '选择状态栏要展示的组件摘要'
      }
    );
    if (!picked) {
      return;
    }

    await vscode.workspace.getConfiguration('leapHome').update('statusBar.component', picked.componentId, vscode.ConfigurationTarget.Global);
    this.refresh();
    vscode.window.setStatusBarMessage(`Leap Home: 状态栏已切换为${getStatusBarComponentLabel(picked.componentId)}`, 2500);
  }

  buildSummary(component) {
    if (component === 'focusTimer') {
      return buildFocusTimerSummary(this.context);
    }
    if (component === 'countdown') {
      return buildCountdownSummary(this.context);
    }
    if (component === 'stats') {
      return buildStatsSummary(this.context, this.index);
    }
    return {
      text: '$(home) Leap Home',
      lines: ['Leap Home', '点击打开知识首页。']
    };
  }
}

function buildFocusTimerSummary(context) {
  const timer = readFocusTimerSnapshot(context).activeSession || {};
  return {
    text: buildFocusTimerStatusText(timer),
    lines: focusSessionTooltipLines(timer)
  };
}

function buildCountdownSummary(context) {
  const now = Date.now();
  const items = readCountdowns(context).items
    .filter((item) => !item.done)
    .map((item) => Object.assign({}, item, { targetMs: getCountdownTargetMs(item) }))
    .filter((item) => Number.isFinite(item.targetMs))
    .sort((left, right) => left.targetMs - right.targetMs || left.title.localeCompare(right.title));

  if (!items.length) {
    return {
      text: '$(calendar) 无倒计日',
      lines: ['Leap Home · 倒计日', '暂无未完成倒计日。']
    };
  }

  const item = items[0];
  const distance = formatCountdownDistance(item, now);
  return {
    text: `$(calendar) ${cleanLabel(item.title, 10)} ${distance}`,
    lines: [
      'Leap Home · 倒计日',
      `最近：${item.title}`,
      `时间：${item.targetDate}${item.targetTime ? ` ${item.targetTime}` : ''}`,
      `状态：${distance}`
    ]
  };
}

function buildStatsSummary(context, index) {
  const focusTimer = readFocusTimerSnapshot(context);
  const todayFocusMs = getTodayFocusMs(focusTimer.history || []);
  const itemCount = index && Array.isArray(index.items) ? index.items.length : 0;
  const readyText = index && index.ready ? `${itemCount} 文件` : '索引中';
  return {
    text: `$(graph) ${readyText} · ${formatDuration(todayFocusMs)}`,
    lines: [
      'Leap Home · 今日统计',
      `索引：${readyText}`,
      `今日专注：${formatDuration(todayFocusMs)}`,
      `番茄记录：${(focusTimer.history || []).length} 条`
    ]
  };
}

function createStatusBarTooltip(component, summary) {
  const markdown = new vscode.MarkdownString();
  markdown.isTrusted = true;
  markdown.supportHtml = false;
  markdown.appendMarkdown((summary.lines || []).map(escapeMarkdownLine).join('  \n'));
  markdown.appendMarkdown('\n\n---\n\n');
  markdown.appendMarkdown('点击打开 Leap Home。');
  markdown.appendMarkdown('\n\n');
  markdown.appendMarkdown(`[切换状态栏显示组件](command:leapHome.chooseStatusBarComponent) · 当前：${getStatusBarComponentLabel(component)}`);
  return markdown;
}

function buildFocusTimerStatusText(timer) {
  const status = formatFocusStatus(timer);
  if (timer.status === 'running') {
    return `$(watch) ${formatClock(timer.remainingMs || 0)} ${status}`;
  }
  if (timer.status === 'paused') {
    return `$(debug-pause) ${formatClock(timer.remainingMs || 0)} ${status}`;
  }
  if (timer.status === 'completed') {
    return `$(check) ${status}`;
  }
  const minutes = Math.round((timer.durationMs || 25 * 60 * 1000) / 60000);
  return `$(watch) 番茄 ${minutes}m`;
}

function focusSessionTooltipLines(item) {
  if (!item) {
    return ['番茄时钟'];
  }
  const title = item.result === 'aborted'
    ? '番茄记录 · 已终止'
    : item.status
      ? `番茄时钟 · ${formatFocusStatus(item)}`
      : `番茄记录 · ${formatFocusType(item.type)}`;
  const lines = [title];
  const taskTitle = focusTaskTitle(item.task);
  if (taskTitle) {
    lines.push(`事项：${taskTitle}`);
  }
  if (item.status === 'running') {
    const currentApp = String(item.foregroundAppName || (item.foregroundApp && item.foregroundApp.name) || '').trim();
    if (currentApp) {
      lines.push(`当前应用：${currentApp}${item.foregroundAppTrusted ? '（计入专注）' : '（未计入专注）'}`);
    }
  }
  if (item.startedAt) {
    lines.push(`开始：${formatDateTime(item.startedAt)}`);
  }
  if (item.completedAt) {
    lines.push(`结束：${formatDateTime(item.completedAt)}`);
  }
  lines.push(`目标：${formatDuration(item.durationMs || 0)}`);
  lines.push(`已进行：${formatDuration(getFocusHistoryElapsed(item))}`);
  lines.push(`专注合计：${formatDuration(item.focusedMs || 0)}`);
  lines.push(`编辑器内：${formatDuration(getFocusEditorMs(item))}`);
  lines.push(`外部专注：${formatDuration(item.trustedExternalMs || 0)}`);
  lines.push(`离开：${formatDuration(item.blurredMs || 0)}`);
  if (item.untrustedExternalMs) {
    lines.push(`非可信应用：${formatDuration(item.untrustedExternalMs)}`);
  }
  if (item.idleMs) {
    lines.push(`空闲：${formatDuration(item.idleMs)}`);
  }
  lines.push(`打断：${item.interruptions || 0} 次`);
  if (item.appSwitches) {
    lines.push(`应用切换：${item.appSwitches} 次`);
  }
  const appLines = focusAppUsageLines(item);
  if (appLines.length) {
    lines.push('');
    lines.push('应用用时：');
    lines.push(...appLines);
  }
  return lines.filter((line) => line !== undefined && line !== null);
}

function formatFocusStatus(session) {
  if (session.status === 'running' && session.type === 'shortBreak') return '短休息中';
  if (session.status === 'running' && session.type === 'longBreak') return '长休息中';
  if (session.status === 'running' && session.focused && !session.cursorFocused) return '外部专注';
  if (session.status === 'running' && session.focused) return '专注中';
  if (session.status === 'running') return '已离开';
  if (session.status === 'paused') return '已暂停';
  if (session.status === 'completed') return `${formatFocusType(session.type)}完成`;
  return '未开始';
}

function focusTaskTitle(task) {
  return task && task.title ? String(task.title) : '';
}

function getFocusEditorMs(item) {
  return Math.max(0, (Number(item && item.focusedMs) || 0) - (Number(item && item.trustedExternalMs) || 0));
}

function focusAppUsageLines(item) {
  return getFocusAppUsage(item).map((app) => `- ${app.name}：${formatDuration(app.ms)}`);
}

function getFocusAppUsage(item) {
  if (item && Array.isArray(item.topApps) && item.topApps.length) {
    return item.topApps
      .map((app) => ({
        name: String(app.name || '').trim(),
        ms: Number(app.ms) || 0
      }))
      .filter((app) => app.name && app.ms > 0);
  }
  const usage = item && item.appUsage && typeof item.appUsage === 'object' ? item.appUsage : {};
  return Object.keys(usage)
    .map((name) => ({ name, ms: Number(usage[name]) || 0 }))
    .filter((app) => app.name && app.ms > 0)
    .sort((left, right) => right.ms - left.ms || left.name.localeCompare(right.name))
    .slice(0, 8);
}

function getFocusHistoryElapsed(item) {
  return Math.min(Number(item && item.durationMs) || 0, (Number(item && item.focusedMs) || 0) + (Number(item && item.blurredMs) || 0));
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())} ${padDatePart(date.getHours())}:${padDatePart(date.getMinutes())}`;
}

function escapeMarkdownLine(value) {
  return String(value || '').replace(/[\\`*_{}[\]()#+\-.!|>]/g, '\\$&');
}

function normalizeStatusBarComponent(value) {
  const text = String(value || '').trim();
  return STATUS_BAR_COMPONENTS.some((component) => component.id === text) ? text : 'focusTimer';
}

function getStatusBarComponentLabel(componentId) {
  const component = STATUS_BAR_COMPONENTS.find((item) => item.id === componentId);
  return component ? component.label : '番茄时钟';
}

function getCountdownTargetMs(item) {
  const suffix = item.targetTime ? `T${item.targetTime}:00` : 'T00:00:00';
  const timestamp = new Date(`${item.targetDate}${suffix}`).getTime();
  return Number.isFinite(timestamp) ? timestamp : NaN;
}

function getTodayFocusMs(history) {
  const today = formatDateKey(new Date());
  return history
    .filter((item) => item && item.type === 'focus' && formatDateKey(new Date(item.completedAt)) === today)
    .reduce((sum, item) => sum + (Number(item.focusedMs) || 0), 0);
}

function formatCountdownDistance(item, now) {
  const diffMs = item.targetMs - now;
  if (!item.targetTime) {
    const todayKey = formatDateKey(new Date(now));
    if (item.targetDate === todayKey) {
      return '今天';
    }
    const targetDay = new Date(`${item.targetDate}T00:00:00`).getTime();
    const todayDay = new Date(`${todayKey}T00:00:00`).getTime();
    const dayDiff = Math.round((targetDay - todayDay) / (24 * 60 * 60 * 1000));
    return dayDiff > 0 ? `D-${dayDiff}` : `逾期${Math.abs(dayDiff)}天`;
  }

  const absMs = Math.abs(diffMs);
  if (absMs < 24 * 60 * 60 * 1000) {
    const hours = Math.max(0, Math.ceil(absMs / (60 * 60 * 1000)));
    return diffMs >= 0 ? `${hours}h` : `逾期${hours}h`;
  }
  const days = Math.ceil(absMs / (24 * 60 * 60 * 1000));
  if (diffMs < 0) {
    return `逾期${days}天`;
  }
  if (days === 0 || diffMs < 24 * 60 * 60 * 1000) {
    return '今天';
  }
  return `D-${days}`;
}

function formatClock(ms) {
  const totalSeconds = Math.max(0, Math.ceil((Number(ms) || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${padDatePart(seconds)}`;
}

function formatDuration(ms) {
  const seconds = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  const minutes = Math.floor(seconds / 60);
  if (minutes >= 60) {
    return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m`;
  }
  return `${seconds}s`;
}

function formatFocusType(type) {
  return {
    focus: '专注',
    shortBreak: '短休息',
    longBreak: '长休息'
  }[type] || '专注';
}

function formatDateKey(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return '';
  }
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;
}

function padDatePart(value) {
  return String(value).padStart(2, '0');
}

function cleanLabel(value, maxLength) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, Math.max(1, maxLength - 1))}…`;
}

module.exports = {
  LeapHomeStatusBarController
};
