export function marbleShardCost(level: number) {
  return Math.floor(10 + level * 5 + Math.pow(level, 1.34) * 2);
}
