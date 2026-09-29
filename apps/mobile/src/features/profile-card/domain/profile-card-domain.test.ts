import { describe, expect, it } from "vitest";

import type { DiscoveryProfileCard, ProfileTag, PublicProfile } from "@snack/contracts";

import { profileBadges } from "./badges";
import { describeIntent } from "./intent";
import {
  groupOtherTagsByCategory,
  nameWithAge,
  sharedTags,
  sortTagsForDisplay,
  toProfilePerson
} from "./person";

function tag(overrides: Partial<ProfileTag> = {}): ProfileTag {
  return {
    id: "t1",
    slug: "music",
    label: "Música",
    category: "interests",
    sortOrder: 1,
    emoji: "🎵",
    shared: false,
    ...overrides
  };
}

function card(overrides: Partial<DiscoveryProfileCard> = {}): DiscoveryProfileCard {
  return {
    id: "p1",
    displayName: "Lucía",
    age: 29,
    bio: "Hola",
    gender: "woman",
    whatIAmLookingFor: "relationship",
    distanceLabel: "Cerca de ti",
    distanceKmApprox: 1,
    score: 10,
    sharedTagsCount: 1,
    photoUrl: "https://x/1.jpg",
    photoCount: 2,
    photos: [
      { id: "b", url: "https://x/2.jpg", position: 2 },
      { id: "a", url: "https://x/1.jpg", position: 1 }
    ],
    tags: [tag({ id: "t2", label: "Yoga", category: "active", shared: false }), tag({ shared: true })],
    likedYou: false,
    isNewcomer: false,
    beyondPreferredDistance: false,
    ...overrides
  };
}

describe("toProfilePerson", () => {
  it("normalizes a feed card: photos by position and shared tags first", () => {
    const person = toProfilePerson(card());

    expect(person.photos.map((photo) => photo.id)).toEqual(["a", "b"]);
    expect(person.tags.map((t) => t.id)).toEqual(["t1", "t2"]);
    expect(person.sharedTagsCount).toBe(1);
  });

  it("falls back to photoUrl when an old payload has no photos", () => {
    const person = toProfilePerson(card({ photos: [] }));

    expect(person.photos).toEqual([{ id: "p1-primary", url: "https://x/1.jpg", position: 1 }]);
  });

  it("derives sharedTagsCount and defaults for a public profile", () => {
    const profile: PublicProfile = {
      id: "p9",
      displayName: "Mar",
      age: 31,
      bio: null,
      gender: "non_binary",
      whatIAmLookingFor: "go_with_the_flow",
      distanceLabel: null,
      distanceKmApprox: null,
      photos: [],
      tags: [tag({ shared: true }), tag({ id: "t3", shared: true })],
      likedYou: true,
      youLiked: false,
      matchId: null,
      conversationId: null,
      isNewcomer: true
    };

    const person = toProfilePerson(profile);

    expect(person.sharedTagsCount).toBe(2);
    expect(person.beyondPreferredDistance).toBe(false);
    expect(person.photos).toEqual([]);
    expect(person.likedYou).toBe(true);
  });

  it("is idempotent", () => {
    const person = toProfilePerson(card());

    expect(toProfilePerson(person)).toBe(person);
  });
});

describe("tags", () => {
  it("sorts shared first, then catalog category order, then sortOrder", () => {
    const sorted = sortTagsForDisplay([
      tag({ id: "pets", category: "pets", sortOrder: 1 }),
      tag({ id: "int2", category: "interests", sortOrder: 2 }),
      tag({ id: "shared", category: "relationship", shared: true }),
      tag({ id: "int1", category: "interests", sortOrder: 1 })
    ]);

    expect(sorted.map((t) => t.id)).toEqual(["shared", "int1", "int2", "pets"]);
  });

  it("groups non-shared tags by category with Spanish labels", () => {
    const groups = groupOtherTagsByCategory([
      tag({ id: "a", category: "pets" }),
      tag({ id: "b", category: "interests", shared: true }),
      tag({ id: "c", category: "interests" }),
      tag({ id: "d", category: "future" })
    ]);

    expect(groups.map((g) => [g.label, g.tags.map((t) => t.id)])).toEqual([
      ["Intereses", ["c"]],
      ["Mascotas", ["a"]],
      ["Más cosas", ["d"]]
    ]);
    expect(sharedTags([tag({ id: "x" }), tag({ id: "y", shared: true })]).map((t) => t.id)).toEqual(["y"]);
  });
});

describe("profileBadges", () => {
  it("returns the badge system in a fixed order", () => {
    const badges = profileBadges(
      toProfilePerson(
        card({ isNewcomer: true, likedYou: true, sharedTagsCount: 3, beyondPreferredDistance: true })
      )
    );

    expect(badges.map((b) => b.kind)).toEqual(["newcomer", "likedYou", "shared", "farther"]);
    expect(badges.map((b) => b.label)).toEqual(["Nuevo", "Te dio like", "3 en común", "Un poco más lejos"]);
    expect(badges.every((b) => b.icon !== undefined && b.accessibilityLabel !== "")).toBe(true);
  });

  it("can hide shared and farther badges", () => {
    const badges = profileBadges(
      toProfilePerson(card({ sharedTagsCount: 2, beyondPreferredDistance: true })),
      { includeShared: false, includeFarther: false }
    );

    expect(badges).toEqual([]);
  });

  it("uses singular copy for one shared tag", () => {
    const [badge] = profileBadges(toProfilePerson(card({ sharedTagsCount: 1 })));

    expect(badge?.accessibilityLabel).toBe("1 etiqueta en común contigo");
  });
});

describe("describeIntent", () => {
  it("describes every known intent with icon and tone", () => {
    expect(describeIntent("relationship")?.label).toBe("Busca pareja");
    expect(describeIntent("go_with_the_flow")?.label).toBe("A ver qué pasa");
    expect(describeIntent("meet_people")?.icon).toBe("users");
  });

  it("tolerates unknown or empty values", () => {
    expect(describeIntent(null)).toBeNull();
    expect(describeIntent("space_travel")?.key).toBe("unknown");
  });
});

describe("nameWithAge", () => {
  it("joins name and age", () => {
    expect(nameWithAge({ displayName: "Lucía", age: 29 })).toBe("Lucía, 29");
    expect(nameWithAge({ displayName: "Lucía", age: null })).toBe("Lucía");
  });
});
