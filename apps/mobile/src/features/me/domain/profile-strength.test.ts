import { describe, expect, it } from "vitest";

import type { Profile } from "@cherry/contracts";

import { assessProfileStrength } from "./profile-strength";

function tag(id: string) {
  return { id, slug: id, label: id, category: "interests", emoji: null };
}

function photo(position: number) {
  return { id: `ph-${position}`, storageKey: `k-${position}`, url: `https://x/${position}.jpg`, position, isActive: true };
}

function profile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: "me",
    displayName: "Lucía",
    birthDate: "1996-03-02",
    age: 30,
    gender: "woman",
    lookingFor: ["relationship"],
    whatIAmLookingFor: "relationship",
    bio: "Me encanta el cine de terror y los domingos de vermut.",
    isComplete: true,
    isPaused: false,
    isDiscoverable: true,
    hasLocation: true,
    photos: [photo(0), photo(1), photo(2), photo(3)],
    tags: [tag("a"), tag("b"), tag("c"), tag("d")],
    blockedTags: [],
    discoveryPreferences: null,
    insertedAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-01T00:00:00Z",
    ...overrides
  };
}

describe("assessProfileStrength", () => {
  it("celebrates a full profile without suggestions", () => {
    const strength = assessProfileStrength(profile());

    expect(strength.tone).toBe("shining");
    expect(strength.title).toBe("Tu perfil brilla");
    expect(strength.suggestions).toEqual([]);
  });

  it("offers optional polish when the profile is complete but has room to grow", () => {
    const strength = assessProfileStrength(profile({ photos: [photo(0), photo(1)], tags: [tag("a")] }));

    expect(strength.tone).toBe("polish");
    expect(strength.suggestions.map((s) => s.id)).toEqual(["photos-room", "tags-few"]);
    expect(strength.suggestions[0]?.text).toContain("2 fotos más");
    expect(strength.suggestions.every((s) => !s.essential)).toBe(true);
  });

  it("lists the essentials first when something required is missing", () => {
    const strength = assessProfileStrength(
      profile({ isComplete: false, photos: [photo(0)], tags: [], bio: "Hola" })
    );

    expect(strength.tone).toBe("incomplete");
    expect(strength.suggestions.map((s) => s.id)).toEqual(["photos-missing", "tags-missing", "bio-missing"]);
    expect(strength.suggestions[0]).toMatchObject({ href: "/(app)/edit/photos", essential: true });
    expect(strength.suggestions[0]?.text).toContain("1 foto más");
  });

  it("points to the filters when the backend says incomplete but the visible fields are fine", () => {
    const strength = assessProfileStrength(profile({ isComplete: false }));

    expect(strength.tone).toBe("incomplete");
    expect(strength.suggestions).toEqual([
      expect.objectContaining({ id: "preferences-missing", href: "/(app)/filters" })
    ]);
  });

  it("asks for the basics when any of them is missing", () => {
    const strength = assessProfileStrength(profile({ gender: null }));

    expect(strength.suggestions.map((s) => s.id)).toEqual(["basics-missing"]);
  });

  it("never blames: no suggestion text uses negative wording", () => {
    const strength = assessProfileStrength(
      profile({ isComplete: false, photos: [], tags: [], bio: null, displayName: null })
    );

    for (const suggestion of strength.suggestions) {
      expect(suggestion.text).not.toMatch(/\b(no has|deberías|error|mal)\b/i);
    }
  });
});
