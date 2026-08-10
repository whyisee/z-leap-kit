import { describe, expect, it } from "vitest";
import {
  resolveEffectiveEventPrivacy,
  type PrivacyPolicyLayer,
} from "./privacy-policy-service";

function layer(
  level: PrivacyPolicyLayer["level"],
  values: Partial<Omit<PrivacyPolicyLayer, "level" | "subjectKey" | "version">>,
  subjectKey = "*",
  version = 1,
): PrivacyPolicyLayer {
  return {
    level,
    subjectKey,
    version,
    contentVisibility: null,
    allowAnonymousStats: null,
    allowMatching: null,
    allowIdentityDisclosure: null,
    allowSharedOccurrence: null,
    ...values,
  };
}

function resolve(input?: {
  userDefault?: PrivacyPolicyLayer;
  category?: PrivacyPolicyLayer;
  entities?: PrivacyPolicyLayer[];
  event?: PrivacyPolicyLayer;
  sensitive?: boolean;
  eligible?: boolean;
}) {
  return resolveEffectiveEventPrivacy({
    eventId: "event-1",
    policyOwnerUserId: "user-1",
    eventOwnerUserId: "user-1",
    eventType: "eat",
    layers: {
      userDefault: input?.userDefault,
      category: input?.category,
      entities: input?.entities ?? [],
      event: input?.event,
    },
    sensitiveMatchExcluded: input?.sensitive ?? false,
    eligibleMatchingFact: input?.eligible ?? true,
  });
}

describe("privacy policy resolution", () => {
  it("defaults every derived use to private and denied", () => {
    const policy = resolve();
    expect(policy).toMatchObject({
      contentVisibility: "private",
      allowAnonymousStats: false,
      effectiveMatching: false,
      allowIdentityDisclosure: false,
      allowSharedOccurrence: false,
    });
  });

  it("uses event over entity, category and user values", () => {
    const policy = resolve({
      userDefault: layer("user_default", { allowMatching: true, allowSharedOccurrence: false }),
      category: layer("activity_category", { allowSharedOccurrence: false }, "eat"),
      entities: [layer("entity", { allowSharedOccurrence: false }, "entity-1")],
      event: layer("event", { allowSharedOccurrence: true }, "event-1", 4),
    });
    expect(policy.allowSharedOccurrence).toBe(true);
    expect(policy.sources.allowSharedOccurrence).toMatchObject({ level: "event", version: 4 });
  });

  it("uses the strictest value when multiple entity policies apply", () => {
    const policy = resolve({
      userDefault: layer("user_default", { allowMatching: true }),
      entities: [
        layer("entity", { allowMatching: true }, "entity-1"),
        layer("entity", { allowMatching: false }, "entity-2"),
      ],
    });
    expect(policy.allowMatching).toBe(false);
    expect(policy.sources.allowMatching).toMatchObject({ level: "entity" });
  });

  it("requires the global discovery gate even when an event opts in", () => {
    const policy = resolve({
      userDefault: layer("user_default", { allowMatching: false }),
      event: layer("event", { allowMatching: true }, "event-1"),
    });
    expect(policy.allowMatching).toBe(true);
    expect(policy.effectiveMatching).toBe(false);
    expect(policy.sources.allowMatching.reason).toContain("全局关系发现");
  });

  it("forces isolated and sensitive events out of derived matching", () => {
    const isolated = resolve({
      userDefault: layer("user_default", { allowMatching: true, allowAnonymousStats: true }),
      event: layer("event", { contentVisibility: "isolated", allowMatching: true }, "event-1"),
    });
    expect(isolated).toMatchObject({
      contentVisibility: "isolated",
      allowAnonymousStats: false,
      effectiveMatching: false,
      allowSharedOccurrence: false,
    });

    const sensitive = resolve({
      userDefault: layer("user_default", { allowMatching: true }),
      sensitive: true,
    });
    expect(sensitive.effectiveMatching).toBe(false);
    expect(sensitive.sources.allowMatching.reason).toContain("敏感");
  });
});
