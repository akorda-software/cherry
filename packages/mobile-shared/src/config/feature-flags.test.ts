import { describe, expect, it } from "vitest";

import type { BootstrapConfig } from "@snack/contracts";
import { createFeatureFlagReader } from "./feature-flags";

describe("createFeatureFlagReader", () => {
  it("reads a subscription flag enabled from the bootstrap response", () => {
    const bootstrap: BootstrapConfig = {
      features: {
        subscriptions: { enabled: true }
      }
    };

    const reader = createFeatureFlagReader(bootstrap);
    expect(reader.isEnabled("subscriptions")).toBe(true);
  });

  it("returns false when the subscriptions flag is disabled", () => {
    const bootstrap: BootstrapConfig = {
      features: {
        subscriptions: { enabled: false }
      }
    };

    const reader = createFeatureFlagReader(bootstrap);
    expect(reader.isEnabled("subscriptions")).toBe(false);
  });

  it("returns false for a flag that does not exist in the bootstrap response", () => {
    const bootstrap: BootstrapConfig = {
      features: {}
    };

    const reader = createFeatureFlagReader(bootstrap);
    expect(reader.isEnabled("subscriptions")).toBe(false);
  });

  it("returns false for any unknown flag key", () => {
    const bootstrap: BootstrapConfig = {
      features: {
        subscriptions: { enabled: true }
      }
    };

    const reader = createFeatureFlagReader(bootstrap);
    expect(reader.isEnabled("nonexistent")).toBe(false);
  });

  it("reads multiple flags independently from the same bootstrap", () => {
    const bootstrap: BootstrapConfig = {
      features: {
        subscriptions: { enabled: true },
        darkMode: { enabled: false }
      }
    };

    const reader = createFeatureFlagReader(bootstrap);
    expect(reader.isEnabled("subscriptions")).toBe(true);
    expect(reader.isEnabled("darkMode")).toBe(false);
  });
});
