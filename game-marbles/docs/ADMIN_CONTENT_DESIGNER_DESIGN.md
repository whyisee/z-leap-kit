# 游戏后台内容设计器方案

本文档用于设计一个面向游戏运营、策划和美术的后台内容设计器。它不是单纯的数据表管理后台，而是一个可以创建、预览、校验、发布和回滚游戏内容的生产工具。首版重点覆盖幻化、角色服装、弹珠外观、拖尾表现、抽卡池和外观商店投放。

## 1. 可行性结论

可行，而且很适合当前项目阶段。

当前游戏内容已经具备几个有利条件：

- 游戏内容大多集中在 `src/config/*`，适合迁移成版本化远程配置。
- 已经有后端设计，包含 `configVersion`、`/bootstrap`、玩家状态同步和排行榜接口。
- 幻化、拖尾、商店、排行榜、PVP 等系统已经出现运营配置诉求。
- 弹珠幻化已经开始拆出外观属性，例如风格、颜色、长度、宽度、动效和密度，适合通过设计器编辑。

建议先做“受约束的内容设计器”，不要第一版做成完全自由的低代码工具。后台可以开放大量参数，但必须有模板、范围、校验和预览，否则很容易发布出破坏战斗可读性或经济平衡的内容。

## 2. 设计目标

核心目标：

- 让策划可以创建和修改幻化、服装、弹珠皮肤、拖尾表现、卡池和商店投放。
- 让美术可以上传或绑定素材，并在真实游戏场景中预览效果。
- 让开发把内容更新从代码发布中拆出来，通过配置版本发布。
- 让运营可以灰度、定时、回滚内容。
- 让所有发布内容都经过结构校验、引用校验、经济校验和性能预算校验。

不做的事：

- 首版不做战斗数值平衡编辑器。
- 首版不允许后台直接编辑角色伤害、弹珠伤害、敌人血量等核心数值。
- 首版不做任意脚本执行，避免安全风险。
- 首版不做多人协同实时编辑，只保留编辑锁和版本记录。

## 3. 首版范围

### 3.1 内容类型

首版支持这些内容：

| 类型 | 说明 | 首版能力 |
| --- | --- | --- |
| 角色服装 | 角色皮肤、头像、展示图、战斗头像 | 创建、编辑、预览、上下架 |
| 弹珠幻化 | 弹珠外观、拖尾、命中和击败表现 | 创建、编辑、战斗预览 |
| 拖尾模板 | 风格、颜色、长度、宽度、动效、密度 | 作为弹珠幻化子模块 |
| 抽卡池 | 角色幻化池、弹珠幻化池、限时主题池 | 配置概率、保底、UP、时间 |
| 外观商店 | 幻彩尘兑换、竞技币兑换、限时外观 | 配置价格、库存、上下架 |
| 图鉴展示 | 外观来源、稀有度、主题、得分 | 配置展示信息 |

后续扩展：

- 角色技能视觉皮肤。
- 入场动作、胜利动作、主页展示动作。
- 称号、头像框、聊天气泡。
- 活动任务、邮件补偿、赛季奖励。
- 章节、敌人、战术卡等战斗配置。

### 3.2 内容边界

幻化和服装只能改变表现，不改变战斗强度。

后台必须禁止这些字段出现在外观配置里：

- 伤害加成。
- 攻速加成。
- 弹珠速度。
- 弹珠碰撞体积。
- 角色生命。
- 掉落倍率。
- 金币倍率。
- PVP 匹配或段位加成。

如果未来要做带属性的装备系统，应作为独立的装备设计器，不混在幻化设计器中。

## 4. 后台整体结构

建议后台命名为“内容工坊”或“运营工坊”。

页面结构：

```txt
顶部：环境 / 当前配置版本 / 发布状态 / 用户权限
左侧：内容类型导航
中间：列表或编辑器
右侧：实时预览 / 校验结果 / 发布摘要
底部：保存草稿 / 提审 / 发布 / 回滚 / 操作日志
```

一级模块：

| 模块 | 用途 |
| --- | --- |
| 内容库 | 管理幻化、服装、弹珠皮肤、拖尾模板 |
| 素材库 | 上传图片、特效图、音效，管理 CDN 地址 |
| 预览沙盒 | 在真实 UI 和战斗场景中预览配置 |
| 投放配置 | 管理抽卡池、商店、活动投放 |
| 发布中心 | 配置版本、灰度、定时发布、回滚 |
| 审计日志 | 查看谁改了什么，什么时候发布 |

## 5. 核心工作流

### 5.1 内容创建流程

```txt
创建草稿
-> 选择内容类型和模板
-> 填写基础信息
-> 绑定素材
-> 编辑表现参数
-> 实时预览
-> 自动校验
-> 提交审核
-> 生成发布候选版本
-> 灰度或全量发布
```

### 5.2 发布流程

```txt
多个内容草稿
-> 合并为配置包
-> 生成 configVersion
-> 运行自动校验
-> 生成差异报告
-> 审核通过
-> 发布到测试环境
-> 发布到灰度环境
-> 发布到正式环境
```

### 5.3 回滚流程

```txt
发现问题
-> 发布中心选择历史版本
-> 查看回滚影响
-> 生成回滚版本
-> 发布
-> 客户端下次 bootstrap 获取旧配置版本
```

回滚不能直接删除玩家已经获得的物品。若某个外观下架，玩家已拥有内容仍应保留，只是不再进入卡池或商店。

## 6. 内容数据模型

### 6.1 通用内容字段

所有内容都建议使用统一元信息：

```ts
type AdminContentItem = {
  id: string;
  type: "character_skin" | "marble_skin" | "trail_preset" | "gacha_pool" | "shop_offer";
  name: string;
  desc: string;
  rarity?: "rare" | "epic" | "legendary";
  theme?: string;
  tags: string[];
  status: "draft" | "reviewing" | "approved" | "published" | "archived";
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  version: number;
};
```

### 6.2 角色服装配置

```ts
type CharacterSkinContent = AdminContentItem & {
  type: "character_skin";
  targetCharacterId: string;
  assets: {
    portrait: string;
    battleAvatar: string;
    profileAvatar?: string;
    cardArt?: string;
    previewBackground?: string;
  };
  colors: {
    primary: string;
    accent: string;
    glow?: string;
  };
  presentation: {
    label: string;
    entranceEffect?: string;
    victoryPose?: string;
    skillFxPreset?: string;
  };
  unlock: {
    source: "gacha" | "shop" | "event" | "achievement" | "mail";
    visibleBeforeOwned: boolean;
  };
};
```

### 6.3 弹珠幻化配置

```ts
type MarbleSkinContent = AdminContentItem & {
  type: "marble_skin";
  targetMarbleId: string;
  visual: {
    label: string;
    shape: "orb" | "candy" | "star" | "leaf" | "crystal" | "bomb" | "flame" | "bolt" | "snowflake" | "ring" | "flower" | "comet";
    bodyColor: string;
    accentColor: string;
    highlightColor?: string;
  };
  trail: MarbleTrailConfig;
  impact: {
    hitEffect: "spark" | "flare" | "electric" | "frost" | "petal" | "crystal" | "ribbon" | "galaxy" | "pulse";
    defeatEffect: "spark" | "flare" | "electric" | "frost" | "petal" | "crystal" | "ribbon" | "galaxy" | "pulse";
    soundKey?: string;
  };
  performance: {
    maxParticles: number;
    recommendedIntensity: "low" | "medium" | "high";
    allowInPvp: boolean;
  };
};
```

### 6.4 拖尾配置

拖尾不是一个单独由风格决定的东西，而是一组可以独立调节的表现属性。

```ts
type MarbleTrailConfig = {
  style: "soft" | "spark" | "stardust" | "leaf" | "ribbon" | "flame" | "electric" | "frost" | "firework" | "petal" | "aurora" | "galaxy";
  color: string;
  accentColor: string;
  highlightColor?: string;
  length: number;
  width: number;
  animation: "steady" | "pulse" | "flicker" | "sparkle" | "flow" | "zigzag" | "orbit";
  density: number;
  opacity?: number;
  turbulence?: number;
  glow?: number;
  fade?: number;
  segmentSpacing?: number;
  sparkRate?: number;
};
```

建议参数范围：

| 字段 | 范围 | 说明 |
| --- | --- | --- |
| length | 0.35 到 2.8 | 拖尾长度倍率 |
| width | 0.45 到 2.2 | 拖尾宽度倍率 |
| density | 0.35 到 2.2 | 标记和粒子密度 |
| opacity | 0 到 1 | 总透明度 |
| turbulence | 0 到 1 | 摆动和扰动强度 |
| glow | 0 到 2 | 发光强度 |
| fade | 0.2 到 1 | 尾部淡出速度 |
| segmentSpacing | 0.5 到 2 | 拖尾段间距 |
| sparkRate | 0 到 2 | 火花或闪烁频率 |

这样可以做出明显差异：

- 短、粗、高密度、闪烁：适合电弧和爆弹。
- 长、细、低密度、流动：适合星河和绸带。
- 中等长度、宽、高光脉冲：适合冰霜和晶体。
- 长、旋转、低透明：适合传说级星轨。

## 7. 编辑器体验设计

### 7.1 内容列表

列表不要做成普通后台表格，应更像游戏资源面板。

信息展示：

- 缩略图。
- 名称。
- 类型。
- 稀有度。
- 主题。
- 状态。
- 最近修改人。
- 发布版本。
- 当前投放位置。

常用操作：

- 新建。
- 复制为新内容。
- 编辑。
- 预览。
- 提审。
- 下架。
- 查看历史。

### 7.2 角色服装编辑器

布局：

```txt
左侧：角色选择 / 模板选择
中间：服装信息 / 素材绑定 / 颜色
右侧：角色详情预览 / 队伍头像预览 / 抽卡结果预览
```

需要支持的预览：

- 角色列表头像。
- 角色详情大图。
- 编队头像。
- PVP 顶部头像。
- 抽卡结果卡片。
- 图鉴卡片。

### 7.3 弹珠幻化编辑器

布局：

```txt
左侧：弹珠类型 / 幻化模板
中间：本体外观 / 拖尾属性 / 命中特效
右侧：战斗画布预览 / 性能评分 / 可读性提示
```

拖尾编辑控件：

- 风格：图标按钮或下拉。
- 主色、强调色、高光色：颜色选择器。
- 长度、宽度、密度、透明度、发光：滑杆。
- 动效：分段按钮。
- 性能档位：低、中、高预览切换。

预览必须提供：

- 单颗弹珠飞行。
- 多弹珠密集飞行。
- 战斗背景上飞行。
- PVP 缩略战场上飞行。
- 低性能模式效果。

### 7.4 抽卡池编辑器

字段：

- 卡池 ID。
- 卡池名称。
- 卡池类型。
- 开始时间和结束时间。
- 产出内容列表。
- 稀有度概率。
- UP 权重。
- 保底规则。
- 重复转化。
- 展示素材。

强校验：

- 总概率必须等于 100%。
- 每个稀有度必须至少有一个可抽内容。
- UP 内容必须属于当前卡池。
- 限时池结束后必须有 fallback 规则。
- 传说保底不能小于史诗保底。

### 7.5 商店投放编辑器

字段：

- 商品 ID。
- 商品名称。
- 购买货币。
- 价格。
- 限购次数。
- 上架时间。
- 下架时间。
- 解锁条件。
- 内容奖励。

强校验：

- 价格不能为负。
- 付费货币和外观货币不能混写。
- 商品内容必须已经发布或将随同版本发布。
- 下架时间不能早于上架时间。

## 8. 校验系统

设计器必须有自动校验，不依赖人工记忆规则。

### 8.1 结构校验

- ID 唯一。
- 字段类型正确。
- 必填字段完整。
- 枚举值合法。
- 图片、音效、特效引用存在。

### 8.2 玩法校验

- 幻化不能包含战斗数值字段。
- 弹珠幻化不能改变碰撞体积。
- PVP 允许使用的外观必须有低性能降级方案。
- 限时内容必须配置获得来源和下架策略。

### 8.3 经济校验

- 抽卡概率总和正确。
- 保底规则完整。
- 重复转化规则完整。
- 商店价格在允许范围内。
- 同一内容不能在多个互斥渠道同时低价售卖。

### 8.4 性能校验

对弹珠幻化尤其重要。

校验项：

- 最大拖尾点数。
- 最大粒子数量。
- 是否使用过高透明叠加。
- 是否在多弹珠场景下遮挡战场。
- 低性能模式是否可读。
- PVP 缩略战场是否还能看清。

## 9. 预览沙盒

后台设计器的价值很大一部分来自预览。

### 9.1 静态预览

- 背包图标。
- 图鉴卡片。
- 抽卡结果。
- 商店商品。
- 角色详情。
- 弹珠工坊详情。

### 9.2 战斗预览

建议复用客户端渲染逻辑，后台通过 iframe 或独立预览包加载游戏 canvas。

预览场景：

- 单弹珠飞行。
- 三角色常规战斗。
- 高波次密集弹珠。
- Boss 战。
- PVP 左侧主战场。
- PVP 右侧缩略战场。

预览参数：

- 画质档位。
- 战斗速度。
- 弹珠数量。
- 背景地图。
- 是否显示低性能降级。

### 9.3 发布前截图

每次发布候选版本自动生成截图：

- 内容卡片截图。
- 抽卡结果截图。
- 战斗预览截图。
- PVP 缩略预览截图。

截图和配置版本一起归档，方便追查线上问题。

## 10. 技术架构

推荐架构：

```txt
Admin Web
  -> Admin API
    -> Auth / RBAC
    -> Content Service
    -> Asset Service
    -> Validation Service
    -> Publish Service
    -> Audit Service
  -> PostgreSQL
  -> Object Storage / CDN
  -> Redis
  -> Game Client Config Loader
```

### 10.1 前端

建议后台前端和游戏客户端分开：

- `admin/`：后台设计器 Web。
- `src/`：游戏客户端。
- 共用 `shared/`：配置类型、schema、校验规则。

如果暂时不拆仓库，也可以先在当前项目下新增 `admin` 目录。

### 10.2 后端

后台 API 可以放入现有 `server`：

```txt
server/src/
  admin/
    routes/
    services/
    validators/
  config/
  assets/
  publish/
  audit/
```

核心服务：

| 服务 | 职责 |
| --- | --- |
| Content Service | 草稿、编辑、查询、复制、归档 |
| Asset Service | 上传、裁剪、压缩、CDN 发布 |
| Validation Service | schema、经济、性能、引用校验 |
| Publish Service | 生成配置版本、灰度、发布、回滚 |
| Audit Service | 操作记录、差异记录、审批记录 |

### 10.3 配置分发

发布后生成版本化 JSON：

```txt
/configs/2026.06.28-001/cosmetics.json
/configs/2026.06.28-001/gacha-pools.json
/configs/2026.06.28-001/shop-offers.json
/configs/2026.06.28-001/config-manifest.json
```

`/bootstrap` 返回：

```json
{
  "configVersion": "2026.06.28-001",
  "configManifestUrl": "https://cdn.example.com/configs/2026.06.28-001/config-manifest.json"
}
```

客户端根据 manifest 拉取配置。战斗开始时记录 `configVersion`，结算时带回，避免配置变更影响本局。

## 11. 数据库表建议

### 11.1 内容表

```sql
admin_content_items
- id
- type
- status
- name
- description
- payload_json
- owner_id
- version
- created_at
- updated_at
- published_at
```

### 11.2 素材表

```sql
admin_assets
- id
- type
- original_name
- storage_key
- cdn_url
- width
- height
- size_bytes
- hash
- created_by
- created_at
```

### 11.3 发布版本表

```sql
config_releases
- id
- config_version
- status
- manifest_json
- diff_summary_json
- created_by
- approved_by
- published_at
- rollback_from
```

### 11.4 审计日志表

```sql
admin_audit_logs
- id
- actor_id
- action
- target_type
- target_id
- before_json
- after_json
- created_at
```

### 11.5 审核表

```sql
admin_review_tasks
- id
- content_id
- status
- submitted_by
- reviewer_id
- comment
- created_at
- reviewed_at
```

## 12. API 设计草案

内容：

```txt
GET    /admin/content
POST   /admin/content
GET    /admin/content/:id
PATCH  /admin/content/:id
POST   /admin/content/:id/duplicate
POST   /admin/content/:id/submit
POST   /admin/content/:id/archive
```

素材：

```txt
GET    /admin/assets
POST   /admin/assets/upload
GET    /admin/assets/:id
DELETE /admin/assets/:id
```

预览：

```txt
POST   /admin/preview/cosmetic-card
POST   /admin/preview/battle-scene
POST   /admin/preview/gacha-result
```

校验：

```txt
POST   /admin/validate/content
POST   /admin/validate/release
```

发布：

```txt
GET    /admin/releases
POST   /admin/releases/create
POST   /admin/releases/:id/approve
POST   /admin/releases/:id/publish
POST   /admin/releases/:id/rollback
```

## 13. 权限设计

角色：

| 角色 | 权限 |
| --- | --- |
| Viewer | 查看内容和发布版本 |
| Designer | 创建和编辑草稿 |
| Artist | 上传和绑定素材 |
| Operator | 配置卡池、商店、活动投放 |
| Reviewer | 审核内容和发布候选 |
| Admin | 管理用户、权限、回滚 |

关键规则：

- 创建者不能直接审核自己的发布。
- 正式环境发布必须二次确认。
- 回滚必须记录原因。
- 所有生产环境操作必须写审计日志。

## 14. 与当前游戏的接入方式

### 14.1 近期接入

当前代码仍然以内置配置为主，可以先做导出能力：

```txt
后台设计器
-> 导出 cosmetics.generated.json
-> 客户端启动时加载远程配置
-> 失败则回退到 src/config/cosmetics.ts
```

### 14.2 中期接入

把 `src/config/cosmetics.ts`、抽卡池、外观商店逐步迁移到远程配置：

- 本地保留默认配置。
- 后端下发最新配置。
- 客户端对远程配置做 schema 校验。
- 校验失败回退本地配置，并上报错误。

### 14.3 长期接入

所有运营内容从后台发布：

- 幻化。
- 服装。
- 卡池。
- 商店。
- 活动。
- 赛季。
- 公告。
- 邮件补偿。

代码只保留渲染能力、规则校验能力和兜底配置。

## 15. MVP 版本建议

### 第 1 期：只做弹珠幻化设计器

范围：

- 弹珠幻化列表。
- 新建和编辑弹珠幻化。
- 拖尾属性编辑。
- 战斗预览。
- JSON 导出。
- 基础 schema 校验。

目标是解决现在最痛的“拖尾和外观调参靠改代码”的问题。

### 第 2 期：角色服装和素材库

范围：

- 角色服装编辑。
- 素材上传。
- 图鉴和抽卡预览。
- CDN 地址管理。

### 第 3 期：卡池和商店投放

范围：

- 抽卡池配置。
- 商店商品配置。
- 概率和价格校验。
- 定时上下架。

### 第 4 期：发布中心

范围：

- 配置版本。
- 审核流。
- 灰度发布。
- 回滚。
- 审计日志。

## 16. 风险与对策

| 风险 | 表现 | 对策 |
| --- | --- | --- |
| 参数过多不好用 | 策划不知道怎么调 | 用模板起步，参数高级折叠 |
| 特效过重 | 战斗卡顿、PVP 缩略图糊 | 性能预算和低性能预览强校验 |
| 配置污染经济 | 商店价格或卡池概率出错 | 发布前经济校验和差异报告 |
| 素材尺寸混乱 | UI 变形或加载慢 | 上传时自动裁剪、压缩、尺寸校验 |
| 回滚影响玩家 | 已拥有内容消失 | 下架不删除拥有记录，回滚只影响投放 |
| 后台太像管理系统 | 使用体验割裂 | 使用游戏化资源面板和真实预览沙盒 |

## 17. 推荐第一步

第一步建议开发“弹珠幻化设计器 MVP”：

1. 定义远程 `MarbleSkinContent` schema。
2. 做后台弹珠幻化编辑页面。
3. 支持拖尾属性编辑：风格、颜色、长度、宽度、动效、密度、透明度、发光。
4. 复用游戏 canvas 做实时预览。
5. 生成 JSON 并让客户端可以读取。
6. 保留本地配置兜底。

这样可以最快验证后台设计器的价值，也能直接解决当前幻化拖尾调参、预览和性能优化的问题。
