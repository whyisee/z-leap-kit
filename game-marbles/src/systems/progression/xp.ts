export function xpNeedForLevel(level: number) {
  return Math.floor(20 * Math.pow(1.24, level - 1) + level * 7);
}
