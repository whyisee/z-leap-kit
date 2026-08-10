function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sameScalar(before: unknown, after: unknown): boolean {
  if (before === after) return true;
  if (typeof before === "string" && typeof after === "string" && /^\d{4}-\d{2}-\d{2}T/.test(before)) {
    const beforeTime = new Date(before).getTime();
    const afterTime = new Date(after).getTime();
    return Number.isFinite(beforeTime) && beforeTime === afterTime;
  }
  return false;
}

/** Returns stable JSON-pointer-like paths whose values differ. Arrays are compared by index. */
export function jsonChangedPaths(before: unknown, after: unknown, path = ""): string[] {
  if (sameScalar(before, after)) return [];
  if (Array.isArray(before) && Array.isArray(after)) {
    const result: string[] = [];
    const length = Math.max(before.length, after.length);
    for (let index = 0; index < length; index += 1) {
      result.push(...jsonChangedPaths(before[index], after[index], `${path}/${index}`));
    }
    return result;
  }
  if (isRecord(before) && isRecord(after)) {
    const result: string[] = [];
    const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
    for (const key of keys) {
      result.push(...jsonChangedPaths(before[key], after[key], `${path}/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`));
    }
    return result;
  }
  return [path || "/"];
}
