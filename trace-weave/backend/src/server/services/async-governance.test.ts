import { describe, expect, it } from "vitest";
import { deletionRetryDelaySeconds } from "./data-governance-service";
import { outboxRetryDelaySeconds } from "./outbox-service";

describe("outbox retry schedule", () => {
  it("backs off exponentially from one second", () => {
    expect([1, 2, 3, 4, 5].map(outboxRetryDelaySeconds)).toEqual([1, 2, 4, 8, 16]);
  });

  it("caps retries at one hour", () => {
    expect(outboxRetryDelaySeconds(50)).toBe(3600);
  });
});

describe("account deletion retry schedule", () => {
  it("uses a slower exponential schedule for destructive work", () => {
    expect([1, 2, 3, 4].map(deletionRetryDelaySeconds)).toEqual([5, 10, 20, 40]);
  });

  it("caps retries at one hour", () => {
    expect(deletionRetryDelaySeconds(50)).toBe(3600);
  });
});
