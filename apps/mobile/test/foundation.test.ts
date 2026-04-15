import { describe, expect, it } from "vitest";

import { contractsPackageName } from "@snack/contracts";
import { mobileSharedPackageName } from "@snack/mobile-shared";
import { mobileFeatureLayers, mobileSharedLayers } from "../src/foundation";

describe("mobile test foundation", () => {
  it("resolves workspace packages and boundary metadata", () => {
    expect(contractsPackageName).toBe("@snack/contracts");
    expect(mobileSharedPackageName).toBe("@snack/mobile-shared");
    expect(mobileFeatureLayers).toEqual([
      "presentation",
      "application",
      "domain",
      "infrastructure"
    ]);
    expect(mobileSharedLayers).toEqual([
      "api",
      "config",
      "storage",
      "ui",
      "device"
    ]);
  });
});
