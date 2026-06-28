import { collectibleConfigs, gemConfigs } from "../../config/loot";
import { marbleConfigs } from "../../config/marbles";
import { clamp } from "../../core/math";
import { randomRange } from "../../core/random";
import { rarityAutoScore, rarityColor, weightedRarity } from "../../core/rarity";
import type { CollectibleId, DropEntry, EnemyType, Rarity } from "../../core/types";

export function rollDropRarity(enemyType: EnemyType, wave: number): Rarity {
  if (enemyType === "boss") {
    return weightedRarity([
      ["rare", 42],
      ["epic", 42],
      ["legendary", 16],
    ]);
  }

  if (enemyType === "elite") {
    return weightedRarity([
      ["common", 24],
      ["rare", 48],
      ["epic", 24],
      ["legendary", 4],
    ]);
  }

  const waveBonus = Math.min(18, wave * 0.6);
  return weightedRarity([
    ["common", 76 - waveBonus],
    ["rare", 20 + waveBonus * 0.65],
    ["epic", 3 + waveBonus * 0.28],
    ["legendary", 1 + waveBonus * 0.07],
  ]);
}

export function dropGemLevel(rarity: Rarity, enemyType: EnemyType) {
  const base = {
    common: 1,
    rare: 2,
    epic: 3,
    legendary: 4,
  }[rarity];
  const bonus = enemyType === "boss" ? 1 : enemyType === "elite" && Math.random() < 0.35 ? 1 : 0;
  return clamp(base + bonus, 1, 6);
}

export function dropShardAmount(rarity: Rarity, enemyType: EnemyType) {
  const base = {
    common: 2,
    rare: 4,
    epic: 7,
    legendary: 12,
  }[rarity];
  const multiplier = enemyType === "boss" ? 3 : enemyType === "elite" ? 2 : 1;
  return base * multiplier + Math.floor(randomRange(0, 3));
}

export function collectibleForRarity(rarity: Rarity): CollectibleId {
  if (rarity === "legendary") return "boss_core";
  if (rarity === "epic") return "void_lens";
  if (rarity === "rare") return "ancient_chip";
  return "scrap_shell";
}

export function compactDrops(drops: DropEntry[]) {
  const map = new Map<string, { label: string; amount: number; rarity: Rarity; icon: string }>();

  for (const drop of drops) {
    const key =
      drop.type === "collectible"
        ? `c:${drop.id}`
        : drop.type === "marbleShard"
          ? `m:${drop.marbleId}`
          : `g:${drop.gemType}:${drop.level}`;
    const label = dropFullLabel(drop);
    const current = map.get(key);
    if (current) {
      current.amount += drop.amount;
    } else {
      map.set(key, { label, amount: drop.amount, rarity: drop.rarity, icon: dropIconText(drop) });
    }
  }

  return [...map.values()].sort((a, b) => rarityAutoScore(b.rarity) - rarityAutoScore(a.rarity));
}

export function dropTotalAmount(drops: DropEntry[]) {
  return drops.reduce((sum, drop) => sum + drop.amount, 0);
}

export function dropAmount(drop: DropEntry) {
  return drop.amount;
}

export function dropFullLabel(drop: DropEntry) {
  if (drop.type === "collectible") return collectibleConfigs[drop.id].name;
  if (drop.type === "marbleShard") return `${marbleConfigs[drop.marbleId].name}碎片`;
  return `${gemConfigs[drop.gemType].name} Lv.${drop.level}`;
}

export function dropShortLabel(drop: DropEntry) {
  if (drop.type === "collectible") return collectibleConfigs[drop.id].name.slice(0, 4);
  if (drop.type === "marbleShard") return "弹珠碎片";
  return `宝石 Lv.${drop.level}`;
}

export function dropIconText(drop: DropEntry) {
  if (drop.type === "collectible") {
    return {
      scrap_shell: "壳",
      ancient_chip: "芯",
      void_lens: "镜",
      boss_core: "核",
    }[drop.id];
  }

  if (drop.type === "marbleShard") {
    return {
      basic: "基",
      split: "分",
      blast: "爆",
      burn: "燃",
      lightning: "电",
      slow: "缓",
    }[drop.marbleId];
  }

  return {
    power: "攻",
    guard: "盾",
    fortune: "财",
    swift: "速",
    focus: "技",
    rupture: "暴",
  }[drop.gemType];
}

export function dropIconFill(drop: DropEntry) {
  if (drop.type === "collectible") return rarityColor(drop.rarity);
  if (drop.type === "marbleShard") return marbleConfigs[drop.marbleId].color;
  return gemConfigs[drop.gemType].color;
}
