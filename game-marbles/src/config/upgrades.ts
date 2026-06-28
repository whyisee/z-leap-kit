import type { MarbleId, Session, UpgradeCard } from "../core/types";
import { marbleConfigs } from "./marbles";

function hasMarble(id: MarbleId) {
  return (session: Session) => session.characters.some((char) => char.marbles.includes(id));
}

function hasTag(tag: string) {
  return (session: Session) => session.characters.some((char) => char.marbles.some((id) => marbleConfigs[id].tags.includes(tag)));
}

function addMarbleDamage(session: Session, id: MarbleId, amount: number) {
  session.modifiers.marbleDamage[id] = (session.modifiers.marbleDamage[id] || 0) + amount;
}

export const upgradeCards: UpgradeCard[] = [
  {
    id: "damage_up",
    name: "火力校准",
    rarity: "common",
    tag: "全队",
    desc: "全队伤害 +16%",
    kind: "tiered",
    effectType: "attribute",
    familyId: "team_firepower",
    tier: "basic",
    maxStacks: 4,
    weight: 1.12,
    apply: (s) => {
      s.modifiers.damageMul *= 1.16;
    },
  },
  {
    id: "damage_up_mid",
    name: "火力矩阵",
    rarity: "rare",
    tag: "全队",
    desc: "全队伤害 +24%，获得火力校准后出现概率提高",
    kind: "tiered",
    effectType: "attribute",
    familyId: "team_firepower",
    tier: "middle",
    maxStacks: 3,
    apply: (s) => {
      s.modifiers.damageMul *= 1.24;
    },
  },
  {
    id: "damage_up_high",
    name: "歼灭矩阵",
    rarity: "epic",
    tag: "全队",
    desc: "全队伤害 +36%，需要火力矩阵后才会出现",
    kind: "tiered",
    effectType: "attribute",
    familyId: "team_firepower",
    tier: "high",
    maxStacks: 2,
    apply: (s) => {
      s.modifiers.damageMul *= 1.36;
    },
  },
  {
    id: "fire_rate",
    name: "快速装填",
    rarity: "common",
    tag: "全队",
    desc: "发射频率 +12%",
    kind: "tiered",
    effectType: "attribute",
    familyId: "rapid_loading",
    tier: "basic",
    maxStacks: 4,
    weight: 1.08,
    apply: (s) => {
      s.modifiers.fireRateMul *= 1.12;
    },
  },
  {
    id: "fire_rate_mid",
    name: "同步装填",
    rarity: "rare",
    tag: "全队",
    desc: "发射频率 +18%，获得快速装填后出现概率提高",
    kind: "tiered",
    effectType: "attribute",
    familyId: "rapid_loading",
    tier: "middle",
    maxStacks: 3,
    apply: (s) => {
      s.modifiers.fireRateMul *= 1.18;
    },
  },
  {
    id: "fire_rate_high",
    name: "超限连发",
    rarity: "epic",
    tag: "全队",
    desc: "发射频率 +26%，需要同步装填后才会出现",
    kind: "tiered",
    effectType: "attribute",
    familyId: "rapid_loading",
    tier: "high",
    maxStacks: 2,
    apply: (s) => {
      s.modifiers.fireRateMul *= 1.26;
    },
  },
  {
    id: "marble_speed",
    name: "高速轨道",
    rarity: "common",
    tag: "弹珠",
    desc: "弹珠飞行速度 +14%",
    kind: "stackable",
    effectType: "attribute",
    maxStacks: "infinite",
    apply: (s) => {
      s.modifiers.marbleSpeedMul *= 1.14;
    },
  },
  {
    id: "endless_calibration",
    name: "持续校准",
    rarity: "common",
    tag: "成长",
    desc: "全队伤害 +5%，暴击伤害 +6%，可无限叠加",
    kind: "stackable",
    effectType: "attribute",
    maxStacks: "infinite",
    weight: 0.92,
    apply: (s) => {
      s.modifiers.damageMul *= 1.05;
      s.modifiers.critDamage += 0.06;
    },
  },
  {
    id: "crit",
    name: "弱点测算",
    rarity: "common",
    tag: "暴击",
    desc: "暴击率 +6%",
    kind: "tiered",
    effectType: "attribute",
    familyId: "critical_math",
    tier: "basic",
    maxStacks: 4,
    apply: (s) => {
      s.modifiers.critChance += 0.06;
    },
  },
  {
    id: "crit_mid",
    name: "弱点建模",
    rarity: "rare",
    tag: "暴击",
    desc: "暴击率 +9%，暴击伤害 +12%",
    kind: "tiered",
    effectType: "attribute",
    familyId: "critical_math",
    tier: "middle",
    maxStacks: 3,
    apply: (s) => {
      s.modifiers.critChance += 0.09;
      s.modifiers.critDamage += 0.12;
    },
  },
  {
    id: "crit_high",
    name: "致命演算",
    rarity: "epic",
    tag: "暴击",
    desc: "暴击率 +12%，暴击伤害 +24%",
    kind: "tiered",
    effectType: "attribute",
    familyId: "critical_math",
    tier: "high",
    maxStacks: 2,
    apply: (s) => {
      s.modifiers.critChance += 0.12;
      s.modifiers.critDamage += 0.24;
    },
  },
  {
    id: "crit_damage",
    name: "过载击穿",
    rarity: "rare",
    tag: "暴击",
    desc: "暴击伤害 +40%",
    kind: "stackable",
    effectType: "attribute",
    maxStacks: "infinite",
    apply: (s) => {
      s.modifiers.critDamage += 0.4;
    },
  },
  {
    id: "base_hp",
    name: "临时装甲",
    rarity: "common",
    tag: "生存",
    desc: "基地生命上限 +1，并立即恢复 1 点",
    kind: "stackable",
    effectType: "attribute",
    maxStacks: 5,
    apply: (s) => {
      s.maxBaseHp += 1;
      s.baseHp = Math.min(s.maxBaseHp, s.baseHp + 1);
    },
  },
  {
    id: "regen_wave",
    name: "回收修复",
    rarity: "rare",
    tag: "生存",
    desc: "之后每 3 波结束恢复 1 点基地生命",
    kind: "unique",
    effectType: "hybrid",
    maxStacks: 1,
    apply: (s) => {
      s.modifiers.baseRegen = 1;
    },
  },
  {
    id: "revive",
    name: "备用防线",
    rarity: "epic",
    tag: "生存",
    desc: "第一次致命突破时清除场上普通敌人并保留 1 点生命",
    kind: "unique",
    effectType: "hybrid",
    maxStacks: 1,
    apply: (s) => {
      s.modifiers.revive = true;
    },
  },
  {
    id: "coin_gain",
    name: "战地回收",
    rarity: "common",
    tag: "经济",
    desc: "本局金币获得 +28%",
    kind: "stackable",
    effectType: "attribute",
    maxStacks: "infinite",
    apply: (s) => {
      s.modifiers.coinMul *= 1.28;
    },
  },
  {
    id: "xp_gain",
    name: "数据采样",
    rarity: "rare",
    tag: "成长",
    desc: "经验获得 +22%",
    kind: "stackable",
    effectType: "attribute",
    maxStacks: "infinite",
    apply: (s) => {
      s.modifiers.expMul *= 1.22;
    },
  },
  {
    id: "utility_refresh_charge",
    name: "战术重抽",
    rarity: "common",
    tag: "功能",
    desc: "获得 1 次刷新机会，升级选择时可重新抽取当前 3 张卡",
    kind: "utility",
    effectType: "utility",
    maxStacks: 3,
    weight: 0.82,
    apply: (s) => {
      s.tacticState.refreshCharges = Math.min(s.tacticState.refreshChargesMax, s.tacticState.refreshCharges + 1);
    },
  },
  {
    id: "utility_attribute_echo",
    name: "属性回响",
    rarity: "rare",
    tag: "功能",
    desc: "下次选择属性卡时效果触发 2 次，不影响功能卡和唯一卡",
    kind: "utility",
    effectType: "utility",
    maxStacks: 2,
    apply: (s) => {
      s.tacticState.nextAttributeMultiplier = Math.max(s.tacticState.nextAttributeMultiplier, 2);
      s.tacticState.nextAttributeMultiplierUses = Math.min(2, s.tacticState.nextAttributeMultiplierUses + 1);
    },
  },
  {
    id: "utility_rarity_boost",
    name: "高阶检索",
    rarity: "rare",
    tag: "功能",
    desc: "之后 2 次升级选择中，稀有/史诗/传说卡出现概率提升",
    kind: "utility",
    effectType: "utility",
    maxStacks: 2,
    apply: (s) => {
      s.tacticState.rarityBoosts.push({ uses: 2, rare: 0.1, epic: 0.055, legendary: 0.015 });
    },
  },
  {
    id: "utility_assault_bias",
    name: "火力检索",
    rarity: "rare",
    tag: "功能",
    desc: "后续全队、弹珠、暴击类卡片更容易出现",
    kind: "utility",
    effectType: "utility",
    maxStacks: 2,
    apply: (s) => {
      s.tacticState.tagBiases["全队"] = (s.tacticState.tagBiases["全队"] || 0) + 0.35;
      s.tacticState.tagBiases["弹珠"] = (s.tacticState.tagBiases["弹珠"] || 0) + 0.28;
      s.tacticState.tagBiases["暴击"] = (s.tacticState.tagBiases["暴击"] || 0) + 0.25;
    },
  },
  {
    id: "gold_damage",
    name: "赏金协议",
    rarity: "epic",
    tag: "经济",
    desc: "当前每 80 金币提高 1% 伤害，最多 28%",
    kind: "unique",
    effectType: "hybrid",
    maxStacks: 1,
    apply: (s) => {
      s.modifiers.cardStacks.goldDamage = 1;
    },
  },
  {
    id: "global_pierce",
    name: "穿透弹体",
    rarity: "rare",
    tag: "弹珠",
    desc: "所有弹珠获得 1 次穿透",
    kind: "stackable",
    effectType: "attribute",
    maxStacks: 2,
    apply: (s) => {
      s.modifiers.globalPierce += 1;
    },
  },
  {
    id: "bounce_damage",
    name: "反弹增幅",
    rarity: "rare",
    tag: "反弹",
    desc: "弹珠每次反弹后伤害 +4%，最多按 12 次计算",
    kind: "stackable",
    effectType: "attribute",
    maxStacks: 3,
    apply: (s) => {
      s.modifiers.bounceDamage += 0.04;
    },
  },
  {
    id: "split_more",
    name: "多重分裂",
    rarity: "rare",
    tag: "多弹",
    desc: "分裂弹珠伤害 +25%，小弹珠存在时间更长",
    kind: "stackable",
    effectType: "attribute",
    maxStacks: "infinite",
    requires: hasMarble("split"),
    apply: (s) => {
      addMarbleDamage(s, "split", 0.25);
      s.modifiers.cardStacks.splitLife = (s.modifiers.cardStacks.splitLife || 0) + 1;
    },
  },
  {
    id: "multi_swarm",
    name: "群集算法",
    rarity: "epic",
    tag: "多弹",
    desc: "场上每 12 颗弹珠，全队伤害 +5%，最多 +30%",
    kind: "unique",
    effectType: "hybrid",
    maxStacks: 1,
    apply: (s) => {
      s.modifiers.cardStacks.swarm = 1;
    },
  },
  {
    id: "blast_radius",
    name: "爆区扩张",
    rarity: "common",
    tag: "爆炸",
    desc: "爆炸范围 +22%",
    kind: "stackable",
    effectType: "attribute",
    maxStacks: "infinite",
    requires: hasTag("explosive"),
    apply: (s) => {
      s.modifiers.blastRadiusMul *= 1.22;
    },
  },
  {
    id: "chain_blast",
    name: "连锁爆破",
    rarity: "epic",
    tag: "爆炸",
    desc: "爆炸击杀敌人时产生一次小爆炸",
    kind: "unique",
    effectType: "hybrid",
    maxStacks: 1,
    requires: hasTag("explosive"),
    apply: (s) => {
      s.modifiers.cardStacks.chainBlast = 1;
    },
  },
  {
    id: "burn_plus",
    name: "高温燃剂",
    rarity: "common",
    tag: "燃烧",
    desc: "燃烧伤害 +30%",
    kind: "stackable",
    effectType: "attribute",
    maxStacks: "infinite",
    requires: hasMarble("burn"),
    apply: (s) => {
      s.modifiers.burnMul *= 1.3;
    },
  },
  {
    id: "burn_spread",
    name: "余烬扩散",
    rarity: "rare",
    tag: "燃烧",
    desc: "燃烧中的敌人死亡时，将燃烧扩散给附近敌人",
    kind: "unique",
    effectType: "hybrid",
    maxStacks: 1,
    requires: hasMarble("burn"),
    apply: (s) => {
      s.modifiers.cardStacks.burnSpread = 1;
    },
  },
  {
    id: "lightning_chain",
    name: "电弧延展",
    rarity: "common",
    tag: "连锁",
    desc: "闪电连锁次数 +2",
    kind: "stackable",
    effectType: "attribute",
    maxStacks: "infinite",
    requires: hasMarble("lightning"),
    apply: (s) => {
      s.modifiers.chainBonus += 2;
    },
  },
  {
    id: "lightning_focus",
    name: "静电标记",
    rarity: "rare",
    tag: "连锁",
    desc: "被减速敌人受到闪电伤害 +35%",
    kind: "unique",
    effectType: "hybrid",
    requires: (s) => hasMarble("lightning")(s) && hasMarble("slow")(s),
    apply: (s) => {
      s.modifiers.cardStacks.slowShock = 1;
    },
  },
  {
    id: "slow_power",
    name: "低温制动",
    rarity: "common",
    tag: "控制",
    desc: "减速效果 +15%",
    kind: "stackable",
    effectType: "attribute",
    maxStacks: "infinite",
    requires: hasMarble("slow"),
    apply: (s) => {
      s.modifiers.slowBonus += 0.15;
    },
  },
  {
    id: "slow_vulnerability",
    name: "迟滞弱点",
    rarity: "rare",
    tag: "控制",
    desc: "被减速敌人受到所有伤害 +14%",
    kind: "unique",
    effectType: "hybrid",
    maxStacks: 1,
    requires: hasMarble("slow"),
    apply: (s) => {
      s.modifiers.cardStacks.slowVulnerable = 1;
    },
  },
  {
    id: "engineer_haste",
    name: "工程师超频",
    rarity: "rare",
    tag: "角色",
    desc: "工程师两种弹珠冷却 -18%",
    kind: "character",
    effectType: "attribute",
    maxStacks: 3,
    unlock: { characters: ["engineer"] },
    apply: (s) => {
      s.modifiers.cardStacks.engineerHaste = (s.modifiers.cardStacks.engineerHaste || 0) + 1;
    },
  },
  {
    id: "bomber_energy",
    name: "爆破补给",
    rarity: "rare",
    tag: "角色",
    desc: "爆破手技能冷却 -25%，爆炸伤害 +10%",
    kind: "character",
    effectType: "attribute",
    maxStacks: 3,
    unlock: { characters: ["bomber"] },
    apply: (s) => {
      s.modifiers.cardStacks.bomberHaste = (s.modifiers.cardStacks.bomberHaste || 0) + 1;
      s.modifiers.tagDamage.explosive = (s.modifiers.tagDamage.explosive || 0) + 0.1;
    },
  },
  {
    id: "magnet_long",
    name: "磁场延展",
    rarity: "rare",
    tag: "角色",
    desc: "磁能师技能持续时间 +3 秒，控制弹珠伤害 +15%",
    kind: "character",
    effectType: "attribute",
    maxStacks: 3,
    unlock: { characters: ["magnetist"] },
    apply: (s) => {
      s.modifiers.cardStacks.magnetLong = (s.modifiers.cardStacks.magnetLong || 0) + 1;
      s.modifiers.tagDamage.control = (s.modifiers.tagDamage.control || 0) + 0.15;
    },
  },
  {
    id: "sentinel_barrier_card",
    name: "守卫者壁垒",
    rarity: "rare",
    tag: "角色",
    desc: "守卫者上阵时出现：基地生命上限 +1，控制弹珠伤害 +12%",
    kind: "character",
    effectType: "attribute",
    maxStacks: 2,
    unlock: { characters: ["sentinel"] },
    apply: (s) => {
      s.maxBaseHp += 1;
      s.baseHp = Math.min(s.maxBaseHp, s.baseHp + 1);
      s.modifiers.tagDamage.control = (s.modifiers.tagDamage.control || 0) + 0.12;
    },
  },
  {
    id: "prism_refraction_card",
    name: "棱镜折射",
    rarity: "epic",
    tag: "角色",
    desc: "棱镜师上阵时出现：闪电连锁 +1，分裂弹珠伤害 +20%",
    kind: "character",
    effectType: "attribute",
    maxStacks: 2,
    unlock: { characters: ["prism"] },
    apply: (s) => {
      s.modifiers.chainBonus += 1;
      addMarbleDamage(s, "split", 0.2);
    },
  },
  {
    id: "alchemist_recycle_card",
    name: "炼金回收",
    rarity: "epic",
    tag: "角色",
    desc: "炼金师上阵时出现：燃烧伤害 +18%，金币获得 +14%",
    kind: "character",
    effectType: "attribute",
    maxStacks: 2,
    unlock: { characters: ["alchemist"] },
    apply: (s) => {
      s.modifiers.burnMul *= 1.18;
      s.modifiers.coinMul *= 1.14;
    },
  },
  {
    id: "legend_all",
    name: "过载齐射",
    rarity: "legendary",
    tag: "传说",
    desc: "所有弹珠伤害 +30%，发射频率 +18%，但敌人速度 +8%",
    kind: "unique",
    effectType: "hybrid",
    maxStacks: 1,
    apply: (s) => {
      s.modifiers.damageMul *= 1.3;
      s.modifiers.fireRateMul *= 1.18;
      s.modifiers.cardStacks.enemySpeedDebt = 1;
    },
  },
  {
    id: "legend_safety",
    name: "完美撤离",
    rarity: "legendary",
    tag: "传说",
    desc: "基地生命立即回满，并且之后触底伤害 -1，最低 1",
    kind: "unique",
    effectType: "hybrid",
    maxStacks: 1,
    apply: (s) => {
      s.baseHp = s.maxBaseHp;
      s.modifiers.cardStacks.touchArmor = 1;
    },
  },
  {
    id: "boss_killer",
    name: "核心猎手",
    rarity: "epic",
    tag: "Boss",
    desc: "对精英和 Boss 伤害 +32%",
    kind: "stackable",
    effectType: "attribute",
    maxStacks: "infinite",
    apply: (s) => {
      s.modifiers.cardStacks.bossDamage = (s.modifiers.cardStacks.bossDamage || 0) + 1;
    },
  },
  {
    id: "last_line",
    name: "底线火网",
    rarity: "rare",
    tag: "生存",
    desc: "敌人越接近底线，受到伤害越高，最高 +25%",
    kind: "unique",
    effectType: "hybrid",
    maxStacks: 1,
    apply: (s) => {
      s.modifiers.cardStacks.lastLine = 1;
    },
  },
];
