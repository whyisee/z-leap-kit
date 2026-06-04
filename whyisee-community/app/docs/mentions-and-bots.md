# @ 用户与 @ 机器人功能设计

## 背景

whyisee-community 已经具备用户、话题、回复、通知和 AI 服务能力。`@用户` 和 `@机器人` 可以基于这些能力扩展，不需要重做社区基础设施。

本功能分成两部分：

- `@用户`：在话题或回复中提及用户，并给被提及用户发送通知。
- `@机器人`：把机器人作为特殊用户，用户提及机器人后触发 AI 任务，并由机器人自动回复或辅助处理。

## 目标

- 支持在话题正文和回复正文中输入 `@username`。
- 将有效提及渲染成用户主页链接。
- 给被提及用户发送站内通知，后续可扩展邮件通知。
- 支持编辑内容时更新提及关系，避免重复通知。
- 支持机器人账号，例如 `@ai`、`@seo`、`@writer`。
- 用户提及机器人时创建后台任务，机器人根据上下文自动回复。

## 非目标

首版不做这些复杂能力：

- 不用显示昵称匹配用户，避免重名。
- 不做跨站私信。
- 不做复杂权限可见性，比如私密话题里的提及权限。
- 不做实时 WebSocket 推送，通知页和 header 未读数即可。
- 不让机器人立即同步阻塞发帖流程。

## 语法约定

首版只支持 username：

```md
@kehuizou 这个问题你怎么看？
@ai 帮我总结一下这个讨论的结论
```

解析规则：

- `@` 后匹配 `username`。
- username 建议沿用注册规则，只允许字母、数字、下划线、短横线。
- 不匹配邮箱里的 `@`。
- 不匹配代码块和链接 URL 中的 `@`。
- 同一篇内容里多次提及同一用户，只记录一次。
- 作者提及自己时不发送通知。

## 数据模型

### users 增加机器人标记

```sql
ALTER TABLE users
ADD COLUMN IF NOT EXISTS is_bot BOOLEAN NOT NULL DEFAULT FALSE;
```

建议首批机器人账号：

- `@ai`：通用社区助手
- `@seo`：SEO 和内容优化助手
- `@writer`：写作助手
- `@mod`：审核助手，前期可只给管理员使用

### 新增 mentions 表

用于记录话题和回复里的用户提及。

```sql
CREATE TABLE IF NOT EXISTS mentions (
  id SERIAL PRIMARY KEY,
  source_type TEXT NOT NULL,
  source_id INTEGER NOT NULL,
  mentioned_user_id INTEGER NOT NULL,
  actor_id INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (source_type, source_id, mentioned_user_id),
  FOREIGN KEY (mentioned_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_mentions_user_created
ON mentions(mentioned_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mentions_source
ON mentions(source_type, source_id);
```

`source_type` 取值：

- `topic`
- `post`

### 新增 bot_jobs 表

机器人任务异步执行，避免用户发布内容时被 AI 调用阻塞。

```sql
CREATE TABLE IF NOT EXISTS bot_jobs (
  id SERIAL PRIMARY KEY,
  bot_user_id INTEGER NOT NULL,
  source_type TEXT NOT NULL,
  source_id INTEGER NOT NULL,
  actor_id INTEGER NOT NULL,
  prompt TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'queued',
  result_post_id INTEGER,
  error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (bot_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (result_post_id) REFERENCES posts(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_bot_jobs_status_created
ON bot_jobs(status, created_at ASC);
```

`status` 取值：

- `queued`
- `running`
- `succeeded`
- `failed`
- `cancelled`

## 服务设计

### mention 解析服务

建议新增：

```text
src/server/services/mentions.ts
```

核心函数：

```ts
extractMentionUsernames(markdown: string): string[]
resolveMentionUsers(usernames: string[]): Promise<UserMentionTarget[]>
syncMentions(input): Promise<void>
notifyMentionedUsers(input): Promise<void>
```

职责：

- 从 Markdown 中提取 `@username`。
- 去重并查询 active 用户。
- 写入 `mentions`。
- 对非 bot 用户创建 `mention` 类型通知。
- 对 bot 用户创建 `bot_jobs`。

### Markdown 渲染增强

当前内容会通过 `renderMarkdown` 生成 HTML。首版可以在 Markdown 渲染前后增加 mention 链接处理：

- 推荐先在 Markdown AST 或 HTML AST 中处理，避免误处理代码块。
- 如果先做 MVP，可以在渲染后的文本节点中处理，但必须跳过 `code`、`pre`、`a`。

输出示例：

```html
<a class="mention-link" href="/u/kehuizou">@kehuizou</a>
```

### 通知

复用现有 `createNotification`：

```ts
createNotification({
  userId: mentionedUser.id,
  actorId,
  type: "mention",
  targetType: sourceType,
  targetId: sourceId,
  title: "有人提到了你",
  body: topicTitleOrExcerpt,
  href,
});
```

通知 href：

- 话题：`/t/:id/:slug`
- 回复：`/t/:topicId/:topicSlug#post-:postId`

## API 设计

### 用户和机器人搜索

```http
GET /api/mentions/search?q=ai
```

返回：

```json
[
  {
    "username": "ai",
    "displayName": "AI 助手",
    "avatarUrl": null,
    "isBot": true
  },
  {
    "username": "kehuizou",
    "displayName": "Kehuizou",
    "avatarUrl": null,
    "isBot": false
  }
]
```

规则：

- 只返回 `status = 'active'` 的用户。
- bot 用户置顶。
- 限制返回数量，例如 8 个。
- 对未登录用户可以不返回，或只返回 bot，首版建议要求登录。

### bot job 处理接口或脚本

首版可做成脚本：

```bash
npm run bot:worker
```

后续再做成后台常驻 worker。

处理逻辑：

1. 取一条 `queued` 任务并标记为 `running`。
2. 加载话题、回复和上下文。
3. 根据 bot 类型构造 prompt。
4. 调用 AI 服务。
5. 以机器人身份创建回复。
6. 更新 `bot_jobs.result_post_id` 和 `status`。

## 前端设计

### 输入补全

在话题编辑器和回复框中支持：

- 输入 `@` 后弹出候选列表。
- 继续输入字符时请求 `/api/mentions/search?q=...`。
- 选中候选后插入 `@username `。
- bot 账号带 `AI` 或 `Bot` 小标识。
- 键盘支持：上下选择、Enter 插入、Esc 关闭。

首版实现位置：

- 新建话题正文 textarea。
- 回复 textarea。

后续可扩展到标题或摘要，但不建议首版支持。

### 展示样式

mention 链接建议样式：

- 颜色使用现有蓝色。
- hover 有轻微背景。
- bot mention 可带不同颜色，例如绿色或紫色小标识。

## 机器人行为

### @ai

通用助手，适合：

- 总结当前话题。
- 提炼争议点。
- 帮忙整理回复。
- 回答用户明确提出的问题。

示例：

```md
@ai 帮我总结一下这个讨论目前的结论
```

### @seo

SEO 助手，适合：

- 优化标题。
- 生成 SEO 摘要。
- 推荐标签。
- 提醒内容缺少哪些关键词或上下文。

### @writer

写作助手，适合：

- 扩写大纲。
- 去 AI 味。
- 改成更像社区讨论的表达。

### @mod

审核助手，前期仅管理员可触发：

- 判断是否广告。
- 判断是否低质灌水。
- 给出审核建议。

## 权限与风控

- 未登录用户不能触发 mention。
- 被禁用用户不能触发机器人。
- 每个用户每天触发机器人次数限制，例如 20 次。
- 同一 source 对同一 bot 只创建一条未完成任务，避免刷屏。
- 机器人回复必须标识为 bot 用户。
- 机器人回复内容进入正常审核策略，必要时可以先设为 `pending`。
- AI prompt 必须把用户内容视为不可信内容，防止 prompt injection。

## 一次性开发清单

本功能按一次性可用版本实现，不再拆开发阶段。

1. 数据库增加 `users.is_bot`。
2. 新增 `mentions` 表，记录话题和回复里的提及关系。
3. 新增 `bot_jobs` 表，记录机器人异步任务。
4. migration 中自动创建 `@ai`、`@seo`、`@writer`、`@mod` 默认机器人账号。
5. seed 中同步维护默认机器人账号。
6. 新增 `src/server/services/mentions.ts`，集中处理提及解析、用户解析、通知和机器人任务创建。
7. 创建话题、审核发布话题、更新话题时同步 mentions。
8. 创建回复、编辑回复时同步 mentions。
9. 被提及用户收到 `mention` 通知。
10. 有效 `@username` 渲染为 `/u/:username` 链接。
11. Markdown 渲染跳过代码块、inline code 和已有链接里的 `@username`。
12. 新增 `/api/mentions/search`，给前端 @ 补全使用。
13. 新增 `MentionAutocomplete` 组件，绑定新建话题、编辑话题、回复和编辑回复正文框。
14. 新增 `src/server/services/botJobs.ts`，负责领取机器人任务、调用 AI、生成机器人回复。
15. 用户提及 bot 时创建 `bot_jobs`，并自动尝试处理下一条队列任务。
16. 新增 `npm run bot:worker`，支持后台或手动处理队列。
17. 普通用户每天最多触发 20 条机器人任务。
18. `@mod` 只允许 admin/moderator 触发。
19. 新增 `/admin/bot-jobs` 后台页面查看机器人任务状态、错误和结果。
20. 新增 `/api/admin/bot-jobs/process`，管理员可手动处理下一条任务。

## 验收清单

- 回复中写 `@someuser` 后，对方通知页出现“有人提到了你”。
- 同一条内容多次 `@someuser` 只产生一次 mention 记录。
- 作者 @ 自己不产生通知。
- 无效 username 不产生通知。
- 正文和回复中的 `@username` 可点击进入用户主页。
- 代码块、inline code、已有链接里的 `@username` 不被转成链接。
- 输入 `@` 后能看到用户和机器人候选。
- 选择候选后插入 `@username `。
- bot 用户在候选中有明确标识。
- 回复中写 `@ai 帮我总结一下` 后，会创建 bot job 并尝试自动生成机器人回复。
- 机器人任务失败时，后台可以看到错误信息。
- 管理员可以在 `/admin/bot-jobs` 查看任务，并手动处理下一条。
- 普通用户不能短时间大量触发机器人。
