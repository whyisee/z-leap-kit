/**
 * 游标是不透明的 base64url 串。
 *
 * 当前实现内部是 offset：看见流的排序在 services/recommendations.ts 里是内存排序
 * （候选集 240 条内按分数/热度排），拿不到稳定的 keyset 锚点。
 * 契约不变的前提下后续换成 keyset（{k, id}）客户端无需改动。
 */
export function encodeCursor(offset: number) {
  return Buffer.from(JSON.stringify({ v: 1, o: offset }), "utf8").toString("base64url");
}

export function decodeCursor(cursor: string | undefined | null): number {
  if (!cursor) return 0;

  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    const offset = Number(parsed?.o);
    return Number.isFinite(offset) && offset > 0 ? Math.trunc(offset) : 0;
  } catch {
    return 0;
  }
}

export function clampLimit(value: string | undefined, fallback = 20, max = 50) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.trunc(parsed), max);
}
