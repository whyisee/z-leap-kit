# Leap Home 设计文档

## 项目简介

**Leap Home** 是一个面向 Cursor 的个人知识库首页插件。它不是新的笔记系统，而是一个在编辑窗口中打开的知识入口、项目上下文启动页和个人工作流面板。

用户打开 Cursor 后，可以通过 Leap Home 快速回到常用文档、项目说明、知识笔记、Prompt 模板和待整理内容，从而减少在文件夹、笔记软件和聊天窗口之间来回切换的成本。

## 产品定位

一句话定位：

> Cursor 里的个人知识库首页，帮助用户快速召回资料、沉淀上下文、启动工作流。

核心价值：

* 快速找到重要知识和项目资料。

* 把散落在本地目录、Obsidian、项目文档中的内容汇聚到一个入口。

* 为 Cursor 使用场景提供 Prompt、模板、项目上下文和知识导航。

* 让个人知识库从“存起来”变成“用起来”。

## 命名

推荐项目名：**Leap Home**

备选名称：

* KnowDock

* MindPort

* Recall Hub

* Z-Knowledge Home

* 知跃首页

当前建议使用 **Leap Home**，原因是名称简洁，和 `z-leap-kit` 的能力跃迁主题一致，也适合作为 Cursor 插件名称。

## 目标用户

* 高频使用 Cursor 的开发者。

* 有本地 Markdown 知识库、Obsidian Vault 或项目文档的人。

* 经常复用 Prompt、模板、代码片段和工作流的人。

* 希望把学习、开发、研究资料整合到同一个工作入口的人。

## 使用场景

### 1. 打开 Cursor 后快速进入工作状态

用户进入 Leap Home 后，可以看到最近打开的知识文档、当前项目 README、常用 Prompt 和待整理收集箱。

### 2. 在项目中快速查找上下文

当用户打开某个代码仓库时，插件自动展示该项目相关文档，例如：

* `README.md`

* `docs/`

* `CHANGELOG.md`

* `TODO.md`

* `.cursor/rules`

* 项目关联笔记

### 3. 快速复用 Prompt 和模板

用户可以从首页选择常用 Prompt，例如代码审查、重构、文档生成、Debug、PR 描述等，然后复制到剪贴板或插入当前编辑器。

### 4. 快速记录灵感和临时信息

用户可以通过命令快速写入收集箱，记录想法、链接、待办、代码片段或临时资料。

## MVP 功能

第一版优先做轻量、稳定、可用的知识首页。

### 1. 编辑窗口首页

通过命令在 Cursor 编辑窗口中打开 Leap Home Webview 首页，首页以普通编辑器标签页呈现，不占用侧边栏空间。

首页包含：

* 最近文件

* 收藏文件

* Prompt 模板

* 收集箱快速入口

* 当前项目文档入口

### 2. 知识源配置

支持在插件配置中添加一个或多个本地目录。

初期支持：

* Markdown 目录

* Obsidian Vault

* 当前 Workspace

* Prompt 目录

示例配置：

```json
{
  "leapHome.sources": [
    {
      "name": "Obsidian",
      "path": "/Users/me/Documents/notes",
      "type": "markdown"
    },
    {
      "name": "Prompt 模板",
      "path": "/Users/me/Documents/prompts",
      "type": "prompt"
    }
  ]
}
```

### 3. 文件扫描

扫描配置目录中的 Markdown 文件，提取基础信息：

* 文件路径

* 文件名

* 标题

* 更新时间

* 所属知识源

初期只做本地扫描，不引入数据库。

### 4. 搜索和快速打开

提供搜索框，支持按以下内容过滤：

* 文件名

* Markdown 一级标题

* 来源名称

点击搜索结果后，在 Cursor 编辑器中打开对应文件。

### 5. 收藏和最近访问

支持对常用文件添加收藏，并记录最近从 Leap Home 打开的文件。

本地状态存储在当前工作区的 `.leap` 目录中：模板和布局保存到 `.leap/state.json`，组件数据按组件保存到 `.leap/components/*.json`。

### 5.1 四象限 AI 归类

四象限组件支持手动维护事项和截止日期，也支持输入事项后由大模型辅助分类。第一版优先接入 DeepSeek，通过 Chat Completions 返回结构化 JSON。为了避免模型随意给象限，扩展端优先读取 `important/urgent` 布尔值，并结合截止日期重新映射象限；逾期、当天、明天或未来 3 天内截止的事项强制视为紧急。

### 6. Prompt 模板区

将指定目录中的 Markdown 或纯文本文件作为 Prompt 模板展示。

操作能力：

* 点击复制 Prompt 内容。

* 后续支持插入到当前编辑器。

### 7. 收集箱快速记录

提供命令：

```text
Leap Home: 记录到收集箱
```

执行后输入一段内容，插件将其追加到配置的收集箱文件，或创建一条新的 Markdown 笔记。

## 非 MVP 功能

以下能力暂不放入第一版，避免范围过大。

* AI 自动总结知识卡片。

* 语义搜索。

* 知识图谱。

* 双链和反向链接分析。

* 多设备同步。

* 复杂标签系统。

* Web 端知识库。

## 功能模块

### 首页 Dashboard

首页是插件的核心界面，建议采用信息密度适中的工作台布局。

模块建议：

* 搜索框

* 当前项目

* 最近打开

* 收藏

* Prompt 模板

* 收集箱

* 知识源列表

### 当前项目面板

根据 Cursor 当前打开的 Workspace 自动识别项目文档。

优先展示：

* 根目录 README

* `docs/` 下的文档

* `.cursor/` 下的规则文件

* 常见说明文件

### 知识源面板

展示用户配置的知识来源。

每个来源显示：

* 名称

* 类型

* 文件数量

* 最近更新时间

### Prompt 面板

展示常用 Prompt 模板。

建议按用途分组：

* Coding

* Review

* Debug

* Writing

* Research

* Planning

### 收集箱面板

用于承接没有整理好的临时内容。

初期可以只显示收集箱文件入口和快速记录按钮。

## 插件命令设计

建议提供以下命令：

| 命令                     | 说明                   |
| ---------------------- | -------------------- |
| `Leap Home: 打开知识首页`    | 在编辑窗口打开 Leap Home 首页 |
| `Leap Home: 搜索知识库`     | 搜索知识库文件              |
| `Leap Home: 记录到收集箱`    | 快速记录一条内容到收集箱         |
| `Leap Home: 刷新索引`      | 重新扫描知识源              |
| `Leap Home: 收藏当前文件`    | 收藏当前文件               |
| `Leap Home: 复制 Prompt` | 复制 Prompt 模板         |
| `Leap Home: 切换主页`      | 在内置模板和自定义主页之间切换     |
| `Leap Home: 新建自定义主页`   | 基于内置模板创建新的自定义主页     |
| `Leap Home: 编辑当前主页`    | 打开当前主页并进入可视化编辑模式    |
| `Leap Home: 退出主页编辑`    | 退出可视化编辑模式            |

## 配置项设计

建议提供以下配置：

| 配置项                           | 类型      | 说明                 |
| ----------------------------- | ------- | ------------------ |
| `leapHome.sources`            | array   | 知识源列表              |
| `leapHome.inboxPath`          | string  | 收集箱文件路径            |
| `leapHome.promptDirs`         | array   | Prompt 模板目录        |
| `leapHome.maxRecentItems`     | number  | 最近访问数量             |
| `leapHome.autoIndexWorkspace` | boolean | 是否自动索引当前 Workspace |

## 数据结构草案

### KnowledgeSource

```ts
interface KnowledgeSource {
  id: string;
  name: string;
  path: string;
  type: 'markdown' | 'obsidian' | 'prompt' | 'workspace';
  enabled: boolean;
}
```

### KnowledgeItem

```ts
interface KnowledgeItem {
  id: string;
  sourceId: string;
  title: string;
  fileName: string;
  filePath: string;
  tags: string[];
  updatedAt: number;
}
```

### PromptItem

```ts
interface PromptItem {
  id: string;
  title: string;
  filePath: string;
  category?: string;
  contentPreview: string;
}
```

## 技术方案

### 插件形态

Leap Home 作为 Cursor / VS Code Extension 实现。

核心组成：

* Extension Host：扫描文件、读取配置、执行命令、打开文档。

* Webview Panel：在编辑窗口中展示首页 UI。

* VS Code API：读取 workspace、剪贴板和文件系统。

### 前端界面

MVP 可使用简单 HTML、CSS 和 TypeScript 实现 Webview，避免过早引入复杂框架。

如果后续界面复杂度上升，可以再迁移到：

* React

* Vue

* Svelte

### 本地索引

MVP 不需要独立数据库。可以在内存中建立索引，并将模板、布局写入 `.leap/state.json`，将收藏、最近访问、四象限事项和日历事件分别写入 `.leap/components/*.json`。

后续如果文件数量较大，再考虑：

* SQLite

* ripgrep 集成

* minisearch

* semantic search index

## 交互草案

### 首页布局

```text
┌─────────────────────────────────────┐
│ 搜索知识、项目文档、Prompt          │
├─────────────────────────────────────┤
│ 当前项目                            │
│ README.md  docs/  .cursor/rules     │
├─────────────────────────────────────┤
│ 收藏                                │
│ - System Design Notes               │
│ - Cursor Prompt Library             │
├─────────────────────────────────────┤
│ 最近打开                            │
│ - API Debug Checklist               │
│ - Weekly Review Template            │
├─────────────────────────────────────┤
│ Prompt 模板                         │
│ [Review] [Refactor] [Debug]         │
├─────────────────────────────────────┤
│ 收集箱                              │
│ [记录到收集箱] [打开收集箱]         │
└─────────────────────────────────────┘
```

### 搜索流程

1. 用户在首页搜索框输入关键词。
2. Webview 向 Extension Host 请求搜索结果。
3. Extension Host 在本地索引中过滤匹配项。
4. 用户点击结果。
5. 插件打开对应文件，并更新最近访问记录。

### 记录到收集箱流程

1. 用户执行 `Leap Home: 记录到收集箱`。
2. 插件弹出输入框。
3. 用户输入内容。
4. 插件将内容写入收集箱文件。
5. 插件提示记录成功。

## 路线图

### v0.1

* 插件项目初始化。

* 编辑窗口 Webview 首页。

* Workspace README 和 docs 快捷入口。

* 手动刷新索引。

### v0.2

* 配置多个知识源。

* Markdown 文件扫描。

* 搜索和打开文件。

* 最近访问记录。

### v0.3

* 收藏功能。

* Prompt 模板展示和复制。

* 收集箱快速记录。

### v0.4

* Obsidian frontmatter 标签解析。

* 当前项目关联知识推荐。

* 首页分组和排序优化。

### v0.5+

* 语义搜索。

* AI 摘要。

* 知识图谱。

* 双链和反向链接。

## 待确认问题

* 插件主要服务中文用户还是中英文混合用户？

* 知识库默认是否优先兼容 Obsidian？

* Prompt 模板是复制到剪贴板，还是直接插入 Chat 输入框？

* 收集箱是追加到固定文件，还是每天生成独立日记文件？

* 首页 UI 是否要做成紧凑工具风格，还是更像新标签页？

## 当前结论

Leap Home 的第一阶段应保持轻量：先把个人知识库入口、当前项目文档、Prompt 模板和收集箱打通。只要能稳定地“找到、打开、复用、记录”，这个插件就已经能为 Cursor 用户带来明显价值。
