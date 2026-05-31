# 番茄时钟组件设计文档

## 目标

番茄时钟组件用于在 Leap Home 中记录一次 25 分钟专注周期，并尽量基于 Cursor 当前窗口状态计算真实专注时长。它不是单纯倒计时，而是要回答一个更有用的问题：这 25 分钟里，用户真正留在 Cursor 里的时间有多少。

## 能力边界

Cursor 插件可以通过 VS Code Extension API 获取当前窗口是否活跃：

- `vscode.window.state.focused`：读取当前窗口初始焦点状态。
- `vscode.window.onDidChangeWindowState`：监听窗口焦点变化，事件包含 `focused`。

这个信号只能说明 Cursor 窗口是否在前台或获得焦点，不能直接判断用户是否真的在思考、阅读、写代码。因此专注时长分为两种口径：

- 基础专注：Cursor 窗口处于 focused 状态时累计。
- 严格专注：Cursor 窗口 focused，且最近一段时间内存在编辑、选择、切换文件等活动时累计。

MVP 先实现基础专注，保留严格专注的数据结构和事件入口。

## MVP 范围

- 新增番茄时钟组件 `focusTimer`。
- 默认时长 25 分钟。
- 支持开始、暂停、继续、重置、完成。
- Cursor 窗口失焦时暂停专注累计，但倒计时继续走。
- Cursor 窗口重新聚焦时继续累计专注时长。
- 记录打断次数。
- 展示：
  - 当前倒计时。
  - 本轮已专注时长。
  - 窗口离开时长。
  - 打断次数。
  - 当前状态。
- 数据存储在 `.leap/components/focus-timer.json`。

## 暂不做

- 系统级应用使用检测。
- 自动识别用户是否离开电脑。
- 严格 idle 检测。
- 通知声音和系统通知。
- 长休息、短休息循环。
- 多项目专注统计。
- 专注记录报表。

## 数据模型

```json
{
  "version": 1,
  "activeSession": {
    "id": "focus-...",
    "status": "running",
    "durationMs": 1500000,
    "task": {
      "source": "quadrant",
      "quadrantId": "importantNotUrgent",
      "quadrantTitle": "重要不紧急",
      "taskId": "task-...",
      "title": "完成搜索组件设计"
    },
    "startedAt": "2026-05-30T10:00:00.000Z",
    "pausedAt": "",
    "completedAt": "",
    "lastTickAt": "2026-05-30T10:05:00.000Z",
    "lastFocusChangedAt": "2026-05-30T10:03:00.000Z",
    "focused": true,
    "focusedMs": 240000,
    "blurredMs": 60000,
    "idleMs": 0,
    "interruptions": 1
  },
  "history": [
    {
      "id": "focus-...",
      "durationMs": 1500000,
      "focusedMs": 1320000,
      "blurredMs": 180000,
      "idleMs": 0,
      "interruptions": 2,
      "task": {
        "source": "quadrant",
        "quadrantId": "importantNotUrgent",
        "quadrantTitle": "重要不紧急",
        "taskId": "task-...",
        "title": "完成搜索组件设计"
      },
      "startedAt": "2026-05-30T09:00:00.000Z",
      "completedAt": "2026-05-30T09:25:00.000Z"
    }
  ]
}
```

## 状态机

- `idle`：没有正在进行的番茄。
- `running`：番茄进行中，倒计时持续。
- `paused`：用户手动暂停，倒计时和专注累计都暂停。
- `completed`：本轮完成，写入历史。

窗口焦点变化不改变 `running` 状态，只影响 `focusedMs` 和 `blurredMs` 的累计。

## 计时规则

组件不能只依赖 webview 前端计时，因为 webview 可能被隐藏或刷新。计时逻辑放在扩展端：

- 开始时创建 `activeSession`，记录 `startedAt` 和 `lastTickAt`。
- 每次状态变化或 webview 请求模型时，根据 `Date.now()` 和 `lastTickAt` 补齐时间差。
- 如果 `status=running`：
  - `focused=true` 时把差值计入 `focusedMs`。
  - `focused=false` 时把差值计入 `blurredMs`。
- 当 `focusedMs + blurredMs >= durationMs` 时，本轮完成。
- 窗口从 focused 变为 blurred 时，`interruptions += 1`。

倒计时展示用 `durationMs - focusedMs - blurredMs`。专注时长展示用 `focusedMs`。

## 交互设计

组件默认是紧凑卡片：

- 顶部：状态和倒计时。
- 中部：专注时长、离开时长、打断次数三格统计。
- 底部：开始/暂停/继续/重置按钮。

下一版需要把操作区压缩到顶部：

- 倒计时仍然作为主视觉。
- 开始/暂停/继续/重置按钮放到进度圈左侧，不再单独占一整行。
- 进度圈保持在右侧，用于展示完成百分比。
- 在未开始状态下允许选择专注时长。

状态文案：

- `idle`：未开始。
- `running + focused`：专注中。
- `running + blurred`：窗口已离开。
- `paused`：已暂停。
- `completed`：已完成。

## 与 Leap Home 的关系

- 作为独立组件加入设计器。
- 内置模板中建议放入“今日启动页”和“项目工作台”。
- 统计组件汇总今日完成番茄数、今日专注时长、本周专注时长、记录总数、完成/终止和事项关联率。
- 数据不进入搜索索引，避免搜索结果污染。

## 当前实现状态

已完成：

- 已新增 `focusTimer` 组件定义。
- 已新增 `.leap/components/focus-timer.json` 存储。
- 已监听 Cursor 窗口 focused/blurred 状态。
- 已支持开始、暂停、继续、重置。
- 已按 focused/blurred 累计专注时间和离开时间。
- 已记录打断次数。
- 已在番茄完成时写入 `history`。
- 已在首页展示倒计时、进度圈、专注时间、离开时间、打断次数。
- 已把 `.leap` 排除出索引文件监听，避免计时文件写入触发索引刷新。
- 已将操作按钮移动到进度圈左侧。
- 已支持 15/25/45/60 分钟和自定义分钟数。
- 已将时长切换改为小号快捷按钮和数字输入，不再使用大字号原生下拉框。
- 已保存用户上次选择的默认专注时长。
- 已在组件内展示最近记录，包含完成和手动终止的记录。
- 已将最近记录改为标题栏右侧按钮切换视图，默认显示番茄时钟，点击后整个内容区切到历史记录。
- 已支持专注开始前选择四象限未完成事项。
- 已支持专注开始前新建四象限事项并自动关联本轮专注。
- 已在专注 session 和历史记录中保存关联事项快照。
- 已优化番茄时钟设置区布局：时间、事项、操作和进度圈分区展示，减少表单堆叠感。
- 已在统计组件汇总今日番茄数、今日专注、本周专注、记录总数、完成/终止和事项关联率。
- 已在完成时发送 Cursor 通知。
- 已支持短休息、长休息和再次专注。
- 已增加严格专注事件入口：编辑、选择和切换文件会更新活动时间。

未完成/待增强：

- 还没有完整专注记录报表。
- 还没有声音提醒。
- 还没有自动进入下一轮的循环策略，只提供手动短休息、长休息和再次专注。

## TODO

- [x] 写设计文档。
- [x] 新增 `focusTimer` 组件定义。
- [x] 新增 `.leap/components/focus-timer.json` 读写模块。
- [x] 扩展端监听 Cursor 窗口焦点变化。
- [x] 实现 session 状态机和时间补齐逻辑。
- [x] Webview 渲染番茄时钟组件。
- [x] 增加开始、暂停、继续、重置消息处理。
- [x] 将组件加入合适的内置模板。
- [x] 跑检查。
- [x] 将开始/暂停/继续/重置按钮移动到进度圈左侧，取消独立按钮行。
- [x] 增加专注时长选择，支持 15/25/45/60 分钟和自定义分钟数。
- [x] 移除大字号原生下拉框，改为小号快捷时长按钮。
- [x] 保存用户上次选择的默认专注时长。
- [x] 在组件内展示最近记录，包含完成和手动终止。
- [x] 最近记录默认不占内容区，在标题栏右侧用按钮切换“时钟/记录”视图。
- [x] 开始专注时支持选择四象限未完成事项。
- [x] 开始专注时支持新建事项，并写入四象限数据。
- [x] 专注 session 和历史记录保存关联事项快照。
- [x] 优化番茄时钟设置区视觉布局，避免表单堆叠。
- [x] 统计组件汇总今日完成番茄数、今日专注、本周专注、记录总数、完成/终止和事项关联率。
- [x] 完成时增加 Cursor 通知。
- [x] 增加短休息/长休息循环。
- [x] 增加严格 idle 检测：focused 且最近有编辑/选择/切换文件活动才计入严格专注。
- [ ] 增加专注记录报表。
