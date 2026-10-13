import { describe, expect, it } from "vitest";

import {
  isOnboardingStepKey,
  nextStepKey,
  ONBOARDING_STEP_KEYS,
  ONBOARDING_STEPS,
  previousStepKey,
  stepFromPathname,
  stepProgress,
  stepRoute,
  stepsBefore
} from "./steps";

describe("onboarding steps", () => {
  it("has the ten steps of the flow in order (liked and blocked tags share one page)", () => {
    expect(ONBOARDING_STEP_KEYS).toEqual([
      "name",
      "birthday",
      "gender",
      "interested",
      "intent",
      "photos",
      "tags",
      "bio",
      "location",
      "done"
    ]);
  });

  it("has no optional steps left (blocking tags is optional inside the tags page)", () => {
    expect(ONBOARDING_STEPS.filter((step) => step.optional)).toEqual([]);
  });

  it("navigates forward and backward", () => {
    expect(nextStepKey("name")).toBe("birthday");
    expect(nextStepKey("tags")).toBe("bio");
    expect(nextStepKey("location")).toBe("done");
    expect(nextStepKey("done")).toBeNull();
    expect(previousStepKey("name")).toBeNull();
    expect(previousStepKey("bio")).toBe("tags");
    expect(stepsBefore("intent")).toEqual(["name", "birthday", "gender", "interested"]);
    expect(stepsBefore("name")).toEqual([]);
  });

  it("builds routes and reads them back from pathnames", () => {
    expect(stepRoute("tags")).toBe("/(onboarding)/tags");

    for (const key of ONBOARDING_STEP_KEYS) {
      expect(stepFromPathname(stepRoute(key))).toBe(key);
      // expo-router quita los grupos del pathname.
      expect(stepFromPathname(`/${key}`)).toBe(key);
    }

    expect(stepFromPathname("/photos?from=edit")).toBe("photos");
    expect(stepFromPathname("/")).toBeNull();
    expect(stepFromPathname("/discover")).toBeNull();
    expect(stepFromPathname(null)).toBeNull();
    expect(stepFromPathname("/toString")).toBeNull();
  });

  it("maps the old blocked-tags route onto the merged tags page", () => {
    expect(isOnboardingStepKey("blocked-tags")).toBe(false);
    expect(stepFromPathname("/blocked-tags")).toBe("tags");
    expect(stepFromPathname("/(onboarding)/blocked-tags")).toBe("tags");
  });

  it("grows the progress monotonically up to 100% at done", () => {
    const values = ONBOARDING_STEP_KEYS.map(stepProgress);
    values.forEach((value, index) => {
      expect(value).toBeGreaterThan(0);
      if (index > 0) expect(value).toBeGreaterThan(values[index - 1]);
    });
    expect(stepProgress("done")).toBe(1);
  });

  it("recognises step keys", () => {
    expect(isOnboardingStepKey("bio")).toBe(true);
    expect(isOnboardingStepKey("profile")).toBe(false);
    expect(isOnboardingStepKey(42)).toBe(false);
  });
});
