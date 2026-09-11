import { describe, expect, it } from "vitest";

import { createBootstrapConfig } from "./config";

describe("createBootstrapConfig", () => {
  it("builds the bootstrap config map for runtime feature flags", () => {
    expect(
      createBootstrapConfig({
        features: {
          beta: { enabled: false },
          darkMode: { enabled: true }
        }
      })
    ).toEqual({
      features: {
        beta: { enabled: false },
        darkMode: { enabled: true }
      }
    });
  });
});
