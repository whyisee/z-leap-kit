import type { CollectibleConfig, CollectibleId, GemConfig, GemType } from "../core/types";

export const collectibleConfigs: Record<CollectibleId, CollectibleConfig> = {
  scrap_shell: {
    id: "scrap_shell",
    name: "废旧外壳",
    rarity: "common",
    value: 8,
    desc: "战场回收物，可出售换取金币。",
  },
  ancient_chip: {
    id: "ancient_chip",
    name: "古旧芯片",
    rarity: "rare",
    value: 28,
    desc: "保留着旧式弹道记录，可出售。",
  },
  void_lens: {
    id: "void_lens",
    name: "棱镜残片",
    rarity: "epic",
    value: 90,
    desc: "高价值收藏品，可出售。",
  },
  boss_core: {
    id: "boss_core",
    name: "首领核心",
    rarity: "legendary",
    value: 260,
    desc: "首领级掉落收藏品，可出售。",
  },
};

export const gemConfigs: Record<GemType, GemConfig> = {
  power: {
    type: "power",
    name: "强袭宝石",
    color: "#ff7b5f",
    stat: "全队伤害",
  },
  guard: {
    type: "guard",
    name: "壁垒宝石",
    color: "#54c7ff",
    stat: "基地生命",
  },
  fortune: {
    type: "fortune",
    name: "回收宝石",
    color: "#61e6a8",
    stat: "金币与掉落",
  },
  swift: {
    type: "swift",
    name: "迅捷宝石",
    color: "#f6c95f",
    stat: "发射频率",
  },
  focus: {
    type: "focus",
    name: "专注宝石",
    color: "#b68cff",
    stat: "技能冷却",
  },
  rupture: {
    type: "rupture",
    name: "锐击宝石",
    color: "#ff6c7e",
    stat: "暴击",
  },
};
