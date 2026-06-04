# 智能搜索与 AI 搜索设计

## 背景

当前社区搜索入口是 `/search?q=...`，后端 `searchCommunity(term, lang, limit)` 只把用户输入当作普通关键词，在话题、回复、分类、标签和用户中做全文/模糊匹配。

这能覆盖简单关键词搜索，但不适合这些场景：

- 用户想限制范围，比如只搜回复、只搜标题、只搜某个标签。
- 用户想组合条件，比如“独立开发分类里，最近一周关于 SEO 的热门帖子”。
- 用户不知道指令语法，希望直接输入自然语言。
- 后续要支持 AI 搜索时，不能让 AI 直接拼 SQL，需要让 AI 输出受控的搜索指令组合。

## 目标

- 搜索框支持显式指令，例如 `tag:seo sort:hot after:7d 独立开发`。
- 支持自然语言 AI 搜索：AI 先把自然语言翻译成搜索指令组合，再由后端统一执行搜索。
- 指令解析、AI 翻译和 SQL 执行严格解耦，避免 AI 直接影响数据库查询。
- 搜索结果可解释，展示“识别到的搜索条件”。
- 保持原有关键词搜索体验，用户不懂指令也能搜。

## 非目标

首版不做这些能力：

- 不做向量数据库或长期语义索引。
- 不做跨站网络搜索。
- 不让 AI 直接返回搜索结果排序结论，AI 只负责翻译查询意图。
- 不支持管理员私有内容搜索，首版只搜公开内容。
- 不做复杂权限过滤之外的个性化推荐。

## 搜索模式

搜索框保留一个输入框，但后端按三种路径处理：

1. 关键词搜索：没有任何指令时，沿用现有全文/模糊搜索。
2. 指令搜索：输入中包含 `key:value`、`@user`、`#tag`、`sort:hot` 等指令时，解析成结构化查询。
3. AI 搜索：用户点击 AI 搜索按钮，或输入以 `ai:` 开头的自然语言，由 AI 翻译成结构化查询后执行。

## 指令语法

### 基础规则

- 指令格式：`key:value`
- 支持空格分隔多个条件。
- 支持中文值、英文值和 slug。
- 带空格的值使用引号：`title:"AI 写作"`
- 普通文本会作为关键词：`seo 独立开发`
- 支持排除条件：`-tag:闲聊`
- 指令大小写不敏感：`TAG:seo` 等价于 `tag:seo`
- 未识别指令不直接报错，作为普通关键词处理，并在 UI 中提示“未识别指令”。

### 范围指令

| 指令 | 示例 | 含义 |
| --- | --- | --- |
| `type:` | `type:topic` | 搜索结果类型，支持 `topic`、`reply`、`category`、`tag`、`user` |
| `in:` | `in:title` | 搜索字段，支持 `title`、`summary`、`content`、`reply`、`user` |
| `category:` / `c:` | `category:独立开发` | 限定分类，可用分类名或 slug |
| `tag:` / `#` | `tag:seo`、`#seo` | 限定标签，可用标签名或 slug |
| `author:` / `by:` | `author:whyisee` | 限定作者 username |
| `mention:` | `mention:ai` | 搜索提及某个用户/机器人的内容 |

### 时间指令

| 指令 | 示例 | 含义 |
| --- | --- | --- |
| `after:` | `after:2026-06-01` | 只搜某日期之后 |
| `before:` | `before:2026-06-04` | 只搜某日期之前 |
| `within:` | `within:7d` | 最近 7 天，支持 `d`、`w`、`m` |
| `year:` | `year:2026` | 指定年份 |

### 内容特征指令

| 指令 | 示例 | 含义 |
| --- | --- | --- |
| `has:image` | `has:image` | 内容包含图片 |
| `has:link` | `has:link` | 内容包含链接 |
| `has:reply` | `has:reply` | 话题有回复 |
| `no:reply` | `no:reply` | 话题无回复 |
| `is:pinned` | `is:pinned` | 置顶话题 |
| `is:featured` | `is:featured` | 精选话题 |

### 排序和分页指令

| 指令 | 示例 | 含义 |
| --- | --- | --- |
| `sort:` | `sort:hot` | 支持 `relevance`、`latest`、`hot`、`views`、`replies` |
| `limit:` | `limit:20` | 返回条数，上限由后端控制 |

### 示例

```txt
seo tag:独立开发 sort:hot within:30d
```

含义：搜索最近 30 天，带“独立开发”标签，关键词包含 SEO，按热度排序。

```txt
type:reply mention:ai after:2026-06-01
```

含义：搜索 2026-06-01 之后提到 `@ai` 的回复。

```txt
category:SEO与流量 has:image sort:latest
```

含义：搜索 SEO 与流量分类下包含图片的话题，按最新排序。

## 结构化查询模型

指令解析后统一生成 `SearchPlan`，后端只执行这个结构，不直接执行原始字符串。

```ts
interface SearchPlan {
  keywords: string[];
  types: Array<"topic" | "reply" | "category" | "tag" | "user">;
  fields: Array<"title" | "summary" | "content" | "reply" | "user">;
  categorySlugs: string[];
  tagSlugs: string[];
  authorUsernames: string[];
  mentionUsernames: string[];
  dateFrom?: string;
  dateTo?: string;
  flags: {
    hasImage?: boolean;
    hasLink?: boolean;
    hasReply?: boolean;
    noReply?: boolean;
    pinned?: boolean;
    featured?: boolean;
  };
  exclude: {
    categorySlugs: string[];
    tagSlugs: string[];
    authorUsernames: string[];
  };
  sort: "relevance" | "latest" | "hot" | "views" | "replies";
  limit: number;
  source: "keyword" | "directive" | "ai";
  originalQuery: string;
  normalizedQuery: string;
  notes: string[];
}
```

## 指令解析流程

1. Tokenize：按空格切分，同时保留引号内容。
2. Normalize：统一大小写、去掉多余空白、识别 `#tag` 和 `@user`。
3. Parse：识别白名单指令。
4. Resolve：把分类名、标签名、用户名解析成数据库 slug/username。
5. Validate：限制 `limit`、日期范围、类型集合。
6. Build SearchPlan：生成后端查询计划。
7. Execute：用参数化 SQL 执行搜索。

## AI 搜索流程

AI 搜索不直接搜索数据库，而是做“自然语言到指令组合”的翻译。

### 用户体验

用户输入：

```txt
帮我找最近一个月独立开发分类里讨论 SEO 或流量增长的热门帖子
```

点击“AI 搜索”后，系统显示：

```txt
category:独立开发 (seo OR 流量增长) within:30d sort:hot type:topic
```

然后用这组指令执行搜索，并展示识别条件：

- 分类：独立开发
- 关键词：seo、流量增长
- 时间：最近 30 天
- 类型：话题
- 排序：热门

### AI 输出约束

AI 必须输出 JSON，不允许输出 SQL。

```json
{
  "keywords": ["seo", "流量增长"],
  "types": ["topic"],
  "category": "独立开发",
  "tags": [],
  "dateRange": "30d",
  "sort": "hot",
  "limit": 20,
  "normalizedQuery": "category:独立开发 seo 流量增长 within:30d sort:hot type:topic",
  "reason": "用户想找最近一个月独立开发分类中关于 SEO 或流量增长的热门帖子"
}
```

后端再把 AI JSON 转成 `SearchPlan`，进行同样的 Resolve、Validate 和 Execute。

### AI Prompt 要点

- 只允许使用系统支持的指令。
- 不允许编造分类、标签、用户名；不确定时放入关键词。
- 日期必须转成 `within:`、`after:`、`before:`。
- 输出 JSON，不输出解释性长文。
- 如果用户问题不是搜索意图，转成普通关键词搜索。

## 后端接口设计

### GET /search

继续作为页面入口。

参数：

- `q`: 用户输入。
- `mode`: `auto`、`directive`、`ai`，默认 `auto`。

行为：

- `mode=auto`：检测是否包含指令，包含则走指令搜索，否则走关键词搜索。
- `mode=directive`：强制按指令解析。
- `mode=ai`：先调用 AI 翻译，再执行指令搜索。

### POST /api/search/translate

用于前端点击 AI 搜索时异步预览 AI 翻译结果。

请求：

```json
{
  "query": "帮我找最近一个月独立开发分类里讨论 SEO 或流量增长的热门帖子"
}
```

响应：

```json
{
  "ok": true,
  "normalizedQuery": "category:独立开发 seo 流量增长 within:30d sort:hot type:topic",
  "plan": {
    "keywords": ["seo", "流量增长"],
    "types": ["topic"],
    "sort": "hot"
  },
  "warnings": []
}
```

## 服务拆分

建议新增或改造这些文件：

- `src/server/services/search.ts`
  - 保留 `searchCommunity`，内部改为调用结构化搜索。
  - 新增 `searchWithPlan(plan, lang)`。
- `src/server/services/searchParser.ts`
  - 解析用户指令为 `SearchPlan`。
- `src/server/services/searchAi.ts`
  - 调用 AI，把自然语言转成受限 JSON。
- `src/pages/api/search/translate.ts`
  - AI 搜索翻译预览接口。
- `src/pages/search.astro`
  - 增加指令提示、AI 搜索按钮、条件摘要。

## SQL 查询策略

首版继续使用 PostgreSQL，不引入新搜索引擎。

- 关键词仍使用 `to_tsvector('simple', ...)` + `ILIKE` 兜底。
- 指令过滤条件统一参数化拼接。
- `sort:hot` 可先用近似热度：
  - 话题：`reply_count * 3 + view_count * 0.2 + like_count * 5`
  - 回复：`like_count * 5`
- `has:image` 检查 Markdown/HTML 中是否含图片。
- `has:link` 检查 Markdown/HTML 中是否含链接。
- `mention:` 可 join `mentions` 表。

## 前端设计

搜索页保持工具型界面，不做营销式布局。

需要新增：

- 搜索框右侧增加 AI 搜索按钮。
- 搜索框下方显示指令提示 chips：
  - `tag:`
  - `category:`
  - `type:topic`
  - `sort:hot`
  - `within:7d`
- 搜索后显示条件摘要：
  - 关键词
  - 类型
  - 分类/标签
  - 时间范围
  - 排序
- AI 搜索时显示“AI 已翻译为：xxx”，允许用户编辑后再搜。

## 错误和降级

- AI 未配置：AI 搜索按钮置灰或提示“还没有配置 AI 模型”。
- AI 翻译失败：退回普通关键词搜索。
- 指令无效：保留原文本作为关键词，并显示 warning。
- 分类/标签不存在：作为关键词处理，不直接报错。
- `limit` 超过上限：后端强制截断。

## 安全约束

- AI 输出必须经过 JSON parse 和 schema 校验。
- AI 输出不能直接进入 SQL。
- 所有 SQL 条件都使用参数化查询。
- 搜索只返回公开内容。
- 对用户输入长度设置上限，例如 300 字符。
- AI 搜索请求限制频率，避免被刷。

## 开发步骤（一次完成）

1. 定义 `SearchPlan` 类型和默认值。
2. 实现 `parseSearchDirectives(query)`。
3. 实现分类、标签、用户的 resolve 逻辑。
4. 把现有 `searchCommunity` 改造成 `SearchPlan` 执行器。
5. 增加 `mode=auto/directive/ai` 的搜索入口。
6. 实现 `searchAi.ts`，复用现有 AI 配置服务。
7. 增加 `/api/search/translate`。
8. 优化 `search.astro`：AI 按钮、指令 chips、条件摘要、错误提示。
9. 增加最小测试数据验证：
   - 普通关键词搜索仍可用。
   - `tag:seo`、`category:独立开发` 可用。
   - `type:reply mention:ai` 可用。
   - AI 自然语言能转成指令并返回结果。

## 验收标准

- 输入普通关键词时，结果不比现有搜索更差。
- 输入指令组合时，结果符合过滤条件。
- AI 搜索能把自然语言转成可编辑的指令组合。
- AI 失败时不会影响普通搜索。
- 所有新搜索链接仍使用 `/t/:id`。
- `npm run check` 和 `npm run build` 通过。
