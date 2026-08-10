import { describe, expect, it } from "vitest";
import { normalizeEntityName } from "./entity-resolver";

describe("entity name normalization", () => {
  it("normalizes width, spacing and case for stable long-term identity", () => {
    expect(normalizeEntityName("  Ａpp   Store  ")).toBe("app store");
  });

  it("keeps meaningful Chinese characters", () => {
    expect(normalizeEntityName("  楼下 那家包子店 ")).toBe("楼下 那家包子店");
  });
});
