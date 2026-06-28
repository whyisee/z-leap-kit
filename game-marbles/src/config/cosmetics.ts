import { characters } from "./characters";
import { marbleConfigs } from "./marbles";
import type { CosmeticConfig, CosmeticGachaPool, CosmeticPoolId, CosmeticRarity, MarbleId } from "../core/types";

const characterSkinSeeds: Array<{
  characterId: string;
  rarity: CosmeticRarity;
  name: string;
  theme: string;
  color: string;
  accentColor: string;
  label: string;
}> = [
  { characterId: "engineer", rarity: "rare", name: "巡检制服", theme: "基地日常", color: "#54c7ff", accentColor: "#f6c95f", label: "巡" },
  { characterId: "bomber", rarity: "rare", name: "糖霜爆破", theme: "派对涂装", color: "#ff7d7d", accentColor: "#fff2bf", label: "爆" },
  { characterId: "magnetist", rarity: "rare", name: "蓝磁校准", theme: "磁轨涂装", color: "#7de2ff", accentColor: "#b68cff", label: "磁" },
  { characterId: "sentinel", rarity: "rare", name: "白塔护卫", theme: "基地日常", color: "#a8ffd7", accentColor: "#54c7ff", label: "守" },
  { characterId: "prism", rarity: "rare", name: "棱镜糖壳", theme: "派对涂装", color: "#d8a8ff", accentColor: "#61e6a8", label: "棱" },
  { characterId: "alchemist", rarity: "rare", name: "蜜焰炼金", theme: "熔火祭典", color: "#ffb86b", accentColor: "#ff6c7e", label: "炼" },
  { characterId: "frostseer", rarity: "rare", name: "雪镜外套", theme: "霜蓝季", color: "#9fd7ff", accentColor: "#eef4ff", label: "霜" },
  { characterId: "voidbinder", rarity: "rare", name: "星渊披风", theme: "星海派对", color: "#8b6cff", accentColor: "#54c7ff", label: "渊" },
  { characterId: "treasurer", rarity: "rare", name: "金票礼服", theme: "财宝季", color: "#ffd166", accentColor: "#ff7d7d", label: "财" },
  { characterId: "engineer", rarity: "epic", name: "霓虹维修官", theme: "幽蓝数据季", color: "#00d5ff", accentColor: "#f6c95f", label: "霓" },
  { characterId: "bomber", rarity: "epic", name: "熔火烟花师", theme: "熔火祭典", color: "#ff8a3d", accentColor: "#b68cff", label: "焰" },
  { characterId: "magnetist", rarity: "epic", name: "极光磁术士", theme: "星海派对", color: "#77f0b7", accentColor: "#7de2ff", label: "极" },
  { characterId: "prism", rarity: "legendary", name: "星盒彩虹", theme: "星海派对", color: "#f6c95f", accentColor: "#b68cff", label: "虹" },
];

const marbleSkinSeeds: Array<{
  marbleId: MarbleId;
  rarity: CosmeticRarity;
  name: string;
  theme: string;
  color: string;
  accentColor: string;
  label: string;
}> = [
  { marbleId: "basic", rarity: "rare", name: "糖芯弹", theme: "派对涂装", color: "#54c7ff", accentColor: "#fff2bf", label: "糖" },
  { marbleId: "basic", rarity: "rare", name: "白星弹", theme: "星海派对", color: "#eef4ff", accentColor: "#54c7ff", label: "星" },
  { marbleId: "split", rarity: "rare", name: "双叶裂弹", theme: "植物实验", color: "#61e6a8", accentColor: "#f6c95f", label: "叶" },
  { marbleId: "split", rarity: "rare", name: "镜面裂弹", theme: "幽蓝数据季", color: "#9fd7ff", accentColor: "#b68cff", label: "镜" },
  { marbleId: "blast", rarity: "rare", name: "橙光爆弹", theme: "熔火祭典", color: "#ffb86b", accentColor: "#ff6c7e", label: "橙" },
  { marbleId: "blast", rarity: "rare", name: "礼花爆弹", theme: "派对涂装", color: "#ff7d7d", accentColor: "#fff2bf", label: "礼" },
  { marbleId: "burn", rarity: "rare", name: "蜜焰火球", theme: "熔火祭典", color: "#ff8a3d", accentColor: "#f6c95f", label: "蜜" },
  { marbleId: "burn", rarity: "rare", name: "赤绸火球", theme: "旧城车间", color: "#ff6c7e", accentColor: "#ffd166", label: "赤" },
  { marbleId: "lightning", rarity: "rare", name: "蓝弧电珠", theme: "磁轨涂装", color: "#7de2ff", accentColor: "#eef4ff", label: "弧" },
  { marbleId: "lightning", rarity: "rare", name: "星闪电珠", theme: "星海派对", color: "#b68cff", accentColor: "#54c7ff", label: "闪" },
  { marbleId: "slow", rarity: "rare", name: "薄荷冰珠", theme: "霜蓝季", color: "#9fd7ff", accentColor: "#61e6a8", label: "薄" },
  { marbleId: "slow", rarity: "rare", name: "雪泡冰珠", theme: "霜蓝季", color: "#eef4ff", accentColor: "#7de2ff", label: "雪" },
  { marbleId: "basic", rarity: "epic", name: "星轨核心", theme: "星海派对", color: "#f6c95f", accentColor: "#54c7ff", label: "轨" },
  { marbleId: "split", rarity: "epic", name: "花瓣分裂", theme: "植物实验", color: "#ff9bd2", accentColor: "#61e6a8", label: "花" },
  { marbleId: "blast", rarity: "epic", name: "烟花团", theme: "派对涂装", color: "#ff8a3d", accentColor: "#b68cff", label: "烟" },
  { marbleId: "burn", rarity: "epic", name: "太阳熔珠", theme: "熔火祭典", color: "#ffd166", accentColor: "#ff6c7e", label: "阳" },
  { marbleId: "lightning", rarity: "epic", name: "霓虹链核", theme: "幽蓝数据季", color: "#00d5ff", accentColor: "#b68cff", label: "链" },
  { marbleId: "slow", rarity: "epic", name: "极光冻珠", theme: "霜蓝季", color: "#7de2ff", accentColor: "#eef4ff", label: "光" },
  { marbleId: "lightning", rarity: "legendary", name: "星河脉冲", theme: "星海派对", color: "#f6c95f", accentColor: "#8b6cff", label: "河" },
];

export const cosmeticConfigs: Record<string, CosmeticConfig> = Object.fromEntries([
  ...characterSkinSeeds.map((skin) => {
    const character = characters.find((item) => item.id === skin.characterId);
    return [
      `char_${skin.characterId}_${skin.name}`,
      {
        id: `char_${skin.characterId}_${skin.name}`,
        type: "character",
        targetId: skin.characterId,
        rarity: skin.rarity,
        name: `${character?.name || skin.characterId} · ${skin.name}`,
        desc: `${skin.theme}主题角色幻化，只改变角色展示、头像和技能表现。`,
        theme: skin.theme,
        color: skin.color,
        accentColor: skin.accentColor,
        visualLabel: skin.label,
        assetKeys: [`character:${skin.characterId}:portrait`, `character:${skin.characterId}:battle`],
        effectKeys: [`skill:${skin.characterId}:cosmetic`],
      } satisfies CosmeticConfig,
    ];
  }),
  ...marbleSkinSeeds.map((skin) => {
    const marble = marbleConfigs[skin.marbleId];
    return [
      `marble_${skin.marbleId}_${skin.name}`,
      {
        id: `marble_${skin.marbleId}_${skin.name}`,
        type: "marble",
        targetId: skin.marbleId,
        rarity: skin.rarity,
        name: `${marble.name} · ${skin.name}`,
        desc: `${skin.theme}主题弹珠幻化，只改变弹珠本体、拖尾、命中表现和音效皮肤。`,
        theme: skin.theme,
        color: skin.color,
        accentColor: skin.accentColor,
        visualLabel: skin.label,
        assetKeys: [`marble:${skin.marbleId}:body`, `marble:${skin.marbleId}:trail`],
        effectKeys: [`marble:${skin.marbleId}:hit`],
      } satisfies CosmeticConfig,
    ];
  }),
]);

export const cosmeticPools: Record<CosmeticPoolId, CosmeticGachaPool> = {
  character: {
    id: "character",
    kind: "character",
    name: "角色幻化",
    desc: "抽取角色皮肤、头像展示、入场和技能视觉表现。",
    ticket: "characterCosmetic",
    singleCrystalCost: 60,
    pity: { epic: 10, legendary: 60 },
    itemIds: Object.values(cosmeticConfigs)
      .filter((item) => item.type === "character")
      .map((item) => item.id),
  },
  marble: {
    id: "marble",
    kind: "marble",
    name: "弹珠幻化",
    desc: "抽取弹珠本体、拖尾、命中特效和音效皮肤。",
    ticket: "marbleCosmetic",
    singleCrystalCost: 60,
    pity: { epic: 10, legendary: 60 },
    itemIds: Object.values(cosmeticConfigs)
      .filter((item) => item.type === "marble")
      .map((item) => item.id),
  },
};

export function cosmeticById(id: string) {
  return cosmeticConfigs[id] || null;
}

export function cosmeticsForPool(poolId: CosmeticPoolId) {
  const pool = cosmeticPools[poolId];
  return pool.itemIds.map((id) => cosmeticConfigs[id]).filter(Boolean);
}

