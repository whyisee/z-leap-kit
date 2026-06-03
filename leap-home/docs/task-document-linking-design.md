---
tags:
  - "task-document-linking"
  - "quadrants"
  - "knowledge-workflow"
  - "mvp"
leap_summary: "事项与文档关联能力用于把四象限待办从轻量清单升级为可追踪产出的知识工作流。"
leap_topics:
  - "事项产出"
  - "文档关联"
  - "四象限"
  - "知识工作流"
leap_related:
  - "docs/next-action-recommendation-design.md"
  - "docs/knowledge-graph-component-design.md"
  - "docs/search-component-todo.md"
leap_aliases:
  - "task output documents"
  - "事项文档关联"
  - "产出文档"
---
# 事项与文档关联设计方案

## 背景

Leap Home 当前已经具备四象限事项、搜索、快速记录、Next Action、知识图谱和 AI 写笔记能力，但这些能力之间还缺少一条稳定链路：

> 从文档产生事项，从事项推进产出，再把产出沉淀回文档。

现在的四象限更像轻量待办清单。它能记录“要做什么”和“什么时候做”，但不能稳定表达“为什么要做”“关联哪个上下文”“最终产出在哪里”。这会让一些需要交付成果的事项在完成打勾后失去痕迹。

## 产品判断

这个方向适合 Leap Home。

Leap Home 的定位不是通用项目管理工具，而是个人知识工作台。很多用户场景天然不是“把事项做完”就结束，而是需要留下文档、方案、复盘、代码说明、Prompt、会议纪要、研究记录或决策依据。

因此，事项不应该只是一行文字。更合理的形态是：

- 事项可以来自某个文档、搜索结果、快速记录或 AI 推荐。
- 事项可以指向一个或多个产出文档。
- 事项完成时，系统能提示用户打开或补齐产出。
- 文档侧能反向看到它关联过哪些事项。

## 目标

- 让事项能关联已有文档，保留行动来源和上下文。
- 让事项能一键新建产出文档，降低写文档的启动成本。
- 让搜索结果加入待办时自动保留来源文档。
- 让 Next Action 创建笔记能力可被四象限事项复用。
- 让知识图谱和搜索逐步识别任务与文档之间的关系。

## 非目标

第一阶段不做完整项目管理。

- 不做多人协作。
- 不做复杂状态流转和审批。
- 不做甘特图、看板泳道或外部任务系统同步。
- 不强制所有事项都必须有关联文档。
- 不把普通快速待办变得沉重。

## 核心概念

### 来源文档

来源文档表示事项从哪里来。

典型场景：

- 用户在搜索结果中看到某篇文档，点击“加入待办”。
- 用户阅读某个 Markdown 后添加“继续整理这篇文档”。
- AI 根据已有文档推荐一个后续行动。

来源文档的作用是帮助用户回到上下文。

### 产出文档

产出文档表示事项最终要沉淀到哪里。

典型场景：

- 写一份方案。
- 整理一个问题分析。
- 补一篇复盘。
- 新建一个项目说明。
- 把快速记录扩展成正式笔记。

产出文档的作用是帮助用户把行动变成知识资产。

### 文档角色

同一个事项可以有多个文档链接，每个链接有角色。

```json
{
  "role": "source | output | reference",
  "sourceId": "workspace:xxx",
  "sourceName": "z-leap-kit",
  "filePath": "/absolute/path/to/file.md",
  "relativePath": "docs/example.md",
  "title": "文档标题",
  "status": "draft | ready | archived",
  "createdAt": "2026-06-03T00:00:00.000Z"
}
```

建议角色：

- `source`：来源文档，说明事项从哪里来。
- `output`：产出文档，说明事项要交付到哪里。
- `reference`：参考文档，说明事项执行时可能需要查看。

## 数据模型

四象限事项当前字段保持兼容，新增 `links` 字段。

```json
{
  "id": "task-xxx",
  "text": "整理事项与文档关联方案",
  "done": false,
  "note": "",
  "dueDate": "2026-06-05",
  "source": "manual",
  "reason": "",
  "confidence": 0.8,
  "links": [
    {
      "role": "source",
      "sourceId": "workspace:xxx",
      "sourceName": "z-leap-kit",
      "filePath": "/workspace/leap-home/docs/next-action-recommendation-design.md",
      "relativePath": "leap-home/docs/next-action-recommendation-design.md",
      "title": "做什么推荐组件设计文档",
      "createdAt": "2026-06-03T00:00:00.000Z"
    },
    {
      "role": "output",
      "sourceId": "workspace:xxx",
      "sourceName": "z-leap-kit",
      "filePath": "/workspace/leap-home/docs/task-document-linking-design.md",
      "relativePath": "leap-home/docs/task-document-linking-design.md",
      "title": "事项与文档关联设计方案",
      "status": "draft",
      "createdAt": "2026-06-03T00:00:00.000Z"
    }
  ],
  "createdAt": "2026-06-03T00:00:00.000Z",
  "updatedAt": "2026-06-03T00:00:00.000Z"
}
```

兼容策略：

- 没有 `links` 的历史事项按空数组处理。
- 旧字段 `source` 继续保留，表示事项来源类型。
- 搜索实体、日历组件、番茄时钟只需要读取 `links`，不需要复制文档数据。

## 文档元数据

为了让文档侧能反向关联事项，产出文档可以写入 Leap Home frontmatter。

```yaml
leap_task_id: "task-xxx"
leap_task_title: "整理事项与文档关联方案"
leap_task_status: "draft"
leap_related:
  - "leap-home/docs/next-action-recommendation-design.md"
```

第一阶段只给新建产出文档写入这些字段。后续再考虑在已有文档中补写元数据，避免用户不期望的文档修改。

## 交互方案

### 从搜索结果加入待办

搜索结果已有“加入待办”按钮。后续点击后应该：

1. 创建四象限事项。
2. 把搜索结果文件写入 `links.role = source`。
3. 事项卡片上显示一个小的文档入口。

默认事项文案仍然可以是：

```text
处理：文档标题 / 命中标题
```

但不再丢失 `filePath`、`relativePath`、`sourceId` 和 `title`。

### 在事项上关联文档

事项卡片新增一个低干扰入口，例如“文档”图标或小按钮。

点击后展示操作：

- 打开来源文档。
- 关联已有文档。
- 新建产出文档。
- 打开产出文档。
- 取消关联。

如果事项没有任何文档，优先展示“新建产出”和“关联已有”。

### 新建产出文档

新建时不要求用户先选择目录。

默认生成候选：

1. 如果事项有来源文档：优先使用来源文档同目录。
2. 如果配置了默认目录：使用 `leapHome.taskDocuments.defaultDir`。
3. 如果没有来源和配置：使用当前知识源下的 `notes/`。
4. 如果都不可用：使用当前工作区的 `notes/`。

文件名来自事项标题，清洗非法字符，自动补 `.md`，重名则生成 `-2`、`-3`。

示例：

```text
notes/整理事项与文档关联方案.md
```

### 完成事项

当用户标记完成时：

- 如果事项没有产出文档：正常完成，不打扰。
- 如果事项有草稿产出文档：提示打开文档补充结果。
- 如果事项有关联文档但没有产出文档：可以提示“是否新建产出文档”，但只在后续版本启用，避免第一版过度打扰。

## 目录与路径简化策略

目录选择要尽量自动化。

建议新增配置：

```json
{
  "leapHome.taskDocuments.defaultDir": "notes",
  "leapHome.taskDocuments.preferSourceDirectory": true,
  "leapHome.taskDocuments.template": "default"
}
```

默认值：

- `defaultDir`: `notes`
- `preferSourceDirectory`: `true`
- `template`: `default`

路径生成规则：

1. 标题清洗：去掉路径非法字符，压缩空白，最多 80 字。
2. 目录安全：相对路径不能以 `/` 开头，不能包含 `..`。
3. 扩展名：固定生成 Markdown 文件。
4. 去重：已有文件时自动追加序号。
5. 知识源优先：优先落在可写知识源，其次工作区。

## 与现有能力的关系

### 四象限

四象限是任务本体，新增 `links` 字段和文档操作入口。

### 搜索

搜索结果加入待办时自动创建来源文档链接。搜索任务时可以展示关联文档，并支持 `@task source:xxx` 这类后续增强。

### Next Action

Next Action 已经支持 `createNote` 和 `appendNote`。后续可以复用这套写文档逻辑，让 AI 推荐创建的事项自动附带产出文档动作。

### 知识图谱

知识图谱已经识别 `leap_related`。产出文档写入 `leap_task_id` 和 `leap_related` 后，后续可以生成任务相关洞察或展示“由事项产生的文档”。

### 快速记录

快速记录可以先转事项，再从事项生成产出文档。暂不直接把每条快速记录绑定文档，避免入口过多。

## TODO

### P0：最小闭环

- [x] 扩展四象限任务数据模型，新增 `links` 字段并兼容历史数据。
- [x] 在 `addQuadrantTask` / `updateQuadrantTask` 中支持文档链接的新增、更新和删除。
- [x] 搜索结果“加入待办”时传递文件元数据，自动写入 `source` 链接。
- [x] 四象限事项卡片显示文档入口；有来源文档时可一键打开。
- [x] 新增“新建产出文档”消息处理，复用现有安全路径和去重逻辑。
- [x] 新建产出文档后把 `output` 链接写回事项。
- [x] 产出文档模板写入标题、事项信息和基础 frontmatter。
- [x] 刷新索引后新文档可被搜索和知识图谱识别。
- [x] 为历史任务 normalization 增加 `links: []` 默认值。

### P1：操作体验

- [x] 事项文档入口支持“关联已有文档”。
- [x] 新建产出文档前展示当前项目下可选目录，默认目录和来源目录优先置顶。
- [x] 支持配置 `leapHome.taskDocuments.defaultDir`。
- [x] 支持配置 `leapHome.taskDocuments.preferSourceDirectory`。
- [x] 完成事项时，如果存在草稿产出文档，提示打开补充结果。
- [x] 搜索任务结果展示关联文档标题和入口。
- [x] Next Action 的 `createTask` 动作支持附带 `links` 或 `outputDocument` 建议。

### P2：知识闭环

- [ ] 产出文档 frontmatter 支持 `leap_task_id`、`leap_task_title`、`leap_task_status`。
- [ ] 知识图谱识别任务产出文档，生成任务-文档关系。
- [ ] 支持在文档侧查看关联事项。
- [ ] 支持将事项完成状态同步到产出文档 frontmatter。
- [ ] 支持按“有产出/无产出/草稿产出”过滤事项。
- [ ] 支持把快速记录直接转成带产出文档的事项。

## 实施顺序

建议先做 P0，不要一开始做复杂选择器。

1. 数据模型兼容：`links` 字段。
2. 搜索结果加入待办保留来源文档。
3. 四象限卡片显示并打开来源文档。
4. 新建产出文档并写回 `output` 链接。
5. 产出文档模板和索引刷新。

这条顺序能最快验证产品价值：用户从文档发现事项，事项再生成文档产出，形成闭环。

## 风险与注意点

- 不要让每个事项都变成重表单；文档关联入口应保持轻量。
- 不要自动修改已有 Markdown frontmatter，除非用户明确选择。
- 绝对路径只用于内部打开文件，展示和 AI 上下文应优先使用相对路径。
- 关联文档丢失或移动时要优雅降级，不能让事项消失。
- 新建文档路径必须限制在工作区或配置知识源内。
- AI 推荐路径必须经过安全校验，不能直接信任。
