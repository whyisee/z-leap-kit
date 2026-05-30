# Leap Search 搜索组件设计方案

## 背景

当前搜索组件只在 webview 中过滤已经序列化到页面模型里的文件元信息，匹配字段包括标题、文件名、相对路径、知识源名和完整路径。它不能搜索正文，也不能解释命中原因，因此更像一个文件入口过滤器，而不是个人知识库搜索。

Leap Home 的搜索必须和 Cursor 自带搜索形成差异：Cursor 擅长代码字符串定位，Leap Search 应该擅长从个人知识库、Prompt、任务和日历上下文中找到可行动的结果。

## 产品定位

Leap Search 是 Leap Home 的知识入口和行动入口。

目标不是替代 Cursor 的代码搜索，而是补齐这些场景：

- 用自然语言找到设计文档、笔记、Prompt 和项目上下文。
- 搜索正文、标题、路径、标签、任务、日历等多类知识对象。
- 按个人使用习惯排序，例如收藏、最近打开、当前项目优先。
- 在结果中直接执行动作，例如打开文件、复制 Prompt、收藏、加入四象限、创建日历事项。

## 搜索范围

P0 必须覆盖：

- 工作区自动索引的 Markdown / MDX / MDC / Cursor Rules，以及仓库内常见代码、配置和文本文件。
- `leapHome.sources` 中配置的知识源。
- `leapHome.promptDirs` 中配置的 Prompt 文件。
- 文件标题、文件名、路径、知识源、正文内容。

后续扩展覆盖：

- Markdown headings、frontmatter、标签、wikilink、任务列表。
- `.leap` 下的四象限事项、日历事件、收集箱、收藏、最近打开。
- 当前编辑器上下文、Git 分支、最近修改文件。
- 可选的语义索引和 AI 查询理解。

## 核心体验

搜索框默认是首页核心入口。输入后结果不再只是文件名列表，而是展示：

- 分组：最相关、文档、Prompt、当前项目。
- 命中片段：展示关键词附近正文。
- 命中原因：标题命中、正文命中、路径命中、最近打开、收藏。
- 快捷动作：打开、收藏、复制 Prompt。
- 零结果诊断：展示当前索引文件数，并提示刷新索引或检查知识源。

## 查询能力

P0 查询规则：

- 大小写不敏感。
- 空格分词，多词都参与评分。
- 标题命中高于路径命中，路径命中高于正文命中。
- 收藏和最近打开加权。
- Prompt 文件在命中 Prompt 语义时加权。
- 当前项目文档加权。

P1 查询语法：

- `@docs 关键词`：只搜文档。
- `@prompt 关键词`：只搜 Prompt。
- `@code 关键词`：只搜代码和配置文件。
- `@task 关键词`：只搜任务。
- `@project 关键词`：只搜当前项目文档和代码。
- `path:docs 关键词`：限定路径。
- `recent:7d 关键词`：限定最近修改。
- `#tag 关键词`：限定标签。

## 排序规则

搜索结果先经过过滤器筛选，再按分数排序。多词查询要求每个词至少命中一个字段。

当前评分规则：

- 完全标题命中：`+90`
- 标题命中：`+62`
- heading 命中：`+52`
- 文件名命中：`+48`
- 标签命中：`+46`
- 路径命中：`+34`
- frontmatter 属性命中：`+28`
- 正文命中：`+14 + 出现次数加权`
- 知识源命中：`+16`
- 收藏：`+18`
- 当前项目：`+12`
- 最近打开：按最近程度 `+12` 到 `+1`
- Prompt：`+8`
- 代码文件：`+6`

分数相同后，按最近更新时间倒序，再按标题排序。

P2 查询理解：

- 使用 DeepSeek 做轻量意图识别和查询改写。
- 支持“上次那个关于四象限 AI 分类的设计”这类自然语言查询。
- 使用 AI 对候选结果摘要和重排，但核心搜索必须在本地可用。

## 技术架构

搜索逻辑从 webview 移到扩展端，避免把大量正文塞进 webview 模型。

```text
webview search input
  -> postMessage(searchQuery)
  -> panel.handleMessage
  -> index.search(query, options)
  -> postMessage(searchResults)
  -> webview renderSearchResults
```

索引对象保留在扩展进程内存中：

```js
{
  id,
  title,
  fileName,
  filePath,
  relativePath,
  sourceName,
  sourceType,
  updatedAt,
  isPrompt,
  category,
  searchContent,
  headings,
  tags,
  searchLines
}
```

P0 暂时不落盘全文索引，刷新索引时读取文件正文并保存在内存中。后续可将索引拆到 `.leap/search/`：

```text
.leap/search/
  metadata.json
  chunks.json
  inverted-index.json
  entities.json
  embeddings.json
```

## P0 实现范围

本阶段先解决“搜不到正文”的关键问题：

- 读取 Markdown / Prompt / 工作区代码与文本正文，建立内存全文索引。
- 新增扩展端 `index.search(query, options)`。
- webview 输入搜索时向扩展端请求结果。
- 搜索结果展示分组、命中片段、命中原因。
- 保留原有打开、收藏、复制 Prompt 能力。
- 零结果时提示刷新索引和检查知识源。

## 后续路线

P1：结构化搜索

- 解析 headings、frontmatter、tags、tasks。
- 支持查询语法和过滤器。
- 支持打开后定位到 heading 或命中文本附近。

P2：搜索到行动

- 结果上直接加入四象限、创建日历事项、复制 Prompt、生成任务。
- 搜索组件展开为“搜索工作台”：左侧结果，右侧预览和动作。

P3：AI 增强

- DeepSeek 查询理解。
- 本地检索后 AI 摘要和重排。
- 可选 embedding 语义索引。

## 当前实现进度

已完成 P0：

- 正文索引和扩展端搜索服务。
- 搜索结果分组、命中片段、命中原因。
- 零结果诊断和刷新索引入口。

已完成 P1 的主体能力：

- 解析 Markdown heading、frontmatter title、frontmatter/tags、正文行。
- 支持 `@docs`、`@prompt`、`@code`、`@task`、`@calendar`、`@inbox`、`@project`、`path:`、`recent:` 和 `#tag` 查询过滤。
- 搜索框下方提供 `@` 命令快捷按钮，点击即可插入或替换筛选命令。
- 搜索结果返回命中行号和最近 heading。
- 点击结果打开文件时定位到命中行。
- 四象限事项、日历事件、收集箱已纳入统一搜索。

已完成部分 P2：

- 结果支持打开、收藏、复制 Prompt。
- 结果支持一键加入四象限的重要不紧急。
- 四象限事项结果支持直接标记完成。

## 验收标准

P0 完成后，用户输入一个只出现在 Markdown 正文中的关键词，应该能搜到对应文档，并看到命中片段和命中原因。

搜索组件必须优雅处理：

- 索引未完成。
- 没有结果。
- 知识源报错。
- 搜索结果过多。
