import { describe, expect, it } from "vitest";

import { formatAppVersion, normalizeSourceUrl, resolveSourceUrl } from "./app-info";
import { deleteAccountConsequences } from "./delete-account";

describe("deleteAccountConsequences", () => {
  it("covers what the backend really does: hidden profile, closed sessions, deactivated account", () => {
    expect(deleteAccountConsequences).toHaveLength(3);
    expect(deleteAccountConsequences.join(" ")).not.toMatch(/borramos todos tus datos/i);
  });
});

describe("resolveSourceUrl", () => {
  it("prefers the Expo extra config", () => {
    expect(resolveSourceUrl({ sourceUrl: "https://git.example.org/cherry" }, "https://other.example")).toBe(
      "https://git.example.org/cherry"
    );
  });

  it("falls back to EXPO_PUBLIC_SOURCE_URL", () => {
    expect(resolveSourceUrl({}, " https://codeberg.org/cherry/cherry ")).toBe("https://codeberg.org/cherry/cherry");
  });

  it("returns null when nothing valid is configured", () => {
    expect(resolveSourceUrl(undefined, undefined)).toBeNull();
    expect(normalizeSourceUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeSourceUrl("not a url")).toBeNull();
  });
});

describe("formatAppVersion", () => {
  it("formats the version with an optional build number", () => {
    expect(formatAppVersion("0.4.1")).toBe("0.4.1");
    expect(formatAppVersion("0.4.1", "12")).toBe("0.4.1 (12)");
    expect(formatAppVersion(undefined)).toBeNull();
  });
});
