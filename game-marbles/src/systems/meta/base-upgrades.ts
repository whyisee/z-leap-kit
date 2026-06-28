import type { MetaUpgrade } from "../../core/types";

export function upgradeLevel(upgrades: Record<string, number>, id: string) {
  return upgrades[id] || 0;
}

export function metaCost(item: MetaUpgrade, level: number) {
  return Math.floor(item.baseCost * Math.pow(item.growth, level));
}
