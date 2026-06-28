import { gemConfigs } from "../../config/loot";
import { GEM_MAX_LEVEL } from "../../core/constants";
import { clamp } from "../../core/math";
import type { GemType, Rarity } from "../../core/types";

export function gemKey(type: GemType, level: number) {
  return `${type}:${clamp(Math.floor(level), 1, GEM_MAX_LEVEL)}`;
}

export function parseGemKey(key: string): { type: GemType; level: number } | null {
  const [type, levelText] = key.split(":");
  const level = Number(levelText);
  if (!Object.keys(gemConfigs).includes(type) || !Number.isFinite(level)) return null;
  return {
    type: type as GemType,
    level: clamp(Math.floor(level), 1, GEM_MAX_LEVEL),
  };
}

export function gemRarity(level: number): Rarity {
  if (level >= 16) return "legendary";
  if (level >= 10) return "epic";
  if (level >= 5) return "rare";
  return "common";
}

export function gemFuseChance(level: number) {
  return clamp(0.96 - (level - 1) * 0.034, 0.32, 0.96);
}

export function gemLabel(key: string) {
  const gem = parseGemKey(key);
  if (!gem) return "未知宝石";
  return `${gemConfigs[gem.type].name} Lv.${gem.level}`;
}

export function gemEffectText(type: GemType, level: number) {
  if (type === "power") return `全队伤害 +${Math.round(level * 1.2)}%`;
  if (type === "guard") return `基地生命 +${Math.max(1, Math.ceil(level / 5))}`;
  if (type === "fortune") return `金币 +${level}% · 掉落 +${Math.round(level * 1.2)}%`;
  if (type === "swift") return `发射频率 +${Math.max(1, Math.round(level * 0.6))}%`;
  if (type === "focus") return `技能冷却 -${Math.max(1, Math.round(level * 0.5))}%`;
  return `暴击率 +${Math.max(1, Math.round(level * 0.4))}% · 暴伤 +${level}%`;
}

export function sortedGemEntries(gems: Record<string, number>) {
  return Object.entries(gems)
    .filter(([key, count]) => count > 0 && !!parseGemKey(key))
    .sort(([a], [b]) => {
      const gemA = parseGemKey(a);
      const gemB = parseGemKey(b);
      if (!gemA || !gemB) return 0;
      if (gemB.level !== gemA.level) return gemB.level - gemA.level;
      return gemConfigs[gemA.type].name.localeCompare(gemConfigs[gemB.type].name, "zh-CN");
    });
}
