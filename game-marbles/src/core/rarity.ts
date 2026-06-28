import type { Rarity } from "./types";

export type RarityRollBoost = Partial<Record<Exclude<Rarity, "common">, number>>;

export function rollRarity(wave: number, lucky: number, boost: RarityRollBoost = {}): Rarity {
  const roll = Math.random();
  const legendary = 0.018 + lucky * 0.003 + (wave >= 15 ? 0.012 : 0) + (boost.legendary || 0);
  const epic = 0.08 + lucky * 0.008 + (wave >= 10 ? 0.025 : 0) + (boost.epic || 0);
  const rare = 0.25 + lucky * 0.012 + (wave >= 5 ? 0.04 : 0) + (boost.rare || 0);
  if (roll < legendary) return "legendary";
  if (roll < legendary + epic) return "epic";
  if (roll < legendary + epic + rare) return "rare";
  return "common";
}

export function rarityLabel(rarity: Rarity) {
  return {
    common: "普通",
    rare: "稀有",
    epic: "史诗",
    legendary: "传说",
  }[rarity];
}

export function rarityColor(rarity: Rarity) {
  return {
    common: "#eaf2ff",
    rare: "#54c7ff",
    epic: "#b68cff",
    legendary: "#f6c95f",
  }[rarity];
}

export function rarityName(rarity: Rarity) {
  return {
    common: "普通",
    rare: "稀有",
    epic: "史诗",
    legendary: "传说",
  }[rarity];
}

export function rarityAutoScore(rarity: Rarity) {
  return {
    common: 0,
    rare: 12,
    epic: 26,
    legendary: 46,
  }[rarity];
}

export function weightedRarity(entries: Array<[Rarity, number]>) {
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = Math.random() * total;
  for (const [rarity, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return rarity;
  }
  return entries[0][0];
}
