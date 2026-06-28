# 排行榜功能设计

## 1. 设计目标

排行榜要服务三个目标：

- 给 PVP 段位体系一个公开荣誉出口，让竞技大厅不只展示个人段位，还能看到赛季竞争位置。
- 给 PVE 长线玩法一个可追逐目标，例如无尽最高波、最快通关、活动挑战榜。
- 给后续赛季奖励、称号、头像框、竞技商店解锁提供可信数据来源。

第一版优先做“竞技 1v1 赛季榜”和长期养成总榜。当前项目已经有 PVP 段位、赛季、匹配、结算、基地强化、角色养成、幻化、主线进度、金币和成就，因此排行榜应先复用这些可信账号数据，而不是重新设计一套成长等级。

## 2. 第一版范围

### 2.1 必做

- 首页“排行”入口改为排行榜中心。
- 增加竞技榜页签：`1v1 赛季榜`。
- 增加养成总榜页签：`基地榜`、`角色榜`、`幻化榜`、`主线榜`、`财富榜`、`成就榜`。
- 展示赛季剩余时间、我的排名、我的段位、前 100 名列表。
- PVP 结算后由服务端更新排行榜条目。
- 玩家存档保存后由服务端刷新养成总榜条目。
- 榜单支持分页和“定位到我”。
- 离线或服务器不可用时，保留本地统计兜底展示。

### 2.2 暂不做

- 好友榜。
- 公会榜。
- 实时观战。
- 每日活动榜。
- 多人吃鸡榜。
- 排行榜奖励发放。

这些可以作为后续阶段扩展，第一版先把服务端榜单链路跑通。

## 3. 榜单类型

### 3.1 竞技 1v1 赛季榜

| 字段 | 说明 |
| --- | --- |
| boardId | `pvp_duel_season` |
| 数据来源 | `/api/pvp/rank/finish` 结算后的 `pvpRanks.duel` |
| 赛季 | 使用 `currentPvpSeason()` 的 `seasonId` |
| 排名依据 | 段位阶梯、段位分、大师分、隐藏 rating、胜场 |
| 展示分数 | 段位标签，例如 `黄金 I`；大师以上显示大师分 |
| 展示范围 | 默认前 100，支持分页 |
| 个人定位 | 返回自己排名附近 10 名 |

排序规则：

```txt
sortScore =
  rankStep * 1_000_000
  + masterPoints * 1_000
  + points * 10
  + normalizedRatingBonus
```

同分排序：

1. `sortScore` 高者在前。
2. 胜场多者在前。
3. 胜率高者在前。
4. 最近更新时间早者在前，减少刷同分卡位。

展示注意：

- 不展示隐藏 MMR。
- 不展示是否匹配到系统对手。
- 不展示异常标记，只是异常条目不入榜或延迟入榜。

### 3.2 无尽最高波榜

第二阶段开放。

| 字段 | 说明 |
| --- | --- |
| boardId | `endless_wave_season` |
| 数据来源 | `/api/battle/finish` 的无尽战斗结果 |
| 排名依据 | 最高波次、击杀、货值、用时 |
| 展示分数 | `第 x 波` |
| 风控要求 | 服务端校验波次、击杀、掉落上限 |

排序规则：

```txt
sortScore =
  wave * 1_000_000
  + kills * 100
  + lootValue
  - durationPenalty
```

### 3.3 吃鸡搜打撤榜

多人模式上线后开放。

| 字段 | 说明 |
| --- | --- |
| boardId | `pvp_battle_royale_season` |
| 数据来源 | 大逃杀结算 |
| 排名依据 | 撤离成功、名次、击败数、带出货值 |
| 展示分数 | 段位或撤离积分 |

该榜单不建议只按击杀排序，否则会鼓励玩家放弃搜打撤目标。推荐“撤离价值 + 名次 + 击败”的复合分。

### 3.4 基地榜

| 字段 | 说明 |
| --- | --- |
| boardId | `base_power_all_time` |
| 周期 | 总榜，`seasonId = all_time` |
| 数据来源 | `/api/player/state` 保存后的 `upgrades` 与 `baseGems` |
| 排名依据 | 基地协议强化等级、已激活协议数、已装备宝石等级 |
| 展示分数 | `评分 x` |

排序规则：

```txt
protocolScore = sum(protocolLevel * 120 + protocolLevel^2 * 8)
gemScore = equippedGemLevelSum * 95 + equippedGemCount * 60
score = protocolScore + gemScore
sortScore = score * 1000 + gemLevelSum * 10 + protocolLevelSum
```

### 3.5 角色榜

| 字段 | 说明 |
| --- | --- |
| boardId | `character_power_all_time` |
| 周期 | 总榜，`seasonId = all_time` |
| 数据来源 | `/api/player/state` 保存后的角色等级、技能、路线、弹珠等级和角色弹珠配置 |
| 排名依据 | 玩家已拥有角色的总战斗力，最强角色战力作为同分优先级 |
| 展示分数 | `战力 x` |

角色战斗力使用前端角色面板的等价公式：角色等级、路线、被动、技能等级、弹珠基础伤害和弹珠等级共同影响最终战力。

### 3.6 幻化榜

| 字段 | 说明 |
| --- | --- |
| boardId | `cosmetic_score_all_time` |
| 周期 | 总榜，`seasonId = all_time` |
| 数据来源 | `/api/player/state` 保存后的 `cosmetics.owned` |
| 排名依据 | 玩家已拥有幻化的稀有度加权总分 |
| 展示分数 | `幻化 x` |

计分权重：

```txt
rare = 10
epic = 35
legendary = 120
score = sum(rarityWeight * ownedCount)
```

### 3.7 主线榜

| 字段 | 说明 |
| --- | --- |
| boardId | `campaign_progress_all_time` |
| 周期 | 总榜，`seasonId = all_time` |
| 数据来源 | `/api/player/state` 保存后的 `progress.clearedStages` 与 `progress.unlockedStage` |
| 排名依据 | 最高主线进度、累计星数、最高进度关卡最好时间 |
| 展示分数 | `主线 x-y` |

排序规则：

```txt
sortScore =
  highestStageIndex * 1_000_000
  + totalStars * 1_000
  + bestTimeBonus
```

### 3.8 财富榜

| 字段 | 说明 |
| --- | --- |
| boardId | `wealth_coins_all_time` |
| 周期 | 总榜，`seasonId = all_time` |
| 数据来源 | `/api/player/state` 保存后的当前金币与可回溯金币投入 |
| 排名依据 | 当前金币 + 基地强化投入 + 角色等级/技能/路线投入 |
| 展示分数 | `金币 x` |

当前存档没有独立的“历史累计金币”字段，因此第一版用“当前金币 + 已投入金币”还原累计金币财富。后续如果存档增加 `lifetimeCoins`，财富榜可以直接改用该字段，并保留投入金币作为展示构成。

### 3.9 成就榜

| 字段 | 说明 |
| --- | --- |
| boardId | `achievement_count_all_time` |
| 周期 | 总榜，`seasonId = all_time` |
| 数据来源 | `/api/player/state` 保存后的战斗、通关、养成、收集和协议状态 |
| 排名依据 | 已达成成就数量，成就总进度作为同分排序 |
| 展示分数 | `x/y 成就` |

成就榜使用收藏室已有成就集合的服务端等价判断，避免前端可视状态和排行榜状态分裂。

## 4. 页面设计

### 4.1 排行榜中心

入口：主页已有“排行”设施，点击进入排行榜中心。

布局：

- 顶部：标题、赛季剩余时间或总榜标记、刷新状态。
- 榜单页签：`竞技榜`、`基地榜`、`角色榜`、`幻化榜`、`主线榜`、`财富榜`、`成就榜`、`无尽榜`、`吃鸡榜`。
- 主区域：榜单列表。
- 底部或顶部固定：我的排名卡片。

第一版启用 `竞技榜` 与 6 个养成总榜；`无尽榜`、`吃鸡榜` 继续展示“即将开放”。

### 4.2 竞技榜列表项

每行展示：

| 区域 | 内容 |
| --- | --- |
| 排名 | `#1`、`#2`、`#3`、普通名次 |
| 玩家 | 头像、昵称 |
| 段位 | `黄金 I`、`大师 620` |
| 战绩 | `38胜 21负 · 64%` |
| 连胜 | `最高 8 连胜` |

前三名可以使用更突出的行样式，但不要做独立大领奖台。当前项目操作型界面更适合紧凑可扫描的榜单。

### 4.3 我的排名

我的排名卡片展示：

- 当前名次：`#128`，未入榜显示 `未入榜`。
- 当前段位。
- 距离上一名差距：例如 `还差 12 分`。
- 最近更新时间。

如果玩家还在定级赛，显示：

```txt
定级赛进行中，完成 5 场后进入赛季榜
```

### 4.4 竞技大厅入口

竞技大厅增加一个小入口：

- 文案：`赛季榜`
- 位置：竞技段位概览附近。
- 点击进入排行榜中心并默认选中 `竞技榜`。

## 5. 服务端数据模型

### 5.1 榜单条目表

新增表 `gm_leaderboard_entries`。

```sql
create table gm_leaderboard_entries (
  board_id text not null,
  season_id text not null,
  user_id uuid not null references gm_users(id) on delete cascade,
  score bigint not null default 0,
  sort_score bigint not null default 0,
  display_score text not null default '',
  metrics jsonb not null default '{}'::jsonb,
  nickname text not null default '',
  avatar text not null default 'avatar_green',
  risk_state text not null default 'normal',
  hidden_until timestamptz,
  updated_at timestamptz not null default now(),
  primary key (board_id, season_id, user_id)
);
```

索引：

```sql
create index gm_leaderboard_entries_rank_idx
on gm_leaderboard_entries (board_id, season_id, sort_score desc, updated_at asc);

create index gm_leaderboard_entries_user_idx
on gm_leaderboard_entries (user_id, board_id, season_id);
```

### 5.2 榜单快照表

第一版可以先不做物化快照，直接查表加 `limit`。当用户量上来后再加 `gm_leaderboard_snapshots`。

后续快照字段：

```sql
create table gm_leaderboard_snapshots (
  board_id text not null,
  season_id text not null,
  range_key text not null,
  entries jsonb not null,
  generated_at timestamptz not null default now(),
  primary key (board_id, season_id, range_key)
);
```

`range_key` 示例：

- `top:100`
- `around:user_id`
- `tier:gold`

## 6. 服务端接口

### 6.1 获取榜单配置

```http
GET /api/leaderboards
```

返回：

```json
{
  "season": {
    "id": "arena-20260608-7",
    "startsAt": 1780876800000,
    "endsAt": 1783296000000
  },
  "boards": [
    {
      "id": "pvp_duel_season",
      "title": "1v1 赛季榜",
      "enabled": true,
      "mode": "duel"
    }
  ]
}
```

### 6.2 获取榜单列表

```http
GET /api/leaderboards/:boardId?seasonId=xxx&offset=0&limit=50
```

返回：

```json
{
  "boardId": "pvp_duel_season",
  "seasonId": "arena-20260608-7",
  "offset": 0,
  "limit": 50,
  "totalEstimate": 12034,
  "entries": [
    {
      "rank": 1,
      "userId": "public-user-id",
      "nickname": "xiaowang",
      "avatar": "engineer",
      "displayScore": "大师 620",
      "metrics": {
        "tier": "master",
        "wins": 82,
        "losses": 31,
        "winRate": 73,
        "bestWinStreak": 12
      },
      "updatedAt": 1780960000000
    }
  ],
  "me": {
    "rank": 128,
    "displayScore": "黄金 I",
    "deltaToPrevious": 12
  },
  "serverTime": 1780960000000
}
```

### 6.3 获取我的附近排名

```http
GET /api/leaderboards/:boardId/me?seasonId=xxx&radius=5
```

返回我前后若干名，用于“定位到我”。

### 6.4 更新榜单条目

不开放客户端直接调用。

服务端内部在以下流程调用：

- `/api/pvp/rank/finish`
- `/api/player/state`
- `/api/redeem-code`
- `/api/battle/finish`
- 后续大逃杀结算接口

原则：

- 客户端提交战斗结果。
- 服务端校验和结算。
- 服务端根据可信结算结果写入排行榜。

## 7. PVP 结算写榜规则

`handlePvpRankFinish()` 当前已经会更新 `save.pvpRanks[mode]`。第一版在保存玩家状态后增加：

```txt
if mode === "duel"
and !rankResult.abnormal
and placementMatchesLeft === 0:
  upsertLeaderboardEntry("pvp_duel_season", seasonId, userId, profile)
```

写入字段：

| 字段 | 来源 |
| --- | --- |
| score | `rankStep * 100 + points`，大师以上使用大师分 |
| sort_score | 排序专用复合分 |
| display_score | `pvpRankDisplayLabel(profile)` |
| nickname | `gm_users.nickname` |
| avatar | `gm_users.avatar` |
| metrics.tier | `profile.tier` |
| metrics.division | `profile.division` |
| metrics.points | `profile.points` |
| metrics.masterPoints | `profile.masterPoints` |
| metrics.wins | `profile.wins` |
| metrics.losses | `profile.losses` |
| metrics.bestWinStreak | `profile.bestWinStreak` |

定级赛期间不入榜，避免 `定级中 1/5` 出现在榜单里。

## 8. 风控与公平性

排行榜比普通结算更敏感，必须遵循更严格规则。

### 8.1 入榜条件

PVP 竞技榜入榜条件：

- 已登录账号。
- 当前赛季。
- 已完成定级赛。
- `rankResult.abnormal === false`。
- 服务端结算成功。
- 玩家未被封禁或榜单隐藏。

PVE 无尽榜入榜条件：

- 战斗由 `/api/battle/start` 创建。
- `/api/battle/finish` 校验通过。
- 波次、击杀、掉落、用时未超过配置上限。

### 8.2 异常处理

| 情况 | 处理 |
| --- | --- |
| 轻微异常 | 结算奖励保守处理，不写榜 |
| 严重异常 | 拒绝结算，不写榜 |
| 多次异常 | `risk_state = hidden`，一段时间内不显示 |
| 昵称违规 | 榜单展示默认昵称，保留成绩 |
| 封禁账号 | 从榜单查询中过滤 |

### 8.3 隐藏系统对手信息

排行榜展示不区分对手来源。无论玩家匹配到真人还是服务器补位，对用户只展示对局结果、段位和战绩。

内部可以记录 `opponentType` 用于风控和收益修正，但不要在榜单、战报、结算文案里暴露。

## 9. 前端状态设计

### 9.1 类型

新增类型：

```ts
export type LeaderboardBoardId =
  | "pvp_duel_season"
  | "endless_wave_season"
  | "pvp_battle_royale_season";

export type LeaderboardEntry = {
  rank: number;
  userId: string;
  nickname: string;
  avatar: string;
  displayScore: string;
  metrics: Record<string, unknown>;
  updatedAt: number;
};

export type LeaderboardResponse = {
  boardId: LeaderboardBoardId;
  seasonId: string;
  entries: LeaderboardEntry[];
  me: LeaderboardEntry | null;
  serverTime: number;
};
```

### 9.2 客户端缓存

`GameBackend` 增加：

- `getLeaderboards()`
- `getLeaderboard(boardId, params)`
- `getLeaderboardAroundMe(boardId, params)`

游戏实例保存轻量 UI 状态：

```ts
leaderboardTab = "pvp_duel_season";
leaderboardState = {
  loading: false,
  error: "",
  entries: [],
  me: null,
  fetchedAt: 0,
};
```

缓存策略：

- 打开排行榜时，如果缓存超过 30 秒则刷新。
- PVP 结算成功后，标记竞技榜缓存失效。
- 切换页签时按需加载。
- 离线时显示上次缓存；无缓存时显示本地统计。

## 10. UI 细节

### 10.1 排行榜中心结构

```txt
标题栏：排行榜 · 赛季剩余 x 天
页签：竞技榜 / 无尽榜 / 吃鸡榜
我的排名卡：#128 黄金 I 38胜21负
榜单列表：
  #1 头像 昵称 大师 620 82胜31负
  #2 ...
操作：刷新 / 定位到我 / 返回
```

### 10.2 空状态

| 状态 | 文案 |
| --- | --- |
| 未定级 | 完成 5 场定级赛后进入赛季榜 |
| 无数据 | 本赛季暂无上榜玩家 |
| 离线 | 无法连接排行榜，正在展示本地统计 |
| 未开放 | 该榜单即将开放 |

### 10.3 排名颜色

- 第 1 名：金色强调。
- 第 2 名：冷白银色。
- 第 3 名：铜色。
- 我的排名：绿色或青色边框。
- 异常、封禁、隐藏条目不出现在前端列表。

## 11. 赛季结算与奖励

第一版不发赛季奖励，只展示排名。

后续加入赛季奖励时：

- 以赛季结束时的榜单快照为准。
- 奖励进入邮件系统，不在打开排行榜时直接发。
- 奖励建议包含头像框、称号、竞技币，不直接给强战力资源。

奖励档位建议：

| 档位 | 奖励方向 |
| --- | --- |
| 前 10 | 限定头像框、称号、大量竞技币 |
| 前 100 | 赛季头像框、竞技币 |
| 前 500 | 赛季称号、竞技币 |
| 黄金以上 | 参与型赛季补给 |

## 12. 实施阶段

### 阶段 1：竞技榜闭环

- 数据库新增 `gm_leaderboard_entries`。
- 服务端新增榜单查询接口。
- `handlePvpRankFinish()` 写入 `pvp_duel_season`。
- 前端排行榜中心读取并展示竞技榜。
- 竞技大厅增加“赛季榜”入口。

### 阶段 2：无尽榜

- `/api/battle/finish` 写入 `endless_wave_season`。
- 增加无尽榜页签。
- 引入更严格的战斗结果校验。

### 阶段 3：附近排名和缓存优化

- 增加 `around me` 查询。
- 增加榜单快照缓存。
- 榜单刷新频率限制。

### 阶段 4：吃鸡榜和赛季奖励

- 大逃杀结算写榜。
- 赛季快照。
- 邮件发奖。
- 称号、头像框、展示徽章。

## 13. 开发清单

后续开始开发时建议按这个顺序：

1. 后端 migration：新增 `gm_leaderboard_entries`。
2. 后端工具函数：`upsertLeaderboardEntry()`、`queryLeaderboard()`、`queryLeaderboardMe()`。
3. PVP 结算接入：`handlePvpRankFinish()` 写榜。
4. API：`GET /api/leaderboards`、`GET /api/leaderboards/:boardId`、`GET /api/leaderboards/:boardId/me`。
5. 前端服务：`GameBackend` 增加排行榜请求。
6. 前端 UI：替换当前本地排行页。
7. 竞技大厅：增加“赛季榜”入口。
8. 测试：本地账号 A/B 多次结算后排名变化正确。

## 14. 第一版验收标准

- 完成 PVP 定级赛后，玩家能出现在 `1v1 赛季榜`。
- 胜利提升段位后，榜单排序会更新。
- 排行榜不显示隐藏 MMR 和对手来源。
- 未登录、离线、服务器异常都有明确兜底界面。
- `npm run build` 通过。
- 后端接口返回结构稳定，前端不会依赖数据库内部字段。
