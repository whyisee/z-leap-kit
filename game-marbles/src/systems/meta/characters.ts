import type { CharacterRoute } from "../../core/types";

export function characterLevelCost(level: number) {
  return Math.floor(90 * Math.pow(1.36, level - 1));
}

export function characterSkillCost(level: number) {
  return Math.floor(130 * Math.pow(1.42, level - 1));
}

export function characterRouteCost(route: CharacterRoute, level: number) {
  return Math.floor(route.baseCost * Math.pow(route.growth, level));
}
