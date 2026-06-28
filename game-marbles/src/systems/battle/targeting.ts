import type { Enemy } from "../../core/types";

export function nearestEnemy(enemies: Enemy[], x: number, y: number) {
  return enemies
    .map((enemy) => ({ enemy, distance: Math.hypot(enemy.x - x, enemy.y - y) }))
    .sort((a, b) => a.distance - b.distance)[0]?.enemy;
}

export function densestPoint(enemies: Enemy[]) {
  if (!enemies.length) return null;
  return [...enemies]
    .map((enemy) => ({
      enemy,
      score: enemies.filter((other) => Math.hypot(other.x - enemy.x, other.y - enemy.y) < 140).length,
    }))
    .sort((a, b) => b.score - a.score)[0].enemy;
}
