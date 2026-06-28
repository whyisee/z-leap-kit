import { characters } from "./characters";
import { marbleConfigs } from "./marbles";
import type {
  CosmeticConfig,
  CosmeticGachaPool,
  CosmeticPoolId,
  CosmeticRarity,
  MarbleId,
  MarbleImpactStyle,
  MarbleTrailAnimation,
  MarbleTrailStyle,
  MarbleVisualShape,
} from "../core/types";

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
  shape: MarbleVisualShape;
  trailStyle: MarbleTrailStyle;
  trailColor?: string;
  trailAccentColor?: string;
  trailHighlightColor?: string;
  trailLength?: number;
  trailWidth?: number;
  trailAnimation?: MarbleTrailAnimation;
  trailDensity?: number;
  hitEffect?: MarbleImpactStyle;
  defeatEffect?: MarbleImpactStyle;
}> = [
  { marbleId: "basic", rarity: "rare", name: "糖芯弹", theme: "派对涂装", color: "#54c7ff", accentColor: "#fff2bf", label: "糖", shape: "candy", trailStyle: "spark", trailColor: "#ff7d7d", trailAccentColor: "#fff2bf", trailLength: 0.9, trailWidth: 1.05, trailAnimation: "sparkle", trailDensity: 1.15 },
  { marbleId: "basic", rarity: "rare", name: "白星弹", theme: "星海派对", color: "#eef4ff", accentColor: "#54c7ff", label: "星", shape: "star", trailStyle: "stardust", trailColor: "#54c7ff", trailAccentColor: "#f6c95f", trailLength: 1.2, trailWidth: 0.92, trailAnimation: "sparkle", trailDensity: 1.1 },
  { marbleId: "split", rarity: "rare", name: "双叶裂弹", theme: "植物实验", color: "#61e6a8", accentColor: "#f6c95f", label: "叶", shape: "leaf", trailStyle: "leaf", trailColor: "#61e6a8", trailAccentColor: "#f6c95f", trailLength: 0.78, trailWidth: 1.15, trailAnimation: "flow", trailDensity: 1.15 },
  { marbleId: "split", rarity: "rare", name: "镜面裂弹", theme: "幽蓝数据季", color: "#9fd7ff", accentColor: "#b68cff", label: "镜", shape: "crystal", trailStyle: "ribbon", trailColor: "#9fd7ff", trailAccentColor: "#b68cff", trailLength: 1.4, trailWidth: 0.86, trailAnimation: "flow", trailDensity: 0.85 },
  { marbleId: "blast", rarity: "rare", name: "橙光爆弹", theme: "熔火祭典", color: "#ffb86b", accentColor: "#ff6c7e", label: "橙", shape: "bomb", trailStyle: "spark", trailColor: "#ff8a3d", trailAccentColor: "#ff6c7e", trailLength: 0.88, trailWidth: 1.12, trailAnimation: "pulse", trailDensity: 1.1 },
  { marbleId: "blast", rarity: "rare", name: "礼花爆弹", theme: "派对涂装", color: "#ff7d7d", accentColor: "#fff2bf", label: "礼", shape: "star", trailStyle: "firework", trailColor: "#ff7d7d", trailAccentColor: "#fff2bf", trailLength: 0.82, trailWidth: 1.2, trailAnimation: "sparkle", trailDensity: 1.35 },
  { marbleId: "burn", rarity: "rare", name: "蜜焰火球", theme: "熔火祭典", color: "#ff8a3d", accentColor: "#f6c95f", label: "蜜", shape: "flame", trailStyle: "flame", trailColor: "#ff8a3d", trailAccentColor: "#f6c95f", trailLength: 1.25, trailWidth: 1.08, trailAnimation: "flicker", trailDensity: 1 },
  { marbleId: "burn", rarity: "rare", name: "赤绸火球", theme: "旧城车间", color: "#ff6c7e", accentColor: "#ffd166", label: "赤", shape: "comet", trailStyle: "ribbon", trailColor: "#ff6c7e", trailAccentColor: "#ffd166", trailLength: 1.55, trailWidth: 0.8, trailAnimation: "flow", trailDensity: 0.9 },
  { marbleId: "lightning", rarity: "rare", name: "蓝弧电珠", theme: "磁轨涂装", color: "#7de2ff", accentColor: "#eef4ff", label: "弧", shape: "bolt", trailStyle: "electric", trailColor: "#00d5ff", trailAccentColor: "#eef4ff", trailLength: 0.65, trailWidth: 0.86, trailAnimation: "zigzag", trailDensity: 1.05 },
  { marbleId: "lightning", rarity: "rare", name: "星闪电珠", theme: "星海派对", color: "#b68cff", accentColor: "#54c7ff", label: "闪", shape: "star", trailStyle: "electric", trailColor: "#b68cff", trailAccentColor: "#54c7ff", trailLength: 0.75, trailWidth: 0.92, trailAnimation: "flicker", trailDensity: 1.2 },
  { marbleId: "slow", rarity: "rare", name: "薄荷冰珠", theme: "霜蓝季", color: "#9fd7ff", accentColor: "#61e6a8", label: "薄", shape: "snowflake", trailStyle: "frost", trailColor: "#7de2ff", trailAccentColor: "#61e6a8", trailLength: 0.72, trailWidth: 1.24, trailAnimation: "pulse", trailDensity: 1.1 },
  { marbleId: "slow", rarity: "rare", name: "雪泡冰珠", theme: "霜蓝季", color: "#eef4ff", accentColor: "#7de2ff", label: "雪", shape: "orb", trailStyle: "frost", trailColor: "#eef4ff", trailAccentColor: "#7de2ff", trailLength: 0.66, trailWidth: 1.32, trailAnimation: "pulse", trailDensity: 0.95 },
  { marbleId: "basic", rarity: "epic", name: "星轨核心", theme: "星海派对", color: "#f6c95f", accentColor: "#54c7ff", label: "轨", shape: "ring", trailStyle: "stardust", trailColor: "#54c7ff", trailAccentColor: "#f6c95f", trailLength: 1.65, trailWidth: 0.84, trailAnimation: "orbit", trailDensity: 1.05 },
  { marbleId: "split", rarity: "epic", name: "花瓣分裂", theme: "植物实验", color: "#ff9bd2", accentColor: "#61e6a8", label: "花", shape: "flower", trailStyle: "petal", trailColor: "#ff4fb8", trailAccentColor: "#61e6a8", trailLength: 0.76, trailWidth: 1.42, trailAnimation: "flow", trailDensity: 1.25 },
  { marbleId: "blast", rarity: "epic", name: "烟花团", theme: "派对涂装", color: "#ff8a3d", accentColor: "#b68cff", label: "烟", shape: "bomb", trailStyle: "firework", trailColor: "#ff8a3d", trailAccentColor: "#b68cff", trailLength: 0.86, trailWidth: 1.28, trailAnimation: "sparkle", trailDensity: 1.45 },
  { marbleId: "burn", rarity: "epic", name: "太阳熔珠", theme: "熔火祭典", color: "#ffd166", accentColor: "#ff6c7e", label: "阳", shape: "flame", trailStyle: "flame", trailColor: "#ff5d2e", trailAccentColor: "#ffd166", trailLength: 1.7, trailWidth: 1.18, trailAnimation: "flicker", trailDensity: 1.05 },
  { marbleId: "lightning", rarity: "epic", name: "霓虹链核", theme: "幽蓝数据季", color: "#00d5ff", accentColor: "#b68cff", label: "链", shape: "bolt", trailStyle: "electric", trailColor: "#00d5ff", trailAccentColor: "#b68cff", trailLength: 0.74, trailWidth: 0.9, trailAnimation: "zigzag", trailDensity: 1.25 },
  { marbleId: "slow", rarity: "epic", name: "极光冻珠", theme: "霜蓝季", color: "#7de2ff", accentColor: "#eef4ff", label: "光", shape: "crystal", trailStyle: "aurora", trailColor: "#61e6a8", trailAccentColor: "#7de2ff", trailHighlightColor: "#b68cff", trailLength: 1.55, trailWidth: 1.05, trailAnimation: "flow", trailDensity: 0.9 },
  { marbleId: "lightning", rarity: "legendary", name: "星河脉冲", theme: "星海派对", color: "#f6c95f", accentColor: "#8b6cff", label: "河", shape: "ring", trailStyle: "galaxy", trailColor: "#8b6cff", trailAccentColor: "#f6c95f", trailHighlightColor: "#54c7ff", trailLength: 2.1, trailWidth: 1.05, trailAnimation: "orbit", trailDensity: 0.85 },
  { marbleId: "basic", rarity: "epic", name: "棱彩信标", theme: "棱镜庆典", color: "#7de2ff", accentColor: "#ffd166", label: "棱", shape: "ring", trailStyle: "aurora", trailColor: "#7de2ff", trailAccentColor: "#ffd166", trailHighlightColor: "#b68cff", trailLength: 1.6, trailWidth: 1.02, trailAnimation: "orbit", trailDensity: 1, hitEffect: "pulse", defeatEffect: "galaxy" },
  { marbleId: "split", rarity: "epic", name: "蝶翼裂片", theme: "植物实验", color: "#8cffc1", accentColor: "#ff9bd2", label: "蝶", shape: "leaf", trailStyle: "petal", trailColor: "#ff4fb8", trailAccentColor: "#8cffc1", trailHighlightColor: "#ff9bd2", trailLength: 0.68, trailWidth: 1.55, trailAnimation: "flow", trailDensity: 1.35, hitEffect: "petal", defeatEffect: "petal" },
  { marbleId: "blast", rarity: "legendary", name: "日冕爆星", theme: "熔火祭典", color: "#ffb13d", accentColor: "#fff2bf", label: "冕", shape: "bomb", trailStyle: "firework", trailColor: "#ff8a3d", trailAccentColor: "#ffd166", trailHighlightColor: "#ff4b2f", trailLength: 0.9, trailWidth: 1.38, trailAnimation: "sparkle", trailDensity: 1.65, hitEffect: "flare", defeatEffect: "flare" },
  { marbleId: "burn", rarity: "epic", name: "赤曜彗核", theme: "旧城车间", color: "#ff5d6c", accentColor: "#ffd166", label: "曜", shape: "comet", trailStyle: "flame", trailColor: "#ff2f4f", trailAccentColor: "#ffd166", trailHighlightColor: "#ff7d3d", trailLength: 1.95, trailWidth: 0.94, trailAnimation: "flicker", trailDensity: 0.95, hitEffect: "flare", defeatEffect: "ribbon" },
  { marbleId: "lightning", rarity: "epic", name: "量子电弧", theme: "幽蓝数据季", color: "#00d5ff", accentColor: "#eef4ff", label: "量", shape: "bolt", trailStyle: "electric", trailColor: "#00f0ff", trailAccentColor: "#b68cff", trailHighlightColor: "#eef4ff", trailLength: 0.58, trailWidth: 0.78, trailAnimation: "zigzag", trailDensity: 1.45, hitEffect: "electric", defeatEffect: "electric" },
  { marbleId: "slow", rarity: "legendary", name: "寒镜星核", theme: "霜蓝季", color: "#a9f0ff", accentColor: "#b68cff", label: "镜", shape: "crystal", trailStyle: "frost", trailColor: "#38e8ff", trailAccentColor: "#8b6cff", trailHighlightColor: "#e8fbff", trailLength: 0.62, trailWidth: 1.62, trailAnimation: "pulse", trailDensity: 1.25, hitEffect: "frost", defeatEffect: "crystal" },
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
        desc: `${skin.theme}主题弹珠幻化，只改变弹珠本体、拖尾、击中和击败表现，不影响属性平衡。`,
        theme: skin.theme,
        color: skin.color,
        accentColor: skin.accentColor,
        visualLabel: skin.label,
        assetKeys: [`marble:${skin.marbleId}:body`, `marble:${skin.marbleId}:trail`],
        effectKeys: [`marble:${skin.marbleId}:hit`, `marble:${skin.marbleId}:defeat`],
        marbleShape: skin.shape,
        marbleTrailStyle: skin.trailStyle,
        marbleTrailColor: skin.trailColor,
        marbleTrailAccentColor: skin.trailAccentColor,
        marbleTrailHighlightColor: skin.trailHighlightColor,
        marbleTrailLength: skin.trailLength,
        marbleTrailWidth: skin.trailWidth,
        marbleTrailAnimation: skin.trailAnimation,
        marbleTrailDensity: skin.trailDensity,
        marbleHitEffect: skin.hitEffect,
        marbleDefeatEffect: skin.defeatEffect,
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
