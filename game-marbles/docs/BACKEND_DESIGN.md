# 弹珠打撤后端设计规划

本文档用于把当前纯本地 H5 单机原型升级为“客户端表现 + 后端保存与校验”的联网游戏。目标是先完成可落地的后端边界设计，后续再按模块并行开发客户端接入、服务端接口、管理后台和活动配置。

## 1. 目标与原则

### 1.1 接入目标

- 用户账号和游客账号可以跨设备保存进度。
- 金币、角色、弹珠、宝石、仓库物品等经济数据由后端保存。
- 活动、奖励、挑战、公告、版本配置等运营数据由后端下发。
- 战斗仍在客户端本地模拟，后端负责开局、结算、奖励和异常校验。
- 本地存档保留为缓存和弱网兜底，但不再作为最终数据源。

### 1.2 不做的事

第一阶段不做实时同步战斗，不做 PvP，不做服务端逐帧模拟。当前游戏是 3-5 分钟一局的 H5 Roguelite 弹珠塔防，服务端逐帧校验成本高，收益暂时不匹配。

### 1.3 核心原则

- 后端是经济数据权威源。
- 客户端是表现层和输入层。
- 所有消耗、获得、升级、装备、合成都走服务端 action。
- 所有 action 都需要 `opId` 幂等，避免重复请求导致重复奖励或重复扣费。
- 配置必须版本化，战斗开始和结算使用同一个 `configVersion`。
- 结算奖励由服务端确认，客户端可以预展示，但最终以服务端返回为准。

## 2. 总体架构

推荐架构：

```txt
H5 Client
  -> API Gateway / Backend API
    -> Auth Service
    -> Player Service
    -> Battle Service
    -> Inventory Service
    -> Activity Service
    -> Config Service
    -> Admin Service
  -> PostgreSQL
  -> Redis
  -> Object Storage / CDN
```

建议技术选型：

- 后端语言：TypeScript。
- Web 框架：Fastify 或 NestJS。
- 数据库：PostgreSQL。
- ORM：Prisma 或 Drizzle。
- 缓存：Redis，用于登录态、限流、活动热数据、排行榜。
- 配置分发：后端管理配置，发布后生成版本化 JSON，走 CDN 或 API 缓存。
- 管理后台：后续单独做 Web Admin，用于活动、补偿、公告、配置发布。

如果当前团队希望尽快跑通，也可以先用单体服务，不急着拆微服务。代码目录按模块拆，部署上仍是一个 Node 服务即可。

## 3. 数据权威划分

### 3.1 后端权威数据

这些数据必须以后端为准：

- 账号：用户 ID、游客 ID、平台 ID 绑定。
- 货币：金币、付费货币、活动货币。
- 仓库：收藏品、弹珠碎片、宝石。
- 角色：是否拥有、等级、强化路线。
- 弹珠：等级、碎片消耗。
- 基地协议：局外强化等级。
- 阵容：当前上阵角色。
- 宝石装备：基地宝石槽位。
- 战斗记录：开局、结算、掉落、异常标记。
- 活动状态：任务进度、领取记录、限时挑战次数。
- 邮件和补偿。

### 3.2 客户端本地缓存

客户端可以缓存：

- 最近一次完整 `PlayerState`。
- 静态配置版本。
- 未完成 action 队列。
- 当前本地战斗临时状态。
- UI 设置：音效、震动、画质、自动战斗偏好。

客户端缓存只用于体验，不用于覆盖服务端权威数据。

### 3.3 静态配置数据

当前 `src/config/*` 中的角色、弹珠、敌人、战术升级、掉落、局外强化，后续需要逐步支持远程配置：

- 客户端内置一份默认配置，保证离线可启动。
- 启动时从 `/bootstrap` 获取最新 `configVersion`。
- 配置更新后下载对应版本 JSON。
- 战斗开始时固定本局使用的配置版本，结算时带回。

## 4. 客户端接入后的数据流

### 4.1 启动流程

```txt
启动游戏
-> 读取本地 token 和缓存
-> POST /auth/guest 或 POST /auth/login
-> GET /bootstrap
-> 对比 playerRevision 和 configVersion
-> 拉取远程配置和玩家状态
-> 渲染主界面
```

`/bootstrap` 返回：

- serverTime
- user
- playerState
- playerRevision
- configVersion
- enabledActivities
- featureFlags
- notices

### 4.2 普通养成操作流程

例如升级弹珠：

```txt
点击升级弹珠
-> 客户端生成 opId
-> POST /player/actions/marble-upgrade
-> 服务端校验碎片、等级、消耗
-> 服务端写 ledger 和新状态
-> 返回 playerPatch + playerRevision
-> 客户端更新本地缓存和 UI
```

### 4.3 战斗流程

```txt
点击开始战斗
-> POST /battle/start
-> 服务端创建 battleSession，返回 battleId、seed、configVersion、阵容快照
-> 客户端本地模拟战斗
-> 客户端展示掉落动画和临时背包
-> POST /battle/finish
-> 服务端校验结果并计算最终奖励
-> 返回 acceptedRewards、playerPatch、battleSummary
-> 客户端展示结算
```

为了兼顾表现和安全：

- 掉落动画可以在客户端即时展示。
- 服务端结算返回最终确认奖励。
- 如客户端预展示与服务端奖励有差异，以服务端为准，UI 做轻量提示或静默修正。

## 5. 存档结构设计

当前客户端 `SaveData` 可以升级为后端 `PlayerState`。建议使用“结构化表 + JSON 快照”混合方式。

### 5.1 PlayerState 快照

用于快速启动和兼容客户端：

```ts
type PlayerState = {
  schemaVersion: number;
  revision: number;
  currencies: {
    coins: number;
    premium: number;
  };
  stats: {
    runs: number;
    wins: number;
    bestWave: number;
    highestStage: number;
  };
  lineup: string[];
  upgrades: Record<string, number>;
  characters: Record<string, {
    owned: boolean;
    level: number;
    routes: Record<string, number>;
  }>;
  marbleLevels: Record<string, number>;
  inventory: {
    collectibles: Record<string, number>;
    marbleShards: Record<string, number>;
    gems: Record<string, number>;
  };
  baseGems: Array<string | null>;
  settings: {
    autoBattle: boolean;
    autoSkill: boolean;
    autoUpgradeMode: "rarity" | "attack" | "defense" | "income";
  };
};
```

### 5.2 为什么还需要结构化表

只存 JSON 快照开发快，但后期会遇到问题：

- 查排行榜和活动任务不方便。
- 追踪货币异常困难。
- 补偿、回滚、客服查询成本高。
- 并发 action 容易覆盖字段。

因此建议：

- `player_state_snapshots` 保存完整 JSON 快照。
- `player_currencies`、`player_inventory_items`、`player_characters` 等保存关键经济字段。
- 每次 action 都写 `player_action_logs` 和 `currency_ledgers`。

## 6. 数据库表设计

以下是第一阶段建议表。

### 6.1 账号与玩家

```sql
users (
  id uuid primary key,
  guest_id text unique,
  platform text,
  platform_uid text,
  created_at timestamptz,
  last_login_at timestamptz,
  banned_until timestamptz,
  status text
)

player_profiles (
  user_id uuid primary key references users(id),
  nickname text,
  avatar_url text,
  level int,
  created_at timestamptz,
  updated_at timestamptz
)
```

### 6.2 玩家状态

```sql
player_states (
  user_id uuid primary key references users(id),
  schema_version int not null,
  revision bigint not null,
  snapshot jsonb not null,
  updated_at timestamptz not null
)

player_currencies (
  user_id uuid references users(id),
  currency text,
  amount bigint,
  updated_at timestamptz,
  primary key (user_id, currency)
)

currency_ledgers (
  id uuid primary key,
  user_id uuid references users(id),
  currency text,
  delta bigint,
  balance_after bigint,
  reason text,
  source_type text,
  source_id text,
  op_id text,
  created_at timestamptz
)
```

### 6.3 背包与养成

```sql
player_inventory_items (
  user_id uuid references users(id),
  item_type text,
  item_id text,
  amount bigint,
  updated_at timestamptz,
  primary key (user_id, item_type, item_id)
)

player_characters (
  user_id uuid references users(id),
  character_id text,
  owned boolean,
  level int,
  routes jsonb,
  updated_at timestamptz,
  primary key (user_id, character_id)
)

player_marbles (
  user_id uuid references users(id),
  marble_id text,
  level int,
  updated_at timestamptz,
  primary key (user_id, marble_id)
)

player_loadouts (
  user_id uuid primary key references users(id),
  lineup jsonb,
  base_gems jsonb,
  updated_at timestamptz
)
```

宝石可以先用 `player_inventory_items` 的 `item_type = "gem"`，`item_id = "power:3"` 这种 key 表示。后续如果宝石要随机词条，再改成实例表：

```sql
player_gem_instances (
  id uuid primary key,
  user_id uuid references users(id),
  gem_type text,
  level int,
  affixes jsonb,
  locked boolean,
  created_at timestamptz
)
```

### 6.4 战斗

```sql
battle_sessions (
  id uuid primary key,
  user_id uuid references users(id),
  mode text,
  stage int,
  config_version text,
  seed text,
  lineup_snapshot jsonb,
  state text,
  started_at timestamptz,
  finished_at timestamptz,
  client_version text,
  risk_score int
)

battle_results (
  battle_id uuid primary key references battle_sessions(id),
  result text,
  wave int,
  duration_ms int,
  kills int,
  selected_upgrades jsonb,
  client_summary jsonb,
  accepted_rewards jsonb,
  validation_flags jsonb,
  created_at timestamptz
)
```

### 6.5 活动与奖励

```sql
activity_definitions (
  id text primary key,
  type text,
  title text,
  config_version text,
  starts_at timestamptz,
  ends_at timestamptz,
  status text,
  rules jsonb,
  rewards jsonb,
  created_at timestamptz,
  updated_at timestamptz
)

player_activity_states (
  user_id uuid references users(id),
  activity_id text references activity_definitions(id),
  progress jsonb,
  claimed jsonb,
  updated_at timestamptz,
  primary key (user_id, activity_id)
)

reward_claim_logs (
  id uuid primary key,
  user_id uuid references users(id),
  activity_id text,
  reward_id text,
  rewards jsonb,
  op_id text,
  created_at timestamptz
)
```

### 6.6 配置与发布

```sql
game_config_versions (
  version text primary key,
  status text,
  checksum text,
  payload jsonb,
  published_at timestamptz,
  created_by uuid
)

feature_flags (
  key text primary key,
  enabled boolean,
  rules jsonb,
  updated_at timestamptz
)
```

## 7. API 设计

所有写接口请求头建议包含：

- `Authorization: Bearer <accessToken>`
- `X-Client-Version`
- `X-Device-Id`
- `X-Request-Id`

所有写接口 body 建议包含：

- `opId`：客户端生成 UUID，服务端幂等。
- `baseRevision`：客户端操作时基于的玩家状态版本。

### 7.1 认证

```http
POST /auth/guest
POST /auth/login
POST /auth/refresh
POST /auth/bind-platform
```

`POST /auth/guest` 返回：

```json
{
  "userId": "uuid",
  "accessToken": "...",
  "refreshToken": "...",
  "isNewUser": true
}
```

### 7.2 启动与同步

```http
GET /bootstrap
GET /player/state
POST /player/sync-actions
```

`GET /bootstrap` 返回：

```json
{
  "serverTime": 1782540000000,
  "playerRevision": 42,
  "playerState": {},
  "configVersion": "2026.06.27-001",
  "activities": [],
  "featureFlags": {},
  "notices": []
}
```

`POST /player/sync-actions` 用于弱网恢复时批量提交离线 action。第一阶段可以限制只允许提交非战斗 UI 设置，经济 action 必须在线完成。

### 7.3 战斗

```http
POST /battle/start
POST /battle/finish
GET /battle/history
```

`POST /battle/start` 请求：

```json
{
  "opId": "uuid",
  "mode": "normal",
  "stage": 1,
  "lineup": ["engineer", "blaster", "magnetist"],
  "baseGems": ["power:1", null, null]
}
```

返回：

```json
{
  "battleId": "uuid",
  "seed": "seed-string",
  "configVersion": "2026.06.27-001",
  "serverStartedAt": 1782540000000,
  "lineupSnapshot": {},
  "rules": {
    "waves": 20,
    "maxDurationMs": 360000
  }
}
```

`POST /battle/finish` 请求：

```json
{
  "opId": "uuid",
  "battleId": "uuid",
  "result": "win",
  "wave": 20,
  "durationMs": 245000,
  "kills": 238,
  "selectedUpgrades": ["damage_up", "fire_rate"],
  "clientDrops": [],
  "clientStats": {
    "coins": 170,
    "maxDamage": 1280
  }
}
```

返回：

```json
{
  "accepted": true,
  "validationFlags": [],
  "acceptedRewards": {
    "coins": 170,
    "drops": []
  },
  "playerRevision": 43,
  "playerPatch": {}
}
```

### 7.4 养成操作

```http
POST /player/actions/meta-upgrade
POST /player/actions/character-level-up
POST /player/actions/character-route-up
POST /player/actions/lineup-update
POST /player/actions/marble-upgrade
POST /player/actions/collectible-sell
POST /player/actions/collectible-sell-all
POST /player/actions/gem-equip
POST /player/actions/gem-unequip
POST /player/actions/gem-fuse
```

统一返回：

```json
{
  "ok": true,
  "playerRevision": 44,
  "playerPatch": {},
  "cost": {},
  "reward": {},
  "message": "升级成功"
}
```

### 7.5 活动、邮件、排行榜

```http
GET /activities
POST /activities/:activityId/claim
GET /mail
POST /mail/:mailId/claim
GET /leaderboards/:boardId
```

活动第一阶段建议支持：

- 每日登录。
- 每日挑战次数。
- 击杀累计。
- 通关累计。
- 掉落收集。
- 限时 Boss 挑战。

## 8. 配置服务设计

### 8.1 配置分类

建议拆成以下配置文件：

```txt
config/
  characters.json
  marbles.json
  enemies.json
  tactical-upgrades.json
  loot.json
  meta-upgrades.json
  modes.json
  activities.json
```

### 8.2 配置版本

每次发布生成：

```json
{
  "version": "2026.06.27-001",
  "checksum": "sha256",
  "files": {
    "characters": "characters.2026.06.27-001.json",
    "marbles": "marbles.2026.06.27-001.json"
  }
}
```

客户端策略：

- 当前版本一致，不下载。
- 版本不同，下载 manifest 和变更文件。
- 下载失败，继续使用本地内置配置，但不能进入需要新配置的活动。

### 8.3 配置兼容

配置不能直接删除客户端可能持有的 ID。需要：

- 废弃字段：`disabled: true`。
- ID 永久稳定。
- 新字段有默认值。
- 服务端结算用 battle start 时记录的 `configVersion`。

## 9. 战斗校验和反作弊

### 9.1 第一阶段校验

第一阶段不用做复杂服务端回放，先做规则校验：

- battleId 必须存在且属于当前用户。
- battle 只能 finish 一次。
- 结算时间在合理范围内。
- wave、kills、coins、drops 不超过配置上限。
- 阵容角色必须已拥有。
- 弹珠、宝石、局外强化必须来自开局快照。
- 战术升级 ID 必须存在，数量和等级成长合理。
- Boss/精英奖励必须符合当前波次。

异常处理：

- 轻微异常：服务端按保守奖励结算，记录 risk flag。
- 严重异常：拒绝结算或只给基础奖励。
- 多次异常：提高用户 risk_score，限制排行榜或活动高价值奖励。

### 9.2 第二阶段校验

引入确定性随机：

- `/battle/start` 返回 seed。
- 客户端所有掉落、升级卡选择池都使用可复现 RNG。
- `/battle/finish` 提交关键事件摘要。
- 服务端用 seed 和配置重算掉落上限。

### 9.3 第三阶段校验

针对排行榜、Boss 挑战、活动榜：

- 服务端轻量模拟战斗摘要。
- 记录关键帧 hash。
- 高分进入人工或自动复核队列。

## 10. 活动系统设计

### 10.1 活动组成

每个活动包含：

- 活动 ID。
- 开始和结束时间。
- 展示文案。
- 任务规则。
- 奖励列表。
- 可参与条件。
- 排序和入口位置。

示例：

```json
{
  "id": "daily_login_202606",
  "type": "daily_login",
  "title": "每日补给",
  "startsAt": "2026-06-27T00:00:00+08:00",
  "endsAt": "2026-07-27T00:00:00+08:00",
  "rules": {
    "reset": "daily"
  },
  "rewards": [
    { "day": 1, "items": [{ "type": "currency", "id": "coins", "amount": 100 }] }
  ]
}
```

### 10.2 活动进度来源

活动进度由服务端根据 action 和 battle result 更新：

- battle_finish 更新击杀、通关、最高波、挑战次数。
- item_drop 更新收集类任务。
- currency_spend 更新消耗类任务。
- login 更新登录类任务。

客户端不直接上报“我完成了任务”，只上报行为，服务端计算进度。

## 11. 客户端改造计划

### 11.1 新增客户端模块

建议在当前前端中增加：

```txt
src/services/
  api-client.ts
  auth-api.ts
  player-api.ts
  battle-api.ts
  activity-api.ts
  config-api.ts

src/state/
  remote-save.ts
  sync-queue.ts
  config-store.ts

src/app/
  online-game-app.ts
```

### 11.2 SaveData 改造

当前 `SaveData` 后续变成：

- `LocalCache`：本地缓存。
- `PlayerState`：服务端状态。
- `PendingAction`：离线或失败重试队列。

本地 `localStorage` key 建议升级：

```txt
game-marbles-auth-v1
game-marbles-cache-v2
game-marbles-actions-v1
game-marbles-config-v1
```

### 11.3 客户端接口适配层

所有当前直接改 `this.save` 的地方，逐步改成 action：

```ts
await playerActions.upgradeMarble(marbleId);
await playerActions.equipGem(key, slot);
await battleActions.finishBattle(summary);
```

第一阶段可以保留本地实现和远程实现两个 adapter：

```ts
interface PlayerRepository {
  load(): Promise<PlayerState>;
  upgradeMarble(id: MarbleId): Promise<ActionResult>;
  fuseGem(key: string): Promise<ActionResult>;
}
```

开发环境用 `LocalPlayerRepository`，联调环境用 `RemotePlayerRepository`。

## 12. 后端开发模块拆分

建议后端目录：

```txt
server/
  src/
    app.ts
    config/
    db/
      schema.ts
      migrations/
    modules/
      auth/
      player/
      battle/
      inventory/
      activity/
      game-config/
      admin/
    shared/
      errors.ts
      idempotency.ts
      validation.ts
      time.ts
```

模块职责：

- `auth`：游客、平台登录、token。
- `player`：玩家状态、revision、action 调度。
- `battle`：开局、结算、战斗记录。
- `inventory`：物品、宝石、货币 ledger。
- `activity`：活动进度和奖励领取。
- `game-config`：配置版本和发布。
- `admin`：管理后台接口。

## 13. 幂等、并发和错误码

### 13.1 幂等

所有写接口必须保存 `opId`。

```sql
idempotency_keys (
  user_id uuid,
  op_id text,
  endpoint text,
  response jsonb,
  created_at timestamptz,
  primary key (user_id, op_id)
)
```

重复请求：

- `opId` 相同且 endpoint 相同：返回上一次 response。
- `opId` 相同但 endpoint 不同：返回错误。

### 13.2 Revision

每次成功修改玩家状态：

- `player_states.revision += 1`
- 返回新 revision。

如果客户端 `baseRevision` 太旧：

- 简单 action 可以由服务端基于最新状态重算。
- 复杂 action 返回 `STATE_CONFLICT`，客户端拉取最新状态。

### 13.3 错误码

建议统一：

```txt
UNAUTHORIZED
STATE_CONFLICT
INSUFFICIENT_RESOURCE
INVALID_CONFIG_VERSION
INVALID_BATTLE_SESSION
BATTLE_ALREADY_FINISHED
VALIDATION_FAILED
ACTIVITY_NOT_AVAILABLE
REWARD_ALREADY_CLAIMED
RATE_LIMITED
SERVER_ERROR
```

## 14. 安全和运营

### 14.1 安全基础

- 全站 HTTPS。
- JWT access token + refresh token。
- token 绑定 deviceId。
- 写接口限流。
- 高价值 action 记录完整日志。
- 后台接口单独鉴权和操作审计。

### 14.2 经济安全

- 金币和物品只允许通过服务端 action 改变。
- 每次变更写 ledger。
- 结算奖励和活动奖励写来源。
- 管理后台补偿也写 ledger。

### 14.3 运营能力

第一阶段建议后台支持：

- 查看用户状态。
- 发放补偿邮件。
- 配置活动。
- 发布配置版本。
- 查看战斗异常。
- 查看货币流水。

## 15. 分阶段落地计划

### 第 1 阶段：后端骨架和账号存档

目标：

- 跑通游客登录。
- `/bootstrap` 返回玩家状态。
- 服务端保存 `PlayerState`。
- 客户端从本地存档迁移一次到服务端。
- 本地缓存仍可兜底。

交付：

- Auth API。
- PlayerState API。
- PostgreSQL schema。
- 客户端 `RemotePlayerRepository` 雏形。

### 第 2 阶段：经济 action 服务端化

目标：

- 升级角色、升级弹珠、宝石装备/合成、出售收藏品全部走服务端。
- 加入幂等和 ledger。
- 本地直接改 save 的逻辑逐步移除。

交付：

- player actions API。
- inventory service。
- currency ledger。
- 客户端 action queue。

### 第 3 阶段：战斗开局和结算

目标：

- `/battle/start` 创建 battle session。
- `/battle/finish` 校验并发奖励。
- 掉落奖励由服务端确认。
- 战斗历史可查。

交付：

- battle service。
- battle result table。
- 基础反作弊规则。

### 第 4 阶段：活动和远程配置

目标：

- 活动配置从后端下发。
- 活动进度由服务端行为更新。
- 配置版本化。
- 客户端支持配置 manifest。

交付：

- activity service。
- config service。
- 管理后台基础发布能力。

### 第 5 阶段：排行榜、邮件、风控

目标：

- 排行榜。
- 邮件和补偿。
- 异常用户 risk score。
- 高价值玩法更严格校验。

## 16. 当前项目下一步建议

前端当前已经开始模块拆分，下一步建议按这个顺序接后端：

1. 在前端新增 `services/api-client.ts` 和 `PlayerRepository` 接口。
2. 把 `state/save.ts` 改造成 local repository，保留当前本地玩法。
3. 新建 `server/` 后端骨架，先实现游客登录和 `/bootstrap`。
4. 做一次本地存档上传迁移：本地有存档、服务端新号时上传；服务端已有进度时以后端为准。
5. 先接入仓库/角色/弹珠这些局外 action。
6. 最后接入战斗 start/finish 和活动。

这样拆，前端玩法可以继续迭代，后端也能逐步替换本地存档，不会一次性把项目卡死。
