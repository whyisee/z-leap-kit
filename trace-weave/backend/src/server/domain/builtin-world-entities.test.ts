import { describe, expect, it } from "vitest";
import { builtinWorldEntities } from "./builtin-world-entities";

describe("built-in world entity catalog", () => {
  it("uses stable unique source ids and canonical identities", () => {
    const externalIds = builtinWorldEntities.map((item) => item.externalId);
    const canonicalKeys = builtinWorldEntities.map(
      (item) => `${item.entityType}:${item.canonicalName.trim().toLocaleLowerCase("zh-CN")}`,
    );

    expect(new Set(externalIds).size).toBe(externalIds.length);
    expect(new Set(canonicalKeys).size).toBe(canonicalKeys.length);
    expect(builtinWorldEntities.length).toBeGreaterThanOrEqual(50);
  });

  it("does not repeat aliases within an entity", () => {
    for (const item of builtinWorldEntities) {
      const aliases = [item.canonicalName, ...(item.aliases ?? [])]
        .map((alias) => alias.trim().toLocaleLowerCase("zh-CN"));
      expect(new Set(aliases).size, item.externalId).toBe(aliases.length);
    }
  });
});
