import { describe, expect, it } from "vitest";

import type { OnboardingStep } from "@cherry/contracts";

import { makePhoto, makePreferences, makeProfile, makeTag } from "../testing/fixtures";
import {
  activePhotoCount,
  firstIncompleteStep,
  profileStepCompletion,
  resolveResumeStep,
  stepForBackendStep,
  stepForMissingFields
} from "./resume";
import { ONBOARDING_STEP_KEYS, stepIndex } from "./steps";

const NOW = new Date("2026-09-29T12:00:00Z");

describe("firstIncompleteStep", () => {
  it("starts at name when the profile does not exist yet", () => {
    expect(firstIncompleteStep(null, NOW)).toBe("name");
    expect(firstIncompleteStep(undefined, NOW)).toBe("name");
  });

  it("returns done for a profile that satisfies every required step", () => {
    expect(firstIncompleteStep(makeProfile(), NOW)).toBe("done");
  });

  // Cada fila rompe UN campo de un perfil completo y espera caer en su paso.
  const singleGaps: Array<[string, Parameters<typeof makeProfile>[0], string]> = [
    ["empty name", { displayName: "" }, "name"],
    ["whitespace name", { displayName: "   " }, "name"],
    ["null name", { displayName: null }, "name"],
    ["name over 50 chars", { displayName: "a".repeat(51) }, "name"],
    ["missing birth date", { birthDate: null }, "birthday"],
    ["under-18 birth date", { birthDate: "2010-02-01" }, "birthday"],
    ["malformed birth date", { birthDate: "1996-13-40" }, "birthday"],
    ["missing gender", { gender: null }, "gender"],
    ["unknown gender", { gender: "other" as never }, "gender"],
    ["no discovery preferences", { discoveryPreferences: null }, "interested"],
    [
      "preferences without anybody selected",
      { discoveryPreferences: makePreferences({ showMen: false, showWomen: false, showNonBinary: false }) },
      "interested"
    ],
    ["missing intent", { lookingFor: [], whatIAmLookingFor: null }, "intent"],
    ["unknown intent", { lookingFor: ["friends"] as never, whatIAmLookingFor: "friends" as never }, "intent"],
    ["no photos", { photos: [] }, "photos"],
    ["one photo", { photos: [makePhoto(1)] }, "photos"],
    ["two photos but one deleted", { photos: [makePhoto(1), makePhoto(2, { isActive: false })] }, "photos"],
    ["no tags", { tags: [] }, "tags"],
    ["missing bio", { bio: null }, "bio"],
    ["short bio", { bio: "Hola, soy yo" }, "bio"],
    ["bio of spaces", { bio: " ".repeat(30) }, "bio"],
    ["bio too long", { bio: "a".repeat(241) }, "bio"],
    ["no location", { hasLocation: false }, "location"]
  ];

  it.each(singleGaps)("%s → %s", (_label, overrides, expected) => {
    expect(firstIncompleteStep(makeProfile(overrides), NOW)).toBe(expected);
  });

  it("accepts the backend minimum of 1 positive tag when resuming (no bounce back to tags)", () => {
    expect(firstIncompleteStep(makeProfile({ tags: [makeTag(1)] }), NOW)).toBe("done");
    expect(firstIncompleteStep(makeProfile({ tags: [makeTag(1), makeTag(2)] }), NOW)).toBe("done");
  });

  it("follows THE FLOW order, not the backend order (photos after intent, tags before bio)", () => {
    // Backend lista bio y fotos antes que las preferencias; el flujo pregunta primero «interested».
    const profile = makeProfile({ bio: null, photos: [], discoveryPreferences: null });
    expect(firstIncompleteStep(profile, NOW)).toBe("interested");

    expect(firstIncompleteStep(makeProfile({ bio: null, tags: [] }), NOW)).toBe("tags");
    expect(firstIncompleteStep(makeProfile({ hasLocation: false, bio: null }), NOW)).toBe("bio");
    expect(firstIncompleteStep(makeProfile({ photos: [], lookingFor: [], whatIAmLookingFor: null }), NOW)).toBe("intent");
  });

  it("never sends anyone back just for having no blocked tags", () => {
    const profile = makeProfile({ blockedTags: [] });
    expect(firstIncompleteStep(profile, NOW)).toBe("done");
  });

  it("resumes a fresh draft that only has a name at birthday", () => {
    const draft = makeProfile({
      birthDate: null,
      age: null,
      gender: null,
      lookingFor: [],
      whatIAmLookingFor: null,
      bio: null,
      hasLocation: false,
      photos: [],
      tags: [],
      discoveryPreferences: null
    });
    expect(firstIncompleteStep(draft, NOW)).toBe("birthday");
  });

  it("walks every step in order as the profile gets filled", () => {
    const empty = makeProfile({
      displayName: null,
      birthDate: null,
      gender: null,
      discoveryPreferences: null,
      lookingFor: [],
      whatIAmLookingFor: null,
      photos: [],
      tags: [],
      bio: null,
      hasLocation: false
    });
    const fills: Array<[string, Parameters<typeof makeProfile>[0]]> = [
      ["name", { displayName: "Lucía" }],
      ["birthday", { birthDate: "1996-05-14" }],
      ["gender", { gender: "woman" }],
      ["interested", { discoveryPreferences: makePreferences() }],
      ["intent", { lookingFor: ["go_with_the_flow"], whatIAmLookingFor: "go_with_the_flow" }],
      ["photos", { photos: [makePhoto(1), makePhoto(3)] }],
      ["tags", { tags: [makeTag(1)] }],
      ["bio", { bio: "Una bio de más de veinte caracteres." }],
      ["location", { hasLocation: true }]
    ];

    let profile = empty;
    for (const [expected, patch] of fills) {
      expect(firstIncompleteStep(profile, NOW)).toBe(expected);
      profile = { ...profile, ...patch };
    }
    expect(firstIncompleteStep(profile, NOW)).toBe("done");
  });

  it("treats the 18th birthday with the backend rule (UTC day, birthday reached)", () => {
    const turning18Today = makeProfile({ birthDate: "2008-09-29" });
    const turning18Tomorrow = makeProfile({ birthDate: "2008-09-30" });
    expect(firstIncompleteStep(turning18Today, NOW)).toBe("done");
    expect(firstIncompleteStep(turning18Tomorrow, NOW)).toBe("birthday");
  });
});

describe("profileStepCompletion", () => {
  it("marks everything false for a missing profile", () => {
    expect(Object.values(profileStepCompletion(null, NOW)).every((value) => value === false)).toBe(true);
  });

  it("counts only active photos", () => {
    const profile = makeProfile({ photos: [makePhoto(1), makePhoto(2, { isActive: false }), makePhoto(3)] });
    expect(activePhotoCount(profile)).toBe(2);
    expect(profileStepCompletion(profile, NOW).photos).toBe(true);
  });

  it("rejects more than 4 active photos (corrupt state)", () => {
    const profile = makeProfile({ photos: [1, 2, 3, 4, 5].map((position) => makePhoto(position)) });
    expect(profileStepCompletion(profile, NOW).photos).toBe(false);
  });
});

describe("stepForBackendStep (bootstrap fallback)", () => {
  const cases: Array<[OnboardingStep, string]> = [
    ["name", "name"],
    ["birth_date", "birthday"],
    ["gender", "gender"],
    ["intent", "intent"],
    ["bio", "bio"],
    ["photos", "photos"],
    ["interested_in", "interested"],
    ["discovery_preferences", "interested"],
    ["tags", "tags"],
    ["location", "location"]
  ];

  it.each(cases)("%s → %s", (backendStep, expected) => {
    expect(stepForBackendStep(backendStep)).toBe(expected);
  });

  it("maps a null step (nothing missing for backend) to done, which re-checks before confirming", () => {
    expect(stepForBackendStep(null)).toBe("done");
    expect(stepForBackendStep(undefined)).toBe("done");
  });

  it("returns null for unknown steps so the caller can decide", () => {
    expect(stepForBackendStep("preferences")).toBeNull();
    expect(stepForBackendStep("")).toBeNull();
  });

  it("covers every backend step with a real route", () => {
    for (const [backendStep] of cases) {
      const step = stepForBackendStep(backendStep);
      expect(step && ONBOARDING_STEP_KEYS.includes(step)).toBeTruthy();
    }
  });
});

describe("stepForMissingFields (profile_incomplete.missing[])", () => {
  it("maps each backend field to its step", () => {
    expect(stepForMissingFields(["display_name"])).toBe("name");
    expect(stepForMissingFields(["birth_date"])).toBe("birthday");
    expect(stepForMissingFields(["gender"])).toBe("gender");
    expect(stepForMissingFields(["what_i_am_looking_for"])).toBe("intent");
    expect(stepForMissingFields(["bio"])).toBe("bio");
    expect(stepForMissingFields(["photos"])).toBe("photos");
    expect(stepForMissingFields(["interested_in"])).toBe("interested");
    expect(stepForMissingFields(["discovery_preferences"])).toBe("interested");
    expect(stepForMissingFields(["tags"])).toBe("tags");
    expect(stepForMissingFields(["location"])).toBe("location");
  });

  it("picks the earliest step OF THE FLOW regardless of the backend list order", () => {
    // Orden real del backend: bio, photos, interested_in… pero en el flujo «interested» va antes.
    expect(stepForMissingFields(["bio", "photos", "interested_in", "tags", "location"])).toBe("interested");
    expect(stepForMissingFields(["location", "tags"])).toBe("tags");
    expect(stepForMissingFields(["bio", "tags"])).toBe("tags");
    expect(stepForMissingFields(["location", "bio"])).toBe("bio");
  });

  it("accepts camelCase field names and ignores unknown ones", () => {
    expect(stepForMissingFields(["whatIAmLookingFor"])).toBe("intent");
    expect(stepForMissingFields(["mystery", "birthDate"])).toBe("birthday");
    expect(stepForMissingFields(["mystery"])).toBeNull();
    expect(stepForMissingFields([])).toBeNull();
    expect(stepForMissingFields(null)).toBeNull();
  });
});

describe("resolveResumeStep", () => {
  it("prefers the profile when it could be loaded", () => {
    expect(resolveResumeStep({ source: "profile", profile: makeProfile({ bio: null }), now: NOW })).toBe("bio");
    expect(resolveResumeStep({ source: "profile", profile: null, now: NOW })).toBe("name");
  });

  it("falls back to the bootstrap hint and to name for unknown hints", () => {
    expect(resolveResumeStep({ source: "bootstrap", nextOnboardingStep: "photos" })).toBe("photos");
    expect(resolveResumeStep({ source: "bootstrap", nextOnboardingStep: null })).toBe("done");
    expect(resolveResumeStep({ source: "bootstrap", nextOnboardingStep: "whatever" })).toBe("name");
  });

  it("never resolves to the removed blocked-tags step (merged into tags)", () => {
    const steps = new Set<string>();
    const variants = [
      makeProfile(),
      makeProfile({ tags: [] }),
      makeProfile({ bio: null }),
      makeProfile({ blockedTags: [] }),
      makeProfile({ hasLocation: false })
    ];
    variants.forEach((profile) => steps.add(resolveResumeStep({ source: "profile", profile, now: NOW })));
    expect(steps.has("blocked-tags")).toBe(false);
    expect(ONBOARDING_STEP_KEYS).not.toContain("blocked-tags");
    // Quien tiene etiquetas y le falta la bio reanuda en bio, justo después de tags.
    expect(resolveResumeStep({ source: "profile", profile: makeProfile({ bio: null }), now: NOW })).toBe("bio");
    expect(stepIndex("bio")).toBe(stepIndex("tags") + 1);
  });
});
