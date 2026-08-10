import { describe, expect, it } from "vitest";
import { calculateSocialScore, socialReasonLabel } from "./social-service";

describe("social projection disclosure", () => {
  it("does not expose a coarse geohash as a user-facing reason", () => {
    expect(socialReasonLabel("geo_cell", "匿名地点网格")).toBe("共同到访过相近区域（约 1 公里）");
  });

  it("keeps a confirmed public place understandable", () => {
    expect(socialReasonLabel("place", "商店A")).toBe("共同地点：商店A");
  });
});

describe("social score", () => {
  it("keeps one ordinary shared feature below the default discovery threshold", () => {
    expect(calculateSocialScore([{ contribution: 1 }])).toBe(51);
  });

  it("combines breadth and repeated strength", () => {
    expect(calculateSocialScore([{ contribution: 1 }, { contribution: 1 }])).toBe(70);
  });

  it("never presents certainty as 100 percent", () => {
    expect(calculateSocialScore(Array.from({ length: 20 }, () => ({ contribution: 10 })))).toBe(99);
  });
});
