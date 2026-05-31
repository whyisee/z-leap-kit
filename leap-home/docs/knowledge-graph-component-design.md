---
tags:
  - "knowledge-graph"
  - "design-doc"
  - "component"
  - "mvp"
  - "insight"
leap_summary: "知识图谱组件设计文档定义了从文档关系挖掘到可视化与洞察整理的完整方案，并与搜索组件设计方案紧密关联。"
leap_topics:
  - "知识图谱"
  - "文档关系挖掘"
  - "组件设计"
  - "MVP范围"
  - "图谱洞察"
  - "AI整理"
  - "交互设计"
leap_related:
  - "docs/search-component-design.md"
leap_organized_by: "Leap Home AI"
leap_organized_at: "2026-05-31T08:46:51.178Z"
---
# 知识图谱组件设计文档

## 目标

知识图谱组件用于从当前工作区和已配置知识源中挖掘文档关系，帮助用户看到“这些文档为什么有关联”。它不是为了做一个炫酷的点线图，而是为了让个人知识库从文件列表变成可探索的关系网络。

## 产品定位

Leap Home 已经有搜索组件负责“找到某个东西”。知识图谱组件负责回答另一类问题：

- 这个文档和哪些文档有关？
- 某个主题散落在哪些文件里？
- 哪些文档是孤岛，可能需要整理或补链接？
- 哪些 Prompt、设计文档、任务说明在同一个上下文里？

图谱必须可解释。每条边都要有关系原因，例如“Markdown 链接”“共享标签”“同目录主题”“标题被正文引用”。

更重要的是，知识图谱不应该只是一张可视化图。它需要把关系转成可执行洞察，帮助用户整理知识库、找到上下文和决定下一步维护动作。

## MVP 范围

- 新增组件 `knowledgeGraph`。
- 基于现有索引结果生成文档节点。
- 挖掘以下关系：
  - Markdown 链接：`[title](path)`。
  - Wikilink：`[[Note]]`。
  - 共享标签：两个文档拥有相同标签。
  - 标题引用：一个文档正文出现另一个文档标题或文件名。
  - 路径邻近：同目录或同模块下的文档。
- 计算边权重和关系原因。
- 展示局部图谱，不默认展示全量大图。
- 支持点击节点打开文件。
- 支持点击节点后只看一跳邻居。
- 支持按关系类型过滤。
- 生成图谱洞察：
  - 孤岛文档：没有进入任何关系的文档。
  - 强相关但未显式链接：有标题引用、共享标签等强关系，但没有 Markdown/Wikilink。
  - 核心入口候选：连接关系很多，适合整理成主题入口。
  - 旧核心文档：仍然有多条关系，但较久未更新。
- 洞察支持打开、搜索、AI 整理。AI 整理会优先更新目标 Markdown 文档的 frontmatter 元数据，避免把小整理动作变成待办。
- 图谱缓存存储在 `.leap/components/knowledge-graph.json`。

## 暂不做

- AI 语义关系挖掘。
- Embedding 向量索引。
- 大规模力导向布局优化。
- 跨工作区全局图谱。
- 图谱手动编辑。
- 复杂图数据库。

## 数据来源

P0 使用现有索引器里的文件信息：

- `items`：已索引文档、代码、Prompt、配置文件。
- `title`：文档标题或文件名。
- `relativePath`：相对路径。
- `searchContent`：正文片段。
- `headings`：标题层级。
- `tags`：标签。
- `sourceType`：知识源类型。
- `updatedAt`：更新时间。

优先处理文档类内容：

- Markdown / MDX / MDC。
- Markdown 格式的 Prompt 文件。
- README.md / docs 下的 Markdown 文件。

代码文件和非 Markdown 文本不进入知识图谱，避免 AI 整理误写代码或配置文件。

## 数据模型

```json
{
  "version": 1,
  "generatedAt": "2026-05-31T10:00:00.000Z",
  "indexSignature": "hash...",
  "nodes": [
    {
      "id": "file:/docs/search-component-design.md",
      "type": "document",
      "title": "Leap Search 搜索组件设计方案",
      "filePath": "/workspace/leap-home/docs/search-component-design.md",
      "relativePath": "docs/search-component-design.md",
      "tags": ["search", "design"],
      "weight": 8
    }
  ],
  "edges": [
    {
      "id": "edge-...",
      "source": "file:/docs/search-component-design.md",
      "target": "file:/docs/search-component-todo.md",
      "type": "title-reference",
      "weight": 42,
      "reasons": ["标题引用", "同目录"]
    }
  ],
  "insights": [
    {
      "id": "missing-link:edge-...",
      "type": "missing-link",
      "title": "补链接：搜索设计 ↔ 搜索 TODO",
      "reason": "关系很强但没有显式链接。",
      "filePath": "/workspace/docs/search.md",
      "query": "搜索设计 搜索 TODO",
      "relatedFiles": [
        {
          "title": "搜索 TODO",
          "filePath": "/workspace/docs/search-todo.md",
          "relativePath": "docs/search-todo.md"
        }
      ]
    }
  ]
}
```

字段说明：

- `node.weight`：节点重要度，用于控制大小。
- `edge.weight`：关系强度，用于排序和过滤。
- `edge.reasons`：用户可读的关系解释。
- `insight.type`：图谱洞察类型，用于驱动整理动作。
- `indexSignature`：根据文件数量、路径、更新时间生成，用于判断缓存是否过期。

## 关系挖掘规则

边权重使用加权求和：

- Markdown 明确链接：`+90`
- Wikilink：`+86`
- 标题被另一个文档正文引用：`+54`
- 文件名被另一个文档正文引用：`+44`
- 共享标签：每个标签 `+22`，最多 `+66`
- 同目录：`+16`
- 同一级 docs 模块：`+12`
- Prompt 与文档共享关键词：`+10`

过滤规则：

- 图谱只接收 Markdown / MDX / MDC / Markdown 后缀文件。
- 排除 `category=code` 的索引项，即使它能被搜索组件索引。
- 边权重低于阈值不展示，默认阈值 `30`。
- 每个节点最多保留前 `8` 条强关系。
- 全图最多展示 `40` 个节点、`80` 条边。
- 如果图谱过密，优先保留当前项目、收藏、最近更新、搜索命中相关节点。

节点权重：

- 被链接次数高：增加权重。
- 收藏文档：增加权重。
- 最近更新：增加权重。
- Prompt 文件：略微增加权重。
- 孤立节点：降低权重，但在“孤岛”视图中可展示。

## 交互设计

组件默认展示局部图谱：

- 没有选中节点时，展示权重最高的主题簇。
- 点击节点后，以该节点为中心展示一跳邻居。
- 节点悬浮显示标题、路径、入度、出度。
- 边悬浮显示关系原因和权重。
- 双击或点击打开按钮打开文档。

控件：

- 视图切换：全图、主题簇、孤岛、最近更新。
- 关系过滤：链接、标签、标题引用、路径邻近。
- 密度切换：轻量、标准、密集。
- 刷新图谱。
- 显示当前视图数量和全图数量，例如 `当前 12/40 节点 · 18/80 关系`。

洞察面板：

- 没有选中节点时，展示整个知识库最值得处理的 3-4 条全局洞察。
- 点击节点后，洞察切换为当前节点上下文，优先展示与该节点相关的补链接、补元数据、入口整理、孤岛处理。
- 支持打开相关文档。
- 支持按洞察主题发起搜索。
- 支持 AI 整理：读取目标文档和相关文档片段，让 DeepSeek 生成结构化元数据并写回目标文档。
- AI 整理优先更新 Markdown frontmatter 元数据：`tags`、`leap_summary`、`leap_topics`、`leap_related`、`leap_aliases`、`leap_organized_at`。
- `leap_related` 会进入知识图谱，形成“AI 元数据关联”边；整理完成后刷新索引和知识图谱。
- AI 整理需要在页面内展示清晰反馈：读取文档、AI 生成、写回文档、完成或失败。

视觉原则：

- 不做满屏毛线球。
- 节点数量少于 8 时使用列表式关系视图补充说明。
- 图谱必须有文字解释，不只显示点线。

## 技术设计

图谱生成放在扩展端：

```text
index.refresh()
  -> graphBuilder.build(items)
  -> write graph cache
  -> model.data.knowledgeGraph
  -> webview renderKnowledgeGraph
```

渲染 MVP 使用原生 SVG：

- 不引入图表库。
- 使用简单圆形布局或分层径向布局。
- 中心节点在中间，一跳节点环绕。
- 全局主题簇使用轻量 force 近似算法，先不追求复杂物理效果。

## 与 Leap Home 的关系

- 搜索组件可以把当前搜索结果传给图谱，形成“搜索结果关系图”。
- 收藏可以提高节点权重。
- Prompt 模板可以通过共享主题和引用文档进入图谱。
- 做什么推荐组件可以使用图谱发现“当前任务相关文档”。

## 价值路线

图谱的价值优先级：

1. 知识健康诊断：发现孤岛、旧核心文档、缺失链接。
2. 搜索增强：搜索后展示相关上下文，而不是只给命中文件。
3. 做什么推荐增强：给任务推荐相关资料，一键打开上下文。
4. 整理动作生成：小整理动作由 AI 直接写回文档；较大整理再转成待办。
5. 影响分析：修改核心文档前提示可能受影响的相关文档。

## TODO

- [x] 写设计文档。
- [x] 新增 `knowledgeGraph` 组件定义。
- [x] 新增图谱构建模块。
- [x] 从索引内容提取 Markdown 链接和 Wikilink。
- [x] 实现共享标签、标题引用、路径邻近关系。
- [x] 实现图谱缓存 `.leap/components/knowledge-graph.json`。
- [x] Webview 使用 SVG 渲染局部图谱。
- [x] 支持节点点击聚焦、一跳邻居展示、双击/按钮打开文件。
- [x] 支持关系类型过滤：全部、链接、标签、引用、路径。
- [x] 支持视图切换：全图、主题、孤岛、最近。
- [x] 生成图谱洞察：孤岛、强相关未链接、核心入口、旧核心文档。
- [x] 点击节点后切换到节点洞察。
- [x] 显示当前视图节点/关系数量和全图数量。
- [x] 洞察支持打开、搜索、AI 整理。
- [x] AI 整理写入目标 Markdown 文档的 frontmatter 元数据。
- [x] 图谱识别 `leap_related` 并生成元数据关系边。
- [x] 整理完成后刷新索引和知识图谱。
- [x] AI 整理展示执行提示和阶段反馈。
- [x] 跑检查。
- [ ] 接入搜索结果生成局部图谱。
- [ ] 将图谱关系用于“做什么推荐”的相关文档建议。
- [ ] 增加节点/边详情面板。
- [ ] 生成主题索引页。
- [ ] 增加核心文档影响分析。
- [ ] AI 整理支持更细粒度的 diff 预览和确认。

<!-- leap-home:knowledge-graph:missing-link:edge:379fc2752548bbf7:start -->

## Leap Home 自动整理：在知识图谱组件设计文档中补充了缺失链接的自动整理区块，建议与搜索组件设计方案互链。

## Leap Home 自动整理

### 补链接：知识图谱组件设计文档 ↔ Leap Search 搜索组件设计方案

这两份设计文档在内容上高度相关，共享搜索与图谱的协作关系（如搜索组件可将结果传给图谱生成关系图），但目前没有显式链接。建议互相补充以下链接：

- 在 `knowledge-graph-component-design.md` 的“与 Leap Home 的关系”一节中，添加链接：[Leap Search 搜索组件设计方案](docs/search-component-design.md)。
- 在 `search-component-design.md` 的“后续路线”或“背景”中，添加链接：[知识图谱组件设计文档](docs/knowledge-graph-component-design.md)。

> **复查提示**：检查是否还有其他同层级的关联文档（如搜索 TODO 或待办列表）也需要补充链接，保持知识库连接性。

<!-- leap-home:knowledge-graph:missing-link:edge:379fc2752548bbf7:end -->

<!-- leap-home:knowledge-graph:missing-link:edge:379fc2752548bbf7:end -->
