import { describe, expect, it } from "vitest";

import type { Profile } from "@snack/contracts";

import {
  describeBasics,
  describeBio,
  describeFilters,
  describePhotoCount,
  describeTagCount
} from "./profile-summaries";
import { toSelfPerson } from "./self-person";

const baseProfile = {
  id: "me",
  displayName: "Lucía",
  age: 30,
  gender: "woman",
  whatIAmLookingFor: "go_with_the_flow",
  bio: "Me encanta el cine de terror.",
  photos: [
    { id: "b", storageKey: "k2", url: "https://x/2.jpg", position: 2, isActive: true },
    { id: "a", storageKey: "k1", url: "https://x/1.jpg", position: 1, isActive: true },
    { id: "c", storageKey: "k3", url: "https://x/3.jpg", position: 3, isActive: false }
  ],
  tags: [{ id: "t1", slug: "cine", label: "Cine", category: "interests", emoji: "🎬" }]
} as unknown as Profile;

describe("toSelfPerson", () => {
  it("shows only active photos in order and never marks tags as shared", () => {
    const person = toSelfPerson(baseProfile);

    expect(person.photos.map((photo) => photo.id)).toEqual(["a", "b"]);
    expect(person.tags).toEqual([expect.objectContaining({ id: "t1", shared: false })]);
    expect(person).toMatchObject({ distanceLabel: null, likedYou: false, sharedTagsCount: 0 });
  });

  it("falls back to «Tú» without a name", () => {
    expect(toSelfPerson({ ...baseProfile, displayName: "  " }).displayName).toBe("Tú");
  });
});

describe("profile summaries", () => {
  it("describes the basics in your own voice", () => {
    expect(describeBasics(baseProfile)).toBe("30 años · Mujer · A ver qué pasa");
    expect(describeBasics({ age: null, gender: null, whatIAmLookingFor: null })).toBe("Por completar");
  });

  it("counts photos and tags against their limits", () => {
    expect(describePhotoCount(3)).toBe("3 de 4");
    expect(describeTagCount(5)).toBe("5 de 8");
  });

  it("previews the bio", () => {
    expect(describeBio(null)).toBe("Sin escribir todavía");
    expect(describeBio("Hola   mundo")).toBe("Hola mundo");
    expect(describeBio("x".repeat(60), 10)).toBe(`${"x".repeat(9)}…`);
  });

  it("summarises the search filters", () => {
    expect(
      describeFilters({
        ageMin: 25,
        ageMax: 35,
        distanceKm: 30,
        showMen: true,
        showWomen: false,
        showNonBinary: true,
        compatibleOnly: false,
        expandDistance: true,
        discoveryMode: "swipe"
      })
    ).toBe("25–35 años · 30 km");
    expect(describeFilters(null)).toBeNull();
  });
});
