# Leap Home 组件化首页设计方案

## 背景

当前 Leap Home MVP 已经能在编辑窗口打开知识库首页，但页面结构仍然是固定的。个人知识库首页不应该只有一种形态，因为不同用户、不同项目、不同时间段需要看到的内容并不一样。

因此，Leap Home 后续应从“固定页面”升级为“可组合的知识工作台”。

核心方向：

> 首页 = 组件系统 + 布局系统 + 内置模板 + 用户自定义配置。

## 设计目标

* 让首页不再写死模块顺序和内容。

* 将搜索、收藏、最近打开、Prompt、项目文档等能力拆成独立组件。

* 支持通过模板快速切换首页形态。

* 支持用户通过设计器调整组件位置、宽度、高度、标题和数据参数。

* 模板设计器采用左侧网格画布 + 右侧属性面板：组件可拖拽放置，也可拖拽右下角调整大小，并通过占位碰撞检测让被碰撞组件自动移动到空白位置。

## 非目标

第一阶段不做以下能力：

* 复杂权限或多用户同步。

* 远程模板市场。

* 自定义 JavaScript 组件。

* 复杂嵌套布局。

## 核心概念

### 组件 Component

组件是首页上的最小功能块。每个组件负责展示一种信息或完成一种操作。

示例：

* 搜索框

* 快速记录

* 当前项目文档

* 最近打开

* 收藏

* Prompt 模板

* 知识源状态

* 收集箱

* PARA 分区入口

* 常用命令

* 最近修改文件

### 布局 Layout

布局描述组件如何排列。MVP 使用 12 列 CSS Grid 模型，并支持显式行列坐标。

每个组件可以声明：

* 组件类型

* 标题

* 起始列 `col`

* 起始行 `row`

* 横向跨度 `colSpan`

* 纵向跨度 `rowSpan`

* 组件参数

`span` 只作为兼容字段保留，等同于 `colSpan`。真正自由布局应优先使用 `col`、`row`、`colSpan`、`rowSpan`。

### 模板 Template

模板是一组预设布局。用户可以直接选择模板，也可以基于模板覆盖局部配置。

模板解决的问题是：用户不需要一开始就手写完整布局。

## 配置结构草案

### 插件配置

```json
{
  "leapHome.homeTemplate": "project-workbench",
  "leapHome.homeLayout": [],
  "leapHome.sources": [],
  "leapHome.promptDirs": [],
  "leapHome.inboxPath": "${workspaceFolder}/.leap/inbox.md",
  "leapHome.ai.provider": "deepseek",
  "leapHome.ai.deepseekModel": "deepseek-v4-flash"
}
```

### 工作区数据

插件运行数据默认放在当前工作区的 `.leap` 目录中。

* `.leap/state.json`：当前主页、内置模板配置和多个自定义主页。

* `.leap/components/favorites.json`：收藏组件数据。

* `.leap/components/recent.json`：最近打开组件数据。

* `.leap/components/four-quadrants.json`：四象限组件数据。

* `.leap/components/calendar.json`：周历和月历共用的日历事件数据。

* `.leap/inbox.md`：快速记录的默认收集箱。

### 布局项结构

```ts
interface LayoutItem {
  id: string;
  component: string;
  title?: string;
  col?: number;
  row?: number;
  colSpan?: number;
  rowSpan?: number;
  span?: number; // 兼容字段，等同于 colSpan
  options?: Record<string, unknown>;
}
```

### 示例布局

```json
{
  "leapHome.homeLayout": [
    {
      "id": "main-search",
      "component": "search",
      "col": 1,
      "row": 1,
      "colSpan": 12,
      "rowSpan": 1
    },
    {
      "id": "project-docs",
      "component": "currentProject",
      "title": "当前项目",
      "col": 1,
      "row": 2,
      "colSpan": 8,
      "rowSpan": 4,
      "options": {
        "limit": 8
      }
    },
    {
      "id": "quick-capture",
      "component": "quickCapture",
      "title": "快速记录",
      "col": 9,
      "row": 2,
      "colSpan": 4,
      "rowSpan": 2
    },
    {
      "id": "favorites",
      "component": "favorites",
      "title": "收藏",
      "col": 1,
      "row": 6,
      "colSpan": 4,
      "rowSpan": 4
    },
    {
      "id": "recent",
      "component": "recent",
      "title": "最近打开",
      "col": 5,
      "row": 6,
      "colSpan": 4,
      "rowSpan": 4
    },
    {
      "id": "prompts",
      "component": "prompts",
      "title": "Prompt 模板",
      "col": 9,
      "row": 4,
      "colSpan": 4,
      "rowSpan": 6,
      "options": {
        "limit": 12
      }
    }
  ]
}
```

## 组件注册机制

扩展端维护组件注册表。每个组件声明自己的元信息、默认标题、默认宽度、数据需求和渲染类型。

```ts
interface ComponentDefinition {
  type: string;
  title: string;
  defaultColSpan: number;
  defaultRowSpan: number;
  description: string;
  dataKey?: string;
  actions?: string[];
}
```

示例：

```ts
const componentRegistry = {
  search: {
    type: 'search',
    title: '搜索',
    defaultColSpan: 12,
    defaultRowSpan: 1,
    description: '搜索知识库、项目文档和 Prompt'
  },
  currentProject: {
    type: 'currentProject',
    title: '当前项目',
    defaultColSpan: 8,
    defaultRowSpan: 4,
    dataKey: 'projectItems',
    actions: ['open', 'favorite']
  },
  quickCapture: {
    type: 'quickCapture',
    title: '快速记录',
    defaultColSpan: 4,
    defaultRowSpan: 2,
    actions: ['captureNote', 'openInbox']
  }
};
```

## MVP 组件清单

第一阶段建议拆出以下组件。

| 组件        | 类型               | 说明                          |
| --------- | ---------------- | --------------------------- |
| 搜索        | `search`         | 全局搜索入口                      |
| 快速记录      | `quickCapture`   | 写入收集箱、打开收集箱                 |
| 当前项目      | `currentProject` | README、docs、`.cursor` 等项目文档 |
| 收藏        | `favorites`      | 用户收藏的文件                     |
| 最近打开      | `recent`         | 从 Leap Home 打开的文件           |
| Prompt 模板 | `prompts`        | Prompt 文件列表和复制操作            |
| 知识源状态     | `sources`        | 知识源数量、类型、错误状态               |
| 四象限       | `fourQuadrants` | 重要/紧急矩阵中的事项                 |
| 周历        | `weekCalendar`  | 本周日程和事件                     |
| 月历        | `monthCalendar` | 当月日期和事件分布                   |
| 统计        | `stats`         | 知识文件、收藏、任务、日历和存储状态          |

四象限组件第一版支持首页内新增事项、配置截止日期、编辑事项文本、完成/取消完成和删除事项。四个象限使用独立颜色标识；设置了截止日期的事项会同步展示在月历组件中，月历日期也可以直接新增事项并选择所属象限。组件顶部提供 `AI 归类` 输入框，默认使用 DeepSeek 判断重要性，并由代码结合截止日期计算紧急性。所有事项保存到 `.leap/components/four-quadrants.json`。

AI 归类规则：模型输出 `important/urgent`，扩展端再映射象限；如果设置了截止日期，逾期、当天、明天或未来 3 天内会强制视为紧急。

AI 配置通过 Cursor 命令 `Leap Home: 配置 AI` 写入用户设置，也可以在 Cursor Settings 中搜索 `Leap Home AI` 手动调整。

## 后续组件池

后续可以逐步扩展更多组件。

| 组件      | 类型                  | 说明                                     |
| ------- | ------------------- | -------------------------------------- |
| 今日笔记    | `todayNote`         | 打开或创建当天笔记                              |
| 最近修改    | `recentModified`    | 按文件修改时间展示                              |
| PARA 入口 | `paraNav`           | Projects / Areas / Resources / Archive |
| 标签入口    | `tagNav`            | 从 frontmatter 或 Obsidian 标签聚合          |
| 主题入口    | `topicNav`          | 用户配置的长期主题                              |
| 常用命令    | `commands`          | 常用 VS Code / Leap Home 命令按钮            |
| 工作区命令   | `workspaceCommands` | 项目常用 npm、pnpm、脚本命令                     |
| 待整理     | `inboxQueue`        | 收集箱中的未整理条目                             |
| 阅读队列    | `readingList`       | 待读文档或链接                                |

## 内置模板

### 1. 项目工作台 project-workbench

适合打开代码项目时使用。重点是快速回到当前项目上下文。

包含组件：

* 搜索

* 当前项目

* 快速记录

* Prompt 模板

* 收藏

* 最近打开

* 知识源状态

布局草案：

```json
[
  { "component": "search", "col": 1, "row": 1, "colSpan": 12, "rowSpan": 1 },
  { "component": "currentProject", "col": 1, "row": 2, "colSpan": 8, "rowSpan": 4 },
  { "component": "quickCapture", "col": 9, "row": 2, "colSpan": 4, "rowSpan": 2 },
  { "component": "sources", "col": 9, "row": 4, "colSpan": 4, "rowSpan": 2 },
  { "component": "prompts", "col": 1, "row": 6, "colSpan": 6, "rowSpan": 4 },
  { "component": "favorites", "col": 7, "row": 6, "colSpan": 3, "rowSpan": 4 },
  { "component": "recent", "col": 10, "row": 6, "colSpan": 3, "rowSpan": 4 }
]
```

### 2. 第二大脑首页 second-brain

适合从知识库入口开始工作。重点是知识召回、收藏和结构导航。

包含组件：

* 搜索

* 收藏

* 最近打开

* 收集箱

* 知识源状态

* 当前项目

* Prompt 模板

布局草案：

```json
[
  { "component": "search", "col": 1, "row": 1, "colSpan": 12, "rowSpan": 1 },
  { "component": "favorites", "col": 1, "row": 2, "colSpan": 4, "rowSpan": 4 },
  { "component": "recent", "col": 5, "row": 2, "colSpan": 4, "rowSpan": 4 },
  { "component": "quickCapture", "col": 9, "row": 2, "colSpan": 4, "rowSpan": 2 },
  { "component": "sources", "col": 9, "row": 4, "colSpan": 4, "rowSpan": 2 },
  { "component": "currentProject", "col": 1, "row": 6, "colSpan": 6, "rowSpan": 3 },
  { "component": "prompts", "col": 7, "row": 6, "colSpan": 6, "rowSpan": 3 }
]
```

### 3. 今日启动页 daily-start

适合每天打开 Cursor 时进入状态。重点是今天要处理什么。

包含组件：

* 搜索

* 快速记录

* 当前项目

* 收藏

* 最近打开

* Prompt 模板

* 知识源状态

布局草案：

```json
[
  { "component": "search", "col": 1, "row": 1, "colSpan": 12, "rowSpan": 1 },
  { "component": "quickCapture", "col": 1, "row": 2, "colSpan": 4, "rowSpan": 2 },
  { "component": "currentProject", "col": 5, "row": 2, "colSpan": 8, "rowSpan": 4 },
  { "component": "favorites", "col": 1, "row": 4, "colSpan": 4, "rowSpan": 3 },
  { "component": "prompts", "col": 5, "row": 6, "colSpan": 8, "rowSpan": 3 },
  { "component": "recent", "col": 1, "row": 7, "colSpan": 4, "rowSpan": 3 },
  { "component": "sources", "col": 5, "row": 9, "colSpan": 8, "rowSpan": 2 }
]
```

### 4. Prompt 控制台 prompt-console

适合大量使用 Prompt 模板的人。

包含组件：

* 搜索

* Prompt 模板

* 收藏

* 当前项目

* 快速记录

布局草案：

```json
[
  { "component": "search", "col": 1, "row": 1, "colSpan": 12, "rowSpan": 1 },
  { "component": "prompts", "col": 1, "row": 2, "colSpan": 8, "rowSpan": 5 },
  { "component": "quickCapture", "col": 9, "row": 2, "colSpan": 4, "rowSpan": 2 },
  { "component": "favorites", "col": 9, "row": 4, "colSpan": 4, "rowSpan": 3 },
  { "component": "currentProject", "col": 1, "row": 7, "colSpan": 6, "rowSpan": 3 },
  { "component": "recent", "col": 7, "row": 7, "colSpan": 6, "rowSpan": 3 }
]
```

### 5. 极简首页 minimal

适合只想快速搜索和打开文件的人。

包含组件：

* 搜索

* 收藏

* 最近打开

布局草案：

```json
[
  { "component": "search", "col": 1, "row": 1, "colSpan": 12, "rowSpan": 1 },
  { "component": "favorites", "col": 1, "row": 2, "colSpan": 6, "rowSpan": 4 },
  { "component": "recent", "col": 7, "row": 2, "colSpan": 6, "rowSpan": 4 }
]
```

## 页面渲染方案

### 数据层

Extension Host 继续负责：

* 扫描知识源。

* 生成索引。

* 读取收藏和最近打开。

* 读取配置中的模板和布局。

* 将首页模型发送给 Webview。

建议发送给 Webview 的数据结构：

```ts
interface HomeModel {
  workspaceName: string;
  activeTemplate: string;
  layout: LayoutItem[];
  components: ComponentDefinition[];
  data: {
    items: KnowledgeItem[];
    projectItems: KnowledgeItem[];
    favorites: KnowledgeItem[];
    recent: KnowledgeItem[];
    prompts: PromptItem[];
    sources: SourceSummary[];
  };
}
```

### 渲染层

Webview 不再写死“当前项目、收藏、最近打开”的顺序，而是遍历 `layout`。

伪代码：

```js
for (const block of model.layout) {
  const definition = componentRegistry[block.component];
  renderComponent(definition, block, model.data);
}
```

### 样式层

MVP 使用 CSS Grid 实现 12 栅格。

```css
.grid {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 12px;
}

.block {
  grid-column: var(--col) / span var(--col-span);
  grid-row: var(--row) / span var(--row-span);
}
```

移动或窄窗口下，所有组件自动变成单列。

## 用户配置优先级

首页布局按以下顺序解析：

1. 如果 `.leap/state.json` 保存了 `activeHomeId` 并能匹配 `customHomes`，优先使用该自定义主页。
2. 如果 `.leap/state.json` 保存了旧版 `homeLayout`，按旧版自定义布局兼容加载。
3. 如果用户配置了 `leapHome.homeLayout`，作为默认布局兜底。
4. 如果 `.leap/state.json` 保存了 `homeTemplate`，使用对应内置模板。
5. 如果用户配置了 `leapHome.homeTemplate`，作为默认模板兜底。
6. 如果没有配置，默认使用 `project-workbench`。
7. 如果模板不存在，回退到 `minimal`。

## 组件参数设计

不同组件可以支持自己的 `options`。

### 列表类组件

```json
{
  "component": "recent",
  "options": {
    "limit": 8,
    "showSource": true,
    "showPath": true
  }
}
```

### Prompt 组件

```json
{
  "component": "prompts",
  "options": {
    "limit": 12,
    "category": "coding",
    "showCopyButton": true
  }
}
```

### 快速记录组件

```json
{
  "component": "quickCapture",
  "options": {
    "defaultTarget": "inbox",
    "showOpenInbox": true
  }
}
```

## 设置入口设计

建议提供以下命令：

| 命令                   | 说明              |
| -------------------- | --------------- |
| `Leap Home: 切换主页`     | 在内置模板和自定义主页之间切换 |
| `Leap Home: 新建自定义主页` | 基于内置模板创建新的自定义主页 |
| `Leap Home: 编辑当前主页`  | 编辑当前主页           |
| `Leap Home: 退出主页编辑`  | 退出可视化编辑模式       |
| `Leap Home: 打开布局配置`  | 打开当前工作区或用户级布局配置 |
| `Leap Home: 重置首页布局`  | 清空自定义布局，回到默认模板  |

第一阶段已提供轻量可视化编辑器：在首页里添加组件、选择组件、调整网格参数并保存到 `.leap/state.json` 的 `customHomes`。

## 实现路线

### 阶段 1：组件化重构

* 保留编辑窗口 Webview Panel。

* 将当前固定页面拆成组件渲染函数。

* 新增组件注册表。

* 新增内置模板注册表。

* 默认使用 `project-workbench` 模板。

### 阶段 2：配置式布局

* 新增 `leapHome.homeTemplate` 配置，作为工作区 `.leap` 状态为空时的默认模板。

* 新增 `leapHome.homeLayout` 配置，作为工作区 `.leap` 状态为空时的默认布局。

* 支持用户通过 JSON 调整组件行列位置、宽度和高度。

* 支持组件级 `options.limit`。

### 阶段 3：模板切换命令

* 新增 `Leap Home: 切换主页`。

* 选择内置模板或自定义主页后写入工作区状态。

* 首页自动刷新。

### 阶段 4：扩展组件池

* 新增今日笔记。

* 新增最近修改。

* 新增 PARA 入口。

* 新增常用命令。

### 阶段 5：可视化布局编辑

* 在首页增加编辑模式。

* 支持移动组件网格位置。

* 支持调整宽度和高度。

* 支持启用和隐藏组件。

* 保存为用户配置。

当前第一版设计器覆盖基础能力：左侧画布拖拽组件并按 12 列网格吸附，右侧属性面板统一添加、复制、删除组件，编辑标题，调整 `col`、`row`、`colSpan`、`rowSpan` 和 `options.limit`。

## MVP 改造验收标准

完成第一轮组件化改造后，应满足：

* 首页仍然在编辑窗口打开。

* 页面由 layout 配置驱动，而不是写死模块顺序。

* 至少内置 `project-workbench`、`second-brain`、`prompt-console`、`daily-start`、`minimal` 五个模板。

* 用户可以通过配置选择模板。

* 现有功能不丢失：搜索、打开文件、收藏、最近打开、Prompt 复制、收集箱记录都可用。

## 当前结论

Leap Home 的长期形态应该是一个可组合的个人知识工作台。固定首页只能满足最早期验证，组件化和模板化才是后续扩展的基础。

下一步建议优先做“阶段 1 + 阶段 2”：把现有页面拆成组件，并用内置模板驱动布局。
