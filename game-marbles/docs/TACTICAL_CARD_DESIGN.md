# 战术卡片扩展设计

## 1. 背景

当前战术卡片由 `src/config/upgrades.ts` 配置，升级时从卡池抽取 3 张，玩家选择 1 张后立即生效。现有结构已经支持基础过滤和叠加：

- `maxStacks` 控制最大叠加次数。
- `requires(session)` 控制卡片是否进入卡池。
- `apply(session)` 负责实际战斗效果。
- `session.modifiers.cardStacks[card.id]` 记录单张卡已选择次数。
- `session.selectedUpgradeIds` 记录本局已选择卡片，用于结算和战术面板展示。

后续需要扩展出更清晰的卡片类型，支持无限叠加、等级链、角色限定，以及新的功能型卡片。

## 2. 设计目标

- 保留现有 `apply(session)` 能力，减少改造成本。
- 让卡片类型显式化，方便配置、图鉴、自动战斗和后端校验。
- 让“构筑方向”有成长路径，而不是每次升级都像独立随机奖励。
- 让功能型卡片改变选卡流程本身，形成更多局内策略。

## 3. 卡片类型

### 3.1 无限叠加型

用于基础属性、经济、控制强度等可以重复成长的卡片。

设计规则：

- `maxStacks: "infinite"` 或不设置上限。
- 选择次数越多，后续出现权重可以轻微下降，避免同卡刷屏。
- 效果应使用温和乘区或递减收益，避免无限堆叠导致数值失控。

适合例子：

- 火力校准：全队伤害提升。
- 快速装填：发射频率提升。
- 战地回收：金币获得提升。
- 低温制动：减速效果提升。

### 3.2 升级链型

拥有初级、中级、高级三个阶段。玩家先获得初级，之后才会出现中级；获得中级后才会出现高级。

设计规则：

- 使用 `familyId` 标记同一条升级链。
- 使用 `tier` 标记等级：`basic`、`middle`、`high`。
- 中级卡需要至少拥有同 `familyId` 的初级卡。
- 高级卡需要至少拥有同 `familyId` 的中级卡。
- 低级卡叠加越多，高一级卡出现概率越高。
- 高级卡通常 `maxStacks: 1` 或 `maxStacks: 2`，用于形成质变。

例子：

| 等级 | 卡片 | 解锁条件 | 设计效果 |
| --- | --- | --- | --- |
| 初级 | 反弹核心 I | 默认可出现 | 反弹后伤害小幅提升 |
| 中级 | 反弹核心 II | 已获得反弹核心 I | 反弹收益提升，出现率随 I 层数增加 |
| 高级 | 反弹核心 III | 已获得反弹核心 II | 反弹达到次数后额外分裂或爆发 |

### 3.3 特定角色型

只有某个角色上阵时才会进入卡池。

设计规则：

- 使用 `unlock.characters` 描述需要的上阵角色。
- 角色没上阵时完全不进卡池。
- 角色卡可以叠加，也可以同时属于升级链。
- 自动战斗选择时，角色卡应获得额外评分，因为它天然匹配当前阵容。

例子：

- 工程师超频：只有工程师上阵时出现。
- 爆破补给：只有爆破手上阵时出现。
- 磁场延展：只有磁能师上阵时出现。

### 3.4 功能型

功能型卡片不直接提升战斗属性，而是影响后续选卡流程、卡池质量或临时规则。

设计规则：

- 使用 `kind: "utility"`。
- 效果写入 `session.modifiers.cardStacks` 或新增的 `session.tacticState`。
- 功能型卡片应避免无限循环自增强，例如“提升高级卡概率”的卡不能过度提高自身出现率。
- 功能型卡片不应太多，否则会稀释战斗构筑体验。建议每局最多出现 1-3 次强功能卡。

推荐子类：

| 子类 | 说明 | 示例 |
| --- | --- | --- |
| 刷新资源 | 增加升级选择时的刷新次数 | 每次选择后，获得 1 次战术刷新机会 |
| 下一张强化 | 影响下一次选择的属性卡 | 下次选择的属性卡效果翻倍 |
| 稀有度操控 | 提升高级卡、史诗卡、传说卡出现率 | 后续升级稀有及以上卡片权重提升 |
| 卡池压缩 | 临时移除低价值卡或某类卡 | 接下来 2 次升级不出现普通经济卡 |
| 定向寻卡 | 提升某个标签或某条升级链出现率 | 之后 3 次升级更容易出现反弹卡 |

功能型示例：

| 卡片 | 稀有度 | 效果 | 限制 |
| --- | --- | --- | --- |
| 战术刷新 | 普通 | 获得 1 次刷新机会 | 可叠加，但刷新机会有上限 |
| 强化预案 | 稀有 | 下次选择属性卡时，效果翻倍 | 只影响一次，不影响功能型卡 |
| 高阶扫描 | 稀有 | 后续 3 次升级中，稀有及以上卡权重提升 | 可叠加延长次数，不无限放大倍率 |
| 定向检索 | 史诗 | 下次升级至少出现 1 张与当前最高层升级链相关的卡 | 每局最多 1 次 |
| 精简卡池 | 史诗 | 接下来 2 次升级不出现已选择 3 次以上的普通卡 | 每局最多 1 次 |

## 4. 数据结构建议

```ts
type TacticalCardKind =
  | "stackable"
  | "tiered"
  | "character"
  | "utility"
  | "unique";

type TacticalTier = "basic" | "middle" | "high";

type TacticalCardEffectType = "attribute" | "utility" | "hybrid";

type TacticalUnlock = {
  characters?: string[];
  cards?: string[];
  marbles?: MarbleId[];
  tags?: string[];
  familyTier?: {
    familyId: string;
    tier: TacticalTier;
    minCount?: number;
  };
};

type TacticalWeight = {
  base?: number;
  perOwnStack?: number;
  perLowerTierStack?: number;
  decayPerOwnStack?: number;
  maxBonus?: number;
};

type UpgradeCard = {
  id: string;
  name: string;
  rarity: Rarity;
  tag: string;
  desc: string;

  kind?: TacticalCardKind;
  effectType?: TacticalCardEffectType;
  familyId?: string;
  tier?: TacticalTier;

  maxStacks?: number | "infinite";
  unlock?: TacticalUnlock;
  weight?: TacticalWeight;

  requires?: (session: Session) => boolean;
  apply: (session: Session) => void;
};
```

## 5. 局内状态建议

当前可以继续使用 `cardStacks` 和 `selectedUpgradeIds`，但功能型卡片建议新增独立状态，避免把流程控制都塞进 `cardStacks`。

```ts
type TacticalState = {
  refreshCharges: number;
  refreshChargesMax: number;
  nextAttributeMultiplier: number;
  nextAttributeMultiplierUses: number;
  rarityBoosts: Array<{
    id: string;
    minRarity: Rarity;
    multiplier: number;
    remainingChoices: number;
  }>;
  tagBiases: Array<{
    tag: string;
    multiplier: number;
    remainingChoices: number;
  }>;
  familyBiases: Array<{
    familyId: string;
    multiplier: number;
    remainingChoices: number;
  }>;
  blockedTags: Array<{
    tag: string;
    remainingChoices: number;
  }>;
};
```

初始值：

```ts
{
  refreshCharges: 0,
  refreshChargesMax: 3,
  nextAttributeMultiplier: 1,
  nextAttributeMultiplierUses: 0,
  rarityBoosts: [],
  tagBiases: [],
  familyBiases: [],
  blockedTags: [],
}
```

## 6. 抽卡流程

推荐将当前 `generateChoices()` 拆成以下步骤：

1. `getAvailableCards(session)`
   - 检查 `maxStacks`。
   - 检查 `unlock.characters`。
   - 检查 `unlock.cards`。
   - 检查 `unlock.familyTier`。
   - 检查 `unlock.marbles` 和 `unlock.tags`。
   - 兼容旧的 `requires(session)`。

2. `getCardWeight(card, session)`
   - 基础权重。
   - 稀有度结果权重。
   - 已拥有层数衰减。
   - 升级链低阶推动高阶。
   - 角色卡阵容加权。
   - 功能型卡的卡池操控状态。

3. `rollTacticalChoices(session)`
   - 按权重抽取 3 张。
   - 单次选择内不重复。
   - 如果卡池不足 3 张，允许少于 3 张，但 UI 要稳定。

4. `applyTacticalCard(card, session)`
   - 如果是属性卡，并存在 `nextAttributeMultiplierUses`，则对本次效果应用倍率。
   - 如果是功能型卡，则写入 `tacticState`。
   - 记录 `cardStacks` 和 `selectedUpgradeIds`。
   - 消耗一次性功能效果。

## 7. 功能型卡片的关键规则

### 7.1 刷新机会

升级选择界面新增“刷新”按钮。

规则：

- 每次刷新消耗 1 点 `refreshCharges`。
- 刷新只重抽当前 3 张，不改变玩家等级和经验。
- 刷新后不应再次出现完全相同的 3 张组合。
- 刷新次数建议显示在按钮上：`刷新 1/3`。

推荐卡片：

```ts
{
  id: "utility_refresh_charge",
  name: "战术刷新",
  kind: "utility",
  effectType: "utility",
  rarity: "common",
  tag: "功能",
  desc: "获得 1 次战术刷新机会。",
  maxStacks: 3,
  apply: (s) => {
    s.tacticState.refreshCharges = Math.min(
      s.tacticState.refreshChargesMax,
      s.tacticState.refreshCharges + 1,
    );
  },
}
```

### 7.2 下次属性卡效果翻倍

属性卡指 `effectType: "attribute"` 的卡，例如伤害、射速、金币、生命、暴击、弹珠增强。

规则：

- 只影响下一张属性卡。
- 不影响功能型卡，避免功能链互相放大。
- 如果下一次选择仍是功能型，则倍率保留。
- 卡片描述需要明确“下次属性卡”。

推荐卡片：

```ts
{
  id: "utility_next_attribute_double",
  name: "强化预案",
  kind: "utility",
  effectType: "utility",
  rarity: "rare",
  tag: "功能",
  desc: "下次选择的属性卡效果翻倍。",
  maxStacks: 1,
  apply: (s) => {
    s.tacticState.nextAttributeMultiplier = 2;
    s.tacticState.nextAttributeMultiplierUses = 1;
  },
}
```

实现注意：

- 当前 `apply(session)` 直接修改数值，无法自动翻倍。
- 建议新增 `applyWithContext(card, session)`，由它判断倍率。
- 属性卡的 `apply` 可以改成接收倍率：`apply(session, context)`。
- 或者短期方案：只让少数属性卡支持 `scale` helper。

### 7.3 提升高级卡片概率

规则：

- 影响后续若干次升级，不是永久无限生效。
- 只提升稀有、史诗、传说权重，不直接保证传说。
- 同类效果可以延长持续次数，但倍率有上限。

推荐卡片：

```ts
{
  id: "utility_rarity_scan",
  name: "高阶扫描",
  kind: "utility",
  effectType: "utility",
  rarity: "rare",
  tag: "功能",
  desc: "接下来 3 次升级中，稀有及以上卡片出现权重提升。",
  maxStacks: 2,
  apply: (s) => {
    s.tacticState.rarityBoosts.push({
      id: "rarity_scan",
      minRarity: "rare",
      multiplier: 1.35,
      remainingChoices: 3,
    });
  },
}
```

## 8. UI 设计

### 8.1 选卡界面

卡片角标建议显示：

- `可叠加`
- `I / II / III`
- `角色`
- `功能`
- `限定`

功能型卡片颜色建议与属性卡区分，使用偏青绿色或白蓝色，不和传说金、史诗紫混淆。

刷新按钮位置：

- 放在 3 张卡片上方右侧。
- 无刷新次数时 disabled。
- 文案：`刷新 1`、`刷新 2`。

### 8.2 战术面板

已选择列表建议展示：

- 无限叠加：`火力校准 x5`
- 升级链：`反弹核心 III`
- 角色卡：`工程师 · 超频 x2`
- 功能型：`高阶扫描 2 次剩余`

### 8.3 图鉴

图鉴中的战术卡详情增加：

- 卡片类型。
- 解锁条件。
- 最大叠加。
- 是否属性卡。
- 对卡池的影响。

## 9. 自动战斗策略

自动战斗需要理解功能型卡片，否则会乱选。

建议规则：

- 进攻模式：优先属性卡，功能型仅在高阶扫描、强化预案时给中等分。
- 防御模式：功能型优先级较低，除非当前选项很差。
- 收益模式：高阶扫描和刷新机会优先级较高，因为它能找经济卡。
- 高稀度模式：高阶扫描优先级高，刷新机会优先级中等。

功能型评分建议：

| 卡片 | 推荐评分 |
| --- | --- |
| 战术刷新 | 中等，当前刷新次数为 0 时加分 |
| 强化预案 | 高，前提是后续还有升级空间 |
| 高阶扫描 | 高，尤其在 10 波前 |
| 定向检索 | 高，如果已有明确升级链 |
| 精简卡池 | 中高，卡池污染严重时加分 |

## 10. 分阶段实现计划

### 阶段 1：结构改造

- 扩展 `UpgradeCard` 类型。
- 新增 `TacticalState`。
- 把 `generateChoices()` 拆成过滤、权重、抽取三个 helper。
- 保持现有卡片效果不变。

### 阶段 2：角色限定

- 为现有角色卡补 `unlock.characters`。
- 图鉴展示“需要某角色上阵”。
- 自动战斗对角色卡加权。

### 阶段 3：升级链

- 选择 2-3 条已有方向先做升级链，例如反弹、爆炸、控制。
- 实现低阶推动高阶概率。
- 战术面板显示等级链最终状态。

### 阶段 4：功能型

- 增加刷新按钮和 `refreshCharges`。
- 增加强化预案。
- 增加高阶扫描。
- 自动战斗补充功能型评分。

### 阶段 5：平衡与内容扩充

- 补齐每个角色 1-2 张专属卡。
- 补齐每个核心流派的 I/II/III。
- 根据胜率、通关时间、选择率调权重和数值。

## 11. 首批落地范围

2026-06-27 首批开发已覆盖：

- 扩展 `UpgradeCard` 类型和局内 `TacticalState`。
- 抽卡流程支持可用性过滤、卡片权重、升级链前置、角色上阵解锁、功能型概率加成。
- 升级界面增加刷新次数展示和刷新按钮。
- 首批升级链：全队火力、发射频率、暴击。
- 首批功能卡：战术重抽、属性回响、高阶检索、火力检索。
- 角色卡改为上阵后才进入卡池，并补充守卫者、棱镜师、炼金师专属卡。
- 自动战斗评分支持功能卡和新增中高阶卡片。

后续仍建议继续补齐反弹、爆炸、控制、燃烧、连锁等流派的 I/II/III 链路，并在图鉴详情里展示解锁条件和卡片类型。

## 12. 风险与约束

- 功能型卡片会改变抽卡节奏，数量不能太多。
- 下次属性卡翻倍需要统一属性卡倍率入口，否则实现容易漏。
- 升级链如果概率太高，会导致每局构筑过于固定。
- 无限叠加需要递减权重或软上限，否则会造成单一数值爆炸。
- 后端校验需要记录功能型状态，否则未来联网版本可能无法验证选卡合法性。
