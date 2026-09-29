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
  it("has the eleven steps of the flow in order", () => {
    expect(ONBOARDING_STEP_KEYS).toEqual([
      "name",
      "birthday",
      "gender",
      "interested",
      "intent",
      "photos",
      "tags",
      "blocked-tags",
      "bio",
      "location",
      "done"
    ]);
  });

  it("marks only blocked-tags as optional", () => {
    expect(ONBOARDING_STEPS.filter((step) => step.optional).map((step) => step.key)).toEqual(["blocked-tags"]);
  });

  it("navigates forward and backward", () => {
    expect(nextStepKey("name")).toBe("birthday");
    expect(nextStepKey("tags")).toBe("blocked-tags");
    expect(nextStepKey("location")).toBe("done");
    expect(nextStepKey("done")).toBeNull();
    expect(previousStepKey("name")).toBeNull();
    expect(previousStepKey("bio")).toBe("blocked-tags");
    expect(stepsBefore("intent")).toEqual(["name", "birthday", "gender", "interested"]);
    expect(stepsBefore("name")).toEqual([]);
  });

  it("builds routes and reads them back from pathnames", () => {
    expect(stepRoute("blocked-tags")).toBe("/(onboarding)/blocked-tags");

    for (const key of ONBOARDING_STEP_KEYS) {
      expect(stepFromPathname(stepRoute(key))).toBe(key);
      // expo-router quita los grupos del pathname.
      expect(stepFromPathname(`/${key}`)).toBe(key);
    }

    expect(stepFromPathname("/photos?from=edit")).toBe("photos");
    expect(stepFromPathname("/")).toBeNull();
    expect(stepFromPathname("/discover")).toBeNull();
    expect(stepFromPathname(null)).toBeNull();
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
