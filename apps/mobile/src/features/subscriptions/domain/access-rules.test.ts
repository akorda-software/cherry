import { describe, expect, it } from "vitest";

import { canAccess } from "./access-rules";

describe("canAccess", () => {
  it("grants access when the user has an active subscription", () => {
    expect(
      canAccess({
        subscribed: true,
        featureFlagEnabled: true
      })
    ).toBe(true);
  });

  it("denies access when the user is unsubscribed and the flag is enabled", () => {
    expect(
      canAccess({
        subscribed: false,
        featureFlagEnabled: true
      })
    ).toBe(false);
  });

  it("grants access when the feature flag is disabled (bypass paywall)", () => {
    expect(
      canAccess({
        subscribed: false,
        featureFlagEnabled: false
      })
    ).toBe(true);
  });

  it("grants access when subscribed but the feature flag is off", () => {
    expect(
      canAccess({
        subscribed: true,
        featureFlagEnabled: false
      })
    ).toBe(true);
  });

  it("denies access with default parameters (unsubscribed, flag on)", () => {
    expect(canAccess({ featureFlagEnabled: true })).toBe(false);
  });
});
