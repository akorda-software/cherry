import { describe, expect, it } from "vitest";

import { makePreferences } from "../testing/fixtures";
import {
  buildInterestedPreferences,
  DEFAULT_DISTANCE_KM,
  defaultAgeRange,
  interestedFromPreferences,
  toggleInterested
} from "./preferences";

describe("defaultAgeRange", () => {
  it("goes from age-6 to age+8", () => {
    expect(defaultAgeRange(30)).toEqual({ ageMin: 24, ageMax: 38 });
    expect(defaultAgeRange(29)).toEqual({ ageMin: 23, ageMax: 37 });
  });

  it("never goes under 18 nor over 99", () => {
    expect(defaultAgeRange(18)).toEqual({ ageMin: 18, ageMax: 26 });
    expect(defaultAgeRange(21)).toEqual({ ageMin: 18, ageMax: 29 });
    expect(defaultAgeRange(95)).toEqual({ ageMin: 89, ageMax: 99 });
  });

  it("keeps min ≤ max even for very old ages", () => {
    const range = defaultAgeRange(110);
    expect(range.ageMin).toBeLessThanOrEqual(range.ageMax);
    expect(range).toEqual({ ageMin: 99, ageMax: 99 });
  });

  it("uses the full range when the age is unknown", () => {
    expect(defaultAgeRange(null)).toEqual({ ageMin: 18, ageMax: 99 });
    expect(defaultAgeRange(Number.NaN)).toEqual({ ageMin: 18, ageMax: 99 });
  });
});

describe("buildInterestedPreferences", () => {
  it("creates smart defaults the first time", () => {
    expect(buildInterestedPreferences(null, ["women", "non_binary"], 29)).toEqual({
      ageMin: 23,
      ageMax: 37,
      distanceKm: DEFAULT_DISTANCE_KM,
      expandDistance: true,
      discoveryMode: "swipe",
      showMen: false,
      showWomen: true,
      showNonBinary: true
    });
  });

  it("only changes the flags when preferences already exist", () => {
    const existing = makePreferences({ ageMin: 30, ageMax: 45, distanceKm: 100, discoveryMode: "feed" });
    expect(buildInterestedPreferences(existing, ["men"], 29)).toEqual({
      ageMin: 30,
      ageMax: 45,
      distanceKm: 100,
      showMen: true,
      showWomen: false,
      showNonBinary: false
    });
  });

  it("uses a distance accepted by the backend", () => {
    expect([10, 25, 50, 100, 999_999]).toContain(buildInterestedPreferences(null, ["men"], 40).distanceKm);
  });
});

describe("interested ⇄ flags", () => {
  it("reads the flags in a stable order", () => {
    expect(interestedFromPreferences(makePreferences({ showMen: true, showWomen: true, showNonBinary: true }))).toEqual([
      "women",
      "men",
      "non_binary"
    ]);
    expect(interestedFromPreferences(null)).toEqual([]);
  });

  it("toggles options keeping the canonical order", () => {
    expect(toggleInterested([], "non_binary")).toEqual(["non_binary"]);
    expect(toggleInterested(["non_binary"], "women")).toEqual(["women", "non_binary"]);
    expect(toggleInterested(["women", "non_binary"], "women")).toEqual(["non_binary"]);
  });
});
