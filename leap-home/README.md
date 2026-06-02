# Leap Home

[English README](README.en.md)

Leap Home 是一个 Cursor / VS Code 个人知识库首页，把 AI 搜索、快速记录、番茄钟、任务规划、日历和知识图谱放到编辑窗口里，打开项目就能进入自己的工作台。

Personal knowledge dashboard for Cursor / VS Code: AI search, notes, Pomodoro, tasks, calendars, and knowledge graph.

![Leap Home 首页总览](https://raw.githubusercontent.com/whyisee/z-leap-kit/main/leap-home/resources/screenshots/home-overview.png)

## 安装

- 在 Cursor / VS Code 扩展面板中搜索 `Leap Home`。
- 或打开 [Open VSX 页面](https://open-vsx.org/extension/whyisee/leap-home) 安装。
- 安装后执行命令 `Leap Home: 打开知识首页`。
- 左侧状态栏会出现 Leap Home 快捷入口，点击即可重新打开首页。
- 执行 `Leap Home: 切换语言 / Switch Language` 可以在中文、英文和自动跟随 Cursor 之间切换。

## 项目信息

- GitHub 仓库：[whyisee/z-leap-kit](https://github.com/whyisee/z-leap-kit/tree/main/leap-home)
- 问题反馈：[GitHub Issues](https://github.com/whyisee/z-leap-kit/issues)
- 开源协议：[MIT](LICENSE)

## 效果预览

![快速记录](https://raw.githubusercontent.com/whyisee/z-leap-kit/main/leap-home/resources/screenshots/quick-capture.png)

![四象限、周历和月历联动](https://raw.githubusercontent.com/whyisee/z-leap-kit/main/leap-home/resources/screenshots/planning-calendar.png)

![知识图谱](https://raw.githubusercontent.com/whyisee/z-leap-kit/main/leap-home/resources/screenshots/knowledge-graph.png)

## 核心功能

- 通过命令在编辑区打开知识库首页，不占用侧边栏。
- 首页由组件和 12 列网格布局驱动，支持内置模板和多个自定义主页。
- 自定义主页编辑器：可视化添加组件、拖拽调整位置和大小、碰撞自动让位、修改标题和数量限制。
- 自动索引当前工作区中的 Markdown、代码、配置和常见文本文件，知识图谱仅处理 Markdown 类文档。
- 支持配置多个本地知识源。
- 支持按标题、文件名、知识源、相对路径、完整路径搜索。
- 自动展示当前项目的 README、docs、TODO、CHANGELOG 和 `.cursor` 相关文件。
- 支持收藏常用文件。
- 记录从 Leap Home 打开的最近文件。
- 展示 Prompt 模板，并支持一键复制到剪贴板。
- 支持搜索、快速记录、番茄时钟、倒计日、做什么推荐、四象限、周历、月历、知识图谱和统计组件。
- 左侧状态栏提供 Leap Home 快捷入口，可选择展示番茄时钟、倒计日或今日统计摘要。
- 插件数据默认存放在当前工作区的 `.leap` 目录。
- 支持把临时内容追加到 `.leap/inbox.md`。

## 本地运行

用 Cursor 或 VS Code 打开这个目录：

```sh
cd leap-home
```

然后使用 `运行 Leap Home 扩展` 调试配置启动扩展宿主。

## 代码结构

```text
src/
├── extension.js   # 插件入口，只负责注册命令和生命周期
├── panel.js       # 编辑窗口 Webview Panel 控制器
├── webview.js     # 首页 Webview HTML/CSS/前端运行时
├── webview/       # 首页前端组件模块
├── statusBar.js   # 状态栏入口和组件摘要
├── components.js  # 组件注册表
├── templates.js   # 内置模板注册表
├── layout.js      # 网格布局解析、保存、重置和模板切换
├── indexer.js     # 知识源扫描和首页数据模型
├── actions.js     # 命令动作：搜索、打开、复制、收集箱等
├── state.js       # 收藏和最近打开状态
├── storage.js     # 工作区 .leap 数据读写
├── inbox.js       # 收集箱文件处理
├── constants.js   # 常量
└── utils.js       # 通用工具
```

## 命令

| 命令 | 说明 |
| --- | --- |
| `Leap Home: 打开知识首页` | 在编辑窗口打开 Leap Home 首页 |
| `Leap Home: 切换状态栏显示组件` | 选择状态栏展示首页入口、番茄时钟、倒计日或今日统计 |
| `Leap Home: 切换语言 / Switch Language` | 切换中文、英文或自动跟随 Cursor 显示语言 |
| `Leap Home: 搜索知识库` | 搜索已索引的知识文件 |
| `Leap Home: 记录到收集箱` | 将一条内容追加到收集箱文件 |
| `Leap Home: 刷新索引` | 重新扫描知识源 |
| `Leap Home: 收藏当前文件` | 收藏当前编辑器文件 |
| `Leap Home: 复制 Prompt` | 复制 Prompt 模板到剪贴板 |
| `Leap Home: 切换主页` | 在内置模板和自定义主页之间切换 |
| `Leap Home: 新建自定义主页` | 基于内置模板创建一个新的自定义主页 |
| `Leap Home: 编辑当前主页` | 打开当前主页并进入可视化编辑模式 |
| `Leap Home: 退出主页编辑` | 退出可视化编辑模式 |
| `Leap Home: 配置 AI` | 在 Cursor 用户设置中配置 DeepSeek API Key 和模型 |
| `Leap Home: 打开调试日志` | 打开 Leap Home Output 日志 |

## 配置示例

```json
{
  "leapHome.homeTemplate": "project-workbench",
  "leapHome.homeLayout": [],
  "leapHome.sources": [
    {
      "name": "Notes",
      "path": "~/Documents/notes",
      "type": "markdown",
      "enabled": true
    }
  ],
  "leapHome.promptDirs": [
    "~/Documents/prompts"
  ],
  "leapHome.inboxPath": "${workspaceFolder}/.leap/inbox.md",
  "leapHome.maxRecentItems": 12,
  "leapHome.statusBar.enabled": true,
  "leapHome.statusBar.component": "focusTimer",
  "leapHome.language": "auto",
  "leapHome.autoIndexWorkspace": true,
  "leapHome.focusTimer.trackForegroundApp": true,
  "leapHome.focusTimer.trustedApps": [
    "Cursor",
    "Obsidian",
    "Notion",
    "Google Chrome",
    "Safari",
    "Preview"
  ],
  "leapHome.ai.provider": "deepseek",
  "leapHome.ai.deepseekModel": "deepseek-v4-flash"
}
```

AI 能力默认优先接入 DeepSeek。直接执行 `Leap Home: 配置 AI`，按提示输入 DeepSeek API Key 和模型即可；插件会写入 Cursor 用户设置。也可以手动在 Cursor Settings 中搜索 `Leap Home AI` 修改配置。

番茄时钟可以识别当前前台应用。启用 `leapHome.focusTimer.trackForegroundApp` 后，专注中切到 `leapHome.focusTimer.trustedApps` 里的应用仍会计入专注时间；插件只记录应用名称，不记录窗口标题。macOS 可能需要允许 Cursor 访问 `System Events`，如果权限不可用会自动退回到只判断 Cursor 窗口焦点。

## 网格布局

`leapHome.homeLayout` 使用 12 列网格。每个组件可以配置起始列、起始行、横向跨度和纵向跨度。

```json
{
  "leapHome.homeLayout": [
    {
      "id": "search",
      "component": "search",
      "col": 1,
      "row": 1,
      "colSpan": 12,
      "rowSpan": 2
    },
    {
      "id": "capture",
      "component": "quickCapture",
      "col": 1,
      "row": 3,
      "colSpan": 6,
      "rowSpan": 2
    },
    {
      "id": "focus",
      "component": "focusTimer",
      "col": 7,
      "row": 3,
      "colSpan": 6,
      "rowSpan": 2
    }
  ]
}
```

## 自定义主页

执行 `Leap Home: 新建自定义主页`，可以基于任意内置模板创建新的主页，并进入可视化编辑模式。执行 `Leap Home: 切换主页` 可以在内置模板和多个自定义主页之间切换；执行 `Leap Home: 编辑当前主页` 可以继续编辑当前主页。

当前支持：

- 添加组件。
- 在左侧画布拖拽组件，按 12 列网格吸附放置。
- 拖动组件右下角手柄，按网格调整组件宽度和高度。
- 移动、缩放、复制、保存时会检测组件占位，被碰撞的组件会自动移动到空白位置。
- 点击组件后，在右侧属性面板统一编辑标题、位置、尺寸和数量。
- 调整 `col`、`row`、`colSpan`、`rowSpan`。
- 调整列表类组件的 `limit`。
- 复制或删除组件。
- 保存到当前工作区 `.leap/state.json` 中的 `customHomes`。
- 恢复当前自定义主页的基准模板布局。

已实现组件：

| 组件 | 类型 |
| --- | --- |
| 搜索 | `search` |
| 快速记录 | `quickCapture` |
| 番茄时钟 | `focusTimer` |
| 倒计日 | `countdown` |
| 做什么 | `nextAction` |
| 知识图谱 | `knowledgeGraph` |
| 收藏 | `favorites` |
| Prompt 模板 | `prompts` |
| 四象限 | `fourQuadrants` |
| 周历 | `weekCalendar` |
| 月历 | `monthCalendar` |
| 统计 | `stats` |

四象限组件支持在首页内直接添加事项、配置截止日期、修改事项文本、标记完成/未完成和删除事项，数据保存到 `.leap/components/four-quadrants.json`。四个象限使用不同颜色区分；带截止日期的事项会同步显示在月历组件中，也可以在月历中点击日期后直接添加事项并选择所属象限。也可以在组件顶部输入事项、选择截止日期并点击 `AI 归类`，由 DeepSeek 判断重要性，代码再结合截止日期判断紧急性后自动添加。

内置模板：

| 模板 | 配置值 |
| --- | --- |
| 默认工作台 | `project-workbench` |
| 第二大脑首页 | `second-brain` |
| Prompt 控制台 | `prompt-console` |
| 今日启动页 | `daily-start` |
| 极简首页 | `minimal` |

## 工作区数据

Leap Home 的运行数据默认写入当前工作区的 `.leap` 目录。`.leap/state.json` 保存当前主页、内置模板配置和多个自定义主页；组件数据按组件拆到 `.leap/components`；`.leap/inbox.md` 是默认收集箱。

```text
.leap/
  state.json
  inbox.md
  components/
    favorites.json
    recent.json
    four-quadrants.json
    calendar.json
    search-history.json
    quick-capture.json
    focus-timer.json
    countdown.json
    next-action.json
    knowledge-graph.json
```

## 知识源类型

| 类型 | 文件 |
| --- | --- |
| `markdown` | `.md`, `.markdown`, `.mdx`, `.mdc` |
| `obsidian` | `.md`, `.markdown`, `.mdx`, `.mdc` |
| `workspace` | Markdown、Cursor Rules、常见代码/配置/文本文件；跳过二进制、锁文件、minified 文件和超过 1MB 的文件 |
| `prompt` | `.md`, `.markdown`, `.mdx`, `.mdc`, `.txt`, `.prompt` |

## 说明

当前版本只在本地维护索引，工作区数据存储在 `.leap` 下，不依赖数据库；AI 功能仅在主动触发时请求 DeepSeek。
