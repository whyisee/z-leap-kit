import { describe, expect, it } from "vitest";
import { decayedInferenceConfidence } from "./insight-service";

describe("decayedInferenceConfidence", () => {
  it("gains confidence from repeated evidence and halves over one half-life", () => {
    const fresh = decayedInferenceConfidence(8, 0);
    expect(fresh).toBeGreaterThan(decayedInferenceConfidence(3, 0));
    expect(decayedInferenceConfidence(8, 90)).toBeCloseTo(fresh / 2);
  });

  it("never reaches zero for stale evidence", () => {
    expect(decayedInferenceConfidence(3, 10_000)).toBe(0.05);
  });
});
