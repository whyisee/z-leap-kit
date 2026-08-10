import type { FormationConfig } from "../core/types";

export const formations: FormationConfig[] = [
  {
    id: "rebound",
    name: "回环阵",
    shortName: "回环",
    desc: "强化反弹、多弹和持续弹幕，适合基础弹珠、分裂弹珠与工程师体系。",
    tags: ["反弹", "多弹", "弹珠"],
    color: "#61e6a8",
    accentColor: "#d9fff0",
    unlockText: "默认解锁",
    initialRefreshCharges: 1,
    tagBiases: {
      反弹: 0.42,
      多弹: 0.36,
      弹珠: 0.18,
    },
    familyBiases: {
      rebound_core: 0.35,
      split_swarm: 0.22,
    },
    coreBiases: {
      rebound_fracture: 0.42,
      swarm_growth: 0.22,
    },
    recommendedDeckId: "rebound",
    applyStart: (session) => {
      session.modifiers.bounceDamage += 0.012;
    },
  },
  {
    id: "pyro",
    name: "灼爆阵",
    shortName: "灼爆",
    desc: "强化燃烧、爆炸和击杀扩散，适合爆破手、炼金师与燃烧/爆裂弹珠。",
    tags: ["燃烧", "爆炸", "经济"],
    color: "#ff9f43",
    accentColor: "#ffe28c",
    unlockText: "拥有燃烧或爆裂弹珠即可使用",
    initialRefreshCharges: 1,
    tagBiases: {
      燃烧: 0.44,
      爆炸: 0.42,
      经济: 0.12,
    },
    familyBiases: {
      pyro_chain: 0.38,
    },
    coreBiases: {
      pyro_chain_core: 0.48,
    },
    recommendedDeckId: "pyro",
    applyStart: (session) => {
      session.modifiers.burnMul *= 1.06;
      session.modifiers.blastRadiusMul *= 1.04;
    },
  },
  {
    id: "magnetic",
    name: "磁控阵",
    shortName: "磁控",
    desc: "强化闪电、减速和控制增伤，适合磁能师、冰霜系角色与闪电/减速弹珠。",
    tags: ["连锁", "控制", "暴击"],
    color: "#54c7ff",
    accentColor: "#b68cff",
    unlockText: "拥有闪电或减速弹珠即可使用",
    initialRefreshCharges: 1,
    tagBiases: {
      连锁: 0.42,
      控制: 0.42,
      暴击: 0.12,
    },
    familyBiases: {
      static_control: 0.4,
    },
    coreBiases: {
      static_frost_core: 0.5,
    },
    recommendedDeckId: "magnetic",
    applyStart: (session) => {
      session.modifiers.slowBonus += 0.04;
      session.modifiers.chainBonus += 1;
    },
  },
  {
    id: "hunter",
    name: "猎核阵",
    shortName: "猎核",
    desc: "强化暴击、Boss 压制和精英击穿，适合高爆发角色与穿透弹珠。",
    tags: ["暴击", "Boss", "全队"],
    color: "#f7c756",
    accentColor: "#fff2a8",
    unlockText: "通关第 1 章第 5 关后可使用",
    initialRefreshCharges: 1,
    tagBiases: {
      暴击: 0.44,
      Boss: 0.42,
      全队: 0.14,
    },
    familyBiases: {
      critical_math: 0.32,
    },
    coreBiases: {
      boss_hunter_core: 0.52,
    },
    recommendedDeckId: "hunter",
    applyStart: (session) => {
      session.modifiers.critChance += 0.035;
      session.modifiers.cardStacks.bossDamage = (session.modifiers.cardStacks.bossDamage || 0) + 0.35;
    },
  },
  {
    id: "guard",
    name: "坚守阵",
    shortName: "坚守",
    desc: "强化生存、控制和底线反击，适合守卫者与减速体系。",
    tags: ["生存", "控制", "全队"],
    color: "#ff8fb3",
    accentColor: "#ffd6e6",
    unlockText: "拥有守卫者或减速弹珠即可使用",
    initialRefreshCharges: 2,
    tagBiases: {
      生存: 0.46,
      控制: 0.34,
      全队: 0.12,
    },
    familyBiases: {
      rapid_loading: 0.08,
    },
    coreBiases: {
      last_line_core: 0.52,
    },
    recommendedDeckId: "guard",
    applyStart: (session) => {
      session.maxBaseHp += 1;
      session.baseHp += 1;
      session.modifiers.slowBonus += 0.03;
    },
  },
  {
    id: "bounty",
    name: "赏金阵",
    shortName: "赏金",
    desc: "强化经济、成长和资源转火力，适合炼金师与宝藏猎人体系。",
    tags: ["经济", "成长", "燃烧"],
    color: "#ffd56a",
    accentColor: "#61e6a8",
    unlockText: "拥有炼金师或宝藏猎人即可使用",
    initialRefreshCharges: 1,
    tagBiases: {
      经济: 0.48,
      成长: 0.32,
      燃烧: 0.16,
    },
    familyBiases: {
      pyro_chain: 0.16,
    },
    coreBiases: {
      pyro_chain_core: 0.2,
      boss_hunter_core: 0.2,
    },
    recommendedDeckId: "bounty",
    applyStart: (session) => {
      session.modifiers.coinMul *= 1.1;
      session.modifiers.expMul *= 1.05;
    },
  },
];

export const defaultFormationId = "rebound";

export function formationById(id: string | undefined) {
  return formations.find((formation) => formation.id === id) || formations[0];
}
