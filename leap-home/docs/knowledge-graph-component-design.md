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
- Cursor Rules。
- Prompt 文件。
- README / docs 下的文本文件。

代码文件默认只作为弱节点参与，不在 MVP 中深挖函数级关系。

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
  ]
}
```

字段说明：

- `node.weight`：节点重要度，用于控制大小。
- `edge.weight`：关系强度，用于排序和过滤。
- `edge.reasons`：用户可读的关系解释。
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

- 关系过滤：链接、标签、标题引用、路径邻近。
- 密度切换：轻量、标准、密集。
- 视图切换：主题簇、孤岛、最近更新。
- 刷新图谱。

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

## TODO

- [x] 写设计文档。
- [ ] 新增 `knowledgeGraph` 组件定义。
- [ ] 新增图谱构建模块。
- [ ] 从索引内容提取 Markdown 链接和 Wikilink。
- [ ] 实现共享标签、标题引用、路径邻近关系。
- [ ] 实现图谱缓存 `.leap/components/knowledge-graph.json`。
- [ ] Webview 使用 SVG 渲染局部图谱。
- [ ] 支持节点点击打开文件和关系过滤。
- [ ] 跑检查。
