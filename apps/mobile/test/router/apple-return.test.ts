import { describe, expect, it } from "vitest";
import { redirectSystemPath } from "../../app/+native-intent";

describe("Apple browser return ownership", () => {
  it.each(["cherry-dev://auth/apple?code=synthetic&state=test", "cherry://auth/apple?error=test", "/auth/apple?code=test"])("keeps an in-flight linking screen mounted for %s", (path) => {
    expect(redirectSystemPath({ path, initial: false })).toBeNull();
    expect(redirectSystemPath({ path, initial: true })).toBe("/");
  });
  it("does not swallow other routes or broader path matches", () => {
    for (const path of ["cherry://auth/apple-other", "cherry://profile/123", "/auth/apple/history"])
      expect(redirectSystemPath({ path, initial: false })).toBe(path);
  });
});
