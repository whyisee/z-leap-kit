# 弹珠打撤当前内容与模块拆分梳理

本文档用于梳理当前 H5 原型的游戏内容、代码职责和后续模块拆分方案。目标不是重新设计玩法，而是把已经变复杂的系统拆成可并行开发的模块，减少多人同时改 `src/main.ts` 的冲突。

当前状态：

- `src/main.ts` 已集中承载类型、配置、战斗、菜单、局外养成、绘制、存档等职责，约 5000 行。
- `src/styles.css` 已集中承载主界面、战斗 HUD、角色页、仓库页、弹珠页、弹窗等样式，约 2200 行。
- 原型内容已经从“单局弹珠战斗”扩展为“战斗 + 角色 + 弹珠升级 + 掉落 + 仓库 + 宝石 + 自动战斗”的复合系统。

## 1. 当前游戏内容盘点

### 1.1 单局战斗

当前单局规则：

- 竖屏 H5 画布，逻辑尺寸 `720 x 1280`。
- 每局 20 波敌人。
- 支持 `1x / 2x / 4x` 加速。
- 3 名角色同时上阵。
- 每名角色自动发射 2 种弹珠。
- 经验满后进入战术升级三选一。
- 第 20 波为最终 Boss。
- 基地生命归零或敌人突破底线失败。
- 胜利/失败后进入结算。

当前战斗内容：

- 敌人：小方块、厚甲块、快速块、分裂块、护盾块、治疗块、金币块、精英块、Boss 核心。
- 弹珠：基础、分裂、爆裂、燃烧、闪电、减速。
- 伤害机制：暴击、护甲、反弹增伤、穿透、爆炸、燃烧、连锁、减速、磁场追踪。
- 角色主动技能：点击角色释放，角色身上有圆形冷却进度条。
- 左侧战术面板：默认收起，展开后显示已选择战术升级。
- 右下角掉落背包：展示本局掉落数量，点击查看本局掉落。

### 1.2 角色系统

当前角色内容：

- 工程师：基础/分裂，折返板，偏反弹和射速。
- 爆破手：爆裂/燃烧，高爆弹，偏范围和燃烧。
- 磁能师：闪电/减速，磁场，偏连锁和控制。
- 守卫者：基础/减速，防线回收，偏防御和压制。
- 棱镜师：闪电/分裂，棱镜齐射，偏连锁和分裂。
- 炼金师：燃烧/爆裂，热核反应，偏燃烧和金币回收。

当前角色功能：

- 主界面展示 3 名出战角色。
- 角色页上方展示出战阵容，下方展示角色列表。
- 点击角色弹窗显示属性、技能、携带弹珠、上阵/替换、强化路线。
- 每个角色有等级强化。
- 每个角色有 3 条专属路线。
- 当前角色默认全解锁，存档结构已支持 `owned`。

### 1.3 弹珠系统

当前弹珠内容：

- 每个弹珠有基础伤害、冷却、速度、生命周期、半径、反弹次数、标签。
- 弹珠等级最高 20 级。
- 战斗掉落弹珠碎片。
- 弹珠页可以用对应碎片升级弹珠。
- 弹珠等级影响实际战斗伤害和角色攻击估值。

### 1.4 战术升级系统

当前局内升级：

- 击杀敌人获得经验。
- 经验满后战斗暂停，出现 3 张战术升级。
- 升级有普通、稀有、史诗、传说品质。
- 升级类型包括全队、弹珠、暴击、生存、经济、成长、角色、Boss、控制、连锁、爆炸、燃烧等。
- 自动战斗可以按战术升级优先策略自动选择。

自动战斗当前配置：

- 自动战斗开关。
- 战术升级优先：高稀度、进攻、防御、收益。
- 自动释放技能。

### 1.5 掉落与仓库系统

当前掉落内容：

- 敌人击杀时有概率掉落物品。
- 精英和 Boss 保底多次掉落。
- 掉落类型：
  - 收藏品：可出售换金币。
  - 弹珠碎片：用于升级弹珠。
  - 基地宝石：装备到基地槽位，影响下一局。
- 掉落品质：普通、稀有、史诗、传说。
- 掉落表现：
  - 局内生成掉落卡片。
  - 停留数秒。
  - 飞入右下角背包。
  - 背包弹跳反馈。
  - 背包弹窗显示本局掉落。

当前仓库内容：

- 仓库页统计金币、收藏估值、最高波、通关数。
- 基地宝石槽位 3 个。
- 宝石类型：
  - 强袭宝石：全队伤害。
  - 壁垒宝石：基地生命。
  - 回收宝石：金币和掉落。
- 宝石最高 20 级。
- 同类型同等级宝石 `2 合 1`，有成功概率，失败返还 1 颗原等级宝石。
- 收藏品可单个出售或全部出售。
- 基地协议作为通用局外强化留在仓库。

### 1.6 主界面与功能页面

当前主界面：

- 顶部统计：最高波、出战、金币、通关。
- 中间展示出战角色。
- 侧边按钮：奖励、排行、引导、广告、存档。
- 中央开始战斗和更多挑战。
- 底部功能导航：仓库、转盘、角色、弹珠。

当前功能页：

- 仓库：基地宝石、收藏品、基地协议。
- 转盘：奖励转盘占位。
- 角色：出战阵容、角色列表、角色详情弹窗。
- 弹珠：弹珠等级与碎片升级。
- 设置：音效、震动、画质、重置存档。
- 更多挑战：无尽挑战、首领挑战、限时挑战占位。

## 2. 当前代码职责分布

当前 `src/main.ts` 同时包含以下内容：

- 全局常量和类型定义。
- 角色、弹珠、敌人、升级、掉落、宝石等配置表。
- `MarblesGame` 主类。
- DOM 事件绑定。
- 菜单页面渲染。
- 角色页、仓库页、弹珠页、弹窗 HTML 生成。
- 存档读写和兼容修正。
- 战斗循环、波次、敌人、弹珠、碰撞、伤害、技能。
- 掉落生成、掉落动画和背包弹窗。
- Canvas 绘制。
- 工具函数。

这导致几个问题：

- 不同功能的开发都要改同一个大文件。
- 类型、配置和逻辑相互交织，新增内容容易误伤。
- UI 和玩法逻辑耦合，页面改动可能影响战斗。
- 后续做多模块并行开发时，冲突概率会很高。

## 3. 推荐模块拆分目标

建议把项目拆为以下顶层目录：

```txt
src/
  app/
    GameApp.ts
    bootstrap.ts
    dom.ts
  core/
    constants.ts
    types.ts
    math.ts
    random.ts
  config/
    characters.ts
    marbles.ts
    enemies.ts
    upgrades.ts
    loot.ts
    meta-upgrades.ts
  state/
    save.ts
    session.ts
    migrations.ts
  systems/
    battle/
      waves.ts
      enemies.ts
      marbles.ts
      damage.ts
      skills.ts
      targeting.ts
    progression/
      xp.ts
      tactical-upgrades.ts
      auto-battle.ts
    loot/
      drops.ts
      drop-visuals.ts
      inventory.ts
      gems.ts
    meta/
      characters.ts
      marble-levels.ts
      base-upgrades.ts
  render/
    canvas.ts
    background.ts
    field.ts
    enemies.ts
    marbles.ts
    characters.ts
    effects.ts
    loot.ts
    particles.ts
  ui/
    hud/
      battle-hud.ts
      bottom-hud.ts
      tactic-panel.ts
      auto-panel.ts
      loot-bag.ts
    menu/
      home.ts
      nav.ts
      warehouse.ts
      heroes.ts
      marbles.ts
      settings.ts
      challenges.ts
    overlays/
      upgrade.ts
      pause.ts
      result.ts
      loot.ts
  styles/
    base.css
    menu.css
    battle-hud.css
    warehouse.css
    heroes.css
    marbles.css
    overlays.css
```

说明：

- `core` 只放无状态工具、常量、类型。
- `config` 只放静态配置，不直接读写存档或 DOM。
- `state` 负责存档、迁移、Session 创建。
- `systems` 负责纯玩法逻辑。
- `render` 负责 Canvas 绘制。
- `ui` 负责 DOM 页面和 HUD。
- `app` 负责把所有模块装配起来。

## 4. 模块职责与边界

### 4.1 Core 模块

职责：

- 基础常量：画布尺寸、战场尺寸、等级上限。
- 公共类型：`Session`、`SaveData`、`DropEntry`、`CharacterConfig` 等。
- 数学工具：`clamp`、`lerp`、`rotate`、缓动函数。
- 随机工具：`randomRange`、`randomChoice`、`shuffle`、权重随机。

不应该做：

- 不访问 DOM。
- 不读写 localStorage。
- 不直接修改游戏状态。

适合并行开发的人：

- 类型和基础工具维护者。
- 负责数据契约和模块接口稳定。

### 4.2 Config 模块

职责：

- 角色配置。
- 弹珠配置。
- 敌人配置。
- 战术升级卡配置。
- 掉落物配置。
- 宝石配置。
- 基地协议配置。

不应该做：

- 不写战斗逻辑。
- 不生成 UI HTML。
- 不读写存档。

并行开发方式：

- 数值策划可以单独改 `config/*`。
- 新角色只改 `characters.ts` 和必要的技能逻辑扩展点。
- 新弹珠只改 `marbles.ts` 和弹珠效果系统扩展点。

### 4.3 State 模块

职责：

- `defaultSave()`。
- `loadSave()`。
- `saveGame()`。
- `normalizeSave()`。
- 存档版本迁移。
- `createSession(save)` 根据存档创建单局状态。

重点建议：

- 给存档加 `version` 字段，后续迁移更稳。
- 所有新增存档字段都走 `migrations.ts`。
- 其他模块不要直接写 localStorage。

建议接口：

```ts
export function loadSave(): SaveData;
export function persistSave(save: SaveData): void;
export function normalizeSave(raw: Partial<SaveData>): SaveData;
export function createSession(save: SaveData): Session;
```

### 4.4 Battle Systems 模块

建议拆为：

- `waves.ts`：波次生成、敌人权重、下一波逻辑。
- `enemies.ts`：敌人移动、技能、突破底线。
- `marbles.ts`：弹珠发射、移动、反弹、碰撞。
- `damage.ts`：伤害公式、暴击、护甲、特殊增伤。
- `skills.ts`：角色主动技能。
- `targeting.ts`：目标选择、密集点计算。

边界：

- 接收 `Session` 并修改 `Session`。
- 不直接生成菜单 HTML。
- 可调用粒子/特效事件，但不直接操作 DOM。

建议接口：

```ts
export function updateBattle(session: Session, dt: number, realDt: number, ctx: BattleContext): void;
export function startWave(session: Session, wave: number): void;
export function fireMarble(session: Session, character: CharacterRuntime, marbleId: MarbleId): void;
export function castSkill(session: Session, characterId: string, ctx: BattleContext): void;
```

`BattleContext` 可包含配置、存档加成、事件回调：

```ts
type BattleContext = {
  save: SaveData;
  emitParticle: (particle: Particle) => void;
  emitFloatingText: (x: number, y: number, text: string, color: string) => void;
  emitDrop: (x: number, y: number, drop: DropEntry) => void;
  endGame: (result: "win" | "lose", reason: string) => void;
};
```

### 4.5 Progression 模块

职责：

- 经验需求。
- 升级卡池筛选。
- 三选一生成。
- 战术升级应用。
- 自动战斗策略。

建议拆分：

- `xp.ts`
- `tactical-upgrades.ts`
- `auto-battle.ts`

边界：

- 不画升级卡 UI。
- 只返回卡牌数据和选择结果。
- UI 只负责把卡牌渲染出来并把选择传回系统。

### 4.6 Loot 模块

职责：

- 掉落概率。
- 掉落稀有度。
- 掉落物汇总。
- 掉落写入存档。
- 掉落动画状态。
- 宝石装备和合成。
- 收藏品出售。

建议拆分：

- `drops.ts`：击杀掉落和稀有度。
- `inventory.ts`：收藏品、碎片、背包数据操作。
- `gems.ts`：宝石装备、卸下、合成概率。
- `drop-visuals.ts`：局内掉落动画状态。

建议接口：

```ts
export function rollEnemyDrops(enemy: Enemy, session: Session): DropEntry[];
export function applyDropsToSave(save: SaveData, drops: DropEntry[]): SaveData;
export function compactDrops(drops: DropEntry[]): DropSummaryItem[];
export function equipGem(save: SaveData, key: string, slot: number): InventoryResult;
export function fuseGem(save: SaveData, key: string): InventoryResult;
```

### 4.7 Meta 模块

职责：

- 角色局外等级。
- 角色路线。
- 弹珠等级。
- 基地协议。
- 基地宝石加成计算。

建议拆分：

- `characters.ts`
- `marble-levels.ts`
- `base-upgrades.ts`

边界：

- 只处理局外数值和存档。
- 不操作 Canvas。
- 不生成 DOM。

### 4.8 Render 模块

职责：

- Canvas 背景。
- 战场。
- 敌人。
- 弹珠。
- 角色。
- 技能特效。
- 粒子。
- 掉落卡片。
- 波次信息。

边界：

- 只读取 `Session`。
- 不修改战斗状态，除非是纯渲染缓存。
- 不做玩法计算。

建议接口：

```ts
export function drawGame(ctx: CanvasRenderingContext2D, session: Session | null): void;
export function drawMenuPreview(ctx: CanvasRenderingContext2D): void;
```

### 4.9 UI 模块

职责：

- 主界面。
- 底部导航。
- 角色页。
- 仓库页。
- 弹珠页。
- 设置页。
- 更多挑战弹窗。
- 升级选择浮层。
- 暂停和结算浮层。
- 战斗 HUD。
- 掉落背包弹窗。

边界：

- UI 只生成 HTML 和绑定事件。
- UI 事件调用 App 层方法，不直接修改战斗系统深层逻辑。
- 样式按功能拆文件，降低 CSS 冲突。

建议接口：

```ts
export function renderHome(save: SaveData): string;
export function renderHeroesPage(model: HeroesPageModel): string;
export function renderWarehousePage(model: WarehousePageModel): string;
export function renderUpgradeOverlay(choices: UpgradeCard[]): string;
```

## 5. 推荐 App 装配层

拆分后保留一个入口类，例如 `GameApp`。

职责：

- 初始化 Canvas 和 DOM。
- 加载存档。
- 创建和销毁 Session。
- 调度 update/draw 循环。
- 响应 UI 事件。
- 在系统之间转发事件。

示意：

```ts
class GameApp {
  save: SaveData;
  session: Session | null;
  phase: Phase;

  startGame() {}
  renderMenu(view: MenuView) {}
  update(dt: number, realDt: number) {}
  draw() {}
  endGame(result: GameResult) {}
}
```

App 层允许知道所有模块，但各模块之间尽量不要横向互相引用。

## 6. 并行开发分工建议

### 6.1 可并行模块

建议拆成以下并行工作流：

| 工作流 | 主要文件 | 适合任务 |
| --- | --- | --- |
| 战斗系统 | `systems/battle/*` | 新敌人、新弹珠效果、Boss 技能、碰撞优化 |
| 局内构筑 | `systems/progression/*`, `config/upgrades.ts` | 新升级卡、自动选择策略、稀有度平衡 |
| 掉落仓库 | `systems/loot/*`, `ui/menu/warehouse.ts` | 新物品、宝石合成、背包筛选、掉落表现 |
| 角色养成 | `systems/meta/characters.ts`, `ui/menu/heroes.ts` | 新角色、路线、上阵规则 |
| 弹珠养成 | `systems/meta/marble-levels.ts`, `ui/menu/marbles.ts` | 弹珠升级、碎片消耗、弹珠图鉴 |
| UI/视觉 | `ui/*`, `render/*`, `styles/*` | 页面布局、HUD、动画、移动端适配 |
| 存档基础 | `state/*`, `core/types.ts` | 版本迁移、数据兼容、导入导出 |

### 6.2 协作规则

建议后续并行开发遵守：

- 每个任务尽量只碰一个系统目录和一个 UI 目录。
- 新配置优先加在 `config/*`，不要散落在逻辑文件。
- 新存档字段必须同步更新：
  - `core/types.ts`
  - `state/defaultSave`
  - `state/normalizeSave`
  - `state/migrations`
- 新玩法数值先写配置，再写系统逻辑。
- 新 UI 页面只调用系统暴露的 action，不直接操作深层状态。
- 每个模块拆出后补最小 smoke test 或验证脚本。

## 7. 推荐拆分顺序

为了降低风险，不建议一次性重构全部代码。建议按以下顺序渐进拆：

### 第 1 步：抽类型和配置

目标：

- 行为不变。
- 先把静态内容挪出去。

拆出：

- `core/constants.ts`
- `core/types.ts`
- `config/characters.ts`
- `config/marbles.ts`
- `config/enemies.ts`
- `config/upgrades.ts`
- `config/loot.ts`
- `config/meta-upgrades.ts`

收益：

- 数值和内容可以开始并行改。
- `main.ts` 会明显变短。

风险：

- 循环依赖，需要统一从 `core/types` 引类型。

### 第 2 步：抽存档和局外养成

拆出：

- `state/save.ts`
- `state/migrations.ts`
- `systems/meta/characters.ts`
- `systems/meta/marble-levels.ts`
- `systems/loot/inventory.ts`
- `systems/loot/gems.ts`

收益：

- 仓库、角色、弹珠可以并行开发。
- 存档兼容更安全。

### 第 3 步：抽 UI 页面

拆出：

- `ui/menu/home.ts`
- `ui/menu/heroes.ts`
- `ui/menu/warehouse.ts`
- `ui/menu/marbles.ts`
- `ui/overlays/*`
- `ui/hud/*`

收益：

- UI 页面能独立迭代。
- 避免改 UI 时碰战斗逻辑。

### 第 4 步：抽战斗系统

拆出：

- `systems/battle/waves.ts`
- `systems/battle/enemies.ts`
- `systems/battle/marbles.ts`
- `systems/battle/damage.ts`
- `systems/battle/skills.ts`
- `systems/progression/*`
- `systems/loot/drops.ts`

收益：

- 新敌人、新弹珠、新技能可以并行。
- 玩法逻辑更容易测试。

### 第 5 步：抽 Canvas 渲染

拆出：

- `render/background.ts`
- `render/field.ts`
- `render/enemies.ts`
- `render/marbles.ts`
- `render/characters.ts`
- `render/effects.ts`
- `render/loot.ts`
- `render/particles.ts`

收益：

- 视觉表现能和玩法逻辑分开。
- 可以更容易加截图验证和像素检查。

### 第 6 步：拆 CSS

拆出：

- `styles/base.css`
- `styles/menu.css`
- `styles/battle-hud.css`
- `styles/heroes.css`
- `styles/warehouse.css`
- `styles/marbles.css`
- `styles/overlays.css`

收益：

- 页面样式互相影响减少。
- 更容易定位移动端布局问题。

## 8. 数据流建议

推荐主数据流：

```txt
SaveData -> createSession -> Session
Session -> battle systems update
Session -> render canvas
Session -> HUD/UI models
Session result + drops -> apply to SaveData
SaveData -> menu pages
```

不要让 UI 直接改深层 Session 字段。推荐：

```txt
UI click -> GameApp action -> system function -> state updated -> render
```

例如宝石合成：

```txt
点击合成按钮
-> GameApp.fuseGem(key)
-> loot/gems.fuseGem(save, key)
-> 返回 InventoryResult
-> persistSave(save)
-> renderWarehousePage()
```

## 9. 当前优先拆分的文件清单

第一阶段建议先拆这些，性价比最高：

```txt
src/core/types.ts
src/core/constants.ts
src/core/math.ts
src/config/characters.ts
src/config/marbles.ts
src/config/enemies.ts
src/config/upgrades.ts
src/config/loot.ts
src/state/save.ts
```

原因：

- 这些模块基本是纯数据或纯工具。
- 拆分后行为最不容易变。
- 后续各功能线可以少改 `main.ts`。

## 10. 后续待补模块设计

当前已有系统还可以继续补：

- 排行：目前主界面入口存在，但功能未实现。
- 引导：目前入口存在，但没有新手流程。
- 广告：目前入口存在，但没有奖励广告逻辑。
- 转盘：目前是奖励展示占位，还没有真实抽取/冷却/消耗。
- 更多挑战：目前是模式选择占位，未接无尽、首领、限时规则。
- 角色获取：当前角色默认全解锁，未接抽取/碎片。
- 弹珠图鉴：当前只有升级，没有获取、筛选、详情弹窗。
- 宝石详情：当前只有装备/合成，缺少详情说明和批量合成。
- 存档导入导出：移动端测试会很有用。

这些功能建议等基础模块拆好后再并行推进。

## 11. 验证策略

每次拆模块都要保证：

- `npm run build` 通过。
- 首页能渲染。
- 能开始战斗。
- 能升级三选一。
- 能结束结算。
- 仓库、角色、弹珠页能打开。
- 存档旧数据能 normalize，不白屏。

建议后续补一个轻量 smoke test：

```txt
1. 清理或准备测试存档
2. 进入首页
3. 打开角色页
4. 打开仓库页
5. 打开弹珠页
6. 开始战斗
7. 人工或脚本推进一次掉落
8. 打开掉落背包
9. 触发一次结算
```

## 12. 结论

当前原型已经从单文件快速验证阶段进入系统化开发阶段。建议下一步不要继续在 `main.ts` 中叠功能，而是先做“无行为变化拆分”：

1. 先抽类型和配置。
2. 再抽存档和局外养成。
3. 然后抽 UI 页面。
4. 最后抽战斗系统和 Canvas 渲染。

这样后续可以让多个模块同时开发：

- 一路做战斗和敌人。
- 一路做仓库和掉落。
- 一路做角色和弹珠养成。
- 一路做 UI 和视觉表现。

拆分完成后，`main.ts` 应该只保留 App 装配、主循环和模块调度，具体玩法与页面都由独立模块承担。
