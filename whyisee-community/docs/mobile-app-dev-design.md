# whyisee.xyz 移动端 App 开发设计方案（服务端 + 客户端）

更新日期：2026-11-17
上游文档：`docs/mobile-app-design.md`（路线决策 ADR，本文不推翻，只承接）

## 0. 本文定位

`mobile-app-design.md` 已经定了三件事：混合壳、远程 URL、Flutter。本文补它没写的两半：

- **服务端**：现在到底缺哪些接口、怎么加、加在哪、怎么保证不破坏网页。
- **客户端**：Flutter 工程长什么样、每个模块怎么实现、验收怎么验。

两条贯穿全文的约束，来自上游文档，不再重复论证：

1. **不为 app 复制一套业务逻辑。** 服务端只加"协议适配层"，业务仍然调 `src/server/services/*`。
2. **app 适配不污染网页。** 服务端不改现有页面与表单流；客户端视觉差异靠注入 CSS。

---

## 1. 现状核实（实测，2026-11-17）

上游文档 §2 的事实基本准确，但有 4 处需要修正，它们直接影响工作量估算。

### 1.1 修正一：已有 6 个只读 JSON 端点，不是"没有 API"

| 端点 | 文件 | 认证 | 说明 |
|---|---|---|---|
| `GET /api/health` | `src/server/api/app.ts` | 无 | 存活探针 |
| `GET /api/categories` | 同上 | 无 | 分类列表 |
| `GET /api/tags` | 同上 | 无 | 标签列表 |
| `GET /api/topics` | 同上 | 无 | 话题列表（`limit` 无上限校验，**无 offset，不能翻页**） |
| `GET /api/topics/:id` | 同上 | 无 | 单话题，**不含回帖、不含互动状态** |
| `GET /api/recommendations/see` | `src/pages/api/recommendations/see.ts` | 可选 cookie | 看见流，有 `category/tag/sort/limit/offset` |

**含义**：看见流和话题详情的数据源已经存在，客户端不需要等后端从零起。真正缺的是"详情聚合 + 写操作 + 分页游标 + token 认证"，不是"整套 API"。

上游 §3 ADR-1 说"现有 API 是给 SSR 表单用的，不是给客户端消费的"——这句话对**写操作**成立，对**读操作**已经过时。

### 1.2 修正二：`security.checkOrigin` 默认开启，multipart 上传会被 403

Astro 版本 `6.4.2`，`security.checkOrigin` 默认 `true`（`node_modules/astro/dist/core/config/schemas/base.js`）。

实际校验逻辑（`node_modules/astro/dist/core/app/middlewares.js`）只有 12 行，规则是：

```
非 GET/HEAD/OPTIONS:
  有 content-type 且是 form 类(urlencoded / multipart / text-plain):
      origin === url.origin ? 放行 : 403
  有 content-type 但不是 form 类(application/json 等):
      放行
  没有 content-type:
      origin === url.origin ? 放行 : 403
```

推出来的三个结论，全部是硬约束：

1. 原生发 `POST application/json` → **放行**，不需要改配置。
2. 原生发 `POST multipart/form-data`（配图上传）→ **403**，因为 dio 不带 `Origin` 头。**已实测复现**：不带 `Origin` 返回 403，带上 `Origin: <站点 origin>` 返回 200。
3. WebView 内发任何请求 → 放行，因为页面本身就在 `https://whyisee.xyz`。

**这是上游文档完全没有覆盖的坑，且是中奖概率 100% 的那种。** 对策见 §3.9。

### 1.3 修正三：详情页 canonical 是 `/t/:id`

`src/pages/t/[id]/[slug].astro` 只是把带 slug 的地址 301 到 `/t/:id`。所以深度链接、推送落地、分享链接统一走 `/t/:id`，不需要处理 slug 参数。

### 1.4 修正四：迁移是"往数组里追加一项"

`scripts/migrate.ts` 里是一个 `migrations[]` 数组，每项 `{ version, sql }`，已应用记录在 `schema_migrations`。加表/加列的方式是**追加一个 version 对象**，不是维护独立 SQL 文件目录。

### 1.5 可复用资产清单

| 资产 | 位置 | app 侧怎么用 |
|---|---|---|
| `listSeeRecommendations()` | `src/server/services/recommendations.ts` | feed 直接调，不改签名 |
| `getTopicById()` / `listPostsForTopic()` | `src/server/services/topics.ts` / `posts.ts` | 详情聚合直接调 |
| `getTopicInteractionState()` / `toggleReaction()` 等 | `src/server/services/interactions.ts` | 点赞/收藏/关注直接调 |
| `renderMarkdown()` + `enhanceMarkdownHtml()` | `src/lib/markdown.ts` | **服务端渲染 HTML，客户端只渲染 HTML**，保证与网页一致 |
| `getLangFromRequest()` / `t()` | `src/lib/i18n.ts` | 语言协商，app 传 `Accept-Language` |
| `recordUserContentEvent()` / `recordRecommendationImpressions()` | `recommendations.ts` | app 埋点写进同一张事件表，推荐模型不必分端 |

---

## 2. 总体架构

```
┌─────────────────────────────────────────────────────────────────┐
│ Flutter App (whyisee-app)                                       │
│                                                                 │
│  Shell: StatefulShellRoute.indexedStack → 4 tab 保活             │
│  ┌──────────────────────────┬──────────────────────────────┐    │
│  │ Native (Dart)            │ WebView (Astro SSR)          │    │
│  │  · 看见 feed              │  · /login /signup            │    │
│  │  · 帖子详情                │  · /search /settings/*       │    │
│  │  · 通知（P2）              │  · /u/* /agent-zone/*        │    │
│  │  · 发帖（P2）              │  · /new-topic                │    │
│  └──────────────────────────┴──────────────────────────────┘    │
│         │                              │                        │
│    ApiClient(dio, Bearer)         WebView(注入 CSS + JS Bridge)   │
└─────────┼──────────────────────────────┼────────────────────────┘
          │                              │
          ▼                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Nginx :443  →  Node standalone :4321                            │
│                                                                 │
│  ┌───────────────────────┐   ┌──────────────────────────────┐   │
│  │ Astro SSR（网页）      │   │ Hono /api/v1（app 专用 BFF）  │   │
│  │  50+ 页面，表单往返     │   │  · 认证 / 分页 / 聚合 / 幂等   │   │
│  │  cookie session       │   │  · Bearer token              │   │
│  └───────────┬───────────┘   └──────────────┬───────────────┘   │
│              └──────────┬───────────────────┘                   │
│                         ▼                                       │
│            src/server/services/*  （唯一业务实现，两端共用）        │
│                         ▼                                       │
│                   PostgreSQL                                     │
└─────────────────────────────────────────────────────────────────┘
```

**分层红线**

| 层 | 允许做 | 禁止做 |
|---|---|---|
| `/api/v1` 路由 | 参数解析、鉴权、序列化、分页、限流、错误映射 | 写 SQL、算推荐分、判业务规则 |
| `services/*` | 业务规则、SQL、事务 | 读 `request` / 读 cookie / 拼 HTTP 响应 |
| Flutter native | 渲染、交互、本地缓存、埋点上报 | 复刻推荐算法、反向推断内容可见性 |

---

## 3. 服务端设计

### 3.1 新增文件清单

```
app/src/server/api/
├── app.ts                     # 现有，保留 /api/health, /api/categories …（向后兼容，不动）
├── v1/
│   ├── index.ts               # Hono 子应用根，挂载所有 v1 路由 + 统一错误处理
│   ├── middleware.ts          # 鉴权、请求 ID、限流、版本头、错误映射
│   ├── serializers.ts         # DB 行 → 移动端 DTO（唯一出参出口）
│   ├── pagination.ts          # 游标编解码
│   └── routes/
│       ├── auth.ts            # login / refresh / logout / me
│       ├── feed.ts            # 看见 / 关注 / 阅读
│       ├── topics.ts          # 详情聚合、回帖列表、发帖
│       ├── posts.ts           # 回帖创建
│       ├── interactions.ts    # like / bookmark / follow
│       ├── uploads.ts         # 图片上传
│       ├── notifications.ts   # 通知列表 / 已读
│       ├── search.ts          # 搜索
│       ├── devices.ts         # 推送设备注册（P2）
│       ├── events.ts          # 埋点批量上报
│       └── meta.ts            # 配置 / 功能开关 / 最低版本
app/src/server/services/
├── appSessions.ts             # 新增：app token 签发、轮换、吊销
└── appIdempotency.ts          # 新增：写操作幂等
app/src/lib/
└── rateLimit.ts               # 新增：进程内令牌桶
```

挂载方式（一行，`src/pages/api/[...path].ts` 已经把所有 `/api/*` 转给 Hono）：

```ts
// src/server/api/app.ts 末尾
import v1 from "./v1/index";
app.route("/api/v1", v1);
```

### 3.2 约定

| 项 | 约定 | 理由 |
|---|---|---|
| 前缀 | `/api/v1/...` | v1 冻结后只增不改，破坏性变更走 v2 |
| 版本头 | 请求 `X-App-Version: 1.0.3 (android)`<br>响应 `X-Min-Version: 1.0.0` | 低于最低版本时客户端弹强制升级 |
| 语言 | `Accept-Language: zh-CN` / `en-US`，回落 `zh` | 复用 `getLangFromRequest` |
| 请求 ID | 服务端生成 `X-Request-Id` 回传 | 用户反馈问题时能一条链查日志 |
| 时间 | 全部 ISO 8601 UTC 字符串 | 与现有 DB `TEXT` 存储一致，客户端本地化 |
| 分页 | `limit` + `cursor`，响应带 `nextCursor` | 见 §3.6 |
| 字段命名 | camelCase（服务端出参层转换） | 与现有 `Topic` / `Post` 接口命名一致 |

### 3.3 统一响应与错误

成功：

```json
{ "ok": true, "data": { }, "meta": { "requestId": "...", "nextCursor": null } }
```

失败：

```json
{ "ok": false, "error": { "code": "topic_not_found", "message": "话题不存在", "details": {} } }
```

错误码表（客户端按 `code` 分支，不按 HTTP 文案分支）：

| code | HTTP | 客户端动作 |
|---|---|---|
| `unauthorized` | 401 | 清 token，跳 WebView 登录页 |
| `token_expired` | 401 | 尝试 refresh；失败再跳登录 |
| `forbidden` | 403 | toast，不跳转 |
| `not_found` | 404 | 空态页 |
| `validation_failed` | 422 | 表单内联错误，`details` 带字段 |
| `rate_limited` | 429 | toast + 按 `Retry-After` 退避 |
| `conflict` | 409 | 提示"内容已变更，请刷新" |
| `payload_too_large` | 413 | 提示压缩后再传 |
| `server_error` | 500 | 兜底页 + 重试按钮 |

**注意**：现有 `/api/*` 端点的返回格式是 `{data}` 或 `{error}`，与 v1 不一致。**不要改它们**——网页在用。v1 独立一套，由 `serializers.ts` 统一出口。

### 3.4 认证：app token 与 cookie 共用同一张表

#### 3.4.1 为什么不用 JWT

- 需要**即时吊销**（改密码、封号、用户手动退出全部设备）。
- 无状态 JWT 的吊销要靠黑名单，等于又把状态搬回 DB。
- 现有 `readSessionId()` 每个请求本来就要查一次 `sessions`，换成 token 没有额外 DB 开销。

所以：**token 就是 `sessions.id`，服务端不透明、只存哈希索引**（现状已如此，`sessions.id` 是 43 字符 base64url 随机串，本身不可猜测）。

#### 3.4.2 表结构变更

`scripts/migrate.ts` 追加：

```ts
{
  version: "0XX_app_mobile_api",
  sql: `
    ALTER TABLE sessions ADD COLUMN IF NOT EXISTS client TEXT NOT NULL DEFAULT 'web';
    ALTER TABLE sessions ADD COLUMN IF NOT EXISTS client_version TEXT;
    CREATE INDEX IF NOT EXISTS idx_sessions_user_client
      ON sessions (user_id, client) WHERE revoked_at IS NULL;

    CREATE TABLE IF NOT EXISTS app_idempotency_keys (
      key TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      scope TEXT NOT NULL,
      response_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_app_idempotency_user
      ON app_idempotency_keys (user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS app_devices (
      id SERIAL PRIMARY KEY,
      user_id INTEGER,
      platform TEXT NOT NULL,
      push_token TEXT NOT NULL UNIQUE,
      app_version TEXT,
      device_model TEXT,
      push_provider TEXT NOT NULL DEFAULT 'fcm',
      last_seen_at TEXT NOT NULL,
      revoked_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_app_devices_user
      ON app_devices (user_id) WHERE revoked_at IS NULL;
  `,
}
```

- `client`：`web` / `app`。用于区分会话来源、统计、以及"退出全部 app 会话"。
- `app_devices`：P2 才写，但表先建，避免后面再改迁移。

#### 3.4.3 有效期策略

| 会话类型 | TTL | 续期 |
|---|---|---|
| web（现有） | 7 天 | 无，到期重登 |
| app | 90 天 | `POST /api/v1/auth/refresh` 轮换，剩余 > 0 即可换 |

轮换实现（防重放 + 防并发）：

```ts
// services/appSessions.ts
export async function rotateAppSession(sessionId: string, meta: SessionMeta) {
  const now = new Date().toISOString();
  return withTransaction(async (tx) => {
    // 1) 原子吊销旧 token，只有吊销成功的那次请求才能换新
    const revoked = await tx.query(
      `UPDATE sessions SET revoked_at = $1
       WHERE id = $2 AND revoked_at IS NULL AND expires_at > $1
       RETURNING user_id`,
      [now, sessionId],
    );
    if (revoked.rowCount === 0) return undefined;   // 已换过或已过期 → 401，客户端跳登录
    // 2) 发新 token，字段从 users 读
    ...
  });
}
```

客户端并发 401 时必须**单飞**（§4.4），否则第二个刷新的请求会拿到 401 并把用户踢下线。

#### 3.4.4 `last_seen_at` 写放大

`readSessionId()` 现在每个请求都 `UPDATE sessions SET last_seen_at`。app 一个 feed 页会并发 3~5 个请求，滚动一次就是十几次写。

对策：只在距上次更新超过 5 分钟时写。

```ts
export async function touchSession(sessionId: string, lastSeenAt: string) {
  const stale = Date.now() - new Date(lastSeenAt).getTime() > 5 * 60 * 1000;
  if (!stale) return;
  await execute("UPDATE sessions SET last_seen_at = $1 WHERE id = $2", [new Date().toISOString(), sessionId]);
}
```

这条改动对网页也生效，属于纯收益（少写库）。

#### 3.4.5 认证中间件

```ts
// api/v1/middleware.ts
export const requireAuth: MiddlewareHandler = async (c, next) => {
  const raw = c.req.header("authorization") || "";
  if (!raw.startsWith("Bearer ")) return fail(c, "unauthorized", 401);
  const token = raw.slice(7).trim();
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return fail(c, "unauthorized", 401);
  const session = await readSessionId(token);            // 复用现有函数
  if (!session) return fail(c, "token_expired", 401);
  c.set("session", session);
  await touchSession(token, /* lastSeenAt */ ...);
  await next();
};

export const optionalAuth: MiddlewareHandler = async (c, next) => {
  // 同上，但不通过也继续；用来看见流的"已登录个性化"
};
```

`readSessionId()` 不做任何修改，app 与 web 走同一段代码，会话失效/封号逻辑天然一致。

### 3.5 端点清单

**P0（壳能跑通，服务端约 1.5 天）**

| 方法 | 路径 | 认证 | 说明 |
|---|---|---|---|
| POST | `/api/v1/auth/login` | 无 | body `{identifier, password, deviceName, platform}` → `{token, expiresAt, user}` |
| POST | `/api/v1/auth/refresh` | Bearer | 轮换，返回新 token |
| POST | `/api/v1/auth/logout` | Bearer | 吊销当前 token |
| GET | `/api/v1/me` | Bearer | 当前用户 + 未读数 |
| GET | `/api/v1/feed` | 可选 | `surface=see\|following\|reading`、`sort`、`limit`、`cursor`、`category`、`tag` |
| GET | `/api/v1/topics/:id` | 可选 | **详情聚合**：topic + posts + interactions + me |
| GET | `/api/v1/meta` | 无 | `{minVersion, latestVersion, featureFlags, apiHost}` |

**P1（原生 feed + 详情可用，约 1 天）**

| 方法 | 路径 | 认证 | 说明 |
|---|---|---|---|
| POST | `/api/v1/topics/:id/posts` | Bearer | 回帖，`{contentMarkdown, parentPostId?, clientRequestId}` |
| POST | `/api/v1/interactions/like` | Bearer | `{targetType, targetId}` → `{liked, likeCount}` |
| POST | `/api/v1/interactions/bookmark` | Bearer | `{topicId}` → `{bookmarked}` |
| POST | `/api/v1/interactions/follow` | Bearer | `{targetType, targetId}` → `{following}` |
| POST | `/api/v1/uploads/images` | Bearer | multipart，字段名 `image`（与网页一致） |
| POST | `/api/v1/events` | 可选 | 批量埋点，`{events:[...]}`，上限 50 条/次 |
| GET | `/api/v1/notifications` | Bearer | 游标分页 |

**P2（按需）**

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/v1/topics` | 发帖（编辑器原生化后） |
| POST | `/api/v1/devices` | 注册推送 token |
| DELETE | `/api/v1/devices/:id` | 注销 |
| GET | `/api/v1/search` | 搜索结果 JSON 化 |
| GET | `/api/v1/users/:username` | 个人主页 JSON 化 |

**刻意不做的端点**：`/settings/*`、`/admin/*`、`/agent-zone/*` 任何 JSON 化。这些页面留在 WebView，做 app API 是纯浪费——网页已经能用，且后台不是手机场景。

### 3.6 分页

**决策（已落地）**：对外只暴露不透明游标，内部第一版是 offset。

原因：`listSeeRecommendations` 的排序发生在内存里（候选集 240 条按分数/热度排），拿不到稳定的 keyset 锚点。要 keyset 就得在服务层重写一条 SQL 路径，那违反"v1 不写 SQL"的红线。

所以：`cursor = base64url({v:1, o:offset})`，客户端只当它是不可解析的字符串。等以后推荐流改成 SQL 排序，把内部实现换成 `{k, id}`，客户端一行都不用改。

代价（必须知道）：翻页期间如果有新内容插入，会出现重复项。客户端**按 id 去重**兜底，这也是 §4.7 里"追加时去重"那条的来源，不是可选项。

实际实现（`src/server/api/v1/pagination.ts`）：

```ts
export function encodeCursor(offset: number) {
  return Buffer.from(JSON.stringify({ v: 1, o: offset }), "utf8").toString("base64url");
}

export function decodeCursor(cursor: string | undefined | null): number {
  if (!cursor) return 0;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    const offset = Number(parsed?.o);
    return Number.isFinite(offset) && offset > 0 ? Math.trunc(offset) : 0;
  } catch {
    return 0;
  }
}
```

`hasMore` 靠多取一条判断，不做 `COUNT(*)`（话题表增长后这是纯拖慢）：请求 `limit + 1`，返回前 `slice(0, limit)`。

`limit` 上限 50，默认 20。

### 3.7 详情聚合端点（最关键的一个）

客户端打开详情页只发**一次**请求。对照现状：网页版详情页要跑 `getTopicById` + `listPostsForTopic` + `getTopicInteractionState` + 每个 post 各 2 次查询（`countTargetLikes` / `userLikedTarget`）——`src/pages/t/[id].astro:52` 那段 `Promise.all` 就是，30 个回帖就是 60 次查询。

服务端聚合时把回帖的互动状态**批量查**，避免 N+1：

```ts
// api/v1/routes/topics.ts
const [topic, posts] = await Promise.all([
  getTopicById(id, lang),
  listPostsForTopic(id, session?.userId, lang),
]);
if (!topic) return fail(c, "not_found", 404);

// 一次查完所有回帖的点赞数与"我是否点过"
const stats = await listPostInteractionStats(posts.map((p) => p.id), session?.userId);
```

`services/interactions.ts` 追加一个批量函数（现有单条函数保留给网页用）：

```sql
-- listPostInteractionStats
SELECT target_id,
       COUNT(*) FILTER (WHERE reaction_type = 'like') AS like_count,
       BOOL_OR(user_id = COALESCE($me, -1)) FILTER (WHERE reaction_type = 'like') AS liked
FROM reactions
WHERE target_type = 'post' AND target_id = ANY($ids)
GROUP BY target_id;
```

响应样例（客户端按此建模型）：

```json
{
  "ok": true,
  "data": {
    "topic": {
      "id": 812, "title": "...", "slug": "...", "type": "discussion",
      "summary": "...", "contentHtml": "<p>...</p>", "contentMarkdown": "...",
      "author": { "id": 3, "username": "z", "displayName": "Z", "avatarUrl": "https://...", "role": "member" },
      "category": { "id": 2, "name": "产品", "slug": "product", "color": "#..." },
      "tags": [{ "id": 7, "name": "Flutter", "slug": "flutter" }],
      "viewCount": 128, "replyCount": 9, "likeCount": 4, "bookmarkCount": 1,
      "publishedAt": "2026-11-16T09:31:00.000Z",
      "lastActivityAt": "2026-11-17T02:10:00.000Z"
    },
    "posts": [
      {
        "id": 5011, "parentPostId": null, "contentHtml": "<p>...</p>",
        "author": { "id": 9, "username": "li", "displayName": "李", "isAnonymous": false },
        "likeCount": 2, "liked": false, "createdAt": "2026-11-16T10:02:00.000Z"
      }
    ],
    "interactions": { "liked": true, "bookmarked": false, "likeCount": 4 },
    "me": { "id": 3, "canReply": true, "canEdit": true },
    "related": [{ "id": 799, "title": "...", "replyCount": 2 }]
  },
  "meta": { "requestId": "..." }
}
```

**只在需要时才返回 `contentMarkdown`**：客户端渲染 HTML，Markdown 只在"编辑"场景要（P2）。P1 可以先不返回，省 40% 流量。

### 3.8 写操作

#### 幂等

弱网下"点发送没反应→再点一次"是常态。所有创建类写操作接受 `clientRequestId`（UUID v4）：

```ts
export async function withIdempotency<T>(
  key: string | undefined, userId: number, scope: string,
  run: () => Promise<T>,
): Promise<T> {
  if (!key) return run();                                  // 老客户端没传，退化为非幂等
  const hit = await queryOne(`SELECT response_json FROM app_idempotency_keys WHERE key = $1`, [`${userId}:${key}`]);
  if (hit) return JSON.parse(hit.response_json);
  const result = await run();
  await execute(
    `INSERT INTO app_idempotency_keys (key, user_id, scope, response_json, created_at)
     VALUES ($1,$2,$3,$4,$5) ON CONFLICT (key) DO NOTHING`,
    [`${userId}:${key}`, userId, scope, JSON.stringify(result), new Date().toISOString()],
  );
  return result;
}
```

清理：`DELETE FROM app_idempotency_keys WHERE created_at < now() - interval '7 days'`，塞进现成的 `bot-worker` 定时任务里，不新起调度。

#### 校验

回帖/发帖走**现有** `createPost` / `createTopic`，它们已经有长度和状态校验。v1 路由只做参数形状检查（`contentMarkdown` 非空、`parentPostId` 属于同一 topic），业务规则不重写。

违规返回 `validation_failed` + `details: { contentMarkdown: "内容太短" }`，不要把 `throw new Error` 的原文透给客户端（现有 `topics/index.ts` 就是 `redirect(?error=1)` 丢掉细节，v1 要补上）。

### 3.9 图片上传（踩坑点集中区）

三个约束同时成立：

1. `security.checkOrigin` 会挡掉没有同源 `Origin` 的 multipart 请求（§1.2）。
2. 现有端点字段名是 `image`（`src/pages/api/uploads/images.ts`）。
3. iOS 需要 `NSCameraUsageDescription` / `NSPhotoLibraryUsageDescription`，否则崩。

#### 方案：v1 上传端点 + 客户端补 Origin 头

服务端 `api/v1/routes/uploads.ts` 复用 `saveImageUpload(file, userId)`，只是把响应改成 v1 格式：

```ts
const uploaded = await saveImageUpload(file, session.userId);
return c.json({ ok: true, data: { url: uploaded.publicUrl, size: uploaded.sizeBytes, mime: uploaded.mimeType } });
```

客户端必须做的一条（写进 dio 拦截器，全局生效）：

```dart
// multipart 请求显式声明同源，绕开 Astro 的 checkOrigin
if (options.data is FormData) {
  options.headers['Origin'] = 'https://whyisee.xyz';
}
```

> 为什么不直接把 `security.checkOrigin: false`：那会连带关掉网页表单的跨站防护，为了一个 app 请求降低整站安全水位，不划算。改客户端一行 vs 降级服务端防线，选前者。

#### 限制与压缩

| 项 | 值 | 位置 |
|---|---|---|
| 单文件上限 | 8 MB | 服务端 `saveImageUpload` 已有类型/大小校验，确认后统一 |
| 允许类型 | png / jpeg / webp / gif | 同上 |
| 客户端压缩 | 最长边 ≤ 2048，质量 82，输出 webp | Flutter 侧上传前处理，省流量也省服务端 CPU |
| 并发 | 最多 3 张同时传 | 客户端队列 |

### 3.10 推送（P2）

| 环节 | 做法 |
|---|---|
| 通道 | FCM 作统一入口，国内再挂小米/华为/OPPO/vivo 各一套（各家 SDK 独立，无法复用） |
| 注册 | app 启动且已登录 → `POST /api/v1/devices`，`push_token` 唯一，按 `user_id` 绑定 |
| 触发 | `notifications` 表插入后，异步任务按 `user_id` 查 `app_devices` 推送；失败标记 `revoked_at` |
| 去重 | 同一 `target_type + target_id` 5 分钟内只推一次（用 `notifications` 已有字段判断，不加表） |
| 免打扰 | 复用 `users.notification_email_enabled` 的思路，新增用户级开关，默认开 |
| 首期替代 | 只做**应用内**通知红点（`GET /api/v1/me` 带 `unreadCount`），不碰系统通道 |

**首期不做系统推送**这条要守住：四个厂商通道各一套 SDK + 各自的角标/权限/后台限制，是一个独立工程，会把 P2 拖成 P3。

### 3.11 深度链接

| 平台 | 文件 | 路径映射 |
|---|---|---|
| iOS | `public/.well-known/apple-app-site-association` | `/t/*` → app |
| Android | `public/.well-known/assetlinks.json` | `/t/*` → app |

只接管 `/t/:id` 一条路径。理由：详情页是唯一的"别人分享给我、我点开要看"的场景，其余路径进 app 反而更慢（WebView 冷启动 vs 浏览器秒开）。

未安装 app 的用户落到网页版，所以**不能让链接本身指向 `whyisee://`**，必须是 https 链接 + 系统级接管。

### 3.12 缓存

| 资源 | 头 | 说明 |
|---|---|---|
| `/api/v1/*` | `Cache-Control: no-store` | 个性化数据，禁止任何中间层缓存 |
| `/uploads/*` | `Cache-Control: public, max-age=2592000, immutable` | 文件名含哈希/唯一路径，可长缓存 |
| `/assets/*` | 现状不变（Astro 自带 hash） | nginx 已 gzip |
| `/api/v1/topics/:id` | 加 `ETag`（`updatedAt` 派生），支持 `If-None-Match` → 304 | 二次进入详情页省流量 |

nginx 需补一条（`deploy/nginx.example.conf`）：

```nginx
location /api/v1/ {
    proxy_pass http://127.0.0.1:4321;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
    client_max_body_size 12m;     # 图片上传
    proxy_read_timeout 30s;
}
```

### 3.13 限流与安全

**限流**（进程内令牌桶，`src/lib/rateLimit.ts`）：

| 范围 | 限额 | 理由 |
|---|---|---|
| `/api/v1/auth/login` | 10 次/5 分钟/IP | 防撞库 |
| 写操作整体 | 30 次/分钟/用户 | 防脚本刷回复 |
| 上传 | 20 次/小时/用户 | 防图床滥用 |
| 读操作 | 300 次/分钟/用户 | 宽松，正常滚动够用 |

单实例 Node（`@astrojs/node` standalone）用进程内 `Map` 就够。**多实例部署时必须换 Redis**，这一点写进注释，别等到扩容才发现限流失效。

**其他**：

- token 只从 `Authorization` 头读，不接 query 参数（避免进 access log / Referer）。
- 日志脱敏：`authorization`、`cookie`、`password` 一律不打。
- 越权：所有写操作在路由层带 `topic.authorId === session.userId || isAdmin(session)` 判断，复用 `services` 里已有的校验，不新写一套。
- 举报/屏蔽走现有 `/api/reports`、`/api/interactions/block-user`（表单式），P2 若要原生化再包 v1。

### 3.14 可观测性

| 项 | 实现 |
|---|---|
| 请求日志 | 每请求一行：`method path status ms userId client=app version` |
| requestId | `X-Request-Id` 生成 + 回传，客户端错误页展示前 8 位，方便用户报障 |
| 埋点 | `POST /api/v1/events` → `recordUserContentEvent` / `recordRecommendationImpressions` / `page_views`（**复用现有三张表，不新建**） |
| 推荐一致性 | app 与 web 走同一 `listSeeRecommendations`，曝光写同一张 `recommendation_impressions`，`source` 字段区分 `web`/`app` |
| 健康检查 | `/api/health` 已有，nginx/uptime 监控直接接 |

埋点事件最小集（P1）：

| 事件 | 字段 |
|---|---|
| `feed_impression` | surface, topicIds[], cursor, position |
| `feed_click` | topicId, position, surface |
| `topic_read` | topicId, dwellMs, scrolledToEnd |
| `reply_submit` | topicId, ok, ms, failedCode? |
| `app_error` | screen, code, message（脱敏） |

### 3.15 上线顺序（必须遵守）

1. 先上迁移 + `/api/v1/auth/*` + `/api/v1/me`。此时网页无任何变化。
2. 再上 `/api/v1/feed` + `/api/v1/topics/:id`。纯读，风险低。
3. 最后上写操作 + 上传。
4. 每步都能单独回滚（v1 路由是新增文件，删掉 `app.route("/api/v1", v1)` 一行即失效）。

**绝不做的**：为了让 app 好写，去改现有页面的数据获取方式。网页那边一个字节都不动。

---

## 4. 客户端设计

### 4.1 工程结构

`whyisee-app/`，与 `whyisee-community/` 平级，独立 git 仓库。

```
whyisee-app/
├── lib/
│   ├── main.dart
│   ├── app.dart                     MaterialApp.router + theme
│   ├── core/
│   │   ├── env.dart                 API_BASE、UA、版本号（--dart-define 注入）
│   │   ├── result.dart              Result<T> / ApiFailure
│   │   ├── logger.dart              脱敏日志
│   │   └── format.dart              相对时间、数字缩写（对齐 src/lib/format.ts）
│   ├── data/
│   │   ├── api/
│   │   │   ├── dio_client.dart      拦截器链
│   │   │   ├── auth_interceptor.dart  token 注入 + 401 单飞刷新
│   │   │   └── endpoints.dart       路径常量，与 §3.5 一一对应
│   │   ├── dto/                     freezed + json_serializable
│   │   │   ├── feed_item_dto.dart
│   │   │   ├── topic_detail_dto.dart
│   │   │   ├── post_dto.dart
│   │   │   └── user_dto.dart
│   │   ├── repository/
│   │   │   ├── feed_repository.dart
│   │   │   ├── topic_repository.dart
│   │   │   └── auth_repository.dart
│   │   └── local/
│   │       ├── token_store.dart     flutter_secure_storage
│   │       └── feed_cache.dart      磁盘 JSON 快照
│   ├── features/
│   │   ├── shell/                   home_shell.dart, back_handler.dart
│   │   ├── feed/                    feed_page.dart, feed_controller.dart, widgets/
│   │   ├── topic/                   topic_page.dart, topic_controller.dart, widgets/
│   │   ├── web/                     web_page.dart, bridge.dart, injected_css.dart
│   │   └── auth/                    login_gate.dart, auth_state.dart
│   └── router/
│       ├── app_router.dart          go_router + StatefulShellRoute
│       └── deep_link.dart
├── test/  integration_test/  goldens/
├── android/  ios/
├── scripts/ci.sh
└── pubspec.yaml
```

### 4.2 选型

| 用途 | 包 | 一句话理由 |
|---|---|---|
| 状态管理 | `flutter_riverpod` | 编译期可检查、无 BuildContext 依赖、异步态（loading/error/data）是原生概念 |
| 路由 | `go_router` | `StatefulShellRoute.indexedStack` 直接给"每个 tab 独立栈 + 保活" |
| 网络 | `dio` | 拦截器链比 `http` 完整，FormData/上传进度/取消都有 |
| 模型 | `freezed` + `json_serializable` | 不可变 + 穷尽 match，编译期挡住字段漏判 |
| HTML 渲染 | `flutter_widget_from_html_core` | 支持 `customWidgetBuilder` 和 `onTapUrl`，够渲染现有 markdown 输出 |
| 图片 | `cached_network_image` | 磁盘缓存 + `cacheWidth` 降采样 |
| WebView | `webview_flutter` | 官方维护；不够用时再换 `flutter_inappwebview` |
| 安全存储 | `flutter_secure_storage` | Keychain / Keystore |
| 外链 | `url_launcher` | 跳系统浏览器 |
| 图片压缩 | `flutter_image_compress` | 上传前压到 webp |
| 埋点 | 自建（走 `/api/v1/events`） | 不引第三方 SDK，避免隐私政策复杂度 |

不引：`get_it`（Riverpod 已覆盖 DI）、`provider`（重复）、`sqflite/drift`（P1 用 JSON 快照就够，需要局部更新再上）。

富文本编辑器也不引 `flutter_quill` / `appflowy_editor` / `super_editor`：它们存的是自家文档模型（delta / 节点树），落库前得转回 Markdown，转出来和网页端编辑器渲染的结果对不上，跨端就是两套正文。正文一律以 Markdown 源文为准，手机上用 `shared/widgets/markdown_editor.dart` —— 一个带格式工具条的 TextField，选中文字点「粗」就包裹成 `**…**`，光标位置不动，没有任何中间格式。

### 4.3 导航结构

```dart
StatefulShellRoute.indexedStack(
  builder: (_, __, shell) => HomeShell(shell: shell),
  branches: [
    StatefulShellBranch(routes: [
      GoRoute(path: '/', builder: (_, __) => const FeedPage()),
      GoRoute(path: '/t/:id', builder: (_, s) => TopicPage(id: int.parse(s.pathParameters['id']!))),
    ]),
    StatefulShellBranch(routes: [GoRoute(path: '/go', ...)]),        // P0 是 WebView
    StatefulShellBranch(routes: [GoRoute(path: '/following', ...)]),
    StatefulShellBranch(routes: [GoRoute(path: '/me', ...)]),
  ],
)
```

三个必须落实的点（对应上游 §5.4）：

1. **`indexedStack` 保活**，tab 切换不重建，否则 WebView 每次重载。
2. **详情的路由挂在"看见"分支内**，不挂在根 Navigator。这样"看见 → 详情 → 切到关注 → 切回看见"能还原栈。
3. **WebView 分支的栈深度上限 1**，网页内部导航由 WebView 自己管，不要塞进 go_router。

路径映射（WebView 与原生共用一套 URL 认知）：

| 服务端路径 | 客户端去向 |
|---|---|
| `/` | 原生 feed |
| `/go` | 原生参与推荐（`GET /api/v1/participation`） |
| `/t/:id` | 原生详情 |
| `/new-topic` | 原生 `/compose`（`POST /api/v1/topics`），网页版仍保留给桌面 |
| `/login`、`/signup`、`/forgot-password` | WebView |
| `/search`、`/settings/*`、`/u/*`、`/agent-zone/*`、`/notifications` | WebView |
| `/c/:slug`、`/tag/:slug`、`/latest`、`/following` | WebView（P1），P2 视情况转原生 |
| `/admin/*` | 系统浏览器 |
| 其他 host | 系统浏览器 |

### 4.4 网络层

拦截器顺序（顺序有讲究）：

```
request:   HeaderInterceptor → AuthInterceptor → FormDataOriginInterceptor
response:  ErrorMapper ← RetryInterceptor ← LogInterceptor
```

```dart
final dio = Dio(BaseOptions(
  baseUrl: Env.apiBase,                 // https://whyisee.xyz
  connectTimeout: const Duration(seconds: 8),
  receiveTimeout: const Duration(seconds: 15),
  headers: {
    'X-App-Version': Env.appVersion,    // 1.0.3
    'X-Client': 'app',
    'Accept-Language': Env.locale,      // zh-CN / en-US
  },
));
```

**401 单飞刷新**（不做这个，并发请求必然互相踢下线）：

```dart
class AuthInterceptor extends Interceptor {
  Completer<bool>? _refreshing;   // 同一时刻只有一个刷新在飞

  @override
  Future<void> onError(err, handler) async {
    final res = err.response;
    if (res?.statusCode != 401 || err.requestOptions.extra['retried'] == true) {
      return handler.next(err);
    }
    final code = (res?.data?['error']?['code']) as String?;
    if (code == 'unauthorized') { await _forceLogout(); return handler.next(err); }

    _refreshing ??= _refreshToken();            // 后来者等同一个 future
    final ok = await _refreshing!;
    _refreshing = null;
    if (!ok) { await _forceLogout(); return handler.next(err); }

    final retried = await _retry(err.requestOptions);
    handler.resolve(retried);
  }
}
```

重试：只对 **GET** 且 `status >= 500 || 超时 || 连接失败` 重试 2 次，指数退避 300ms/900ms + 抖动。写操作**绝不自动重试**（靠 `clientRequestId` 幂等，由用户手动再点）。

超时策略：feed 首屏 8s 就降级到缓存并提示"网络不稳"，不要让用户盯空白 15 秒。

### 4.5 模型与解析

`feed_item_dto.dart`（服务端见 §3.7）：

```dart
@freezed
class FeedItemDto with _$FeedItemDto {
  const factory FeedItemDto({
    required int id,
    required String title,
    required String summary,
    required String type,
    String? coverImage,                  // 服务端从 content 抽第一张图
    required AuthorDto author,
    required CategoryDto category,
    @Default(<TagDto>[]) List<TagDto> tags,
    @Default(0) int replyCount,
    @Default(0) int likeCount,
    @Default(0) int viewCount,
    String? publishedAt,
    String? lastActivityAt,
  }) = _FeedItemDto;

  factory FeedItemDto.fromJson(Map<String, dynamic> json) => _$FeedItemDtoFromJson(json);
}
```

规则：

- **DTO 不做业务判断**，只做类型安全。可见性/权限以服务端返回的 `me.canReply` 等字段为准。
- 时间统一 `DateTime.tryParse`，展示走 `formatRelative()`，与 `src/lib/format.ts` 的文案规则对齐（"3 分钟前" / "3 min ago"）。
- 未知枚举值**不抛异常**，回落默认值 + 上报 `app_error`。服务端加新 `type` 时老客户端不能白屏。

### 4.6 认证流程

```
冷启动
 ├─ secure storage 有 token?
 │   ├─ 是 → GET /api/v1/me
 │   │        ├─ 200 → 已登录，进 shell
 │   │        ├─ 401 token_expired → refresh → 成功则重试 /me
 │   │        └─ 401 其他 → 清 token → 未登录态
 │   └─ 否 → 未登录态
 └─ 未登录态：feed 走匿名（服务端 optionalAuth），点"回复/点赞"时弹登录

登录（WebView）
 打开 https://whyisee.xyz/login
   → 注入脚本检测 window.FlutterBridge
   → 登录成功后网页 JS 调 POST /api/v1/session-from-cookie（内部端点，仅 cookie 认证）
   → 把 token 推给原生 → 原生存 secure storage → 关闭 WebView → 刷新 /me
```

服务端要一个桥接端点（上游 §5.2 方案 B 的落地形态）：

```
POST /api/v1/auth/session-from-cookie   仅 cookie 认证，不接受 Bearer
  → { ok:true, data:{ token, expiresAt, user } }
```

实现要点：它读 cookie 里的 `whyisee_session`，**为该 session 标记 `client='app'` 并延长到 90 天**，然后原样返回 `sessionId` 作为 token。这样网页登录和 app 登录共用一条会话，用户在网页退登，app 也跟着失效——符合直觉。

> 不做：把 cookie 改成非 httpOnly。上游 §5.2 已否决，这里不重复。

### 4.7 看见 feed 实现

```
FeedController (AsyncNotifier<List<FeedItem>>)
  ├─ state: AsyncValue<FeedState>
  │    FeedState { items, nextCursor, hasMore, refreshing, loadingMore }
  ├─ build(): 先吐磁盘缓存（≤ 6 小时），再发首屏请求
  ├─ loadMore(): cursor 为空则跳过
  └─ refresh(): 清 cursor，重建列表
```

细节清单：

| 项 | 做法 | 为什么 |
|---|---|---|
| 列表 | `ListView.builder` + `itemExtent` 不用（卡片高度可变），改用 `PrototypeItem` | 可变高卡片无法固定 extent，`PrototypeItem` 仍是线性构建 |
| 图片 | `CachedNetworkImage(cacheWidth: 屏幕宽 * dpr)` | 不降采样会解码 4000px 原图，滚动必掉帧 |
| 卡片 | 外层包 `RepaintBoundary` | 点赞状态变化不重绘整屏 |
| 首屏骨架 | 6 个灰块，与真实卡片同高 | 避免加载完成时跳动 |
| 分页触底 | `scrollController.position.pixels > maxScrollExtent - 600` 时预取 | 提前 600px，滚动不断流 |
| 去重 | 追加时按 `id` 去重（服务端 offset 分页会重复，见 §3.6） | 唯一可靠的兜底 |
| 埋点 | 首屏渲染后上报 `feed_impression`（含 position），滚动可见项按 50% 可见时长 > 1s 计入 | 与网页曝光口径一致，推荐模型不分叉 |
| 离线 | 缓存为空 + 无网 → 原生错误页；有缓存 → 顶部黄条"离线内容" | 不白屏 |

### 4.8 帖子详情渲染

**决策：服务端返回 `contentHtml`，客户端渲染 HTML，不在 Dart 里重新解析 Markdown。**

理由：网页的 markdown 输出经过 `enhanceMarkdownHtml()`（图片自动并排成 grid、@提及转链接）。客户端自己再用 `flutter_markdown` 渲染一遍，视觉必然与网页不一致，且要重写这两个增强逻辑。

```dart
HtmlWidget(
  contentHtml,
  onTapUrl: (url) => _handleTap(url),
  customWidgetBuilder: (el) {
    if (el.localName == 'pre') return _CodeBlock(el.text);
    return null;
  },
  factoryBuilder: () => _ArticleFactory(),   // 统一 h1-h4/p/li 的行高与字号
)
```

必须处理的四类内容：

| 内容 | 处理 |
|---|---|
| 外链 | `onTapUrl` 拦截，host 不是 whyisee.xyz → `url_launcher` 打开系统浏览器 |
| 站内链接 | `/t/123` → 路由 replace 到原生详情；`/u/xxx`、`/c/xxx` → 打开 WebView |
| 代码块 | 自定义 `pre` widget：等宽字体、横向滚动、右上角复制按钮 |
| 图片 | `img` 走 `cached_network_image`，点开全屏查看（`InteractiveViewer`） |

文章本体直接给 `SingleChildScrollView`？不行——长文 + 回帖列表需要懒加载。结构用：

```dart
CustomScrollView(slivers: [
  SliverToBoxAdapter(child: _TopicHeader(topic)),      // 标题、作者、分类
  SliverToBoxAdapter(child: HtmlWidget(topic.contentHtml)),  // 正文
  SliverToBoxAdapter(child: _InteractionBar(...)),     // 点赞/收藏/回复
  SliverList.builder(itemCount: posts.length, ...),    // 回帖
  SliverToBoxAdapter(child: _LoadMore(hint)),
])
```

### 4.9 WebView 模块

承接上游 §5.1/§5.5/§5.9，给出落地差异：

```dart
WebViewController()
  ..setJavaScriptMode(JavaScriptMode.unrestricted)
  ..setBackgroundColor(const Color(0xFF11161F))        // 深色底，防白闪（必须）
  ..setNavigationDelegate(NavigationDelegate(
    onNavigationRequest: _decide,
    onWebResourceError: _onError,                       // 切原生错误页
  ))
  ..addJavaScriptChannel('FlutterBridge', onMessageReceived: _onBridge)
  ..loadRequest(Uri.parse('https://whyisee.xyz/login?redirect=/'));
```

注入 CSS 只在"原生 AppBar 覆盖网页 header"时启用：P0 全部用网页自带 `.site-header`（上游 §5.5 结论），**先不注入任何 CSS**。等原生页混排时再按需注入，且集中在 `injected_css.dart`。

必须补的一条（上游文档提到的缺口，实测仍在）：`src/layouts/BaseLayout.astro` 的 viewport 缺 `viewport-fit=cover`，导致 `env(safe-area-inset-*)` 恒为 0。

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
```

JS 桥协议（Dart 侧必须做白名单 + 长度上限）：

```dart
void _onBridge(JavaScriptMessage msg) {
  if (msg.message.length > 1024 * 1024) return;         // 1MB 上限，防卡主线程
  final data = jsonDecode(msg.message);
  switch (data['type']) {
    case 'token':  ...   // 存 secure storage
    case 'toast':  ...
    case 'haptic': ...
    default: return;     // 未知类型直接丢
  }
}
```

### 4.10 缓存与离线

| 数据 | 位置 | 策略 |
|---|---|---|
| token | `flutter_secure_storage` | 唯一凭证，退出即清 |
| feed 首屏 | 应用文档目录 `feed_cache.json` | 写时带 `fetchedAt`；冷启动先渲染，再后台刷新 |
| 详情 | 内存 LRU（最近 20 篇） | 返回时秒开，后台校验 ETag |
| 图片 | `cached_network_image` 默认磁盘缓存 | 30 天 |
| 草稿（P2） | `shared_preferences` | 输入即存，发帖失败不丢内容 |

上限：feed 缓存只存 30 条、单文件 ≤ 2 MB。超了直接丢弃重建，不做增量合并（复杂度不值）。

### 4.11 主题

站点固定深色（`responsive.css` 里全是 `rgba(17, 22, 31)` 系），app **只做深色**，不做切换。

颜色 token 与网页 CSS 变量对齐（避免 app 和 WebView 切换时色差）。取值来自 `app/src/styles/modules/foundation.css` 的 `:root`，不是估的：

| token | 值 | 网页变量 | 用途 |
|---|---|---|---|
| `bg` | `#0D1016` | `--bg` | 页面底、WebView 底色 |
| `headerBg` | `#0F1118` | `--header-bg` | 顶栏、底部 tab 栏 |
| `surface` | `#171B23` | `--surface-bg` | 卡片 |
| `panel` | `#1D222C` | `--panel` | 面板 |
| `line` | `rgba(255,255,255,0.09)` | `--line` | 分隔线 |
| `text` | `#F0F3F7` | `--text` | 正文 |
| `muted` | `#A9B1BC` | `--muted` | 次要信息 |
| `blue` | `#8AB4F8` | `--blue` | 选中态、链接 |

（早期版本按 `#11161F` 估的，实测是 `#0D1016`，以本表为准。）

状态栏：

```dart
SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
  statusBarColor: Colors.transparent,
  statusBarIconBrightness: Brightness.light,        // 深底亮字
  systemNavigationBarColor: Color(0xFF11161F),
  systemNavigationBarIconBrightness: Brightness.light,
));
```

### 4.12 错误与空态

| 场景 | 呈现 |
|---|---|
| 无网 + 无缓存 | 原生错误页：图标 + "网络不通" + 重试按钮（`onWebResourceError` 与 dio 连接错误共用同一个页面） |
| 无网 + 有缓存 | 顶部 32px 黄条"离线内容 · 点击刷新" |
| 401 | 静默跳登录，不弹窗 |
| 429 | toast"操作太快了，稍等" |
| 500 | 半屏错误 + 重试，保留已加载内容 |
| 空列表 | 居中插画 + 一句引导（"还没有内容，去提个问题"） |

统一实现：`AsyncValue` + `switch` 穷尽匹配，禁止 `state.hasValue ? ... : ...` 的二态写法漏掉 error。

### 4.13 性能预算

| 指标 | 目标 | 验证方式 |
|---|---|---|
| 冷启动到首帧（有缓存） | < 1.2s | `flutter run --profile` + DevTools timeline |
| feed 滚动 | 稳定 60fps | DevTools 帧图，不允许连续 3 帧超 16ms |
| 首屏请求 | ≤ 1 次，返回 ≤ 40KB | 抓包 |
| APK 大小 | < 25 MB | `flutter build apk --split-per-abi` |
| 内存（滚动 200 条后） | < 220 MB | DevTools memory |

### 4.14 测试与 CI

| 层 | 工具 | 覆盖 |
|---|---|---|
| 单元 | `dart test` | DTO 解析、游标、`formatRelative`、AuthInterceptor 单飞逻辑 |
| Widget | `flutter_test` | feed 卡片、详情头、错误态、空态 |
| Golden | `golden_toolkit` | 6 张关键界面（feed/详情/错误/空态/登录门/离线条），防无意改样式 |
| 集成 | `integration_test` | 冷启动 → 滚动 → 进详情 → 点赞 → 回复 |

**测试环境**：集成测试跑本地服务（`--dart-define=API_BASE=http://10.0.2.2:4321`，安卓模拟器回环），打真实接口。**不做 Mock Server**：接口是我们的，Mock 一遍等于维护两套契约。

CI（`scripts/ci.sh`，本地/远端同一套）：

```bash
set -euo pipefail
dart format --output=none --set-exit-if-changed .
flutter analyze --fatal-infos
flutter test
flutter build apk --debug --dart-define=API_BASE=https://whyisee.xyz
```

### 4.15 发布

| 项 | 值 |
|---|---|
| applicationId | `xyz.whyisee.app` |
| minSdk / targetSdk | 24 / 35 |
| 签名 | `android/key.properties`（gitignore）+ `key.jks` 备份在密码库 |
| 版本号 | `pubspec.yaml` 的 `version: 1.0.3+4`，与 `X-App-Version` 同源 |
| 混淆 | `flutter build apk --obfuscate --split-debug-info=build/symbols`，symbols 归档 |
| 分发 | 先自己装（P0/P1）；再走内测（蒲公英/Google 内测）；商店最后 |
| 渠道 | P2 需要友盟/厂商统计时再加 flavor，首期单一 flavor |
| 强制升级 | `/api/v1/meta` 的 `minVersion` 低于当前则弹不可关闭的升级页 |

iOS 后置（上游 §9：纯壳提审 4.2 必拒）。提审前置条件写死：2 个原生页已上 + 有推送 + 有隐私政策页。

---

## 5. 三条关键时序

### 5.1 首次登录（WebView 回传 token）

```
App           WebView(/login)        Server(/api/login)     Server(v1)
 │  open login    │                        │                    │
 │───────────────>│  POST form            │                    │
 │                │───────────────────────>│  set cookie        │
 │                │  303 → /                │                    │
 │                │  JS: bridge 存在?       │                    │
 │                │  POST /auth/session-from-cookie (cookie)     │
 │                │─────────────────────────────────────────────>│
 │                │                        │  返回 {token}       │
 │                │  FlutterBridge.postMessage({type:token})     │
 │<───────────────│                        │                    │
 │ 存 secure store │                        │                    │
 │ GET /api/v1/me (Bearer)                                      │
 │─────────────────────────────────────────────────────────────>│
```

### 5.2 冷启动 + feed

```
启动 → 读 token → 有则并发：GET /me + GET /feed（磁盘缓存先渲染）
                                  │
                       /feed 200 → 替换列表，写缓存
                       /feed 超时 → 保留缓存，顶部离线提示
                       /me 401 → refresh（单飞）→ 成功重试 / 失败清 token 转匿名
```

### 5.3 回帖

```
点发送 → 生成 clientRequestId → 禁用按钮 + 显示"发送中"
   → POST /api/v1/topics/:id/posts
      ├─ 200 → 插入列表末尾、清输入框、滚到新帖、埋点 reply_submit ok
      ├─ 422 → 输入框下方内联错误，保留内容
      ├─ 429 → toast + 按 Retry-After 允许重试
      └─ 超时/断网 → 保留内容 + 显示"重试"（用同一 clientRequestId，不会重复发）
```

---

## 6. 分期与工作量

| 阶段 | 服务端 | 客户端 | 产出 | 依赖 |
|---|---|---|---|---|
| **S0**（1.5d） | v1 骨架、auth 三端点、`/me`、`/feed`、详情聚合、`/meta` | — | 接口可用（curl 验证） | 迁移先上 |
| **C0**（1d） | — | 混合壳、tab、返回键、登录 WebView、错误页 | 能装能刷能登 | S0 的 `/meta` |
| **S1**（1d） | 写操作 4 个、上传、`/events` | — | 原生页可写 | 无 |
| **C1**（4d） | — | 原生 feed、原生详情、token 打通、缓存 | 日常可用 | S0 + S1 |
| **S2**（3d） | 通知列表、设备注册、批量未读 | 应用内通知红点 | 不被消息漏掉 | C1 |
| **P2**（按需） | 推送通道、发帖 API、搜索 JSON | 发帖编辑器、离线、iOS | 完整 | S2 |

**服务端总计约 5.5 人日，客户端 P0+P1 约 5 人日。** 比上游文档的"P0 1 天"多出来的部分全在认证与详情聚合——那两项上游按"零后端改动"估的，实测做不干净。

### 验收清单

**S0/C0 完成标准**

- [ ] `curl` 拿到 token，带 Bearer 能取 `/me`
- [ ] `GET /api/v1/feed?limit=20` 返回 `nextCursor`，第二页无重复
- [ ] `GET /api/v1/topics/:id` 一次返回 topic + posts + interactions，SQL 查询数 ≤ 4
- [ ] 网页登录路径完全无变化（回归：登录、发帖、点赞各一次）
- [ ] apk 装机：启动直达 feed、进详情能回退、返回键三级判断正确、外链跳浏览器、断网有原生错误页、深色无白闪、底部不被手势条压

**S1/C1 完成标准**

- [ ] 原生回帖成功，列表即时插入，网页端能看到同一条
- [ ] 点赞后网页端计数一致（同一张 `reactions` 表）
- [ ] 上传 3 张图成功（含一次弱网重试），服务端 `uploaded_files` 有记录
- [ ] token 过期后自动刷新，用户无感
- [ ] 并发 5 个请求同时 401，只发生一次 refresh（单飞生效）
- [ ] feed 滚动 60fps，200 条后内存 < 220 MB
- [ ] 埋点表 `recommendation_impressions` 出现 `source=app` 记录

---

## 7. 风险登记（补充上游 §9 未覆盖的部分）

| 风险 | 概率 | 影响 | 对策 |
|---|---|---|---|
| **multipart 上传被 checkOrigin 403** | 已确认 | 配图功能不可用 | 客户端 multipart 显式带 `Origin: https://whyisee.xyz`（§3.9） |
| **v1 与网页业务逻辑分叉** | 中 | 两端行为不一致，长期维护翻倍 | v1 路由禁止写 SQL/业务判断，只调 `services/*`；PR 检查项 |
| **`last_seen_at` 写放大** | 高 | 库 IO 压力，app 端尤其明显 | 5 分钟节流（§3.4.4） |
| **详情页 N+1 查询** | 高 | 详情加载 2s+ | 批量查回帖互动（§3.7），验收要求查询数 ≤ 4 |
| **token 泄漏（日志/截图）** | 低 | 账号被接管 | 只在 header 传、日志脱敏、90 天轮换、支持全设备退登 |
| **单实例限流失效（多实例后）** | 中 | 限流形同虚设 | 限流模块注释写死"多实例必须换 Redis" |
| **HTML 渲染差异（表格/代码块）** | 中 | 部分帖子显示异常 | 固定 6 张 golden + 人工抽 20 篇真实帖验证 |
| **新 `type` 枚举导致老客户端崩** | 中 | 白屏 | DTO 未知值回落默认 + 上报，不抛异常 |
| **深链被系统浏览器抢** | 低 | 点链接进浏览器 | AASA/assetlinks 验证 + `flutter_deeplinking_enabled` 关闭 |
| **强升版本把用户锁在门外** | 中 | 老版本直接不能用 | `minVersion` 只在安全或协议破坏时上调，日常走软提示 |

---

## 8. 明确不做

- ❌ 为 app 重写一套业务 API（只在 v1 层做协议适配，业务全部复用 `services/*`）
- ❌ 改任何现有页面/表单/样式（唯一例外：`BaseLayout.astro` 加 `viewport-fit=cover`）
- ❌ 把 `security.checkOrigin` 关掉换取上传便利
- ❌ 在 Dart 里重新实现 Markdown 渲染
- ❌ `/settings/*`、`/admin/*`、`/agent-zone/*` 的 JSON 化
- ❌ 首期做系统推送（先做应用内红点）
- ❌ 首期做 iOS
- ❌ Mock Server（契约就一份，Mock 等于维护两套）
- ❌ JWT + 刷新令牌那套（服务端不透明 token 已足够，且天然支持吊销）

---

## 9. 一页速查

| 要知道的 | 去看 |
|---|---|
| 为什么是混合壳而不是全原生 | `mobile-app-design.md` §3 ADR-1 |
| v1 端点全集 | 本文 §3.5 |
| 认证怎么打通 cookie 与 token | §3.4 + §4.6 |
| 为什么上传会 403 | §1.2（12 行 middlewares.js 的判定规则） |
| 详情一次请求拿全 | §3.7 |
| 分页为什么 latest 用游标、hot 用 offset | §3.6 |
| Flutter 目录怎么分 | §4.1 |
| 401 并发处理 | §4.4 |
| 验收怎么算过 | §6 末尾清单 |
| 新增表与列 | §3.4.2（一条迁移，追加进 `scripts/migrate.ts`） |

---

## 12. 实现状态（2026-11-17）

### 12.1 已上线的端点（都在 `/api/v1`，已用 curl 实测）

| 方法 | 路径 | 认证 | 实测结果 |
|---|---|---|---|
| GET | `/meta` | 无 | 200，返回版本阈值与功能开关 |
| POST | `/auth/login` | 无 | 200，签发 43 位 token，有效期 90 天 |
| POST | `/auth/refresh` | Bearer | 200，换新 token，旧 token 立刻 401 |
| POST | `/auth/session-from-cookie` | cookie | 200，网页会话升级为 app 会话 |
| POST | `/auth/logout` | Bearer | 200，吊销当前 token |
| GET | `/auth/me` | Bearer | 200；无 token → `unauthorized`；坏 token → `token_expired` |
| GET | `/feed` | 可选 | 200，游标翻页两页无重叠 |
| GET | `/topics/:id` | 可选 | 200，28ms 返回 topic + posts + interactions + related；ETag 命中返回 304 |
| POST | `/topics/:id/posts` | Bearer | 200；同 `clientRequestId` 重放返回同一 postId 且 `x-idempotent-replay: 1`；空内容 422 |
| POST | `/interactions/like` | Bearer | 200，点赞/取消各一次后计数回到原值 |
| POST | `/interactions/bookmark` | Bearer | 已实现，未单独实测 |
| POST | `/interactions/follow` | Bearer | 已实现，未单独实测 |
| POST | `/uploads/images` | Bearer | 不带 `Origin` → 403，带 `Origin` → 200（与 §1.2 预测一致） |
| POST | `/events` | 可选 | 200，click/read 均写入 `user_content_events` |

`surface=following` 明确拒绝（`validation_failed`）：`listFollowingFeed` 只返回 title/summary/href，拼不出完整 DTO。关注 tab 继续走 WebView。

### 12.2 网页侧改动（共 3 处，均不影响普通浏览器）

1. `src/layouts/BaseLayout.astro`：viewport 加 `viewport-fit=cover`。
2. `src/layouts/BaseLayout.astro`：引入 `<AppTokenBridge />`。
3. `src/components/AppTokenBridge.astro`（新增）：仅当 `window.FlutterBridge` 存在时，调 `/auth/session-from-cookie` 把 token 推给原生。第一行就判 `FlutterBridge`，普通浏览器里零副作用。

### 12.3 服务端改动清单

| 文件 | 改动 |
|---|---|
| `src/lib/auth.ts` | `createUserSession` / `authenticateUser` 增加 `SessionCreateOptions`（client / ttl / version / userAgent）；`last_seen_at` 由"每请求写"改为"距上次超 5 分钟才写" |
| `src/lib/rateLimit.ts` | 新增，进程内令牌桶（多实例必须换 Redis，代码里有注释） |
| `src/server/services/appSessions.ts` | 新增，token 轮换（原子吊销）与 cookie 会话升级 |
| `src/server/services/appIdempotency.ts` | 新增，写操作幂等 + 过期清理 |
| `src/server/services/interactions.ts` | 新增 `listPostInteractionStats`，回帖互动批量查，消除详情页 N+1 |
| `src/server/api/v1/**` | 新增，见 §3.1 |
| `src/server/api/app.ts` | 加一行 `app.route("/api/v1", v1)` |
| `scripts/migrate.ts` | 追加 `029_app_mobile_api`（sessions 加 2 列、2 张新表） |
| `deploy/nginx.example.conf` | 新增 `/api/v1/` location（12m 上传、30s 超时、no-store） |

### 12.4 数据库注意：`.env` 里的远程库其实没被用到

`getDatabaseConfig()` 读的是 `process.env`。实测（2026-11-17）：**Astro dev / build 都不会把 `.env` 灌进 `process.env`**，所以：

| 场景 | 实际连的库 | 数据量 |
|---|---|---|
| `npm run dev`（接口测试打的就是这个） | `127.0.0.1:15432/zi?ws`（代码默认值，密码 `123456`） | 62 topics / 20 users |
| 裸跑 `node scripts/migrate.ts`（不 source .env） | 同上 | 同上 |
| `set -a; . ./.env; set +a; node ... migrate.ts` | `123.56.166.241:15432/zi?ws` | 65 topics / 21 users |

证据：通过 `/api/v1/auth/login` 建的会话（`client='app'`、`user_agent='android / PKG110'`）只出现在本机库；远程库里一条都没有。同时 `/api/v1/meta` 的 `apiHost` 回落到 `https://whyisee.xyz` 而不是 `.env` 的 `SITE_URL`，也印证 `process.env.SITE_URL` 为空。

**推论（比迁移本身更重要）**

1. 本地开发 / 接口自测默认打的是本机库，不会碰远程数据。想在本地复现生产数据，得显式 `set -a; . ./.env`。
2. 生产进程（systemd）才靠环境变量拿到远程库配置，所以**部署时必须确认 029 已经在目标库上**。
3. `029` 已同时应用在本机库与远程库（纯加列加表、`IF NOT EXISTS`、可重复执行），两处都不影响现有数据。

> 待确认：本地这台 15432 的 PG 是谁在跑、和远程库的定位关系（一个是开发库一个是线上库？）。搞错会在错误的数据上调试。

### 12.5 还没做的

- `POST /topics`（发帖）、`/notifications`、`/devices`、`/search`：P2。
- 客户端 P1 原生 feed / 详情页：服务端已就绪，客户端未开始。
- `npm run check` 有 3 个既有错误，都在 `src/pages/app.astro`（与本方案无关，未改动）。

## 13. 部署 runbook（服务端）

### 13.1 现状形态

单机部署，不是容器：

```
nginx :443 → 127.0.0.1:4321 → node dist/server/entry.mjs (systemd: whyisee-community)
                                    ↓
                            PostgreSQL 127.0.0.1:15432 / zi?ws
```

- 代码目录 `/opt/whyisee-community/app`，systemd unit 见 `deploy/whyisee-community.service`
- **systemd 不读 `app/.env`**，所有配置写在 unit 的 `Environment=` 里。`.env` 只在本地开发用。
- 图片落在 `app/uploads`（不在版本库），部署时不能删。

### 13.2 发布前必须核对的三项

| 项 | 为什么 | 怎么查 |
|---|---|---|
| `PORT` | Astro standalone 在未设 `PORT` 时默认监听 **8080**（`dist/server/chunks/*.mjs` 里 `options.port ?? 8080`），而线上 nginx 反代写的是 **4321**。仓库里那份 unit 没有 `PORT`，两者对不上就是 502。 | `systemctl show whyisee-community -p Environment`，确认有 `PORT=4321` |
| `uploads` 目录 | 用户配图。`rsync --delete` 或整目录替换会清空它。 | `ls app/uploads \| wc -l`，部署前后数量不变 |
| nginx `/api/v1/` location | 缺了这段拿不到 `Cache-Control: no-store`（中间层可能缓存带 token 的响应）。请求体上限线上 server 级已有 `client_max_body_size 20m`，location 继承即可。 | `grep -rl "/api/v1/" /etc/nginx` |

线上 `conf.d/whyisee.conf` 的实际结构（2026-11-17 核对）：三个 server 块（80 跳转 / www 跳转 / 主站 443），反代目标 `127.0.0.1:4321`，全站已带 `X-Forwarded-Host` / `X-Forwarded-Proto https` / `X-Forwarded-Port 443`。要做的事只有一件：在主站 443 的 server 块里插入 `location /api/v1/`，其余不动。完整底本见 `deploy/nginx.example.conf`。改完 `nginx -t && systemctl reload nginx`。

`X-Forwarded-Proto` 不要省。Astro 的 `security.checkOrigin` 会拿 `Origin` 和实际请求协议比对，缺了它服务端会认为请求是 http，客户端发 `Origin: https://whyisee.xyz` 的 multipart 请求就 403。

### 13.3 一条命令

```bash
# 服务器上
cd /opt/whyisee-community
bash app/deploy/release.sh
```

脚本顺序：读 systemd 环境 → 快进合并 `origin/main` → 依赖变更时 `npm ci` → 备份 `dist` → **先迁移** → 构建 → 重启 → 直连端口冒烟 → 检查 nginx。构建失败或重启后 `/api/v1/meta` 不通会**自动回滚 dist 并重启**，不会留半死状态。

按需裁剪：

```bash
bash app/deploy/release.sh --no-pull      # 代码已 rsync 到位
bash app/deploy/release.sh --skip-build   # 只跑迁移 + 重启（改 systemd/nginx 场景）
```

迁移接在构建之前，是因为新代码会查 `sessions.client`、`app_idempotency` 等新列新表，顺序反了会 500。迁移本身幂等，重复执行安全。

### 13.4 本次（v0.1 移动端）的实际发布步骤

1. 提交并推送当前改动（`app/src/server/api/v1/`、`app/src/lib/rateLimit.ts`、`app/src/server/services/appSessions.ts`、`appIdempotency.ts`、`app/src/components/AppTokenBridge.astro`、`auth.ts`、`interactions.ts`、`api/app.ts`、`BaseLayout.astro`、`scripts/migrate.ts`、`deploy/*`）。
2. 服务器上把 `location /api/v1/` 加进 nginx 并 reload。
3. `bash app/deploy/release.sh`。
4. 外网确认：`curl -s https://whyisee.xyz/api/v1/meta` 应返回 `{"ok":true,...}`；`/api/v1/meta` 现在线上是 404，返回 200 就说明新版本起来了。
5. 迁移 `029_app_mobile_api` 已对生产库（`123.56.166.241:15432`）应用过，脚本会跳过；`sessions.client` 列已在。

### 13.5 回滚

脚本把旧 `dist` 留在 `../.release/<时间戳>/dist`（保留最近 3 份）。代码级回滚：

```bash
cd /opt/whyisee-community
git reset --hard <上一个提交> && npm run build && systemctl restart whyisee-community
```

回滚**不要**动数据库：`029` 只加列加表，不回滚也兼容旧代码（旧代码不查这些列）。这是当初把迁移写成纯增量的原因。

### 13.6 遗留风险

- `deploy/whyisee-community.service` 里 `DB_PASSWORD=123456` 明文且极弱，unit 文件权限建议 `600`；数据库端口 `15432` 公网可达（本地开发就是这么连的），至少应限制安全组来源 IP。
- 单实例重启有 1~2 秒 502，可接受；要做零停机得上 nginx upstream + 双端口滚动，不是现在的优先级。

## 14. 客户端 P1 实现状态（2026-11-17）

### 14.1 做完了什么

| 模块 | 实现 | 关键决策 |
|---|---|---|
| 原生 feed | `features/feed/`，四种排序（推荐/最新/热门/精选）、下拉刷新、游标翻页、骨架屏、空态、触底预取 | 分页用 offset 游标 + 按 id 去重（服务端排序是查询时实时算的，做不了稳定 keyset） |
| 原生详情 | `features/topic/topic_detail_page.dart`，一次请求拿 topic+posts+interactions+related | 点赞乐观更新，失败回滚；本地计数回写 feed 列表，返回时数字已更新 |
| 正文渲染 | `widgets/article_webview.dart`，内联深色样式的 HTML 文档 | 注入 JS 测 `scrollHeight` 经 `ContentMetrics` 通道回传，父级按高度展开，避免 WebView 内部滚动 |
| 回帖渲染 | `widgets/post_tile.dart`，HTML 降级成纯文本 | 30 条回复 = 30 个 WebView 太重；只保留段落换行和 `[图:alt]` 占位 |
| 认证 | `core/api/token_store.dart` + `core/providers.dart` | token 落 SharedPreferences；401 由 ApiClient 统一清 token 并回调，页面不各写一遍登出 |
| 网页登录交接 | WebView JS 桥 `token` 分支 → `session.adopt()` | 沿用 `AppTokenBridge.astro`，网页退登 app 立刻失效 |

路由：`/` → 原生 feed，`/t/:id` 挂在第一个 branch 下（从 feed 进详情再返回，tab 状态不丢）；其余三个 tab 仍是 WebView。

### 14.2 实测（真机 OnePlus PKG110 / Android 16）

用 debug 包 + `adb` 断言，不用截图：

```
[api] GET /api/v1/feed?sort=recommend&limit=20&surface=see -> 200   # 首屏
[api] GET /api/v1/feed?sort=latest&limit=20&surface=see -> 200      # 点「最新」
[api] GET /api/v1/feed -> 200  ×2                                    # 滑到底翻页
[api] GET /api/v1/topics/31 -> 200                                   # 点卡片进详情
[article] height=750                                                 # 正文高度上报成功
```

`flutter analyze` 无 issue，`flutter test` 15 个用例全过（`format_test.dart`、`models_test.dart` 用线上真实响应做 fixture 锁字段名）。

### 14.3 P1 踩的三个坑（都已修，别再犯）

1. **`main.dart` 缺 `ProviderScope`**。表现极具误导性：app 能启动、不崩溃、界面正常，但所有 provider 读不到，网络请求一个都不发。排查方法是先看有没有 `[api]` 日志，没有就从 provider 初始化查起。
2. **Riverpod 3 不允许在 `build()` 同步链里写 `state`**。`unawaited(_load())` 会同步执行到第一个 `await`，如果第一句是 `state = ...` 就抛 `Bad state: Tried to read the state of an uninitialized provider`。改用 `Future.microtask` 推迟。
3. **`shared_preferences_foundation` 2.6.x 让 `flutter test` 直接失败**。它依赖 `objective_c`，其构建钩子要调 `xcodebuild`，本机只有 CommandLineTools 就报 `Bad state: No element`。已在 `pubspec.yaml` 用 `dependency_overrides` 锁 2.5.3（只影响 iOS/macOS 实现，Android 不受影响）。

### 14.4 还没做（P2）

- 发帖 / 回复输入框、配图上传：现在点「回复」提示走浏览器。要做需要在 dio 的 multipart 请求上带 `Origin: https://whyisee.xyz`（Astro `checkOrigin` 会拦，见 §3.4）。
- 收藏写入：按钮已渲染，`onTap` 为空。
- 「关注」流的 JSON：服务端 `surface!=see` 时直接拒绝，因为关注流服务层没有作者与计数，拼不出完整 DTO。
- 推送、深链、iOS 构建（缺完整 Xcode）。

### 14.5 详情页正文空白：根因与修复（2026-11-17 夜）

真机上详情页偶发「标题在、正文区整片黑」，且时好时坏。用 WebView 调试端口（`adb forward` + DevTools Protocol）抓到关键证据：**DOM 里文字在（243 个字符）、尺寸正常（328×604），但屏幕像素一个都没画出来**。同时高度日志暴露第二个问题：同一篇文章先报 `7680` 再报 `750`，有时最终停在 `7680`。

两个独立缺陷，都要修：

| 缺陷 | 根因 | 修法 |
|---|---|---|
| 正文区域全黑 | 插件默认把 WebView 渲染到 SurfaceTexture（Texture Layer Hybrid Composition），再当 Flutter 图层合成。该路径在部分设备上不刷新纹理，DOM 有内容但画面不更新 | `WebViewWidget.fromPlatformCreationParams(AndroidWebViewWidgetCreationParams(displayWithHybridComposition: true))`，改用 SurfaceView |
| 高度报成十倍 | WebView 首次 attach 时宽度未定型，文字按极窄宽度换行；且 `Math.max(body.scrollHeight, documentElement.scrollHeight)` 里的 `documentElement` 至少等于视口高度，父级一旦撑高就把视口高度报回来，形成只增不减的自锁 | JS 只量 `body`，且 `window.innerWidth < 60` 时不报；Dart 侧攒 120ms 取最后一次（debounce） |

验证方式：截图后取正文核心区（y 34%~86%）统计亮像素占比。空白页是 **0.00%**，正常页 5%~8%。修复后连测 3 篇不同文章 + 同一篇反复进出 5 次，全部稳定在 8% 左右；高度日志每次只报一次正确值（714/577/549），不再出现四位数。

副作用检查：Hybrid Composition 是 SurfaceView，z-order 在 Flutter 之上，实测滚动时底部 tab 栏没有被盖住。代价是滚动时正文与 Flutter 内容可能有轻微不同步，只读长文可接受。
