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

状态文案：

- `idle`：未开始。
- `running + focused`：专注中。
- `running + blurred`：窗口已离开。
- `paused`：已暂停。
- `completed`：已完成。

## 与 Leap Home 的关系

- 作为独立组件加入设计器。
- 内置模板中建议放入“今日启动页”和“项目工作台”。
- 统计组件后续可以汇总今日完成番茄数、今日专注时长。
- 数据不进入搜索索引，避免搜索结果污染。

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
