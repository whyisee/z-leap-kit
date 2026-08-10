import { describe, expect, it } from "vitest";
import { classifyLocationSensitivity, encodeGeohash } from "./location-context";

describe("location context", () => {
  it("encodes stable geohashes at exact and social precision", () => {
    expect(encodeGeohash(42.6, -5.6, 5)).toBe("ezs42");
    expect(encodeGeohash(39.9042, 116.4074, 10)).toBe("wx4g0bm6c4");
    expect(encodeGeohash(39.9042, 116.4074, 6)).toBe("wx4g0b");
  });

  it("marks private and sensitive labels as ineligible for matching", () => {
    expect(classifyLocationSensitivity("我家")).toBe("sensitive");
    expect(classifyLocationSensitivity("协和医院")).toBe("sensitive");
    expect(classifyLocationSensitivity("商店 A")).toBe("normal");
  });
});
